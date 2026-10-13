use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub personality: String,
    pub language: String,
    pub voice_enabled: bool,
    pub voice: String,
    /// "apple" or "elevenlabs".
    pub engine: String,
    pub eleven_voice: String,
    /// ElevenLabs voice per personality, falling back to `eleven_voice`.
    pub persona_voices: std::collections::HashMap<String, String>,
    pub eleven_voice_name: String,
    pub eleven_model: String,
    pub sound_effects: bool,
    pub rate: u32,
    pub volume: f32,
    pub low_battery: u8,
    pub critical_battery: u8,
    pub quiet_enabled: bool,
    pub quiet_start: u8,
    pub quiet_end: u8,
    pub disabled_events: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            personality: "desi".into(),
            language: "english".into(),
            voice_enabled: true,
            voice: crate::voice::AUTO.into(),
            engine: "apple".into(),
            eleven_voice: String::new(),
            persona_voices: Default::default(),
            eleven_voice_name: String::new(),
            eleven_model: "eleven_v4".into(),
            sound_effects: true,
            rate: 185,
            volume: 0.8,
            low_battery: 20,
            critical_battery: 10,
            quiet_enabled: false,
            quiet_start: 23,
            quiet_end: 8,
            disabled_events: Vec::new(),
        }
    }
}

pub struct SettingsState {
    inner: Mutex<Settings>,
    path: Option<PathBuf>,
}

impl SettingsState {
    pub fn load(app: &AppHandle) -> Self {
        let path = app.path().app_config_dir().ok().map(|d| d.join("settings.json"));
        let settings = path
            .as_ref()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Self { inner: Mutex::new(settings), path }
    }

    pub fn get(&self) -> Settings {
        self.inner.lock().unwrap().clone()
    }

    pub fn set(&self, settings: Settings) -> Result<(), String> {
        if let Some(path) = &self.path {
            if let Some(dir) = path.parent() {
                std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
            }
            let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
            std::fs::write(path, json).map_err(|e| e.to_string())?;
        }
        *self.inner.lock().unwrap() = settings;
        Ok(())
    }
}
