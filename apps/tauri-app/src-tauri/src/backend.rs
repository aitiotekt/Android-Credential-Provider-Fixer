use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use acp_fixer_core::{
    AdbCandidateEntity, AdbCandidateSource, AdbDiscoveryContext, AdbDiscoveryEntity,
    AdbSelectionEntity, AdbSelectionId, ChangeError, ChangeExecution, ChangeKind, ChangePlan,
    ChangePreview, DemoFixture, DeviceEntity, DeviceEnumerationEntity, DeviceEnumerationId,
    DeviceId, DiagnosisEntity, DiagnosisId, DiagnosticError, DiscoveryId, ErrorCode, ErrorEnvelope,
    ExecutionId, ExecutionStatus, PUBLIC_SCHEMA_VERSION, PlanId, PlanStatus, PreviewId,
    ProviderEntity, ProviderId, SessionContext, SnapshotId, SnapshotInventory, SnapshotRecord,
    SnapshotStore, ValidatedAdb, authorize_unparsed_preview, cancel_snapshot, consume_preview,
    create_change_plan, demo_fixture, diagnose_device, discover_adb as discover_adb_core,
    execute_change, expire_snapshot, invalidate_snapshot, list_devices as list_devices_core,
    mark_snapshot_executing, mark_source_snapshot_restored, prepare_pin as prepare_pin_core,
    prepare_restore as prepare_restore_core, update_snapshot_from_outcome, validate_adb,
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
    pub adb_selection: Option<AdbSelectionEntity>,
    pub preference_warning: Option<ErrorEnvelope>,
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
    revision: u64,
    discovery: Option<AdbDiscoveryEntity>,
    selection: Option<AdbSelectionEntity>,
    enumeration: Option<DeviceEnumerationEntity>,
    diagnoses: HashMap<DiagnosisId, DiagnosisEntity>,
    latest_diagnosis_id: Option<DiagnosisId>,
    previews: HashMap<PreviewId, ChangePreview>,
    plans: HashMap<PlanId, PendingPlan>,
    executions: HashMap<ExecutionId, ChangeExecution>,
}

impl SessionState {
    fn context(&self) -> SessionContext {
        SessionContext {
            schema_version: PUBLIC_SCHEMA_VERSION,
            session_revision: self.revision,
            selection_id: self
                .selection
                .as_ref()
                .map(|entity| entity.selection_id.clone()),
            enumeration_id: self
                .enumeration
                .as_ref()
                .map(|entity| entity.enumeration_id.clone()),
            latest_diagnosis_id: self.latest_diagnosis_id.clone(),
        }
    }

    fn advance(&mut self) -> u64 {
        self.revision = self.revision.wrapping_add(1);
        self.revision
    }

    fn clear_after_selection(&mut self) -> Vec<PendingPlan> {
        self.enumeration = None;
        self.clear_after_enumeration()
    }

    fn clear_after_enumeration(&mut self) -> Vec<PendingPlan> {
        self.clear_after_diagnosis()
    }

    fn clear_after_diagnosis(&mut self) -> Vec<PendingPlan> {
        self.latest_diagnosis_id = None;
        self.diagnoses.clear();
        self.previews.clear();
        self.executions.clear();
        self.plans.drain().map(|(_, plan)| plan).collect()
    }

