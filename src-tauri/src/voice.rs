//! Speech and sound effects, played in-process so they start the moment an event lands.
//!
//! Spawning `say` per line cost ~0.75 s before the first word, and the sound effect had to
//! finish before speech could start. AVSpeechSynthesizer keeps the voice loaded and NSSound
//! plays instantly. Everything here must run on the main thread.

use objc2::rc::{Allocated, Retained};
use objc2::runtime::{AnyObject, Bool};
use objc2::{class, msg_send, sel};
use objc2_foundation::{NSArray, NSString};
use serde::Serialize;
use std::cell::RefCell;
use std::path::Path;

/// Pseudo voice name: use the best English voice that's installed.
pub const AUTO: &str = "auto";

/// After a sound effect the voice comes in on its tail, so the two don't blur together.
const VOICE_DELAY_AFTER_SOUND: f64 = 0.3;

const AV_BOUNDARY_IMMEDIATE: isize = 0;

thread_local! {
    static SYNTH: RefCell<Option<Retained<AnyObject>>> = const { RefCell::new(None) };
    static SOUND: RefCell<Option<Retained<AnyObject>>> = const { RefCell::new(None) };
    static CLIP: RefCell<Option<Retained<AnyObject>>> = const { RefCell::new(None) };
}

#[derive(Serialize, Clone)]
pub struct Voice {
    pub name: String,
    pub locale: String,
    /// 2 = Premium, 1 = Enhanced, 0 = standard.
    pub quality: u8,
}

struct InstalledVoice {
    voice: Voice,
    identifier: String,
    male: bool,
}

/// Plays an optional system sound and speaks the optional text right after it.
/// `language` is the setting value: "english", "hinglish" or "hindi". `male` makes a
/// personality that must sound like a man ignore the chosen voice if it isn't one.
pub fn speak(
    text: Option<String>,
    sound: Option<String>,
    voice: &str,
    rate: u32,
    volume: f32,
    language: &str,
    male: bool,
) {
    stop();
    // A personality without Hindi lines falls back to Hinglish, which is Roman script.
    let language = match language {
        "hindi" if !text.as_deref().is_some_and(is_devanagari) => "hinglish",
        other => other,
    };
    let volume = volume.clamp(0.0, 1.0);
    let played = sound.as_deref().is_some_and(|name| play_sound(name, volume * 0.6));
    let Some(text) = text.filter(|t| !t.trim().is_empty()) else { return };
    let delay = if played { VOICE_DELAY_AFTER_SOUND } else { 0.0 };
    utter(&text, voice, rate, volume, delay, language, male);
}

/// Plays an optional sound effect, then a pre-rendered voice clip on its tail.
pub fn play_clip(sound: Option<String>, clip: &Path, volume: f32) {
    stop();
    let volume = volume.clamp(0.0, 1.0);
    let played = sound.as_deref().is_some_and(|name| play_sound(name, volume * 0.6));
    unsafe {
        let alloc: Allocated<AnyObject> = msg_send![class!(NSSound), alloc];
        let path = NSString::from_str(&clip.to_string_lossy());
        let clip: Option<Retained<AnyObject>> = msg_send![alloc, initWithContentsOfFile: &*path, byReference: true];
        let Some(clip) = clip else { return };
        let _: () = msg_send![&*clip, setVolume: volume];
        if played {
            let _: () = msg_send![
                &*clip,
                performSelector: sel!(play),
                withObject: None::<&AnyObject>,
                afterDelay: VOICE_DELAY_AFTER_SOUND
            ];
        } else {
            let _: Bool = msg_send![&*clip, play];
        }
        CLIP.with(|current| *current.borrow_mut() = Some(clip));
    }
}

/// Loads the voice ahead of time so the first real line isn't slow.
pub fn warm_up(voice: &str, language: &str) {
    utter(".", voice, 185, 0.0, 0.0, language, false);
}

pub fn stop() {
    unsafe {
        let _: Bool = msg_send![&*synth(), stopSpeakingAtBoundary: AV_BOUNDARY_IMMEDIATE];
    }
    SOUND.with(|current| {
        if let Some(sound) = current.borrow_mut().take() {
            let _: Bool = unsafe { msg_send![&*sound, stop] };
        }
    });
    CLIP.with(|current| {
        if let Some(clip) = current.borrow_mut().take() {
            unsafe {
                let _: () = msg_send![class!(NSObject), cancelPreviousPerformRequestsWithTarget: &*clip];
                let _: Bool = msg_send![&*clip, stop];
            }
        }
    });
}

/// Whether a male voice that can read Devanagari is installed.
pub fn has_male_hindi() -> bool {
    installed().iter().any(|v| v.male && v.voice.locale.starts_with("hi"))
}

pub fn list() -> Vec<Voice> {
    installed().into_iter().map(|v| v.voice).collect()
}

