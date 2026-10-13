//! Polls the system once a second and turns state changes into events for the notch.

use crate::settings::SettingsState;
use crate::{bluetooth, power};
use chrono::{Local, NaiveDate, Timelike};
use core_foundation::base::{CFType, TCFType};
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
use core_foundation::number::CFNumber;
use core_foundation::string::CFString;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{class, msg_send};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter, Manager};

#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGSessionCopyCurrentDictionary() -> CFDictionaryRef;
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MacEvent {
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device: Option<String>,
}

impl MacEvent {
    pub fn new(kind: &str) -> Self {
        Self { kind: kind.into(), ..Default::default() }
    }
    fn level(mut self, level: u8) -> Self {
        self.level = Some(level);
        self
    }
    fn name(mut self, name: &str) -> Self {
        self.name = Some(name.into());
        self
    }
}

pub fn emit(app: &AppHandle, event: MacEvent) {
    let _ = app.emit_to("notch", "mac-event", event);
}

/// Fast enough that a plugged-in charger feels instant; every check here is cheap.
const TICK: Duration = Duration::from_millis(250);
/// Bluetooth needs a hop to the main thread, so it runs once a second.
const BLUETOOTH_EVERY: u32 = 4;
/// A gap this long between ticks means the Mac was asleep.
const SLEEP_GAP: Duration = Duration::from_secs(20);

/// macOS kills any process that touches Bluetooth unless whoever launched it declares
/// NSBluetoothAlwaysUsageDescription. A bundled .app does; `tauri dev` (launched from a
/// terminal) doesn't, so Bluetooth stays off there.
fn bluetooth_allowed() -> bool {
    std::env::current_exe().is_ok_and(|p| p.to_string_lossy().contains(".app/Contents/MacOS/"))
}