    fn retain_referenced_diagnoses(&mut self) {
        let mut ids = self.latest_diagnosis_id.iter().cloned().collect::<Vec<_>>();
        ids.extend(
            self.previews
                .values()
                .map(|preview| preview.source_diagnosis_id.clone()),
        );
        ids.extend(
            self.plans
                .values()
                .map(|pending| pending.plan.source_diagnosis_id.clone()),
        );
        ids.extend(
            self.executions
                .values()
                .map(|execution| execution.source_diagnosis_id.clone()),
        );
        self.diagnoses.retain(|id, _| ids.contains(id));
    }
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
                revision: 0,
                discovery: None,
                selection: None,
                enumeration: None,
                diagnoses: HashMap::new(),
                latest_diagnosis_id: None,
                previews: HashMap::new(),
                plans: HashMap::new(),
                executions: HashMap::new(),
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
        if session.selection.is_some() {
            return Ok(startup_state(&session));
        }
        session.preferences.adb_path.clone()
    };
    if let Some(path) = saved_path {
        match validate_adb(&state.runner, &path).await {
            Ok(adb) => {
                let mut session = state.session.lock().await;
                let revision = session.advance();
                session.selection = Some(selection_entity(adb, None, revision));
            }
            Err(error) => {
                state.session.lock().await.preference_warning = Some(ErrorEnvelope::from(&error));
            }
        }
    }
    let session = state.session.lock().await;
    Ok(startup_state(&session))
}

#[tauri::command]
pub async fn get_session_context(
    state: State<'_, BackendState>,
) -> Result<SessionContext, ErrorEnvelope> {
    Ok(state.session.lock().await.context())
}

#[tauri::command]
pub async fn discover_adb(
    state: State<'_, BackendState>,
) -> Result<AdbDiscoveryEntity, ErrorEnvelope> {
    let (saved, operation_revision, plans) = {
        let mut session = state.session.lock().await;
        let saved = session.preferences.adb_path.clone();
        let revision = session.advance();
        session.selection = None;
        let plans = session.clear_after_selection();
        (saved, revision, plans)
    };
    invalidate_plans(&state, plans, "ADB discovery changed the active context")?;
    let explicit = saved
        .map(|path| vec![(path, AdbCandidateSource::Saved)])
        .unwrap_or_default();
    let result = discover_adb_core(
        &state.runner,
        &AdbDiscoveryContext::from_environment(explicit),
    )
    .await;
    let mut session = state.session.lock().await;
    if session.revision != operation_revision {
        return Err(stale_error());
    }
    let entity = AdbDiscoveryEntity {
        schema_version: PUBLIC_SCHEMA_VERSION,
        discovery_id: DiscoveryId::from(new_id()),
        session_revision: operation_revision,
        completed_at_unix_ms: now_unix_ms(),
        candidates: result
            .candidates
            .into_iter()
            .map(|candidate| AdbCandidateEntity {
                candidate_id: new_id(),
                source: candidate.source,
                adb: candidate.adb,
            })
            .collect(),
        failures: result.failures,
    };
    session.discovery = Some(entity.clone());
    Ok(entity)
}

#[tauri::command]
pub async fn select_adb_candidate(
    discovery_id: DiscoveryId,
    candidate_id: String,
    state: State<'_, BackendState>,
) -> Result<AdbSelectionEntity, ErrorEnvelope> {
    let adb = {
        let session = state.session.lock().await;
        session
            .discovery
            .as_ref()
            .filter(|entity| entity.discovery_id == discovery_id)
            .and_then(|entity| {
                entity
                    .candidates
                    .iter()
                    .find(|candidate| candidate.candidate_id == candidate_id)
            })
            .map(|candidate| candidate.adb.clone())
            .ok_or_else(stale_error)?
    };
    select_and_persist(&state, adb, Some(discovery_id)).await
}

#[tauri::command]
pub async fn choose_adb_executable(
    app: AppHandle<Wry>,
    state: State<'_, BackendState>,
) -> Result<Option<AdbSelectionEntity>, ErrorEnvelope> {
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
    select_and_persist(&state, adb, None).await.map(Some)
}