fn utter(text: &str, voice: &str, rate: u32, volume: f32, delay: f64, language: &str, male: bool) {
    unsafe {
        let utterance: Retained<AnyObject> =
            msg_send![class!(AVSpeechUtterance), speechUtteranceWithString: &*NSString::from_str(text)];
        if let Some(identifier) = resolve(voice, language, male) {
            let voice: Option<Retained<AnyObject>> = msg_send![
                class!(AVSpeechSynthesisVoice),
                voiceWithIdentifier: &*NSString::from_str(&identifier)
            ];
            if let Some(voice) = voice {
                let _: () = msg_send![&*utterance, setVoice: &*voice];
            }
        }
        let _: () = msg_send![&*utterance, setRate: av_rate(rate)];
        let _: () = msg_send![&*utterance, setVolume: volume];
        let _: () = msg_send![&*utterance, setPreUtteranceDelay: delay];
        let _: () = msg_send![&*synth(), speakUtterance: &*utterance];
    }
}

fn synth() -> Retained<AnyObject> {
    SYNTH.with(|cell| {
        cell.borrow_mut()
            .get_or_insert_with(|| unsafe { msg_send![class!(AVSpeechSynthesizer), new] })
            .clone()
    })
}

fn play_sound(name: &str, volume: f32) -> bool {
    if name.is_empty() || !name.chars().all(|c| c.is_ascii_alphanumeric()) {
        return false;
    }
    unsafe {
        let sound: Option<Retained<AnyObject>> = msg_send![class!(NSSound), soundNamed: &*NSString::from_str(name)];
        let Some(sound) = sound else { return false };
        let _: Bool = msg_send![&*sound, stop];
        let _: () = msg_send![&*sound, setVolume: volume];
        let started: Bool = msg_send![&*sound, play];
        SOUND.with(|current| *current.borrow_mut() = Some(sound));
        started.as_bool()
    }
}

/// `say` speaks at words per minute; AVSpeechUtterance takes 0–1 with 0.5 as normal speed.
fn av_rate(words_per_minute: u32) -> f32 {
    (0.5 + (words_per_minute as f32 - 185.0) / 400.0).clamp(0.3, 0.75)
}

pub fn is_devanagari(text: &str) -> bool {
    text.chars().any(|c| ('\u{0900}'..='\u{097F}').contains(&c))
}

/// Returns the voice identifier, or `None` to use the system voice. Hindi lines are written in
/// Devanagari, which English voices can't read, so they always get a Hindi voice.
fn resolve(voice: &str, language: &str, male: bool) -> Option<String> {
    let voices = installed();
    let hindi = language == "hindi";
    let base = |name: &str| name.split(" (").next().unwrap_or(name).to_string();
    let chosen = voices
        .iter()
        .find(|v| v.voice.name == voice)
        .or_else(|| voices.iter().find(|v| base(&v.voice.name) == base(voice)));
    if voice != AUTO {
        if let Some(v) = chosen.filter(|v| (!hindi || v.voice.locale.starts_with("hi")) && (!male || v.male)) {
            return Some(v.identifier.clone());
        }
    }
    voices
        .into_iter()
        .filter(|v| if hindi { v.voice.locale.starts_with("hi") } else { v.voice.locale.starts_with("en") })
        .max_by_key(|v| {
            let indian = language == "hinglish" && v.voice.locale == "en_IN";
            let favourite = matches!(base(&v.voice.name).as_str(), "Zoe" | "Ava" | "Samantha" | "Rishi" | "Lekha");
            (v.male == male || !male, v.voice.quality, indian, favourite)
        })
        .map(|v| v.identifier)
}

/// English and Hindi voices, named like `say -v ?` does ("Zoe (Premium)") so saved settings keep working.
fn installed() -> Vec<InstalledVoice> {
    unsafe {
        let all: Retained<NSArray<AnyObject>> = msg_send![class!(AVSpeechSynthesisVoice), speechVoices];
        all.iter()
            .filter_map(|v| {
                let name: Retained<NSString> = msg_send![&*v, name];
                let language: Retained<NSString> = msg_send![&*v, language];
                let identifier: Retained<NSString> = msg_send![&*v, identifier];
                let quality: isize = msg_send![&*v, quality];
                // AVSpeechSynthesisVoiceGender: 1 = male, 2 = female.
                let gender: isize = msg_send![&*v, gender];
                let locale = language.to_string().replace('-', "_");
                if !(locale.starts_with("en") || locale.starts_with("hi")) {
                    return None;
                }
                let quality = (quality - 1).clamp(0, 2) as u8;
                let name = name.to_string();
                let suffix = match quality {
                    _ if name.contains('(') => "",
                    2 => " (Premium)",
                    1 => " (Enhanced)",
                    _ => "",
                };
                Some(InstalledVoice {
                    voice: Voice { name: format!("{name}{suffix}"), locale, quality },
                    identifier: identifier.to_string(),
                    male: gender == 1,
                })
            })
            .collect()
    }
}
