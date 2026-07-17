mod adapters;
mod backend;

use acp_fixer_core::{AppInfo, app_info};
use backend::BackendState;
use tauri::Manager;

#[tauri::command]
fn get_app_info() -> AppInfo {
    app_info()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            app.manage(BackendState::new(app.handle()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            backend::get_startup_state,
            backend::discover_adb,
            backend::select_adb_candidate,
            backend::choose_adb_executable,
            backend::list_devices,
            backend::inspect_device,
            backend::set_onboarding_status,
            backend::get_demo_fixture,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Android Credential Provider Fixer");
}
