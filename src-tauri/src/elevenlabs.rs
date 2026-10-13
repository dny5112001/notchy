//! ElevenLabs voices. Each line is synthesised once and cached on disk, so repeats play
//! instantly and stay in step with the notch.

use crate::settings::Settings;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const API: &str = "https://api.elevenlabs.io";
pub const ENGINE: &str = "elevenlabs";

pub struct ElevenLabs {
    key: Mutex<Option<String>>,
    key_path: Option<PathBuf>,
    cache_dir: Option<PathBuf>,
    client: reqwest::Client,
    /// Bumped whenever a new prefetch starts, so an outdated one stops early.
    prefetch_run: AtomicU64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ElevenVoice {
    pub id: String,
    pub name: String,
    pub description: String,
    pub accent: String,
    pub gender: String,
    pub preview_url: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct ElevenModel {
    pub id: String,
    pub name: String,
}

/// Everything that changes how a line sounds, and so belongs in its cache key.
#[derive(Clone)]
pub struct Request {
    voice_id: String,
    model: String,
    speed: f32,
    stability: f32,
    style: f32,
    /// ISO 639-1, set for Hindi so Devanagari gets native pronunciation.
    language: Option<&'static str>,
}

impl Request {
    /// `None` unless the ElevenLabs engine is selected and a voice is picked.
    pub fn from_settings(s: &Settings) -> Option<Self> {
        let voice_id = s
            .persona_voices
            .get(&s.personality)
            .filter(|v| !v.is_empty())
            .unwrap_or(&s.eleven_voice)
            .clone();
        if s.engine != ENGINE || voice_id.is_empty() {
            return None;
        }
        // Looser stability lets the voice act more; the dramatic one gets the most room.
        // The comedian gets the loosest, most exaggerated delivery.
        let (stability, style) = match s.personality.as_str() {
            "tapori" => (0.22, 0.75),
            "dramatic" => (0.3, 0.5),
            "sassy" => (0.4, 0.4),
            _ => (0.5, 0.35),
        };
        Some(Self {
            voice_id,
            model: s.eleven_model.clone(),
            speed: (s.rate as f32 / 185.0).clamp(0.7, 1.2),
            stability,
            style,
            language: (s.language == "hindi").then_some("hi"),
        })
    }
}

#[derive(Serialize, Clone)]
pub struct CacheProgress {
    pub ready: usize,
    pub total: usize,
    pub busy: bool,
    pub error: Option<String>,
}

impl ElevenLabs {
    pub fn load(app: &AppHandle) -> Self {
        let key_path = app.path().app_config_dir().ok().map(|d| d.join("elevenlabs.key"));
        let key = key_path
            .as_ref()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty());
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(8))
            .build()
            .expect("HTTP client");
        Self {
            key: Mutex::new(key),
            key_path,
            cache_dir: app.path().app_cache_dir().ok().map(|d| d.join("tts")),
            client,
            prefetch_run: AtomicU64::new(0),
        }
    }

    pub fn has_key(&self) -> bool {
        self.key.lock().unwrap().is_some()
    }

    fn key(&self) -> Result<String, String> {
        self.key.lock().unwrap().clone().ok_or_else(|| "Add your ElevenLabs API key first.".into())
    }

    /// Checks the key against the API before saving it. `None` removes it.
    pub async fn set_key(&self, key: Option<String>) -> Result<(), String> {
        let Some(path) = &self.key_path else { return Err("No config folder".into()) };
        match key.map(|k| k.trim().to_string()).filter(|k| !k.is_empty()) {
            Some(key) => {
                self.fetch_voices(&key).await?;
                if let Some(dir) = path.parent() {
                    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
                }
                write_private(path, &key)?;
                *self.key.lock().unwrap() = Some(key);
            }
            None => {
                let _ = std::fs::remove_file(path);
                *self.key.lock().unwrap() = None;
            }
        }
        Ok(())
    }

    pub async fn voices(&self) -> Result<Vec<ElevenVoice>, String> {
        let key = self.key()?;
        self.fetch_voices(&key).await
    }

    async fn fetch_voices(&self, key: &str) -> Result<Vec<ElevenVoice>, String> {
        #[derive(Deserialize)]
        struct Page {
            voices: Vec<Raw>,
        }
        #[derive(Deserialize)]
        struct Raw {
            voice_id: String,
            name: String,
            #[serde(default)]
            description: Option<String>,
            #[serde(default)]
            labels: std::collections::HashMap<String, String>,
            #[serde(default)]
            preview_url: Option<String>,
        }
        let response = self
            .client
            .get(format!("{API}/v2/voices?page_size=100&include_total_count=false"))
            .header("xi-api-key", key)
            .send()
            .await
            .map_err(network_error)?;
        let page: Page = check(response).await?.json().await.map_err(|e| e.to_string())?;
        Ok(page
            .voices
            .into_iter()
            .map(|v| ElevenVoice {
                id: v.voice_id,
                name: v.name,
                description: v.description.or_else(|| v.labels.get("descriptive").cloned()).unwrap_or_default(),
                accent: v.labels.get("accent").cloned().unwrap_or_default(),
                gender: v.labels.get("gender").cloned().unwrap_or_default(),
                preview_url: v.preview_url,
            })
            .collect())
    }

