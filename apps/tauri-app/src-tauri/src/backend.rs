use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use acp_fixer_core::{
    AdbCandidate, AdbCandidateSource, AdbDiscoveryContext, AdbValidationFailure, ChangeError,
    ChangeKind, ChangeOutcome, ChangePlan, ChangePreview, ComponentName, DemoFixture, DeviceList,
    DeviceSummary, DiagnosisReport, DiagnosticError, ErrorCode, ErrorEnvelope, ProviderService,
    SnapshotInventory, SnapshotRecord, SnapshotStore, ValidatedAdb, create_change_plan,
    demo_fixture, diagnose_device, discover_adb as discover_adb_core, execute_change,
    expire_snapshot, list_devices as list_devices_core, mark_source_snapshot_restored,
    prepare_pin as prepare_pin_core, prepare_restore as prepare_restore_core,
    update_snapshot_from_outcome, validate_adb,
};
use acp_fixer_storage::{FileSnapshotStore, default_app_data_dir};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State, Wry};
use tauri_plugin_dialog::DialogExt;
use tokio::sync::Mutex;

use crate::adapters::TauriShellCommandRunner;

const ONBOARDING_VERSION: u32 = 2;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OnboardingStatus {
    Completed,
    Skipped,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ThemePreference {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Preferences {
    schema_version: u32,
    adb_path: Option<PathBuf>,
    onboarding_version: Option<u32>,
    onboarding_status: Option<OnboardingStatus>,
    theme_preference: ThemePreference,
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
    pub theme_preference: ThemePreference,
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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderChoice {
    pub provider_id: String,
    #[serde(flatten)]
    pub provider: ProviderService,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectionView {
    pub schema_version: u32,
    pub report: DiagnosisReport,
    pub providers: Vec<ProviderChoice>,
}

#[derive(Clone, Debug)]
struct PendingPlan {
    plan: ChangePlan,
    snapshot: SnapshotRecord,
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
    provider_generation: u64,
    providers: HashMap<String, (String, ComponentName)>,
    previews: HashMap<String, ChangePreview>,
    plans: HashMap<String, PendingPlan>,
}

#[derive(Debug)]
pub struct BackendState {
    runner: TauriShellCommandRunner,
    preferences_path: PathBuf,
    snapshots: FileSnapshotStore,
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
            snapshots: FileSnapshotStore::new(default_app_data_dir().join("snapshots")),
            session: Mutex::new(SessionState {
                preferences,
                preference_warning,
                selected_adb: None,
                candidate_generation: 0,
                candidates: HashMap::new(),
                device_generation: 0,
                devices: HashMap::new(),
                provider_generation: 0,
                providers: HashMap::new(),
                previews: HashMap::new(),
                plans: HashMap::new(),
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
    session.devices.clear();
    session.providers.clear();
    session.previews.clear();
    session.plans.clear();
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
) -> Result<InspectionView, ErrorEnvelope> {
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
    let report = diagnose_device(&state.runner, &adb, &serial)
        .await
        .map_err(|error| ErrorEnvelope::from(&error))?;
    let mut session = state.session.lock().await;
    session.provider_generation = session.provider_generation.wrapping_add(1);
    session.providers.clear();
    session.previews.clear();
    session.plans.clear();
    let generation = session.provider_generation;
    let providers = report
        .providers
        .iter()
        .cloned()
        .enumerate()
        .map(|(index, provider)| {
            let provider_id = format!("provider-{generation}-{index}");
            session.providers.insert(
                provider_id.clone(),
                (device_id.clone(), provider.component.clone()),
            );
            ProviderChoice {
                provider_id,
                provider,
            }
        })
        .collect();
    Ok(InspectionView {
        schema_version: 1,
        report,
        providers,
    })
}

#[tauri::command]
pub async fn prepare_pin(
    device_id: String,
    provider_id: String,
    allow_unparsed: bool,
    state: State<'_, BackendState>,
) -> Result<ChangePreview, ErrorEnvelope> {
    let (adb, serial, provider) = {
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
        let (provider_device_id, provider) = session
            .providers
            .get(&provider_id)
            .cloned()
            .ok_or_else(|| ErrorEnvelope::from(&ChangeError::TargetNotRegistered))?;
        if provider_device_id != device_id {
            return Err(ErrorEnvelope::from(&ChangeError::TargetNotRegistered));
        }
        (adb, serial, provider)
    };
    let report = diagnose_device(&state.runner, &adb, &serial)
        .await
        .map_err(|error| ErrorEnvelope::from(&error))?;
    let preview = prepare_pin_core(&report, &provider, allow_unparsed, new_id(), now_unix_ms())
        .map_err(|error| ErrorEnvelope::from(&error))?;
    state
        .session
        .lock()
        .await
        .previews
        .insert(preview.preview_id.clone(), preview.clone());
    Ok(preview)
}

#[tauri::command]
pub async fn create_pin_plan(
    preview_id: String,
    state: State<'_, BackendState>,
) -> Result<ChangePlan, ErrorEnvelope> {
    create_plan(&state, preview_id, ChangeKind::Pin).await
}

#[tauri::command]
pub async fn execute_pin_plan(
    plan_id: String,
    state: State<'_, BackendState>,
) -> Result<ChangeOutcome, ErrorEnvelope> {
    execute_plan(&state, plan_id, ChangeKind::Pin).await
}

#[tauri::command]
pub fn list_snapshots(state: State<'_, BackendState>) -> Result<SnapshotInventory, ErrorEnvelope> {
    state
        .snapshots
        .list()
        .map_err(|error| ErrorEnvelope::from(&error))
}

#[tauri::command]
pub async fn prepare_restore(
    device_id: String,
    snapshot_id: String,
    state: State<'_, BackendState>,
) -> Result<ChangePreview, ErrorEnvelope> {
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
    let snapshot = state
        .snapshots
        .load(&snapshot_id)
        .map_err(|error| ErrorEnvelope::from(&error))?;
    let report = diagnose_device(&state.runner, &adb, &serial)
        .await
        .map_err(|error| ErrorEnvelope::from(&error))?;
    let preview = prepare_restore_core(&report, &snapshot, new_id(), now_unix_ms())
        .map_err(|error| ErrorEnvelope::from(&error))?;
    state
        .session
        .lock()
        .await
        .previews
        .insert(preview.preview_id.clone(), preview.clone());
    Ok(preview)
}

#[tauri::command]
pub async fn create_restore_plan(
    preview_id: String,
    state: State<'_, BackendState>,
) -> Result<ChangePlan, ErrorEnvelope> {
    create_plan(&state, preview_id, ChangeKind::Restore).await
}

#[tauri::command]
pub async fn execute_restore_plan(
    plan_id: String,
    state: State<'_, BackendState>,
) -> Result<ChangeOutcome, ErrorEnvelope> {
    execute_plan(&state, plan_id, ChangeKind::Restore).await
}

#[tauri::command]
pub async fn discard_change_plan(
    plan_id: String,
    state: State<'_, BackendState>,
) -> Result<(), ErrorEnvelope> {
    let mut pending = state
        .session
        .lock()
        .await
        .plans
        .remove(&plan_id)
        .ok_or_else(|| ErrorEnvelope::from(&ChangeError::PlanUnavailable))?;
    expire_snapshot(&mut pending.snapshot, now_unix_ms());
    state
        .snapshots
        .save(&pending.snapshot)
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
pub async fn set_theme_preference(
    preference: ThemePreference,
    state: State<'_, BackendState>,
) -> Result<StartupState, ErrorEnvelope> {
    let mut session = state.session.lock().await;
    let mut next = session.preferences.clone();
    next.theme_preference = preference;
    save_preferences(&state.preferences_path, &next)?;
    session.preferences = next;
    Ok(startup_state(&session))
}

#[tauri::command]
pub fn get_demo_fixture() -> DemoFixture {
    demo_fixture()
}

async fn create_plan(
    state: &State<'_, BackendState>,
    preview_id: String,
    expected_kind: ChangeKind,
) -> Result<ChangePlan, ErrorEnvelope> {
    let preview = state
        .session
        .lock()
        .await
        .previews
        .remove(&preview_id)
        .ok_or_else(|| ErrorEnvelope::from(&ChangeError::PlanUnavailable))?;
    if preview.kind != expected_kind {
        return Err(ErrorEnvelope::from(&ChangeError::PlanUnavailable));
    }
    let (plan, snapshot) = create_change_plan(&preview, new_id(), new_id(), now_unix_ms())
        .map_err(|error| ErrorEnvelope::from(&error))?;
    state
        .snapshots
        .save(&snapshot)
        .map_err(|error| ErrorEnvelope::from(&error))?;
    state.session.lock().await.plans.insert(
        plan.plan_id.clone(),
        PendingPlan {
            plan: plan.clone(),
            snapshot,
        },
    );
    Ok(plan)
}

async fn execute_plan(
    state: &State<'_, BackendState>,
    plan_id: String,
    expected_kind: ChangeKind,
) -> Result<ChangeOutcome, ErrorEnvelope> {
    let mut pending = state
        .session
        .lock()
        .await
        .plans
        .remove(&plan_id)
        .ok_or_else(|| ErrorEnvelope::from(&ChangeError::PlanUnavailable))?;
    if pending.plan.kind != expected_kind {
        return Err(ErrorEnvelope::from(&ChangeError::PlanUnavailable));
    }
    let now = now_unix_ms();
    if now > pending.plan.expires_at_unix_ms {
        expire_snapshot(&mut pending.snapshot, now);
        state
            .snapshots
            .save(&pending.snapshot)
            .map_err(|error| ErrorEnvelope::from(&error))?;
        return Err(ErrorEnvelope::from(&ChangeError::PlanExpired));
    }
    let outcome = execute_change(&state.runner, &pending.plan, now)
        .await
        .map_err(|error| ErrorEnvelope::from(&error))?;
    update_snapshot_from_outcome(&mut pending.snapshot, &outcome);
    state
        .snapshots
        .save(&pending.snapshot)
        .map_err(|error| ErrorEnvelope::from(&error))?;
    if outcome.status == acp_fixer_core::ChangeOutcomeStatus::Restored {
        let source_id = pending
            .plan
            .source_snapshot_id
            .as_deref()
            .ok_or_else(|| ErrorEnvelope::from(&ChangeError::PlanUnavailable))?;
        let mut source = state
            .snapshots
            .load(source_id)
            .map_err(|error| ErrorEnvelope::from(&error))?;
        mark_source_snapshot_restored(&mut source, &outcome)
            .map_err(|error| ErrorEnvelope::from(&error))?;
        state
            .snapshots
            .save(&source)
            .map_err(|error| ErrorEnvelope::from(&error))?;
    }
    Ok(outcome)
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
    session.providers.clear();
    session.previews.clear();
    session.plans.clear();
    Ok(adb)
}

async fn cache_devices(state: &State<'_, BackendState>, list: DeviceList) -> DeviceListView {
    let mut session = state.session.lock().await;
    session.device_generation = session.device_generation.wrapping_add(1);
    session.devices.clear();
    session.providers.clear();
    session.previews.clear();
    session.plans.clear();
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
        theme_preference: session.preferences.theme_preference,
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

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn now_unix_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
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
            theme_preference: ThemePreference::Dark,
        };

        save_preferences(&path, &preferences).unwrap();
        let (actual, warning) = load_preferences(&path);

        assert_eq!(actual, preferences);
        assert!(warning.is_none());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn preferences_without_theme_migrate_to_system() {
        let directory = temporary_directory();
        let path = directory.join("preferences.json");
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            &path,
            br#"{"schemaVersion":1,"onboardingVersion":2,"onboardingStatus":"skipped"}"#,
        )
        .unwrap();

        let (preferences, warning) = load_preferences(&path);

        assert_eq!(preferences.theme_preference, ThemePreference::System);
        assert!(warning.is_none());
        fs::remove_dir_all(directory).unwrap();
    }

    fn temporary_directory() -> PathBuf {
        let suffix = NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("acp-fixer-test-{}-{suffix}", std::process::id()))
    }
}