#[tauri::command]
pub async fn list_devices(
    selection_id: AdbSelectionId,
    state: State<'_, BackendState>,
) -> Result<DeviceEnumerationEntity, ErrorEnvelope> {
    let (adb, revision, plans) = {
        let mut session = state.session.lock().await;
        let selection = session
            .selection
            .as_ref()
            .filter(|entity| entity.selection_id == selection_id)
            .ok_or_else(stale_error)?;
        let adb = selection.adb.clone();
        let revision = session.advance();
        let plans = session.clear_after_enumeration();
        (adb, revision, plans)
    };
    invalidate_plans(&state, plans, "device enumeration changed")?;
    let list = list_devices_core(&state.runner, &adb)
        .await
        .map_err(|error| ErrorEnvelope::from(&error))?;
    let mut session = state.session.lock().await;
    if session.revision != revision
        || session
            .selection
            .as_ref()
            .map(|entity| &entity.selection_id)
            != Some(&selection_id)
    {
        return Err(stale_error());
    }
    let entity = DeviceEnumerationEntity {
        schema_version: PUBLIC_SCHEMA_VERSION,
        enumeration_id: DeviceEnumerationId::from(new_id()),
        selection_id,
        session_revision: revision,
        observed_at_unix_ms: list.observed_at_unix_ms,
        devices: list
            .devices
            .into_iter()
            .map(|device| DeviceEntity {
                device_id: DeviceId::from(new_id()),
                device,
            })
            .collect(),
    };
    session.enumeration = Some(entity.clone());
    Ok(entity)
}

#[tauri::command]
pub async fn resolve_diagnosis(
    enumeration_id: DeviceEnumerationId,
    device_id: DeviceId,
    state: State<'_, BackendState>,
) -> Result<DiagnosisEntity, ErrorEnvelope> {
    let (adb, serial, revision, started_at, plans) = {
        let mut session = state.session.lock().await;
        let adb = session
            .selection
            .as_ref()
            .map(|entity| entity.adb.clone())
            .ok_or_else(stale_error)?;
        let enumeration = session
            .enumeration
            .as_ref()
            .filter(|entity| entity.enumeration_id == enumeration_id)
            .ok_or_else(|| ErrorEnvelope::from(&DiagnosticError::DeviceSelectionRequired))?;
        let serial = enumeration
            .devices
            .iter()
            .find(|entity| entity.device_id == device_id)
            .map(|entity| entity.device.serial.clone())
            .ok_or_else(|| ErrorEnvelope::from(&DiagnosticError::DeviceSelectionRequired))?;
        let revision = session.advance();
        let plans = session.clear_after_diagnosis();
        (adb, serial, revision, now_unix_ms(), plans)
    };
    invalidate_plans(&state, plans, "a new diagnosis changed the active context")?;
    let report = diagnose_device(&state.runner, &adb, &serial)
        .await
        .map_err(|error| ErrorEnvelope::from(&error))?;
    let mut session = state.session.lock().await;
    let still_current = session.revision == revision
        && session.enumeration.as_ref().is_some_and(|entity| {
            entity.enumeration_id == enumeration_id
                && entity
                    .devices
                    .iter()
                    .any(|device| device.device_id == device_id)
        });
    if !still_current {
        return Err(ErrorEnvelope::from(&DiagnosticError::DeviceChanged {
            serial,
        }));
    }
    let diagnosis_id = DiagnosisId::from(new_id());
    let entity = DiagnosisEntity {
        schema_version: PUBLIC_SCHEMA_VERSION,
        diagnosis_id: diagnosis_id.clone(),
        session_revision: revision,
        enumeration_id,
        device_id,
        started_at_unix_ms: started_at,
        resolved_at_unix_ms: now_unix_ms(),
        providers: report
            .providers
            .iter()
            .cloned()
            .map(|provider| ProviderEntity {
                provider_id: ProviderId::from(new_id()),
                diagnosis_id: diagnosis_id.clone(),
                provider,
            })
            .collect(),
        report,
    };
    session.latest_diagnosis_id = Some(diagnosis_id.clone());
    session.diagnoses.insert(diagnosis_id, entity.clone());
    session.retain_referenced_diagnoses();
    Ok(entity)
}

