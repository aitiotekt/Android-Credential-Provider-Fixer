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
            backend::get_session_context,
            backend::discover_adb,
            backend::select_adb_candidate,
            backend::choose_adb_executable,
            backend::list_devices,
            backend::resolve_diagnosis,
            backend::prepare_pin,
            backend::authorize_pin_preview,
            backend::create_pin_plan,
            backend::execute_pin_plan,
            backend::list_snapshots,
            backend::prepare_restore,
            backend::create_restore_plan,
            backend::execute_restore_plan,
            backend::cancel_change_plan,
            backend::set_onboarding_status,
            backend::set_theme_preference,
            backend::get_demo_fixture,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Android Credential Provider Fixer");
}