pub fn start(app: AppHandle) {
    let watch_bluetooth = bluetooth_allowed();
    if !watch_bluetooth {
        eprintln!("notchy: not running from a .app bundle, Bluetooth events are off");
    }
    thread::spawn(move || {
        let mut power = power::read();
        let mut low_fired = power.is_some_and(|p| !p.on_ac && p.percent <= 20);
        let mut critical_fired = power.is_some_and(|p| !p.on_ac && p.percent <= 10);
        let mut full_fired = power.is_some_and(|p| p.percent >= 100);
        let mut locked = is_locked();
        let mut volumes = volumes();
        let mut thermal = thermal_state();
        let mut bluetooth: Option<HashMap<String, bluetooth::Device>> = None;
        let mut late_night_on: Option<NaiveDate> = None;
        let mut last_tick = SystemTime::now();
        let mut tick: u32 = 0;

        loop {
            thread::sleep(TICK);
            tick = tick.wrapping_add(1);
            let settings = app.state::<SettingsState>().get();

            // Sleep / wake. Waking onto a lock screen is greeted by the unlock instead.
            let now = SystemTime::now();
            let slept = now.duration_since(last_tick).unwrap_or_default() > SLEEP_GAP;
            last_tick = now;
            let now_locked = is_locked();
            if slept && !now_locked {
                emit(&app, MacEvent::new("wake"));
            }
            if locked && !now_locked {
                emit(&app, MacEvent::new("unlock"));
            }
            locked = now_locked;

            // Charger and battery.
            let current = power::read();
            if let (Some(prev), Some(cur)) = (power, current) {
                if !prev.on_ac && cur.on_ac {
                    emit(&app, MacEvent::new("charger_connected").level(cur.percent));
                } else if prev.on_ac && !cur.on_ac {
                    emit(&app, MacEvent::new("charger_disconnected").level(cur.percent));
                }

                if cur.on_ac && cur.percent >= 100 && !full_fired {
                    full_fired = true;
                    emit(&app, MacEvent::new("battery_full").level(cur.percent));
                } else if cur.percent < 95 {
                    full_fired = false;
                }

                if cur.on_ac || cur.percent > settings.low_battery.saturating_add(2) {
                    low_fired = false;
                }
                if cur.on_ac || cur.percent > settings.critical_battery.saturating_add(2) {
                    critical_fired = false;
                }
                if !cur.on_ac && cur.percent <= settings.critical_battery && !critical_fired {
                    critical_fired = true;
                    low_fired = true;
                    emit(&app, MacEvent::new("battery_critical").level(cur.percent));
                } else if !cur.on_ac && cur.percent <= settings.low_battery && !low_fired {
                    low_fired = true;
                    emit(&app, MacEvent::new("battery_low").level(cur.percent));
                }
            }
            power = current.or(power);

            // Bluetooth. IOBluetooth wants the main thread.
            if watch_bluetooth && tick % BLUETOOTH_EVERY == 0 {
                if let Some(devices) = connected_bluetooth(&app) {
                    let devices: HashMap<_, _> =
                        devices.into_iter().map(|d| (d.address.clone(), d)).collect();
                    if let Some(prev) = &bluetooth {
                        for (address, device) in &devices {
                            if !prev.contains_key(address) {
                                let mut event = MacEvent::new("bt_connected").name(&device.name);
                                event.device = Some(device.kind.into());
                                emit(&app, event);
                            }
                        }
                        for (address, device) in prev {
                            if !devices.contains_key(address) {
                                let mut event = MacEvent::new("bt_disconnected").name(&device.name);
                                event.device = Some(device.kind.into());
                                emit(&app, event);
                            }
                        }
                    }
                    bluetooth = Some(devices);
                }
            }

            // Drives.
            let now_volumes = self::volumes();
            for name in now_volumes.difference(&volumes) {
                emit(&app, MacEvent::new("drive_mounted").name(name));
            }
            for name in volumes.difference(&now_volumes) {
                emit(&app, MacEvent::new("drive_unmounted").name(name));
            }
            volumes = now_volumes;

            // Heat. 2 is "serious", 3 is "critical".
            let now_thermal = thermal_state();
            if now_thermal >= 2 && thermal < 2 {
                emit(&app, MacEvent::new("thermal_hot"));
            }
            thermal = now_thermal;

            // Still up between 1 and 4 am.
            let local = Local::now();
            let today = local.date_naive();
            if (1..4).contains(&local.hour()) && !locked && late_night_on != Some(today) {
                late_night_on = Some(today);
                emit(&app, MacEvent::new("late_night"));
            }
        }
    });
}

fn connected_bluetooth(app: &AppHandle) -> Option<Vec<bluetooth::Device>> {
    let (tx, rx) = mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(bluetooth::connected());
    })
    .ok()?;
    rx.recv_timeout(Duration::from_secs(2)).ok()
}

fn is_locked() -> bool {
    unsafe {
        let dict = CGSessionCopyCurrentDictionary();
        if dict.is_null() {
            return false;
        }
        let dict: CFDictionary<CFString, CFType> = CFDictionary::wrap_under_create_rule(dict);
        let Some(value) = dict.find(CFString::new("CGSSessionScreenIsLocked")) else {
            return false;
        };
        if let Some(b) = value.downcast::<CFBoolean>() {
            return bool::from(b);
        }
        value.downcast::<CFNumber>().and_then(|n| n.to_i64()).is_some_and(|n| n != 0)
    }
}

/// External drives and disk images. The boot volume shows up as a symlink and is skipped.
fn volumes() -> HashSet<String> {
    let Ok(entries) = std::fs::read_dir("/Volumes") else { return HashSet::new() };
    entries
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| !t.is_symlink()))
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|name| !name.starts_with('.'))
        .collect()
}

fn thermal_state() -> isize {
    unsafe {
        let info: Retained<AnyObject> = msg_send![class!(NSProcessInfo), processInfo];
        msg_send![&*info, thermalState]
    }
}
