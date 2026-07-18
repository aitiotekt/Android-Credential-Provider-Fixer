use std::ffi::OsString;

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::diagnostics::{
    ADB_COMMAND_MAX_OUTPUT_BYTES, ADB_COMMAND_TIMEOUT, ensure_success, now_unix_ms, read_setting,
};
use crate::{
    CommandRequest, CommandRunner, ComponentName, DiagnosisReport, DiagnosisStatus,
    DiagnosticError, ErrorCode, SettingValue, ValidatedAdb, canonical_component_name,
    diagnose_device, run_command,
};

pub const CHANGE_PLAN_TTL_MS: u64 = 5 * 60 * 1_000;
const MAX_SETTING_BYTES: usize = 16 * 1024;
const ENABLED_KEY: &str = "credential_service";
const PRIMARY_KEY: &str = "credential_service_primary";

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChangeKind {
    Pin,
    Restore,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ChangeBlocker {
    AndroidVersionUnsupported,
    DiagnosisUnavailable,
    TargetNotRegistered,
    UnparsedConfirmationRequired,
    StateChanged,
    SnapshotNotRestorable,
    NoChangeRequired,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ManagedSettingValue {
    Missing,
    Empty,
    Value { raw: String, parseable: bool },
}

impl ManagedSettingValue {
    fn from_setting(value: &SettingValue) -> Result<Self, ChangeError> {
        match value {
            SettingValue::Missing => Ok(Self::Missing),
            SettingValue::Empty => Ok(Self::Empty),
            SettingValue::Value { raw, components } => {
                validate_raw_value(raw)?;
                Ok(Self::Value {
                    raw: raw.clone(),
                    parseable: components.is_some(),
                })
            }
            SettingValue::Unavailable { .. } => Err(ChangeError::SettingUnavailable),
        }
    }

    #[must_use]
    pub const fn is_parseable(&self) -> bool {
        !matches!(
            self,
            Self::Value {
                parseable: false,
                ..
            }
        )
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedCredentialState {
    pub enabled: ManagedSettingValue,
    pub primary: ManagedSettingValue,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePreview {
    pub schema_version: u32,
    pub preview_id: String,
    pub source_snapshot_id: Option<String>,
    pub kind: ChangeKind,
    pub created_at_unix_ms: u64,
    pub adb: ValidatedAdb,
    pub device: crate::DeviceInfo,
    pub android_user: crate::AndroidUser,
    pub target: ComponentName,
    pub registered_providers: Vec<String>,
    pub before: ManagedCredentialState,
    pub after: ManagedCredentialState,
    pub requires_unparsed_confirmation: bool,
    pub allow_unparsed: bool,
    pub blockers: Vec<ChangeBlocker>,
}

impl ChangePreview {
    #[must_use]
    pub fn eligible(&self) -> bool {
        self.blockers.is_empty()
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePlan {
    pub schema_version: u32,
    pub plan_id: String,
    pub snapshot_id: String,
    pub source_snapshot_id: Option<String>,
    pub created_at_unix_ms: u64,
    pub expires_at_unix_ms: u64,
    pub kind: ChangeKind,
    pub adb: ValidatedAdb,
    pub device: crate::DeviceInfo,
    pub android_user: crate::AndroidUser,
    pub target: ComponentName,
    pub registered_providers: Vec<String>,
    pub before: ManagedCredentialState,
    pub after: ManagedCredentialState,
    pub allow_unparsed: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SnapshotStatus {
    Planned,
    Expired,
    Applied,
    Recovered,
    RecoveryFailed,
    Restored,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotRecord {
    pub schema_version: u32,
    pub revision: u32,
    pub snapshot_id: String,
    pub plan_id: String,
    pub source_snapshot_id: Option<String>,
    pub created_at_unix_ms: u64,
    pub updated_at_unix_ms: u64,
    pub status: SnapshotStatus,
    pub kind: ChangeKind,
    pub adb: ValidatedAdb,
    pub device: crate::DeviceInfo,
    pub android_user: crate::AndroidUser,
    pub target: ComponentName,
    pub registered_providers: Vec<String>,
    pub before: ManagedCredentialState,
    pub intended_after: ManagedCredentialState,
    pub last_observed: Option<ManagedCredentialState>,
    pub message: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SettingMutation {
    Put,
    Delete,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeStepOutcome {
    pub key: String,
    pub mutation: SettingMutation,
    pub success: bool,
    pub observed: Option<ManagedSettingValue>,
    pub error: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChangeOutcomeStatus {
    Applied,
    Restored,
    Recovered,
    RecoveryFailed,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeOutcome {
    pub schema_version: u32,
    pub plan_id: String,
    pub snapshot_id: String,
    pub status: ChangeOutcomeStatus,
    pub completed_at_unix_ms: u64,
    pub steps: Vec<ChangeStepOutcome>,
    pub recovery_steps: Vec<ChangeStepOutcome>,
    pub observed: ManagedCredentialState,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotWarning {
    pub file: String,
    pub code: String,
    pub message: String,
}

#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotInventory {
    pub schema_version: u32,
    pub snapshots: Vec<SnapshotRecord>,
    pub warnings: Vec<SnapshotWarning>,
}

pub trait SnapshotStore: Send + Sync {
    fn save(&self, snapshot: &SnapshotRecord) -> Result<(), ChangeError>;
    fn load(&self, snapshot_id: &str) -> Result<SnapshotRecord, ChangeError>;
    fn list(&self) -> Result<SnapshotInventory, ChangeError>;
}

#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum ChangeError {
    #[error("the diagnosis cannot be used to create a change plan")]
    DiagnosisUnavailable,
    #[error("the selected provider is not registered for the current Android user")]
    TargetNotRegistered,
    #[error("a managed setting is unavailable")]
    SettingUnavailable,
    #[error("the setting value exceeds the safe size limit")]
    SettingValueTooLarge,
    #[error("the setting value contains a NUL character")]
    SettingValueInvalid,
    #[error("explicit confirmation is required for an unparsed OEM setting value")]
    UnparsedConfirmationRequired,
    #[error("the requested change would not modify either managed setting")]
    NoChangeRequired,
    #[error("the change preview is blocked")]
    PreviewBlocked,
    #[error("the one-use change plan has expired")]
    PlanExpired,
    #[error("the one-use change plan is no longer available")]
    PlanUnavailable,
    #[error("the device state changed after the plan was created")]
    StateChanged,
    #[error("snapshot {snapshot_id} is not restorable")]
    SnapshotNotRestorable { snapshot_id: String },
    #[error("snapshot {snapshot_id} was not found")]
    SnapshotNotFound { snapshot_id: String },
    #[error("snapshot storage failed: {message}")]
    SnapshotStorage { message: String },
    #[error("snapshot data is invalid: {message}")]
    SnapshotInvalid { message: String },
    #[error(transparent)]
    Diagnostic(#[from] DiagnosticError),
}

impl ChangeError {
    #[must_use]
    pub const fn code(&self) -> ErrorCode {
        match self {
            Self::DiagnosisUnavailable => ErrorCode::ChangeDiagnosisUnavailable,
            Self::TargetNotRegistered => ErrorCode::ChangeTargetNotRegistered,
            Self::SettingUnavailable => ErrorCode::ChangeSettingUnavailable,
            Self::SettingValueTooLarge | Self::SettingValueInvalid => {
                ErrorCode::ChangeSettingInvalid
            }
            Self::UnparsedConfirmationRequired => ErrorCode::ChangeConfirmationRequired,
            Self::NoChangeRequired => ErrorCode::ChangeNoOp,
            Self::PreviewBlocked => ErrorCode::ChangePreviewBlocked,
            Self::PlanExpired => ErrorCode::ChangePlanExpired,
            Self::PlanUnavailable => ErrorCode::ChangePlanUnavailable,
            Self::StateChanged => ErrorCode::ChangeStateChanged,
            Self::SnapshotNotRestorable { .. } => ErrorCode::SnapshotNotRestorable,
            Self::SnapshotNotFound { .. } => ErrorCode::SnapshotNotFound,
            Self::SnapshotStorage { .. } => ErrorCode::SnapshotStorageFailed,
            Self::SnapshotInvalid { .. } => ErrorCode::SnapshotInvalid,
            Self::Diagnostic(error) => error.code(),
        }
    }
}

pub fn prepare_pin(
    report: &DiagnosisReport,
    target: &ComponentName,
    allow_unparsed: bool,
    preview_id: String,
    created_at_unix_ms: u64,
) -> Result<ChangePreview, ChangeError> {
    let mut blockers = Vec::new();
    if report.status == DiagnosisStatus::Unsupported || report.device.api_level < 34 {
        blockers.push(ChangeBlocker::AndroidVersionUnsupported);
    }
    let Some(user) = report.android_user.clone() else {
        return Err(ChangeError::DiagnosisUnavailable);
    };
    let registered = registered_provider_names(report);
    if !registered.contains(&canonical_component_name(target)) {
        blockers.push(ChangeBlocker::TargetNotRegistered);
    }
    let before = managed_state(report).map_err(|error| {
        if error == ChangeError::SettingUnavailable {
            blockers.push(ChangeBlocker::DiagnosisUnavailable);
        }
        error
    })?;
    let requires_unparsed_confirmation =
        !before.enabled.is_parseable() || !before.primary.is_parseable();
    if requires_unparsed_confirmation && !allow_unparsed {
        blockers.push(ChangeBlocker::UnparsedConfirmationRequired);
    }
    let target_value = ManagedSettingValue::Value {
        raw: target.flattened.clone(),
        parseable: true,
    };
    let after = ManagedCredentialState {
        enabled: target_value.clone(),
        primary: target_value,
    };
    if before == after {
        blockers.push(ChangeBlocker::NoChangeRequired);
    }
    Ok(ChangePreview {
        schema_version: 1,
        preview_id,
        source_snapshot_id: None,
        kind: ChangeKind::Pin,
        created_at_unix_ms,
        adb: report.adb.clone(),
        device: report.device.clone(),
        android_user: user,
        target: target.clone(),
        registered_providers: registered,
        before,
        after,
        requires_unparsed_confirmation,
        allow_unparsed,
        blockers,
    })
}

pub fn prepare_restore(
    report: &DiagnosisReport,
    snapshot: &SnapshotRecord,
    preview_id: String,
    created_at_unix_ms: u64,
) -> Result<ChangePreview, ChangeError> {
    if snapshot.status != SnapshotStatus::Applied {
        return Err(ChangeError::SnapshotNotRestorable {
            snapshot_id: snapshot.snapshot_id.clone(),
        });
    }
    let Some(user) = report.android_user.clone() else {
        return Err(ChangeError::DiagnosisUnavailable);
    };
    let current = managed_state(report)?;
    let expected = snapshot
        .last_observed
        .as_ref()
        .unwrap_or(&snapshot.intended_after);
    let registered = registered_provider_names(report);
    let mut blockers = Vec::new();
    if report.device.serial != snapshot.device.serial
        || user.id != snapshot.android_user.id
        || current != *expected
        || registered != snapshot.registered_providers
    {
        blockers.push(ChangeBlocker::StateChanged);
    }
    Ok(ChangePreview {
        schema_version: 1,
        preview_id,
        source_snapshot_id: Some(snapshot.snapshot_id.clone()),
        kind: ChangeKind::Restore,
        created_at_unix_ms,
        adb: report.adb.clone(),
        device: report.device.clone(),
        android_user: user,
        target: snapshot.target.clone(),
        registered_providers: registered,
        before: current,
        after: snapshot.before.clone(),
        requires_unparsed_confirmation: false,
        allow_unparsed: true,
        blockers,
    })
}

pub fn create_change_plan(
    preview: &ChangePreview,
    plan_id: String,
    snapshot_id: String,
    created_at_unix_ms: u64,
) -> Result<(ChangePlan, SnapshotRecord), ChangeError> {
    if !preview.eligible() {
        return Err(ChangeError::PreviewBlocked);
    }
    let plan = ChangePlan {
        schema_version: 1,
        plan_id,
        snapshot_id,
        source_snapshot_id: preview.source_snapshot_id.clone(),
        created_at_unix_ms,
        expires_at_unix_ms: created_at_unix_ms.saturating_add(CHANGE_PLAN_TTL_MS),
        kind: preview.kind,
        adb: preview.adb.clone(),
        device: preview.device.clone(),
        android_user: preview.android_user.clone(),
        target: preview.target.clone(),
        registered_providers: preview.registered_providers.clone(),
        before: preview.before.clone(),
        after: preview.after.clone(),
        allow_unparsed: preview.allow_unparsed,
    };
    let snapshot = SnapshotRecord {
        schema_version: 1,
        revision: 1,
        snapshot_id: plan.snapshot_id.clone(),
        plan_id: plan.plan_id.clone(),
        source_snapshot_id: plan.source_snapshot_id.clone(),
        created_at_unix_ms,
        updated_at_unix_ms: created_at_unix_ms,
        status: SnapshotStatus::Planned,
        kind: plan.kind,
        adb: plan.adb.clone(),
        device: plan.device.clone(),
        android_user: plan.android_user.clone(),
        target: plan.target.clone(),
        registered_providers: plan.registered_providers.clone(),
        before: plan.before.clone(),
        intended_after: plan.after.clone(),
        last_observed: None,
        message: None,
    };
    Ok((plan, snapshot))
}

pub async fn execute_change(
    runner: &(impl CommandRunner + ?Sized),
    plan: &ChangePlan,
    current_time_unix_ms: u64,
) -> Result<ChangeOutcome, ChangeError> {
    if current_time_unix_ms > plan.expires_at_unix_ms {
        return Err(ChangeError::PlanExpired);
    }
    let report = diagnose_device(runner, &plan.adb, &plan.device.serial).await?;
    verify_plan_state(plan, &report)?;

    let mut steps = Vec::new();
    let order = match plan.kind {
        ChangeKind::Pin => [
            (ENABLED_KEY, &plan.after.enabled),
            (PRIMARY_KEY, &plan.after.primary),
        ],
        ChangeKind::Restore => [
            (PRIMARY_KEY, &plan.after.primary),
            (ENABLED_KEY, &plan.after.enabled),
        ],
    };
    for (key, value) in order {
        let outcome = mutate_setting(
            runner,
            &plan.adb,
            &plan.device.serial,
            plan.android_user.id,
            key,
            value,
        )
        .await;
        let failed = !outcome.success;
        steps.push(outcome);
        if failed {
            let recovery_steps = recover_before(runner, plan).await;
            let recovered = recovery_steps.iter().all(|step| step.success);
            let observed = observe_managed(runner, plan).await;
            return Ok(ChangeOutcome {
                schema_version: 1,
                plan_id: plan.plan_id.clone(),
                snapshot_id: plan.snapshot_id.clone(),
                status: if recovered {
                    ChangeOutcomeStatus::Recovered
                } else {
                    ChangeOutcomeStatus::RecoveryFailed
                },
                completed_at_unix_ms: now_unix_ms(),
                steps,
                recovery_steps,
                observed,
            });
        }
    }
    Ok(ChangeOutcome {
        schema_version: 1,
        plan_id: plan.plan_id.clone(),
        snapshot_id: plan.snapshot_id.clone(),
        status: match plan.kind {
            ChangeKind::Pin => ChangeOutcomeStatus::Applied,
            ChangeKind::Restore => ChangeOutcomeStatus::Restored,
        },
        completed_at_unix_ms: now_unix_ms(),
        steps,
        recovery_steps: Vec::new(),
        observed: plan.after.clone(),
    })
}

pub fn update_snapshot_from_outcome(snapshot: &mut SnapshotRecord, outcome: &ChangeOutcome) {
    snapshot.revision = snapshot.revision.saturating_add(1);
    snapshot.updated_at_unix_ms = outcome.completed_at_unix_ms;
    snapshot.last_observed = Some(outcome.observed.clone());
    snapshot.status = match outcome.status {
        ChangeOutcomeStatus::Applied => SnapshotStatus::Applied,
        ChangeOutcomeStatus::Restored => SnapshotStatus::Restored,
        ChangeOutcomeStatus::Recovered => SnapshotStatus::Recovered,
        ChangeOutcomeStatus::RecoveryFailed => SnapshotStatus::RecoveryFailed,
    };
    snapshot.message = (outcome.status == ChangeOutcomeStatus::RecoveryFailed)
        .then(|| "automatic recovery did not restore every managed setting".to_owned());
}

pub fn mark_source_snapshot_restored(
    snapshot: &mut SnapshotRecord,
    outcome: &ChangeOutcome,
) -> Result<(), ChangeError> {
    if snapshot.status != SnapshotStatus::Applied || outcome.status != ChangeOutcomeStatus::Restored
    {
        return Err(ChangeError::SnapshotNotRestorable {
            snapshot_id: snapshot.snapshot_id.clone(),
        });
    }
    snapshot.revision = snapshot.revision.saturating_add(1);
    snapshot.updated_at_unix_ms = outcome.completed_at_unix_ms;
    snapshot.last_observed = Some(outcome.observed.clone());
    snapshot.status = SnapshotStatus::Restored;
    snapshot.message = None;
    Ok(())
}

pub fn expire_snapshot(snapshot: &mut SnapshotRecord, now_unix_ms: u64) {
    if snapshot.status == SnapshotStatus::Planned {
        snapshot.revision = snapshot.revision.saturating_add(1);
        snapshot.updated_at_unix_ms = now_unix_ms;
        snapshot.status = SnapshotStatus::Expired;
    }
}

fn managed_state(report: &DiagnosisReport) -> Result<ManagedCredentialState, ChangeError> {
    Ok(ManagedCredentialState {
        enabled: ManagedSettingValue::from_setting(&report.credential_state.enabled.value)?,
        primary: ManagedSettingValue::from_setting(&report.credential_state.primary.value)?,
    })
}

fn registered_provider_names(report: &DiagnosisReport) -> Vec<String> {
    let mut names = report
        .providers
        .iter()
        .map(|provider| canonical_component_name(&provider.component))
        .collect::<Vec<_>>();
    names.sort();
    names.dedup();
    names
}

fn verify_plan_state(plan: &ChangePlan, report: &DiagnosisReport) -> Result<(), ChangeError> {
    let user = report
        .android_user
        .as_ref()
        .ok_or(ChangeError::StateChanged)?;
    if report.device != plan.device
        || user.id != plan.android_user.id
        || managed_state(report)? != plan.before
        || registered_provider_names(report) != plan.registered_providers
        || (plan.kind == ChangeKind::Pin
            && !plan
                .registered_providers
                .contains(&canonical_component_name(&plan.target)))
    {
        return Err(ChangeError::StateChanged);
    }
    Ok(())
}

async fn recover_before(
    runner: &(impl CommandRunner + ?Sized),
    plan: &ChangePlan,
) -> Vec<ChangeStepOutcome> {
    let mut outcomes = Vec::new();
    for (key, value) in [
        (PRIMARY_KEY, &plan.before.primary),
        (ENABLED_KEY, &plan.before.enabled),
    ] {
        outcomes.push(
            mutate_setting(
                runner,
                &plan.adb,
                &plan.device.serial,
                plan.android_user.id,
                key,
                value,
            )
            .await,
        );
    }
    outcomes
}

async fn observe_managed(
    runner: &(impl CommandRunner + ?Sized),
    plan: &ChangePlan,
) -> ManagedCredentialState {
    let enabled = read_setting(
        runner,
        &plan.adb,
        &plan.device.serial,
        plan.android_user.id,
        ENABLED_KEY,
    )
    .await;
    let primary = read_setting(
        runner,
        &plan.adb,
        &plan.device.serial,
        plan.android_user.id,
        PRIMARY_KEY,
    )
    .await;
    ManagedCredentialState {
        enabled: ManagedSettingValue::from_setting(&enabled.value)
            .unwrap_or_else(|_| plan.before.enabled.clone()),
        primary: ManagedSettingValue::from_setting(&primary.value)
            .unwrap_or_else(|_| plan.before.primary.clone()),
    }
}

async fn mutate_setting(
    runner: &(impl CommandRunner + ?Sized),
    adb: &ValidatedAdb,
    serial: &str,
    user_id: u32,
    key: &str,
    desired: &ManagedSettingValue,
) -> ChangeStepOutcome {
    debug_assert!(matches!(key, ENABLED_KEY | PRIMARY_KEY));
    let (mutation, value) = match desired {
        ManagedSettingValue::Missing => (SettingMutation::Delete, None),
        ManagedSettingValue::Empty => (SettingMutation::Put, Some("")),
        ManagedSettingValue::Value { raw, .. } => (SettingMutation::Put, Some(raw.as_str())),
    };
    let mut arguments = vec![
        OsString::from("-s"),
        OsString::from(serial),
        OsString::from("shell"),
        OsString::from("settings"),
        OsString::from("--user"),
        OsString::from(user_id.to_string()),
        OsString::from(match mutation {
            SettingMutation::Put => "put",
            SettingMutation::Delete => "delete",
        }),
        OsString::from("secure"),
        OsString::from(key),
    ];
    if let Some(value) = value {
        arguments.push(OsString::from(value));
    }
    let result = async {
        let request = CommandRequest::new(
            &adb.path,
            arguments,
            ADB_COMMAND_TIMEOUT,
            ADB_COMMAND_MAX_OUTPUT_BYTES,
        )?;
        let output = run_command(runner, &request).await?;
        ensure_success(&output, key)?;
        let observation = read_setting(runner, adb, serial, user_id, key).await;
        let observed = ManagedSettingValue::from_setting(&observation.value)?;
        if observed != *desired {
            return Err(ChangeError::StateChanged);
        }
        Ok::<_, ChangeError>(observed)
    }
    .await;
    match result {
        Ok(observed) => ChangeStepOutcome {
            key: key.to_owned(),
            mutation,
            success: true,
            observed: Some(observed),
            error: None,
        },
        Err(error) => ChangeStepOutcome {
            key: key.to_owned(),
            mutation,
            success: false,
            observed: None,
            error: Some(error.to_string()),
        },
    }
}

fn validate_raw_value(value: &str) -> Result<(), ChangeError> {
    if value.len() > MAX_SETTING_BYTES {
        return Err(ChangeError::SettingValueTooLarge);
    }
    if value.contains('\0') {
        return Err(ChangeError::SettingValueInvalid);
    }
    Ok(())
}

impl From<crate::CommandError> for ChangeError {
    fn from(error: crate::CommandError) -> Self {
        Self::Diagnostic(DiagnosticError::Command(error))
    }
}

#[cfg(test)]
mod tests {
    use std::{collections::VecDeque, path::PathBuf, sync::Mutex};

    use super::*;
    use crate::{
        AndroidUser, ConnectionType, CredentialState, DeviceInfo, DiagnosisMode, Finding,
        ProviderService, SettingObservation,
    };
    use async_trait::async_trait;

    #[test]
    fn pin_preview_requires_override_for_unparsed_raw_value() {
        let mut report = report();
        report.credential_state.enabled.value = SettingValue::Value {
            raw: "oem:encoding".to_owned(),
            components: None,
        };
        let target = report.providers[0].component.clone();

        let blocked = prepare_pin(&report, &target, false, "preview".to_owned(), 1).unwrap();
        let allowed = prepare_pin(&report, &target, true, "preview".to_owned(), 1).unwrap();

        assert!(blocked.requires_unparsed_confirmation);
        assert!(
            blocked
                .blockers
                .contains(&ChangeBlocker::UnparsedConfirmationRequired)
        );
        assert!(allowed.eligible());
        assert_eq!(
            allowed.before.enabled,
            ManagedSettingValue::Value {
                raw: "oem:encoding".to_owned(),
                parseable: false,
            }
        );
    }

    #[test]
    fn canonical_target_accepts_shorthand_provider_identity() {
        let report = report();
        let full = ComponentName {
            flattened: "com.example/com.example.Provider".to_owned(),
            package_name: "com.example".to_owned(),
            service_class: "com.example.Provider".to_owned(),
        };

        let preview = prepare_pin(&report, &full, false, "preview".to_owned(), 1).unwrap();

        assert!(preview.eligible());
    }

    #[test]
    fn plans_expire_after_five_minutes_and_snapshot_before_state() {
        let report = report();
        let preview = prepare_pin(
            &report,
            &report.providers[0].component,
            false,
            "preview".to_owned(),
            10,
        )
        .unwrap();
        let (plan, snapshot) =
            create_change_plan(&preview, "plan".to_owned(), "snapshot".to_owned(), 10).unwrap();

        assert_eq!(plan.expires_at_unix_ms, 10 + CHANGE_PLAN_TTL_MS);
        assert_eq!(snapshot.before, preview.before);
        assert_eq!(snapshot.status, SnapshotStatus::Planned);
    }

    #[test]
    fn restore_binds_and_completes_the_original_applied_snapshot() {
        let report = report();
        let preview = prepare_pin(
            &report,
            &report.providers[0].component,
            false,
            "pin-preview".to_owned(),
            10,
        )
        .unwrap();
        let (_, mut source) = create_change_plan(
            &preview,
            "pin-plan".to_owned(),
            "pin-snapshot".to_owned(),
            10,
        )
        .unwrap();
        source.status = SnapshotStatus::Applied;
        source.last_observed = Some(source.intended_after.clone());
        let mut pinned_report = report;
        pinned_report.credential_state.enabled.value = SettingValue::Value {
            raw: source.target.flattened.clone(),
            components: Some(vec![source.target.clone()]),
        };
        pinned_report.credential_state.primary.value =
            pinned_report.credential_state.enabled.value.clone();

        let restore =
            prepare_restore(&pinned_report, &source, "restore-preview".to_owned(), 20).unwrap();
        let (plan, snapshot) = create_change_plan(
            &restore,
            "restore-plan".to_owned(),
            "restore-snapshot".to_owned(),
            20,
        )
        .unwrap();
        assert_eq!(plan.source_snapshot_id.as_deref(), Some("pin-snapshot"));
        assert_eq!(snapshot.source_snapshot_id, plan.source_snapshot_id);

        let outcome = ChangeOutcome {
            schema_version: 1,
            plan_id: plan.plan_id,
            snapshot_id: plan.snapshot_id,
            status: ChangeOutcomeStatus::Restored,
            completed_at_unix_ms: 30,
            steps: Vec::new(),
            recovery_steps: Vec::new(),
            observed: source.before.clone(),
        };
        mark_source_snapshot_restored(&mut source, &outcome).unwrap();
        assert_eq!(source.status, SnapshotStatus::Restored);
        assert_eq!(source.last_observed, Some(source.before.clone()));
    }

    #[test]
    fn recovery_failed_snapshot_is_not_assumed_safe_to_restore() {
        let report = report();
        let preview = prepare_pin(
            &report,
            &report.providers[0].component,
            false,
            "preview".to_owned(),
            1,
        )
        .unwrap();
        let (_, mut snapshot) =
            create_change_plan(&preview, "plan".to_owned(), "snapshot".to_owned(), 1).unwrap();
        snapshot.status = SnapshotStatus::RecoveryFailed;

        let error = prepare_restore(&report, &snapshot, "restore".to_owned(), 2).unwrap_err();

        assert!(matches!(error, ChangeError::SnapshotNotRestorable { .. }));
    }

    #[tokio::test]
    async fn pin_uses_exact_bounded_argument_order_and_verifies_each_write() {
        let report = report();
        let preview = prepare_pin(
            &report,
            &report.providers[0].component,
            false,
            "preview".to_owned(),
            1,
        )
        .unwrap();
        let (plan, _) =
            create_change_plan(&preview, "plan".to_owned(), "snapshot".to_owned(), 1).unwrap();
        let outputs = [
            ok(b"List of devices attached\nSERIAL device usb:1 model:Phone\n"),
            ok(b"Example\n"),
            ok(b"Phone\n"),
            ok(b"phone\n"),
            ok(b"14\n"),
            ok(b"34\n"),
            ok(b"0\n"),
            ok(b"com.example/.Provider\n"),
            ok(b"null\n"),
            ok(b"null\n"),
            ok(b"null\n"),
            ok(b""),
            ok(b"com.example/.Provider\n"),
            ok(b""),
            ok(b"com.example/.Provider\n"),
        ];
        let runner = ScriptedRunner {
            requests: Mutex::new(Vec::new()),
            outputs: Mutex::new(outputs.into_iter().map(Ok).collect()),
        };

        let outcome = execute_change(&runner, &plan, 2).await.unwrap();

        assert_eq!(outcome.status, ChangeOutcomeStatus::Applied);
        let requests = runner.requests.lock().unwrap();
        assert_eq!(
            requests[11].arguments,
            [
                "-s",
                "SERIAL",
                "shell",
                "settings",
                "--user",
                "0",
                "put",
                "secure",
                ENABLED_KEY,
                "com.example/.Provider",
            ]
            .into_iter()
            .map(OsString::from)
            .collect::<Vec<_>>()
        );
        assert_eq!(requests[13].arguments[8], OsString::from(PRIMARY_KEY));
    }

    #[tokio::test]
    async fn failed_pin_restores_missing_values_with_delete_in_reverse_order() {
        let report = report();
        let preview = prepare_pin(
            &report,
            &report.providers[0].component,
            false,
            "preview".to_owned(),
            1,
        )
        .unwrap();
        let (plan, _) =
            create_change_plan(&preview, "plan".to_owned(), "snapshot".to_owned(), 1).unwrap();
        let outputs = [
            ok(b"List of devices attached\nSERIAL device usb:1 model:Phone\n"),
            ok(b"Example\n"),
            ok(b"Phone\n"),
            ok(b"phone\n"),
            ok(b"14\n"),
            ok(b"34\n"),
            ok(b"0\n"),
            ok(b"com.example/.Provider\n"),
            ok(b"null\n"),
            ok(b"null\n"),
            ok(b"null\n"),
            failed(b"write rejected"),
            ok(b""),
            ok(b"null\n"),
            ok(b""),
            ok(b"null\n"),
            ok(b"null\n"),
            ok(b"null\n"),
        ];
        let runner = ScriptedRunner {
            requests: Mutex::new(Vec::new()),
            outputs: Mutex::new(outputs.into_iter().map(Ok).collect()),
        };

        let outcome = execute_change(&runner, &plan, 2).await.unwrap();

        assert_eq!(outcome.status, ChangeOutcomeStatus::Recovered);
        assert!(!outcome.steps[0].success);
        assert!(outcome.recovery_steps.iter().all(|step| step.success));
        let requests = runner.requests.lock().unwrap();
        assert_eq!(
            requests[12].arguments,
            [
                "-s",
                "SERIAL",
                "shell",
                "settings",
                "--user",
                "0",
                "delete",
                "secure",
                PRIMARY_KEY,
            ]
            .into_iter()
            .map(OsString::from)
            .collect::<Vec<_>>()
        );
        assert_eq!(requests[14].arguments[8], OsString::from(ENABLED_KEY));
        assert_eq!(requests[14].arguments.len(), 9);
    }

    struct ScriptedRunner {
        requests: Mutex<Vec<CommandRequest>>,
        outputs: Mutex<VecDeque<Result<crate::CommandOutput, crate::CommandError>>>,
    }

    #[async_trait]
    impl CommandRunner for ScriptedRunner {
        async fn run(
            &self,
            request: &CommandRequest,
        ) -> Result<crate::CommandOutput, crate::CommandError> {
            self.requests.lock().unwrap().push(request.clone());
            self.outputs.lock().unwrap().pop_front().unwrap()
        }
    }

    fn ok(stdout: &[u8]) -> crate::CommandOutput {
        crate::CommandOutput {
            exit_code: Some(0),
            signal: None,
            stdout: stdout.to_vec(),
            stderr: Vec::new(),
        }
    }

    fn failed(stderr: &[u8]) -> crate::CommandOutput {
        crate::CommandOutput {
            exit_code: Some(1),
            signal: None,
            stdout: Vec::new(),
            stderr: stderr.to_vec(),
        }
    }

    fn report() -> DiagnosisReport {
        let target = ComponentName {
            flattened: "com.example/.Provider".to_owned(),
            package_name: "com.example".to_owned(),
            service_class: ".Provider".to_owned(),
        };
        DiagnosisReport {
            schema_version: 1,
            mode: DiagnosisMode::Real,
            status: DiagnosisStatus::Complete,
            observed_at_unix_ms: 0,
            adb: ValidatedAdb {
                path: PathBuf::from("/adb"),
                resolved_path: PathBuf::from("/adb"),
                version: "1.0.41".to_owned(),
            },
            device: DeviceInfo {
                serial: "SERIAL".to_owned(),
                connection_type: ConnectionType::Usb,
                manufacturer: "Example".to_owned(),
                model: "Phone".to_owned(),
                codename: "phone".to_owned(),
                android_version: "14".to_owned(),
                api_level: 34,
            },
            android_user: Some(AndroidUser {
                id: 0,
                is_foreground: true,
            }),
            providers: vec![ProviderService {
                component: target,
                enabled: false,
                primary: false,
                same_package_as_autofill: true,
            }],
            credential_state: CredentialState {
                enabled: SettingObservation {
                    key: ENABLED_KEY.to_owned(),
                    value: SettingValue::Missing,
                },
                primary: SettingObservation {
                    key: PRIMARY_KEY.to_owned(),
                    value: SettingValue::Missing,
                },
                autofill: SettingObservation {
                    key: "autofill_service".to_owned(),
                    value: SettingValue::Missing,
                },
            },
            findings: Vec::<Finding>::new(),
        }
    }
}