#[tauri::command]
pub async fn prepare_pin(
    diagnosis_id: DiagnosisId,
    provider_id: ProviderId,
    allow_unparsed: bool,
    state: State<'_, BackendState>,
) -> Result<ChangePreview, ErrorEnvelope> {
    let mut session = state.session.lock().await;
    let diagnosis = current_diagnosis(&session, &diagnosis_id)?;
    let target = diagnosis
        .providers
        .iter()
        .find(|provider| {
            provider.provider_id == provider_id && provider.diagnosis_id == diagnosis_id
        })
        .map(|provider| provider.provider.component.clone())
        .ok_or_else(|| ErrorEnvelope::from(&ChangeError::TargetNotRegistered))?;
    let report = diagnosis.report.clone();
    let preview = prepare_pin_core(
        &report,
        &target,
        allow_unparsed,
        diagnosis_id,
        PreviewId::from(new_id()),
        now_unix_ms(),
    )
    .map_err(|error| ErrorEnvelope::from(&error))?;
    session.previews.clear();
    session
        .previews
        .insert(preview.preview_id.clone(), preview.clone());
    Ok(preview)
}

#[tauri::command]
pub async fn authorize_pin_preview(
    preview_id: PreviewId,
    state: State<'_, BackendState>,
) -> Result<ChangePreview, ErrorEnvelope> {
    let mut session = state.session.lock().await;
    let latest_diagnosis_id = session.latest_diagnosis_id.clone();
    let preview = session
        .previews
        .get_mut(&preview_id)
        .ok_or_else(|| ErrorEnvelope::from(&ChangeError::PreviewBlocked))?;
    if latest_diagnosis_id.as_ref() != Some(&preview.source_diagnosis_id) {
        return Err(ErrorEnvelope::from(&ChangeError::DiagnosisUnavailable));
    }
    authorize_unparsed_preview(preview).map_err(|error| ErrorEnvelope::from(&error))?;
    Ok(preview.clone())
}

#[tauri::command]
pub async fn prepare_restore(
    diagnosis_id: DiagnosisId,
    snapshot_id: SnapshotId,
    state: State<'_, BackendState>,
) -> Result<ChangePreview, ErrorEnvelope> {
    let snapshot = state
        .snapshots
        .load(&snapshot_id)
        .map_err(|error| ErrorEnvelope::from(&error))?;
    let mut session = state.session.lock().await;
    let diagnosis = current_diagnosis(&session, &diagnosis_id)?;
    let preview = prepare_restore_core(
        &diagnosis.report,
        &snapshot,
        diagnosis_id,
        PreviewId::from(new_id()),
        now_unix_ms(),
    )
    .map_err(|error| ErrorEnvelope::from(&error))?;
    session.previews.clear();
    session
        .previews
        .insert(preview.preview_id.clone(), preview.clone());
    Ok(preview)
}

#[tauri::command]
pub async fn create_pin_plan(
    preview_id: PreviewId,
    state: State<'_, BackendState>,
) -> Result<ChangePlan, ErrorEnvelope> {
    create_plan(&state, preview_id, ChangeKind::Pin).await
}

#[tauri::command]
pub async fn create_restore_plan(
    preview_id: PreviewId,
    state: State<'_, BackendState>,
) -> Result<ChangePlan, ErrorEnvelope> {
    create_plan(&state, preview_id, ChangeKind::Restore).await
}

#[tauri::command]
pub async fn execute_pin_plan(
    plan_id: PlanId,
    state: State<'_, BackendState>,
) -> Result<ChangeExecution, ErrorEnvelope> {
    execute_plan(&state, plan_id, ChangeKind::Pin).await
}

#[tauri::command]
pub async fn execute_restore_plan(
    plan_id: PlanId,
    state: State<'_, BackendState>,
) -> Result<ChangeExecution, ErrorEnvelope> {
    execute_plan(&state, plan_id, ChangeKind::Restore).await
}

