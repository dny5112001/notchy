mod bluetooth;
mod elevenlabs;
mod notch;
mod power;
mod settings;
mod voice;
mod watcher;

use elevenlabs::ElevenLabs;
use settings::{Settings, SettingsState};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use watcher::MacEvent;

#[tauri::command]
fn get_settings(state: State<SettingsState>) -> Settings {
    state.get()
}

#[tauri::command]
fn save_settings(app: AppHandle, state: State<SettingsState>, settings: Settings) -> Result<(), String> {
    state.set(settings.clone())?;
    let _ = app.emit("settings-changed", settings);
    Ok(())
}

#[tauri::command]
async fn list_voices(app: AppHandle) -> Vec<voice::Voice> {
    on_main_thread(&app, voice::list).unwrap_or_default()
}

/// Bumped per `speak` so a line that finishes downloading late doesn't talk over a newer one.
static SPEECH: AtomicU64 = AtomicU64::new(0);

/// Resolves once the audio has started, so the notch can open in step with the voice.
#[tauri::command]
async fn speak(app: AppHandle, text: Option<String>, sound: Option<String>) -> Result<(), String> {
    let id = SPEECH.fetch_add(1, Ordering::SeqCst) + 1;
    let latest = || SPEECH.load(Ordering::SeqCst) == id;
    let s = app.state::<SettingsState>().get();

    if let (Some(line), Some(request)) = (&text, elevenlabs::Request::from_settings(&s)) {
        let eleven = app.state::<ElevenLabs>();
        if eleven.has_key() {
            match eleven.audio(&request, line).await {
                Ok(clip) => {
                    if latest() {
                        on_main_thread(&app, move || voice::play_clip(sound, &clip, s.volume));
                    }
                    return Ok(());
                }
                Err(error) => {
                    eprintln!("notchy: ElevenLabs failed, falling back to the Mac voice: {error}");
                    let _ = app.emit("voice-error", error);
                }
            }
        }
    }
    if latest() {
        on_main_thread(&app, move || {
            voice::speak(text, sound, &s.voice, s.rate, s.volume, &s.language, s.personality == "tapori");
        });
    }
    Ok(())
}

#[tauri::command]
async fn has_male_hindi_voice(app: AppHandle) -> bool {
    on_main_thread(&app, voice::has_male_hindi).unwrap_or(false)
}

#[tauri::command]
fn elevenlabs_has_key(eleven: State<ElevenLabs>) -> bool {
    eleven.has_key()
}

#[tauri::command]
async fn set_elevenlabs_key(eleven: State<'_, ElevenLabs>, key: Option<String>) -> Result<(), String> {
    eleven.set_key(key).await
}

#[tauri::command]
async fn elevenlabs_voices(eleven: State<'_, ElevenLabs>) -> Result<Vec<elevenlabs::ElevenVoice>, String> {
    eleven.voices().await
}

#[tauri::command]
async fn elevenlabs_models(eleven: State<'_, ElevenLabs>) -> Result<Vec<elevenlabs::ElevenModel>, String> {
    eleven.models().await
}

/// Starts caching the given lines in the background and reports what's already cached.
#[tauri::command]
fn prepare_voice_cache(
    app: AppHandle,
    state: State<SettingsState>,
    eleven: State<ElevenLabs>,
    lines: Vec<String>,
) -> Option<elevenlabs::CacheProgress> {
    let request = elevenlabs::Request::from_settings(&state.get())?;
    if !eleven.has_key() {
        return None;
    }
    let progress = eleven.progress(&request, &lines);
    if progress.ready < progress.total {
        ElevenLabs::prefetch(app, request, lines);
    }
    Some(progress)
}

/// Opens System Settings where Premium voices can be downloaded.
#[tauri::command]
fn open_voice_settings() {
    let _ = std::process::Command::new("/usr/bin/open")
        .arg("x-apple.systempreferences:com.apple.Accessibility-Settings.extension?SpokenContent")
        .spawn();
}

#[tauri::command]
fn stop_speaking(app: AppHandle) {
    let _ = app.run_on_main_thread(voice::stop);
}

/// Runs `f` on the main thread and waits for its result. Don't call from the main thread.
fn on_main_thread<T: Send + 'static>(app: &AppHandle, f: impl FnOnce() -> T + Send + 'static) -> Option<T> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(f());
    })
    .ok()?;
    rx.recv().ok()
}

/// Re-centres the overlay on the right screen (displays come and go) and reports the notch size.
#[tauri::command]
async fn prepare_notch(app: AppHandle) -> Result<notch::NotchMetrics, String> {
    let window = app.get_webview_window("notch").ok_or("notch window missing")?;
    on_main_thread(&app, move || notch::place(&window)).ok_or_else(|| "main thread unavailable".into())
}

#[tauri::command]
fn test_event(app: AppHandle, event: MacEvent) {
    watcher::emit(&app, event);
}

fn open_settings(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, Some("Cmd+,"))?;
    let poke = MenuItem::with_id(app, "poke", "Say Something", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Notchy", true, Some("Cmd+Q"))?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&poke, &settings, &separator, &quit])?;

    TrayIconBuilder::with_id("main")
        .icon(tauri::include_image!("icons/tray.png"))
        .icon_as_template(true)
        .tooltip("Notchy")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "settings" => open_settings(app),
            "poke" => watcher::emit(app, MacEvent::new("poke")),
            "quit" => {
                voice::stop();
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let settings = SettingsState::load(app.handle());
            let s = settings.get();
            voice::warm_up(&s.voice, &s.language);
            app.manage(settings);
            app.manage(ElevenLabs::load(app.handle()));
            notch::keep_awake();
            if let Some(window) = app.get_webview_window("notch") {
                notch::configure(&window);
                notch::place(&window);
                notch::follow_spaces(&window);
            }
            build_tray(app.handle())?;
            watcher::start(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "settings" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            list_voices,
            speak,
            stop_speaking,
            open_voice_settings,
            prepare_notch,
            test_event,
            elevenlabs_has_key,
            has_male_hindi_voice,
            set_elevenlabs_key,
            elevenlabs_voices,
            elevenlabs_models,
            prepare_voice_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Notchy");
}
