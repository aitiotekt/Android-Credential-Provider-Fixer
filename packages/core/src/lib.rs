//! Platform-independent application contracts and orchestration.

mod adb;
mod changes;
mod command;
mod demo;
mod diagnostics;
mod error;
mod metadata;

pub use adb::{
    ADB_VERSION_MAX_OUTPUT_BYTES, ADB_VERSION_TIMEOUT, AdbCandidate, AdbCandidateSource,
    AdbDiscoveryContext, AdbDiscoveryResult, AdbValidationFailure, HostPlatform, ValidatedAdb,
    discover_adb, validate_adb,
};
pub use changes::{
    CHANGE_PLAN_TTL_MS, ChangeBlocker, ChangeError, ChangeKind, ChangeOutcome, ChangeOutcomeStatus,
    ChangePlan, ChangePreview, ChangeStepOutcome, ManagedCredentialState, ManagedSettingValue,
    SettingMutation, SnapshotInventory, SnapshotRecord, SnapshotStatus, SnapshotStore,
    SnapshotWarning, create_change_plan, execute_change, expire_snapshot,
    mark_source_snapshot_restored, prepare_pin, prepare_restore, update_snapshot_from_outcome,
};
pub use command::{CommandOutput, CommandRequest, CommandRunner, run_command};
pub use demo::{DemoFixture, demo_fixture};
pub use diagnostics::{
    AndroidUser, ComponentName, ConnectionType, CredentialState, DeviceConnectionState, DeviceInfo,
    DeviceList, DeviceSummary, DiagnosisMode, DiagnosisReport, DiagnosisStatus, DiagnosticError,
    Finding, FindingCode, FindingSeverity, ProviderService, SettingObservation, SettingValue,
    canonical_component_name, diagnose_device, list_devices, parse_adb_devices, parse_component,
    parse_provider_services, parse_setting_value,
};
pub use error::{CommandError, ErrorCode, ErrorEnvelope};
pub use metadata::{AppInfo, app_info};