#[tauri::command]
pub async fn cancel_change_plan(
    plan_id: PlanId,
    state: State<'_, BackendState>,
) -> Result<ChangeExecution, ErrorEnvelope> {
    let mut pending = state
        .session
        .lock()
        .await
        .plans
        .remove(&plan_id)
        .ok_or_else(|| ErrorEnvelope::from(&ChangeError::PlanUnavailable))?;
    let planned = pending.clone();
    let completed_at = now_unix_ms();
    cancel_snapshot(&mut pending.snapshot, completed_at)
        .map_err(|error| ErrorEnvelope::from(&error))?;
    if let Err(error) = state.snapshots.save(&pending.snapshot) {
        state.session.lock().await.plans.insert(plan_id, planned);
        return Err(ErrorEnvelope::from(&error));
    }
    let execution = terminal_execution(
        &pending.plan,
        ExecutionStatus::Cancelled,
        false,
        completed_at,
        None,
    );
    record_execution(&state, execution.clone()).await;
    Ok(execution)
}

#[tauri::command]
pub fn list_snapshots(state: State<'_, BackendState>) -> Result<SnapshotInventory, ErrorEnvelope> {
    state
        .snapshots
        .list()
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
    preview_id: PreviewId,
    expected_kind: ChangeKind,
) -> Result<ChangePlan, ErrorEnvelope> {
    let (preview, revision) = {
        let session = state.session.lock().await;
        let preview = session
            .previews
            .get(&preview_id)
            .filter(|preview| {
                preview.kind == expected_kind
                    && session.latest_diagnosis_id.as_ref() == Some(&preview.source_diagnosis_id)
            })
            .cloned()
            .ok_or_else(|| ErrorEnvelope::from(&ChangeError::PlanUnavailable))?;
        (preview, session.revision)
    };
    let (plan, mut snapshot) = create_change_plan(
        &preview,
        PlanId::from(new_id()),
        SnapshotId::from(new_id()),
        now_unix_ms(),
    )
    .map_err(|error| ErrorEnvelope::from(&error))?;
    state
        .snapshots
        .save(&snapshot)
        .map_err(|error| ErrorEnvelope::from(&error))?;
    let mut session = state.session.lock().await;
    let unchanged = session.revision == revision
        && session
            .previews
            .get(&preview_id)
            .is_some_and(|current| current.revision == preview.revision);
    if !unchanged {
        invalidate_snapshot(
            &mut snapshot,
            now_unix_ms(),
            "preview context changed before plan commit",
        )
        .map_err(|error| ErrorEnvelope::from(&error))?;
        drop(session);
        state
            .snapshots
            .save(&snapshot)
            .map_err(|error| ErrorEnvelope::from(&error))?;
        return Err(ErrorEnvelope::from(&ChangeError::PlanUnavailable));
    }
    consume_preview(
        session
            .previews
            .get_mut(&preview_id)
            .expect("preview identity was checked"),
    )
    .map_err(|error| ErrorEnvelope::from(&error))?;
    session.plans.insert(
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
    plan_id: PlanId,
    expected_kind: ChangeKind,
) -> Result<ChangeExecution, ErrorEnvelope> {
    let (mut pending, diagnosis_is_current) = {
        let mut session = state.session.lock().await;
        let pending = session
            .plans
            .remove(&plan_id)
            .filter(|pending| {
                pending.plan.kind == expected_kind && pending.plan.status == PlanStatus::Ready
            })
            .ok_or_else(|| ErrorEnvelope::from(&ChangeError::PlanUnavailable))?;
        let diagnosis_is_current =
            session.latest_diagnosis_id.as_ref() == Some(&pending.plan.source_diagnosis_id);
        (pending, diagnosis_is_current)
    };
    let now = now_unix_ms();
    if !diagnosis_is_current {
        pending.plan.status = PlanStatus::Invalidated;
        invalidate_snapshot(
            &mut pending.snapshot,
            now,
            "the source diagnosis is no longer current",
        )
        .map_err(|error| ErrorEnvelope::from(&error))?;
        state
            .snapshots
            .save(&pending.snapshot)
            .map_err(|error| ErrorEnvelope::from(&error))?;
        let execution = terminal_execution(
            &pending.plan,
            ExecutionStatus::Invalidated,
            false,
            now,
            Some(&ChangeError::StateChanged),
        );
        record_execution(state, execution.clone()).await;
        return Ok(execution);
    }
    if now > pending.plan.expires_at_unix_ms {
        expire_snapshot(&mut pending.snapshot, now);
        state
            .snapshots
            .save(&pending.snapshot)
            .map_err(|error| ErrorEnvelope::from(&error))?;
        let execution = terminal_execution(
            &pending.plan,
            ExecutionStatus::Expired,
            false,
            now,
            Some(&ChangeError::PlanExpired),
        );
        record_execution(state, execution.clone()).await;
        return Ok(execution);
    }
    let planned_snapshot = pending.snapshot.clone();
    mark_snapshot_executing(&mut pending.snapshot, now)
        .map_err(|error| ErrorEnvelope::from(&error))?;
    if let Err(error) = state.snapshots.save(&pending.snapshot) {
        pending.snapshot = planned_snapshot;
        state.session.lock().await.plans.insert(plan_id, pending);
        return Err(ErrorEnvelope::from(&error));
    }
    pending.plan.status = PlanStatus::Executing;
    let result = execute_change(&state.runner, &pending.plan, now).await;
    let completed_at = now_unix_ms();
    let mut execution = match result {
        Ok(outcome) => {
            update_snapshot_from_outcome(&mut pending.snapshot, &outcome);
            pending.plan.status = PlanStatus::Completed;
            ChangeExecution {
                schema_version: PUBLIC_SCHEMA_VERSION,
                execution_id: ExecutionId::from(new_id()),
                plan_id: pending.plan.plan_id.clone(),
                source_diagnosis_id: pending.plan.source_diagnosis_id.clone(),
                status: match outcome.status {
                    acp_fixer_core::ChangeOutcomeStatus::Applied => ExecutionStatus::Applied,
                    acp_fixer_core::ChangeOutcomeStatus::Restored => ExecutionStatus::Restored,
                    acp_fixer_core::ChangeOutcomeStatus::Recovered => ExecutionStatus::Recovered,
                    acp_fixer_core::ChangeOutcomeStatus::RecoveryFailed => {
                        ExecutionStatus::RecoveryFailed
                    }
                },
                write_attempted: true,
                completed_at_unix_ms: completed_at,
                outcome: Some(outcome),
                error: None,
                persistence_warning: None,
            }
        }
        Err(error) => {
            pending.plan.status = PlanStatus::Invalidated;
            invalidate_snapshot(&mut pending.snapshot, completed_at, error.to_string())
                .map_err(|snapshot_error| ErrorEnvelope::from(&snapshot_error))?;
            terminal_execution(
                &pending.plan,
                ExecutionStatus::Invalidated,
                false,
                completed_at,
                Some(&error),
            )
        }
    };
    if let Err(error) = state.snapshots.save(&pending.snapshot) {
        execution.persistence_warning = Some(ErrorEnvelope::from(&error));
    }
    if execution.status == ExecutionStatus::Restored
        && let (Some(source_id), Some(outcome)) = (
            pending.plan.source_snapshot_id.as_ref(),
            execution.outcome.as_ref(),
        )
        && let Ok(mut source) = state.snapshots.load(source_id)
        && let Err(error) = mark_source_snapshot_restored(&mut source, outcome)
            .and_then(|()| state.snapshots.save(&source))
    {
        execution.persistence_warning = Some(ErrorEnvelope::from(&error));
    }
    {
        let mut session = state.session.lock().await;
        session.advance();
        session.latest_diagnosis_id = None;
        session.previews.clear();
        session
            .executions
            .insert(execution.execution_id.clone(), execution.clone());
        session.retain_referenced_diagnoses();
    }
    Ok(execution)
}

async fn record_execution(state: &State<'_, BackendState>, execution: ChangeExecution) {
    state
        .session
        .lock()
        .await
        .executions
        .insert(execution.execution_id.clone(), execution);
}

fn terminal_execution(
    plan: &ChangePlan,
    status: ExecutionStatus,
    write_attempted: bool,
    completed_at_unix_ms: u64,
    error: Option<&ChangeError>,
) -> ChangeExecution {
    ChangeExecution {
        schema_version: PUBLIC_SCHEMA_VERSION,
        execution_id: ExecutionId::from(new_id()),
        plan_id: plan.plan_id.clone(),
        source_diagnosis_id: plan.source_diagnosis_id.clone(),
        status,
        write_attempted,
        completed_at_unix_ms,
        outcome: None,
        error: error.map(ErrorEnvelope::from),
        persistence_warning: None,
    }
}

fn current_diagnosis<'a>(
    session: &'a SessionState,
    diagnosis_id: &DiagnosisId,
) -> Result<&'a DiagnosisEntity, ErrorEnvelope> {
    if session.latest_diagnosis_id.as_ref() != Some(diagnosis_id) {
        return Err(ErrorEnvelope::from(&ChangeError::DiagnosisUnavailable));
    }
    session
        .diagnoses
        .get(diagnosis_id)
        .ok_or_else(|| ErrorEnvelope::from(&ChangeError::DiagnosisUnavailable))
}

