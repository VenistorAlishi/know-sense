use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval(
                    "window.location.replace('http://127.0.0.1:3847/jarvis')",
                );
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Смысл desktop");
}
