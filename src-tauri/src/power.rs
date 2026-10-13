//! Battery and charger state from IOKit's power-source API.

use core_foundation::array::{CFArray, CFArrayRef};
use core_foundation::base::{CFType, CFTypeRef, TCFType};
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
use core_foundation::number::CFNumber;
use core_foundation::string::CFString;

unsafe extern "C" {
    fn IOPSCopyPowerSourcesInfo() -> CFTypeRef;
    fn IOPSCopyPowerSourcesList(blob: CFTypeRef) -> CFArrayRef;
    fn IOPSGetPowerSourceDescription(blob: CFTypeRef, ps: CFTypeRef) -> CFDictionaryRef;
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PowerState {
    pub on_ac: bool,
    pub charging: bool,
    pub percent: u8,
}

/// Returns `None` on Macs without an internal battery.
pub fn read() -> Option<PowerState> {
    unsafe {
        let blob = IOPSCopyPowerSourcesInfo();
        if blob.is_null() {
            return None;
        }
        let blob = CFType::wrap_under_create_rule(blob);
        let list = IOPSCopyPowerSourcesList(blob.as_CFTypeRef());
        if list.is_null() {
            return None;
        }
        let list: CFArray<CFType> = CFArray::wrap_under_create_rule(list);
        for source in list.iter() {
            let desc = IOPSGetPowerSourceDescription(blob.as_CFTypeRef(), source.as_CFTypeRef());
            if desc.is_null() {
                continue;
            }
            let desc: CFDictionary<CFString, CFType> = CFDictionary::wrap_under_get_rule(desc);
            if string(&desc, "Type").as_deref() != Some("InternalBattery") {
                continue;
            }
            let current = number(&desc, "Current Capacity")?;
            let max = number(&desc, "Max Capacity").filter(|m| *m > 0).unwrap_or(100);
            return Some(PowerState {
                on_ac: string(&desc, "Power Source State").as_deref() == Some("AC Power"),
                charging: boolean(&desc, "Is Charging").unwrap_or(false),
                percent: ((current * 100) / max).clamp(0, 100) as u8,
            });
        }
        None
    }
}

fn value(desc: &CFDictionary<CFString, CFType>, key: &str) -> Option<CFType> {
    desc.find(CFString::new(key)).map(|v| v.clone())
}

fn string(desc: &CFDictionary<CFString, CFType>, key: &str) -> Option<String> {
    value(desc, key)?.downcast::<CFString>().map(|s| s.to_string())
}

fn number(desc: &CFDictionary<CFString, CFType>, key: &str) -> Option<i64> {
    value(desc, key)?.downcast::<CFNumber>()?.to_i64()
}

fn boolean(desc: &CFDictionary<CFString, CFType>, key: &str) -> Option<bool> {
    value(desc, key)?.downcast::<CFBoolean>().map(bool::from)
}
