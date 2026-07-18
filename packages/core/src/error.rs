use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    CommandInvalid,
    CommandSpawnFailed,
    CommandTimeout,
    CommandOutputTooLarge,
    CommandOutputReadFailed,
    CommandWaitFailed,
    CommandTerminateFailed,
    AdbNotFound,
    AdbNotExecutable,
    AdbVersionFailed,
    AdbSelectionStale,
    DeviceSelectionRequired,
    DeviceUnauthorized,
    DeviceOffline,
    DeviceNoPermissions,
    DeviceChanged,
    UserQueryFailed,
    ProviderQueryFailed,
    SettingReadFailed,
    OutputInvalid,
    PreferencesReadFailed,
    PreferencesWriteFailed,
    ChangeDiagnosisUnavailable,
    ChangeTargetNotRegistered,
    ChangeSettingUnavailable,
    ChangeSettingInvalid,
    ChangeConfirmationRequired,
    ChangeNoOp,
    ChangePreviewBlocked,
    ChangePlanExpired,
    ChangePlanUnavailable,
    ChangeStateChanged,
    SnapshotNotRestorable,
    SnapshotNotFound,
    SnapshotStorageFailed,
    SnapshotInvalid,
}

impl ErrorCode {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::CommandInvalid => "COMMAND_INVALID",
            Self::CommandSpawnFailed => "COMMAND_SPAWN_FAILED",
            Self::CommandTimeout => "COMMAND_TIMEOUT",
            Self::CommandOutputTooLarge => "COMMAND_OUTPUT_TOO_LARGE",
            Self::CommandOutputReadFailed => "COMMAND_OUTPUT_READ_FAILED",
            Self::CommandWaitFailed => "COMMAND_WAIT_FAILED",
            Self::CommandTerminateFailed => "COMMAND_TERMINATE_FAILED",
            Self::AdbNotFound => "ADB_NOT_FOUND",
            Self::AdbNotExecutable => "ADB_NOT_EXECUTABLE",
            Self::AdbVersionFailed => "ADB_VERSION_FAILED",
            Self::AdbSelectionStale => "ADB_SELECTION_STALE",
            Self::DeviceSelectionRequired => "DEVICE_SELECTION_REQUIRED",
            Self::DeviceUnauthorized => "DEVICE_UNAUTHORIZED",
            Self::DeviceOffline => "DEVICE_OFFLINE",
            Self::DeviceNoPermissions => "DEVICE_NO_PERMISSIONS",
            Self::DeviceChanged => "DEVICE_CHANGED",
            Self::UserQueryFailed => "USER_QUERY_FAILED",
            Self::ProviderQueryFailed => "PROVIDER_QUERY_FAILED",
            Self::SettingReadFailed => "SETTING_READ_FAILED",
            Self::OutputInvalid => "OUTPUT_INVALID",
            Self::PreferencesReadFailed => "PREFERENCES_READ_FAILED",
            Self::PreferencesWriteFailed => "PREFERENCES_WRITE_FAILED",
            Self::ChangeDiagnosisUnavailable => "CHANGE_DIAGNOSIS_UNAVAILABLE",
            Self::ChangeTargetNotRegistered => "CHANGE_TARGET_NOT_REGISTERED",
            Self::ChangeSettingUnavailable => "CHANGE_SETTING_UNAVAILABLE",
            Self::ChangeSettingInvalid => "CHANGE_SETTING_INVALID",
            Self::ChangeConfirmationRequired => "CHANGE_CONFIRMATION_REQUIRED",
            Self::ChangeNoOp => "CHANGE_NO_OP",
            Self::ChangePreviewBlocked => "CHANGE_PREVIEW_BLOCKED",
            Self::ChangePlanExpired => "CHANGE_PLAN_EXPIRED",
            Self::ChangePlanUnavailable => "CHANGE_PLAN_UNAVAILABLE",
            Self::ChangeStateChanged => "CHANGE_STATE_CHANGED",
            Self::SnapshotNotRestorable => "SNAPSHOT_NOT_RESTORABLE",
            Self::SnapshotNotFound => "SNAPSHOT_NOT_FOUND",
            Self::SnapshotStorageFailed => "SNAPSHOT_STORAGE_FAILED",
            Self::SnapshotInvalid => "SNAPSHOT_INVALID",
        }
    }
}

#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum CommandError {
    #[error("invalid command request: {message}")]
    Invalid { message: String },
    #[error("failed to start process: {message}")]
    Spawn { message: String },
    #[error("process exceeded its {timeout_ms} ms timeout")]
    Timeout { timeout_ms: u64 },
    #[error("process output exceeded the {limit_bytes} byte limit")]
    OutputTooLarge { limit_bytes: usize },
    #[error("failed to read process output: {message}")]
    ReadOutput { message: String },
    #[error("failed while waiting for process: {message}")]
    Wait { message: String },
    #[error("failed to terminate process: {message}")]
    Terminate { message: String },
}

impl CommandError {
    #[must_use]
    pub const fn code(&self) -> ErrorCode {
        match self {
            Self::Invalid { .. } => ErrorCode::CommandInvalid,
            Self::Spawn { .. } => ErrorCode::CommandSpawnFailed,
            Self::Timeout { .. } => ErrorCode::CommandTimeout,
            Self::OutputTooLarge { .. } => ErrorCode::CommandOutputTooLarge,
            Self::ReadOutput { .. } => ErrorCode::CommandOutputReadFailed,
            Self::Wait { .. } => ErrorCode::CommandWaitFailed,
            Self::Terminate { .. } => ErrorCode::CommandTerminateFailed,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEnvelope {
    pub code: String,
    pub message: String,
}

impl From<&CommandError> for ErrorEnvelope {
    fn from(error: &CommandError) -> Self {
        Self {
            code: error.code().as_str().to_owned(),
            message: error.to_string(),
        }
    }
}

impl From<&crate::DiagnosticError> for ErrorEnvelope {
    fn from(error: &crate::DiagnosticError) -> Self {
        Self {
            code: error.code().as_str().to_owned(),
            message: error.to_string(),
        }
    }
}

impl From<&crate::ChangeError> for ErrorEnvelope {
    fn from(error: &crate::ChangeError) -> Self {
        Self {
            code: error.code().as_str().to_owned(),
            message: error.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn envelope_uses_stable_error_code() {
        let error = CommandError::Timeout { timeout_ms: 250 };

        assert_eq!(
            ErrorEnvelope::from(&error),
            ErrorEnvelope {
                code: "COMMAND_TIMEOUT".to_owned(),
                message: "process exceeded its 250 ms timeout".to_owned(),
            }
        );
    }
}
