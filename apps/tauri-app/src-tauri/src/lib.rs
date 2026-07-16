mod adapters;

use acp_fixer_core::{AppInfo, app_info};
use adapters::TauriShellCommandRunner;
use tauri::Manager;

#[tauri::command]
fn get_app_info() -> AppInfo {
    app_info()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            app.manage(TauriShellCommandRunner::new(app.handle().clone()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_app_info])
        .run(tauri::generate_context!())
        .expect("failed to run Android Credential Provider Fixer");
}
