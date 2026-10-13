fn main() {
    println!("cargo:rustc-link-lib=framework=IOBluetooth");
    println!("cargo:rustc-link-lib=framework=IOKit");
    println!("cargo:rustc-link-lib=framework=AVFoundation");
    tauri_build::build()
}
