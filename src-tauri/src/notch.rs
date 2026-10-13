//! Native setup for the overlay window that sits over the camera notch.

use objc2::encode::{Encode, Encoding};
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{class, msg_send};
use block2::RcBlock;
use objc2_foundation::{NSArray, NSPoint, NSRect, NSSize, NSString};
use std::ptr::NonNull;
use serde::Serialize;
use tauri::WebviewWindow;

/// The window is larger than the pill so it has room to grow; it's transparent and click-through.
const WIDTH: f64 = 640.0;
const HEIGHT: f64 = 220.0;

/// Above the menu bar (24) and status items (25).
const WINDOW_LEVEL: isize = 26;

/// Brought along to whichever Space is active whenever it's ordered front. `CanJoinAllSpaces`
/// should have kept the window on every desktop, but macOS left it behind on the first one.
const MOVE_TO_ACTIVE_SPACE: usize = 1 << 1;
const IGNORES_CYCLE: usize = 1 << 6;
const FULL_SCREEN_AUXILIARY: usize = 1 << 8;

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct EdgeInsets {
    top: f64,
    left: f64,
    bottom: f64,
    right: f64,
}

unsafe impl Encode for EdgeInsets {
    const ENCODING: Encoding = Encoding::Struct(
        "NSEdgeInsets",
        &[Encoding::Double, Encoding::Double, Encoding::Double, Encoding::Double],
    );
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotchMetrics {
    pub has_notch: bool,
    pub notch_width: f64,
    pub notch_height: f64,
}

/// Opts the whole app out of App Nap. Notchy has no visible window most of the time, and
/// without this macOS stretches its timers until events show up seconds late.
pub fn keep_awake() {
    // NSActivityUserInitiatedAllowingIdleSystemSleep | NSActivityLatencyCritical
    const OPTIONS: u64 = 0x00EF_FFFF | 0xFF_0000_0000;
    unsafe {
        let info: Retained<AnyObject> = msg_send![class!(NSProcessInfo), processInfo];
        let reason = NSString::from_str("Reacting to system events");
        let token: Retained<AnyObject> = msg_send![&*info, beginActivityWithOptions: OPTIONS, reason: &*reason];
        // The activity lasts as long as the token is alive, i.e. forever.
        std::mem::forget(token);
    }
}

/// Must be called on the main thread, once.
pub fn configure(window: &WebviewWindow) {
    let Some(ns_window) = ns_window(window) else { return };
    unsafe {
        let _: () = msg_send![ns_window, setLevel: WINDOW_LEVEL];
        let behavior = MOVE_TO_ACTIVE_SPACE | IGNORES_CYCLE | FULL_SCREEN_AUXILIARY;
        let _: () = msg_send![ns_window, setCollectionBehavior: behavior];
        let _: () = msg_send![ns_window, setHasShadow: false];
        let _: () = msg_send![ns_window, setHidesOnDeactivate: false];
        let _: () = msg_send![ns_window, setIgnoresMouseEvents: true];
    }
}

/// Moves the window to the top centre of the notched screen (or the primary one) and
/// shows it without taking focus. Must be called on the main thread.
pub fn place(window: &WebviewWindow) -> NotchMetrics {
    let (frame, metrics) = unsafe { target_screen() };
    if let Some(ns_window) = ns_window(window) {
        let origin = NSPoint::new(
            frame.origin.x + (frame.size.width - WIDTH) / 2.0,
            frame.origin.y + frame.size.height - HEIGHT,
        );
        let rect = NSRect::new(origin, NSSize::new(WIDTH, HEIGHT));
        unsafe {
            let _: () = msg_send![ns_window, setFrame: rect, display: true];
            let _: () = msg_send![ns_window, orderFrontRegardless];
        }
    }
    metrics
}

/// Re-shows the overlay on each desktop switch so it follows the user from Space to Space.
/// Must be called on the main thread, once.
pub fn follow_spaces(window: &WebviewWindow) {
    let window = window.clone();
    let on_switch = RcBlock::new(move |_notification: NonNull<AnyObject>| {
        if let Some(ns_window) = ns_window(&window) {
            unsafe {
                let _: () = msg_send![ns_window, orderFrontRegardless];
            }
        }
    });
    unsafe {
        let workspace: Retained<AnyObject> = msg_send![class!(NSWorkspace), sharedWorkspace];
        let center: Retained<AnyObject> = msg_send![&*workspace, notificationCenter];
        let queue: Retained<AnyObject> = msg_send![class!(NSOperationQueue), mainQueue];
        let name = NSString::from_str("NSWorkspaceActiveSpaceDidChangeNotification");
        let observer: Retained<AnyObject> = msg_send![
            &*center,
            addObserverForName: &*name,
            object: None::<&AnyObject>,
            queue: &*queue,
            usingBlock: &*on_switch
        ];
        // Observes for the life of the app.
        std::mem::forget(observer);
    }
}

fn ns_window(window: &WebviewWindow) -> Option<&AnyObject> {
    let ptr = window.ns_window().ok()? as *mut AnyObject;
    unsafe { ptr.as_ref() }
}

/// Prefers the built-in screen with a camera housing; otherwise uses the primary screen
/// and treats the menu bar as a pretend notch.
unsafe fn target_screen() -> (NSRect, NotchMetrics) {
    unsafe {
        let screens: Retained<NSArray<AnyObject>> = msg_send![class!(NSScreen), screens];
        for screen in screens.iter() {
            let insets: EdgeInsets = msg_send![&*screen, safeAreaInsets];
            if insets.top > 0.0 {
                let frame: NSRect = msg_send![&*screen, frame];
                let left: NSRect = msg_send![&*screen, auxiliaryTopLeftArea];
                let right: NSRect = msg_send![&*screen, auxiliaryTopRightArea];
                let metrics = NotchMetrics {
                    has_notch: true,
                    notch_width: frame.size.width - left.size.width - right.size.width,
                    notch_height: insets.top,
                };
                return (frame, metrics);
            }
        }
        let primary = screens.firstObject();
        let frame: NSRect = match primary {
            Some(screen) => msg_send![&*screen, frame],
            None => NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(1440.0, 900.0)),
        };
        let status_bar: Retained<AnyObject> = msg_send![class!(NSStatusBar), systemStatusBar];
        let thickness: f64 = msg_send![&*status_bar, thickness];
        (frame, NotchMetrics { has_notch: false, notch_width: 0.0, notch_height: thickness })
    }
}