async fn select_and_persist(
    state: &State<'_, BackendState>,
    adb: ValidatedAdb,
    discovery_id: Option<DiscoveryId>,
) -> Result<AdbSelectionEntity, ErrorEnvelope> {
    let mut session = state.session.lock().await;
    if let Some(expected_discovery_id) = discovery_id.as_ref()
        && session
            .discovery
            .as_ref()
            .map(|entity| &entity.discovery_id)
            != Some(expected_discovery_id)
    {
        return Err(stale_error());
    }
    let mut preferences = session.preferences.clone();
    preferences.adb_path = Some(adb.path.clone());
    save_preferences(&state.preferences_path, &preferences)?;
    session.preferences = preferences;
    let revision = session.advance();
    let plans = session.clear_after_selection();
    let selection = selection_entity(adb, discovery_id, revision);
    session.selection = Some(selection.clone());
    drop(session);
    invalidate_plans(state, plans, "ADB selection changed")?;
    Ok(selection)
}

fn selection_entity(
    adb: ValidatedAdb,
    discovery_id: Option<DiscoveryId>,
    revision: u64,
) -> AdbSelectionEntity {
    AdbSelectionEntity {
        schema_version: PUBLIC_SCHEMA_VERSION,
        selection_id: AdbSelectionId::from(new_id()),
        discovery_id,
        session_revision: revision,
        selected_at_unix_ms: now_unix_ms(),
        adb,
    }
}

fn invalidate_plans(
    state: &State<'_, BackendState>,
    plans: Vec<PendingPlan>,
    reason: &str,
) -> Result<(), ErrorEnvelope> {
    for mut pending in plans {
        invalidate_snapshot(&mut pending.snapshot, now_unix_ms(), reason)
            .map_err(|error| ErrorEnvelope::from(&error))?;
        state
            .snapshots
            .save(&pending.snapshot)
            .map_err(|error| ErrorEnvelope::from(&error))?;
    }
    Ok(())
}

fn startup_state(session: &SessionState) -> StartupState {
    StartupState {
        schema_version: PUBLIC_SCHEMA_VERSION,
        onboarding_version: ONBOARDING_VERSION,
        onboarding_status: (session.preferences.onboarding_version == Some(ONBOARDING_VERSION))
            .then_some(session.preferences.onboarding_status)
            .flatten(),
        theme_preference: session.preferences.theme_preference,
        adb_selection: session.selection.clone(),
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

fn stale_error() -> ErrorEnvelope {
    ErrorEnvelope::from(&DiagnosticError::AdbSelectionStale)
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
