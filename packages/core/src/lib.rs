//! Platform-independent application contracts and orchestration.

mod adb;
mod changes;
mod command;
mod demo;
mod diagnostics;
mod entities;
mod error;
mod ids;
mod metadata;

pub use adb::{
    ADB_VERSION_MAX_OUTPUT_BYTES, ADB_VERSION_TIMEOUT, AdbCandidate, AdbCandidateSource,
    AdbDiscoveryContext, AdbDiscoveryResult, AdbValidationFailure, HostPlatform, ValidatedAdb,
    discover_adb, validate_adb,
};
pub use changes::{
    CHANGE_PLAN_TTL_MS, ChangeBlocker, ChangeError, ChangeExecution, ChangeKind, ChangeOutcome,
    ChangeOutcomeStatus, ChangePlan, ChangePreview, ChangeStepOutcome, ExecutionStatus,
    ManagedCredentialState, ManagedSettingValue, PlanStatus, PreviewStatus, SettingMutation,
    SnapshotInventory, SnapshotRecord, SnapshotStatus, SnapshotStore, SnapshotWarning,
    authorize_unparsed_preview, cancel_snapshot, consume_preview, create_change_plan,
    execute_change, expire_snapshot, invalidate_snapshot, mark_snapshot_executing,
    mark_source_snapshot_restored, prepare_pin, prepare_restore, update_snapshot_from_outcome,
};
pub use command::{CommandOutput, CommandRequest, CommandRunner, run_command};
pub use demo::{DemoFixture, demo_fixture};
pub use diagnostics::{
    AndroidUser, ComponentName, ConnectionType, CredentialState, DeviceConnectionState, DeviceInfo,
    DeviceList, DeviceSummary, DiagnosisCompleteness, DiagnosisMode, DiagnosisReport,
    DiagnosticError, Finding, FindingCode, FindingSeverity, ProviderService, SettingObservation,
    SettingValue, canonical_component_name, diagnose_device, list_devices, parse_adb_devices,
    parse_component, parse_provider_services, parse_setting_value,
};
pub use entities::{
    AdbCandidateEntity, AdbDiscoveryEntity, AdbSelectionEntity, DeviceEntity,
    DeviceEnumerationEntity, DiagnosisEntity, PUBLIC_SCHEMA_VERSION, ProviderEntity,
    SessionContext,
};
pub use error::{CommandError, ErrorCode, ErrorEnvelope};
pub use ids::{
    AdbSelectionId, DeviceEnumerationId, DeviceId, DiagnosisId, DiscoveryId, ExecutionId, PlanId,
    PreviewId, ProviderId, SnapshotId,
};
pub use metadata::{AppInfo, app_info};