    pub async fn models(&self) -> Result<Vec<ElevenModel>, String> {
        #[derive(Deserialize)]
        struct Raw {
            model_id: String,
            name: String,
            #[serde(default)]
            can_do_text_to_speech: bool,
        }
        let response = self
            .client
            .get(format!("{API}/v1/models"))
            .header("xi-api-key", self.key()?)
            .send()
            .await
            .map_err(network_error)?;
        let models: Vec<Raw> = check(response).await?.json().await.map_err(|e| e.to_string())?;
        Ok(models
            .into_iter()
            .filter(|m| m.can_do_text_to_speech)
            .map(|m| ElevenModel { id: m.model_id, name: m.name })
            .collect())
    }

    fn cache_path(&self, req: &Request, text: &str) -> Option<PathBuf> {
        let id = format!(
            "{}|{}|{:.2}|{:.2}|{:.2}|{}",
            req.model, req.voice_id, req.speed, req.stability, req.style, text
        );
        Some(self.cache_dir.as_ref()?.join(format!("{:016x}.mp3", fnv1a(id.as_bytes()))))
    }

    pub fn cached(&self, req: &Request, text: &str) -> Option<PathBuf> {
        self.cache_path(req, text).filter(|p| p.exists())
    }

    /// The line's audio file, synthesising and caching it on a miss.
    pub async fn audio(&self, req: &Request, text: &str) -> Result<PathBuf, String> {
        let path = self.cache_path(req, text).ok_or("No cache folder")?;
        if path.exists() {
            return Ok(path);
        }
        let mut body = serde_json::json!({
            "text": text,
            "model_id": req.model,
            "voice_settings": {
                "stability": req.stability,
                "similarity_boost": 0.8,
                "style": req.style,
                "use_speaker_boost": true,
                "speed": req.speed,
            }
        });
        if let Some(code) = req.language.filter(|_| crate::voice::is_devanagari(text)) {
            body["language_code"] = code.into();
        }
        let response = self
            .client
            .post(format!("{API}/v1/text-to-speech/{}?output_format=mp3_44100_128", req.voice_id))
            .header("xi-api-key", self.key()?)
            .json(&body)
            .send()
            .await
            .map_err(network_error)?;
        let bytes = check(response).await?.bytes().await.map_err(|e| e.to_string())?;
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let tmp = path.with_extension("part");
        std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
        std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
        Ok(path)
    }

    pub fn progress(&self, req: &Request, lines: &[String]) -> CacheProgress {
        let ready = lines.iter().filter(|l| self.cached(req, l).is_some()).count();
        CacheProgress { ready, total: lines.len(), busy: false, error: None }
    }

    /// Synthesises every line that isn't cached yet, one at a time, reporting progress.
    pub fn prefetch(app: AppHandle, req: Request, lines: Vec<String>) {
        let run = app.state::<ElevenLabs>().prefetch_run.fetch_add(1, Ordering::SeqCst) + 1;
        tauri::async_runtime::spawn(async move {
            let this = app.state::<ElevenLabs>();
            let total = lines.len();
            let mut ready = this.progress(&req, &lines).ready;
            for line in &lines {
                if this.prefetch_run.load(Ordering::SeqCst) != run {
                    return;
                }
                if this.cached(&req, line).is_some() {
                    continue;
                }
                let _ = app.emit("voice-cache", CacheProgress { ready, total, busy: true, error: None });
                if let Err(error) = this.audio(&req, line).await {
                    let _ = app.emit("voice-cache", CacheProgress { ready, total, busy: false, error: Some(error) });
                    return;
                }
                ready += 1;
            }
            let _ = app.emit("voice-cache", CacheProgress { ready, total, busy: false, error: None });
        });
    }
}

async fn check(response: reqwest::Response) -> Result<reqwest::Response, String> {
    let status = response.status();
    if status.is_success() {
        return Ok(response);
    }
    let body = response.text().await.unwrap_or_default();
    let message = serde_json::from_str::<serde_json::Value>(&body)
        .ok()
        .and_then(|v| {
            let detail = v.get("detail")?;
            detail.get("message").or(Some(detail)).and_then(|m| m.as_str().map(String::from))
        });
    Err(match (status.as_u16(), message) {
        (401, _) => "ElevenLabs didn't accept that API key.".into(),
        (_, Some(m)) => m,
        (code, None) => format!("ElevenLabs returned HTTP {code}."),
    })
}

fn network_error(e: reqwest::Error) -> String {
    if e.is_timeout() { "ElevenLabs took too long to answer.".into() } else { "Couldn't reach ElevenLabs.".into() }
}

fn write_private(path: &std::path::Path, contents: &str) -> Result<(), String> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(contents.as_bytes()).map_err(|e| e.to_string())
}

/// Stable across builds, unlike std's hasher, so cache files survive updates.
fn fnv1a(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf2_9ce4_8422_2325, |h, b| (h ^ *b as u64).wrapping_mul(0x100_0000_01b3))
}
