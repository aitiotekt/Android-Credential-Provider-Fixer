use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use acp_fixer_core::{
    AdbCandidate, AdbCandidateSource, AdbDiscoveryContext, AdbValidationFailure, DemoFixture,
    DeviceList, DeviceSummary, DiagnosisReport, DiagnosticError, ErrorCode, ErrorEnvelope,
    ValidatedAdb, demo_fixture, diagnose_device, discover_adb as discover_adb_core,
    list_devices as list_devices_core, validate_adb,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State, Wry};
use tauri_plugin_dialog::DialogExt;
use tokio::sync::Mutex;

use crate::adapters::TauriShellCommandRunner;

const ONBOARDING_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OnboardingStatus {
    Completed,
    Skipped,
}

#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Preferences {
    schema_version: u32,
    adb_path: Option<PathBuf>,
    onboarding_version: Option<u32>,
    onboarding_status: Option<OnboardingStatus>,
}

impl Preferences {
    fn normalized(mut self) -> Self {
        self.schema_version = 1;
        self
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupState {
    pub schema_version: u32,
    pub onboarding_version: u32,
    pub onboarding_status: Option<OnboardingStatus>,
    pub selected_adb: Option<ValidatedAdb>,
    pub preference_warning: Option<ErrorEnvelope>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbCandidateView {
    pub candidate_id: String,
    #[serde(flatten)]
    pub candidate: AdbCandidate,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbDiscoveryView {
    pub schema_version: u32,
    pub candidates: Vec<AdbCandidateView>,
    pub failures: Vec<AdbValidationFailure>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceChoice {
    pub device_id: String,
    #[serde(flatten)]
    pub device: DeviceSummary,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceListView {
    pub schema_version: u32,
    pub observed_at_unix_ms: u64,
    pub devices: Vec<DeviceChoice>,
}

#[derive(Debug)]
struct SessionState {
    preferences: Preferences,
    preference_warning: Option<ErrorEnvelope>,
    selected_adb: Option<ValidatedAdb>,
    candidate_generation: u64,
    candidates: HashMap<String, ValidatedAdb>,
    device_generation: u64,
    devices: HashMap<String, String>,
}

#[derive(Debug)]
pub struct BackendState {
    runner: TauriShellCommandRunner,
    preferences_path: PathBuf,
    session: Mutex<SessionState>,
}

impl BackendState {
    pub fn new(app: &AppHandle<Wry>) -> Self {
        let preferences_path = app
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| std::env::temp_dir().join("acp-fixer"))
            .join("preferences.json");
        let (preferences, preference_warning) = load_preferences(&preferences_path);
        Self {
            runner: TauriShellCommandRunner::new(app.clone()),
            preferences_path,
            session: Mutex::new(SessionState {
                preferences,
                preference_warning,
                selected_adb: None,
                candidate_generation: 0,
                candidates: HashMap::new(),
                device_generation: 0,
                devices: HashMap::new(),
            }),
        }
    }
}

#[tauri::command]
pub async fn get_startup_state(
    state: State<'_, BackendState>,
) -> Result<StartupState, ErrorEnvelope> {
    let saved_path = {
        let session = state.session.lock().await;
        if session.selected_adb.is_some() {
            return Ok(startup_state(&session));
        }
        session.preferences.adb_path.clone()
    };
    if let Some(path) = saved_path {
        match validate_adb(&state.runner, &path).await {
            Ok(adb) => state.session.lock().await.selected_adb = Some(adb),
            Err(error) => {
                state.session.lock().await.preference_warning = Some(ErrorEnvelope::from(&error));
            }
        }
    }
    let session = state.session.lock().await;
    Ok(startup_state(&session))
}

#[tauri::command]
pub async fn discover_adb(
    state: State<'_, BackendState>,
) -> Result<AdbDiscoveryView, ErrorEnvelope> {
    let saved = state.session.lock().await.preferences.adb_path.clone();
    let explicit = saved
        .map(|path| vec![(path, AdbCandidateSource::Saved)])
        .unwrap_or_default();
    let result = discover_adb_core(
        &state.runner,
        &AdbDiscoveryContext::from_environment(explicit),
    )
    .await;
    let mut session = state.session.lock().await;
    session.candidate_generation = session.candidate_generation.wrapping_add(1);
    session.candidates.clear();
    let generation = session.candidate_generation;
    let candidates = result
        .candidates
        .into_iter()
        .enumerate()
        .map(|(index, candidate)| {
            let candidate_id = format!("adb-{generation}-{index}");
            session
                .candidates
                .insert(candidate_id.clone(), candidate.adb.clone());
            AdbCandidateView {
                candidate_id,
                candidate,
            }
        })
        .collect();
    Ok(AdbDiscoveryView {
        schema_version: 1,
        candidates,
        failures: result.failures,
    })
}

#[tauri::command]
pub async fn select_adb_candidate(
    candidate_id: String,
    state: State<'_, BackendState>,
) -> Result<ValidatedAdb, ErrorEnvelope> {
    let adb = state
        .session
        .lock()
        .await
        .candidates
        .get(&candidate_id)
        .cloned()
        .ok_or_else(|| ErrorEnvelope::from(&DiagnosticError::AdbSelectionStale))?;
    select_and_persist(&state, adb).await
}

#[tauri::command]
pub async fn choose_adb_executable(
    app: AppHandle<Wry>,
    state: State<'_, BackendState>,
) -> Result<Option<ValidatedAdb>, ErrorEnvelope> {
    let selected = app
        .dialog()
        .file()
        .set_title("Select the Android Debug Bridge executable")
        .blocking_pick_file();
    let Some(selected) = selected else {
        return Ok(None);
    };
    let path = selected.into_path().map_err(|error| ErrorEnvelope {
        code: ErrorCode::AdbNotExecutable.as_str().to_owned(),
        message: error.to_string(),
    })?;
    let adb = validate_adb(&state.runner, &path)
        .await
        .map_err(|error| ErrorEnvelope::from(&error))?;
    select_and_persist(&state, adb).await.map(Some)
}

#[tauri::command]
pub async fn list_devices(state: State<'_, BackendState>) -> Result<DeviceListView, ErrorEnvelope> {
    let adb = selected_adb(&state).await?;
    let list = list_devices_core(&state.runner, &adb)
        .await
        .map_err(|error| ErrorEnvelope::from(&error))?;
    Ok(cache_devices(&state, list).await)
}

#[tauri::command]
pub async fn inspect_device(
    device_id: String,
    state: State<'_, BackendState>,
) -> Result<DiagnosisReport, ErrorEnvelope> {
    let (adb, serial) = {
        let session = state.session.lock().await;
        let adb = session
            .selected_adb
            .clone()
            .ok_or_else(|| ErrorEnvelope::from(&DiagnosticError::AdbSelectionStale))?;
        let serial = session
            .devices
            .get(&device_id)
            .cloned()
            .ok_or_else(|| ErrorEnvelope::from(&DiagnosticError::DeviceSelectionRequired))?;
        (adb, serial)
    };
    diagnose_device(&state.runner, &adb, &serial)
        .await
        .map_err(|error| ErrorEnvelope::from(&error))
}

#[tauri::command]
pub async fn set_onboarding_status(
    status: OnboardingStatus,
    state: State<'_, BackendState>,
) -> Result<StartupState, ErrorEnvelope> {
    let mut session = state.session.lock().await;
    session.preferences.onboarding_version = Some(ONBOARDING_VERSION);
    session.preferences.onboarding_status = Some(status);
    save_preferences(&state.preferences_path, &session.preferences)?;
    Ok(startup_state(&session))
}

#[tauri::command]
pub fn get_demo_fixture() -> DemoFixture {
    demo_fixture()
}

async fn selected_adb(state: &State<'_, BackendState>) -> Result<ValidatedAdb, ErrorEnvelope> {
    state
        .session
        .lock()
        .await
        .selected_adb
        .clone()
        .ok_or_else(|| ErrorEnvelope::from(&DiagnosticError::AdbSelectionStale))
}

async fn select_and_persist(
    state: &State<'_, BackendState>,
    adb: ValidatedAdb,
) -> Result<ValidatedAdb, ErrorEnvelope> {
    let mut session = state.session.lock().await;
    session.preferences.adb_path = Some(adb.path.clone());
    save_preferences(&state.preferences_path, &session.preferences)?;
    session.selected_adb = Some(adb.clone());
    session.devices.clear();
    Ok(adb)
}

async fn cache_devices(state: &State<'_, BackendState>, list: DeviceList) -> DeviceListView {
    let mut session = state.session.lock().await;
    session.device_generation = session.device_generation.wrapping_add(1);
    session.devices.clear();
    let generation = session.device_generation;
    let devices = list
        .devices
        .into_iter()
        .enumerate()
        .map(|(index, device)| {
            let device_id = format!("device-{generation}-{index}");
            session
                .devices
                .insert(device_id.clone(), device.serial.clone());
            DeviceChoice { device_id, device }
        })
        .collect();
    DeviceListView {
        schema_version: 1,
        observed_at_unix_ms: list.observed_at_unix_ms,
        devices,
    }
}

fn startup_state(session: &SessionState) -> StartupState {
    StartupState {
        schema_version: 1,
        onboarding_version: ONBOARDING_VERSION,
        onboarding_status: (session.preferences.onboarding_version == Some(ONBOARDING_VERSION))
            .then_some(session.preferences.onboarding_status)
            .flatten(),
        selected_adb: session.selected_adb.clone(),
        preference_warning: session.preference_warning.clone(),
    }
}

fn load_preferences(path: &Path) -> (Preferences, Option<ErrorEnvelope>) {
    match fs::read(path) {
        Ok(bytes) => match serde_json::from_slice::<Preferences>(&bytes) {
            Ok(preferences) => (preferences.normalized(), None),
            Err(error) => (
                Preferences::default().normalized(),
                Some(ErrorEnvelope {
                    code: ErrorCode::PreferencesReadFailed.as_str().to_owned(),
                    message: format!("preferences were ignored: {error}"),
                }),
            ),
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            (Preferences::default().normalized(), None)
        }
        Err(error) => (
            Preferences::default().normalized(),
            Some(ErrorEnvelope {
                code: ErrorCode::PreferencesReadFailed.as_str().to_owned(),
                message: error.to_string(),
            }),
        ),
    }
}

fn save_preferences(path: &Path, preferences: &Preferences) -> Result<(), ErrorEnvelope> {
    let parent = path.parent().ok_or_else(|| ErrorEnvelope {
        code: ErrorCode::PreferencesWriteFailed.as_str().to_owned(),
        message: "preferences path has no parent directory".to_owned(),
    })?;
    fs::create_dir_all(parent).map_err(preferences_write_error)?;
    let temporary = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(preferences).map_err(preferences_write_error)?;
    fs::write(&temporary, bytes).map_err(preferences_write_error)?;
    if cfg!(windows) && path.exists() {
        fs::remove_file(path).map_err(preferences_write_error)?;
    }
    fs::rename(&temporary, path).map_err(preferences_write_error)
}

fn preferences_write_error(error: impl std::fmt::Display) -> ErrorEnvelope {
    ErrorEnvelope {
        code: ErrorCode::PreferencesWriteFailed.as_str().to_owned(),
        message: error.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::*;

    static NEXT_DIRECTORY: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn corrupt_preferences_are_recoverable() {
        let directory = temporary_directory();
        let path = directory.join("preferences.json");
        fs::create_dir_all(&directory).unwrap();
        fs::write(&path, b"not json").unwrap();

        let (preferences, warning) = load_preferences(&path);

        assert_eq!(preferences.schema_version, 1);
        assert_eq!(
            warning.unwrap().code,
            ErrorCode::PreferencesReadFailed.as_str()
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn preferences_round_trip_onboarding_and_adb_path() {
        let directory = temporary_directory();
        let path = directory.join("preferences.json");
        let preferences = Preferences {
            schema_version: 1,
            adb_path: Some(PathBuf::from("/path with spaces/adb")),
            onboarding_version: Some(1),
            onboarding_status: Some(OnboardingStatus::Skipped),
        };

        save_preferences(&path, &preferences).unwrap();
        let (actual, warning) = load_preferences(&path);

        assert_eq!(actual, preferences);
        assert!(warning.is_none());
        fs::remove_dir_all(directory).unwrap();
    }

    fn temporary_directory() -> PathBuf {
        let suffix = NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("acp-fixer-test-{}-{suffix}", std::process::id()))
    }
}
