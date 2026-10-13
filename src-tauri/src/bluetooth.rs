//! Connected Bluetooth devices, read from IOBluetooth's paired-device list.

use objc2::rc::Retained;
use objc2::runtime::{AnyObject, Bool};
use objc2::{class, msg_send};
use objc2_foundation::{NSArray, NSString};

#[derive(Debug, Clone, PartialEq)]
pub struct Device {
    pub address: String,
    pub name: String,
    pub kind: &'static str,
}

/// Must be called on the main thread.
pub fn connected() -> Vec<Device> {
    let mut out = Vec::new();
    unsafe {
        let devices: Option<Retained<NSArray<AnyObject>>> =
            msg_send![class!(IOBluetoothDevice), pairedDevices];
        let Some(devices) = devices else { return out };
        for device in devices.iter() {
            let connected: Bool = msg_send![&*device, isConnected];
            if !connected.as_bool() {
                continue;
            }
            let name: Option<Retained<NSString>> = msg_send![&*device, name];
            let address: Option<Retained<NSString>> = msg_send![&*device, addressString];
            let major: u32 = msg_send![&*device, deviceClassMajor];
            let name = name.map(|n| n.to_string()).unwrap_or_else(|| "Device".into());
            out.push(Device {
                address: address.map(|a| a.to_string()).unwrap_or_else(|| name.clone()),
                kind: kind_of(&name, major),
                name,
            });
        }
    }
    out
}

fn kind_of(name: &str, major: u32) -> &'static str {
    let lower = name.to_lowercase();
    if lower.contains("airpods") || lower.contains("beats") {
        "airpods"
    } else if major == 0x04 {
        "audio"
    } else if major == 0x05 {
        "input"
    } else if major == 0x02 {
        "phone"
    } else {
        "other"
    }
}
