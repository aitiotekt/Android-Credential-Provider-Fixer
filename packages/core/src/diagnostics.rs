use std::{
    collections::HashSet,
    ffi::OsString,
    path::PathBuf,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::{
    CommandError, CommandOutput, CommandRequest, CommandRunner, ErrorCode, ValidatedAdb,
    run_command,
};

const ADB_COMMAND_TIMEOUT: Duration = Duration::from_secs(10);
const ADB_COMMAND_MAX_OUTPUT_BYTES: usize = 256 * 1024;
const CREDENTIAL_PROVIDER_ACTION: &str = "android.service.credentials.CredentialProviderService";

#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum DiagnosticError {
    #[error("ADB was not found in the configured or common locations")]
    AdbNotFound,
    #[error("ADB path is not executable: {path}: {message}")]
    AdbNotExecutable { path: PathBuf, message: String },
    #[error("ADB version validation failed: {message}")]
    AdbVersionFailed { message: String },
    #[error("the selected ADB candidate is no longer available")]
    AdbSelectionStale,
    #[error("select a device from the current device list")]
    DeviceSelectionRequired,
    #[error("device {serial} is unauthorized")]
    DeviceUnauthorized { serial: String },
    #[error("device {serial} is offline")]
    DeviceOffline { serial: String },
    #[error("ADB has no permission to access device {serial}")]
    DeviceNoPermissions { serial: String },
    #[error("device {serial} is no longer present in the current device list")]
    DeviceChanged { serial: String },
    #[error("failed to query the foreground Android user: {message}")]
    UserQueryFailed { message: String },
    #[error("failed to enumerate Credential Provider services: {message}")]
    ProviderQueryFailed { message: String },
    #[error("failed to read setting {key}: {message}")]
    SettingReadFailed { key: String, message: String },
    #[error("invalid output during {stage}: {message}")]
    OutputInvalid { stage: String, message: String },
    #[error(transparent)]
    Command(#[from] CommandError),
}

impl DiagnosticError {
    #[must_use]
    pub const fn code(&self) -> ErrorCode {
        match self {
            Self::AdbNotFound => ErrorCode::AdbNotFound,
            Self::AdbNotExecutable { .. } => ErrorCode::AdbNotExecutable,
            Self::AdbVersionFailed { .. } => ErrorCode::AdbVersionFailed,
            Self::AdbSelectionStale => ErrorCode::AdbSelectionStale,
            Self::DeviceSelectionRequired => ErrorCode::DeviceSelectionRequired,
            Self::DeviceUnauthorized { .. } => ErrorCode::DeviceUnauthorized,
            Self::DeviceOffline { .. } => ErrorCode::DeviceOffline,
            Self::DeviceNoPermissions { .. } => ErrorCode::DeviceNoPermissions,
            Self::DeviceChanged { .. } => ErrorCode::DeviceChanged,
            Self::UserQueryFailed { .. } => ErrorCode::UserQueryFailed,
            Self::ProviderQueryFailed { .. } => ErrorCode::ProviderQueryFailed,
            Self::SettingReadFailed { .. } => ErrorCode::SettingReadFailed,
            Self::OutputInvalid { .. } => ErrorCode::OutputInvalid,
            Self::Command(error) => error.code(),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeviceConnectionState {
    Device,
    Unauthorized,
    Offline,
    NoPermissions,
    Unknown,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionType {
    Usb,
    Wireless,
    Unknown,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSummary {
    pub serial: String,
    pub state: DeviceConnectionState,
    pub connection_type: ConnectionType,
    pub product: Option<String>,
    pub model: Option<String>,
    pub device: Option<String>,
    pub transport_id: Option<String>,
    pub details: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceList {
    pub observed_at_unix_ms: u64,
    pub devices: Vec<DeviceSummary>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub serial: String,
    pub connection_type: ConnectionType,
    pub manufacturer: String,
    pub model: String,
    pub codename: String,
    pub android_version: String,
    pub api_level: u32,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AndroidUser {
    pub id: u32,
    pub is_foreground: bool,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentName {
    pub flattened: String,
    pub package_name: String,
    pub service_class: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderService {
    pub component: ComponentName,
    pub enabled: bool,
    pub primary: bool,
    pub same_package_as_autofill: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SettingValue {
    Missing,
    Empty,
    Value {
        raw: String,
        components: Option<Vec<ComponentName>>,
    },
    Unavailable {
        code: String,
        message: String,
    },
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingObservation {
    pub key: String,
    pub value: SettingValue,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialState {
    pub enabled: SettingObservation,
    pub primary: SettingObservation,
    pub autofill: SettingObservation,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FindingSeverity {
    Info,
    Warning,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FindingCode {
    AndroidVersionUnsupported,
    NoRegisteredProvider,
    EnabledProviderNotRegistered,
    PrimaryProviderNotRegistered,
    PrimaryProviderNotEnabled,
    AutofillProviderNotCredentialEnabled,
    NoEnabledProvider,
    NoPrimaryProvider,
    SettingValueUnparseable,
    NoInconsistencyDetected,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub code: FindingCode,
    pub severity: FindingSeverity,
    pub related_value: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiagnosisMode {
    Real,
    Demo,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiagnosisStatus {
    Complete,
    Incomplete,
    Unsupported,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosisReport {
    pub schema_version: u32,
    pub mode: DiagnosisMode,
    pub status: DiagnosisStatus,
    pub observed_at_unix_ms: u64,
    pub adb: ValidatedAdb,
    pub device: DeviceInfo,
    pub android_user: Option<AndroidUser>,
    pub providers: Vec<ProviderService>,
    pub credential_state: CredentialState,
    pub findings: Vec<Finding>,
}

pub fn parse_adb_devices(output: &[u8]) -> Result<Vec<DeviceSummary>, DiagnosticError> {
    let text = std::str::from_utf8(output).map_err(|_| DiagnosticError::OutputInvalid {
        stage: "device-list".to_owned(),
        message: "device list was not valid UTF-8".to_owned(),
    })?;
    let mut devices = Vec::new();
    for raw_line in text.lines() {
        let line = raw_line.trim_end_matches('\r').trim();
        if line.is_empty() || line.starts_with("List of devices attached") {
            continue;
        }
        let Some((serial, remainder)) = split_first_field(line) else {
            continue;
        };
        let (state, attribute_text, details) = if remainder.starts_with("no permissions") {
            (
                DeviceConnectionState::NoPermissions,
                "",
                Some(remainder.to_owned()),
            )
        } else {
            let Some((raw_state, attributes)) = split_first_field(remainder) else {
                continue;
            };
            let state = match raw_state {
                "device" => DeviceConnectionState::Device,
                "unauthorized" => DeviceConnectionState::Unauthorized,
                "offline" => DeviceConnectionState::Offline,
                _ => DeviceConnectionState::Unknown,
            };
            let details = (state == DeviceConnectionState::Unknown).then(|| remainder.to_owned());
            (state, attributes, details)
        };
        let product = attribute(attribute_text, "product");
        let model = attribute(attribute_text, "model").map(|value| value.replace('_', " "));
        let device = attribute(attribute_text, "device");
        let transport_id = attribute(attribute_text, "transport_id");
        let connection_type = if attribute(attribute_text, "usb").is_some() {
            ConnectionType::Usb
        } else if serial.contains(':') {
            ConnectionType::Wireless
        } else {
            ConnectionType::Unknown
        };
        devices.push(DeviceSummary {
            serial: serial.to_owned(),
            state,
            connection_type,
            product,
            model,
            device,
            transport_id,
            details,
        });
    }
    Ok(devices)
}

pub fn parse_component(value: &str) -> Option<ComponentName> {
    let value = value.trim();
    let (package_name, service_class) = value.split_once('/')?;
    if package_name.is_empty()
        || service_class.is_empty()
        || package_name.chars().any(char::is_whitespace)
        || service_class.chars().any(char::is_whitespace)
        || value.contains(':')
    {
        return None;
    }
    Some(ComponentName {
        flattened: value.to_owned(),
        package_name: package_name.to_owned(),
        service_class: service_class.to_owned(),
    })
}

pub fn parse_provider_services(output: &[u8]) -> Result<Vec<ComponentName>, DiagnosticError> {
    let text = std::str::from_utf8(output).map_err(|_| DiagnosticError::OutputInvalid {
        stage: "provider-query".to_owned(),
        message: "provider query was not valid UTF-8".to_owned(),
    })?;
    let mut components = Vec::new();
    let mut seen = HashSet::new();
    for raw_line in text.lines() {
        let line = raw_line.trim().trim_end_matches('\r');
        if line.is_empty()
            || line.eq_ignore_ascii_case("no services found")
            || line.ends_with(" services:")
        {
            continue;
        }
        let token = line.split_whitespace().last().unwrap_or(line);
        if !token.contains('/') {
            continue;
        }
        let component = parse_component(token).ok_or_else(|| DiagnosticError::OutputInvalid {
            stage: "provider-query".to_owned(),
            message: format!("invalid provider component: {token}"),
        })?;
        if seen.insert(component.flattened.clone()) {
            components.push(component);
        }
    }
    Ok(components)
}

pub fn parse_setting_value(output: &[u8]) -> Result<SettingValue, DiagnosticError> {
    let text = std::str::from_utf8(output).map_err(|_| DiagnosticError::OutputInvalid {
        stage: "setting-read".to_owned(),
        message: "setting output was not valid UTF-8".to_owned(),
    })?;
    let raw = text.trim_end_matches(['\r', '\n']);
    if raw == "null" {
        return Ok(SettingValue::Missing);
    }
    if raw.is_empty() {
        return Ok(SettingValue::Empty);
    }
    let components = raw
        .split(':')
        .map(parse_component)
        .collect::<Option<Vec<_>>>();
    Ok(SettingValue::Value {
        raw: raw.to_owned(),
        components,
    })
}

pub async fn list_devices(
    runner: &(impl CommandRunner + ?Sized),
    adb: &ValidatedAdb,
) -> Result<DeviceList, DiagnosticError> {
    let output = run_adb(runner, adb, ["devices", "-l"]).await?;
    ensure_success(&output, "device-list")?;
    Ok(DeviceList {
        observed_at_unix_ms: now_unix_ms(),
        devices: parse_adb_devices(&output.stdout)?,
    })
}

pub async fn diagnose_device(
    runner: &(impl CommandRunner + ?Sized),
    adb: &ValidatedAdb,
    serial: &str,
) -> Result<DiagnosisReport, DiagnosticError> {
    let device_list = list_devices(runner, adb).await?;
    let summary = device_list
        .devices
        .iter()
        .find(|device| device.serial == serial)
        .ok_or_else(|| DiagnosticError::DeviceChanged {
            serial: serial.to_owned(),
        })?;
    match summary.state {
        DeviceConnectionState::Device => {}
        DeviceConnectionState::Unauthorized => {
            return Err(DiagnosticError::DeviceUnauthorized {
                serial: serial.to_owned(),
            });
        }
        DeviceConnectionState::Offline => {
            return Err(DiagnosticError::DeviceOffline {
                serial: serial.to_owned(),
            });
        }
        DeviceConnectionState::NoPermissions => {
            return Err(DiagnosticError::DeviceNoPermissions {
                serial: serial.to_owned(),
            });
        }
        DeviceConnectionState::Unknown => {
            return Err(DiagnosticError::DeviceChanged {
                serial: serial.to_owned(),
            });
        }
    }
    let connection_type = summary.connection_type;
    let manufacturer = read_property(runner, adb, serial, "ro.product.manufacturer").await?;
    let model = read_property(runner, adb, serial, "ro.product.model").await?;
    let codename = read_property(runner, adb, serial, "ro.product.device").await?;
    let android_version = read_property(runner, adb, serial, "ro.build.version.release").await?;
    let api_text = read_property(runner, adb, serial, "ro.build.version.sdk").await?;
    let api_level = api_text
        .parse::<u32>()
        .map_err(|error| DiagnosticError::OutputInvalid {
            stage: "android-api".to_owned(),
            message: error.to_string(),
        })?;
    let device = DeviceInfo {
        serial: serial.to_owned(),
        connection_type,
        manufacturer,
        model,
        codename,
        android_version,
        api_level,
    };
    if api_level < 34 {
        return Ok(unsupported_report(adb, device));
    }
    let user_output = run_device_adb(runner, adb, serial, ["shell", "am", "get-current-user"])
        .await
        .map_err(|error| DiagnosticError::UserQueryFailed {
            message: error.to_string(),
        })?;
    ensure_success(&user_output, "current-user").map_err(|error| {
        DiagnosticError::UserQueryFailed {
            message: error.to_string(),
        }
    })?;
    let user_text = output_text(&user_output.stdout, "current-user")?;
    let user_id =
        user_text
            .trim()
            .parse::<u32>()
            .map_err(|error| DiagnosticError::UserQueryFailed {
                message: format!("invalid user id: {error}"),
            })?;
    let provider_output = run_device_adb(
        runner,
        adb,
        serial,
        [
            "shell",
            "cmd",
            "package",
            "query-services",
            "--brief",
            "--components",
            "--user",
            &user_id.to_string(),
            "-a",
            CREDENTIAL_PROVIDER_ACTION,
        ],
    )
    .await
    .map_err(|error| DiagnosticError::ProviderQueryFailed {
        message: error.to_string(),
    })?;
    ensure_success(&provider_output, "provider-query").map_err(|error| {
        DiagnosticError::ProviderQueryFailed {
            message: error.to_string(),
        }
    })?;
    let registered = parse_provider_services(&provider_output.stdout)?;
    let credential_state = CredentialState {
        enabled: read_setting(runner, adb, serial, user_id, "credential_service").await,
        primary: read_setting(runner, adb, serial, user_id, "credential_service_primary").await,
        autofill: read_setting(runner, adb, serial, user_id, "autofill_service").await,
    };
    let mut report = DiagnosisReport {
        schema_version: 1,
        mode: DiagnosisMode::Real,
        status: DiagnosisStatus::Complete,
        observed_at_unix_ms: now_unix_ms(),
        adb: adb.clone(),
        device,
        android_user: Some(AndroidUser {
            id: user_id,
            is_foreground: true,
        }),
        providers: Vec::new(),
        credential_state,
        findings: Vec::new(),
    };
    complete_report(&mut report, registered);
    Ok(report)
}

fn unsupported_report(adb: &ValidatedAdb, device: DeviceInfo) -> DiagnosisReport {
    let unavailable = |key: &str| SettingObservation {
        key: key.to_owned(),
        value: SettingValue::Unavailable {
            code: "ANDROID_VERSION_UNSUPPORTED".to_owned(),
            message: "Credential Provider diagnostics require Android 14 / API 34 or newer"
                .to_owned(),
        },
    };
    DiagnosisReport {
        schema_version: 1,
        mode: DiagnosisMode::Real,
        status: DiagnosisStatus::Unsupported,
        observed_at_unix_ms: now_unix_ms(),
        adb: adb.clone(),
        device,
        android_user: None,
        providers: Vec::new(),
        credential_state: CredentialState {
            enabled: unavailable("credential_service"),
            primary: unavailable("credential_service_primary"),
            autofill: unavailable("autofill_service"),
        },
        findings: vec![Finding {
            code: FindingCode::AndroidVersionUnsupported,
            severity: FindingSeverity::Info,
            related_value: None,
        }],
    }
}

fn complete_report(report: &mut DiagnosisReport, registered: Vec<ComponentName>) {
    let enabled = parsed_components(&report.credential_state.enabled.value);
    let primary = parsed_components(&report.credential_state.primary.value);
    let autofill = parsed_components(&report.credential_state.autofill.value);
    if [&enabled, &primary, &autofill]
        .iter()
        .any(|value| value.is_none())
    {
        report.status = DiagnosisStatus::Incomplete;
    }
    for observation in [
        &report.credential_state.enabled,
        &report.credential_state.primary,
        &report.credential_state.autofill,
    ] {
        if matches!(
            observation.value,
            SettingValue::Value {
                components: None,
                ..
            }
        ) {
            report.findings.push(Finding {
                code: FindingCode::SettingValueUnparseable,
                severity: FindingSeverity::Warning,
                related_value: Some(observation.key.clone()),
            });
        }
    }
    let registered_names = registered
        .iter()
        .map(|component| component.flattened.as_str())
        .collect::<HashSet<_>>();
    if registered.is_empty() {
        report.findings.push(Finding {
            code: FindingCode::NoRegisteredProvider,
            severity: FindingSeverity::Warning,
            related_value: None,
        });
    }
    if let Some(enabled) = enabled {
        if enabled.is_empty() {
            report.findings.push(Finding {
                code: FindingCode::NoEnabledProvider,
                severity: FindingSeverity::Warning,
                related_value: None,
            });
        }
        for component in enabled {
            if !registered_names.contains(component.flattened.as_str()) {
                report.findings.push(Finding {
                    code: FindingCode::EnabledProviderNotRegistered,
                    severity: FindingSeverity::Warning,
                    related_value: Some(component.flattened.clone()),
                });
            }
        }
    }
    if let Some(primary) = primary {
        if primary.is_empty() {
            report.findings.push(Finding {
                code: FindingCode::NoPrimaryProvider,
                severity: FindingSeverity::Info,
                related_value: None,
            });
        }
        for component in primary {
            if !registered_names.contains(component.flattened.as_str()) {
                report.findings.push(Finding {
                    code: FindingCode::PrimaryProviderNotRegistered,
                    severity: FindingSeverity::Warning,
                    related_value: Some(component.flattened.clone()),
                });
            }
            if let Some(enabled) = enabled
                && !enabled.contains(component)
            {
                report.findings.push(Finding {
                    code: FindingCode::PrimaryProviderNotEnabled,
                    severity: FindingSeverity::Warning,
                    related_value: Some(component.flattened.clone()),
                });
            }
        }
    }
    if let (Some(autofill), Some(enabled)) = (autofill, enabled) {
        for component in autofill {
            let registered_same_package = registered
                .iter()
                .any(|item| item.package_name == component.package_name);
            let enabled_same_package = enabled
                .iter()
                .any(|item| item.package_name == component.package_name);
            if registered_same_package && !enabled_same_package {
                report.findings.push(Finding {
                    code: FindingCode::AutofillProviderNotCredentialEnabled,
                    severity: FindingSeverity::Warning,
                    related_value: Some(component.package_name.clone()),
                });
            }
        }
    }
    report.providers = registered
        .into_iter()
        .map(|component| ProviderService {
            enabled: enabled
                .map(|items| items.contains(&component))
                .unwrap_or(false),
            primary: primary
                .map(|items| items.contains(&component))
                .unwrap_or(false),
            same_package_as_autofill: autofill
                .map(|items| {
                    items
                        .iter()
                        .any(|item| item.package_name == component.package_name)
                })
                .unwrap_or(false),
            component,
        })
        .collect();
    if report.status == DiagnosisStatus::Complete
        && !report
            .findings
            .iter()
            .any(|finding| finding.severity == FindingSeverity::Warning)
    {
        report.findings.push(Finding {
            code: FindingCode::NoInconsistencyDetected,
            severity: FindingSeverity::Info,
            related_value: None,
        });
    }
}

fn parsed_components(value: &SettingValue) -> Option<&[ComponentName]> {
    match value {
        SettingValue::Missing | SettingValue::Empty => Some(&[]),
        SettingValue::Value {
            components: Some(components),
            ..
        } => Some(components),
        SettingValue::Value {
            components: None, ..
        }
        | SettingValue::Unavailable { .. } => None,
    }
}

async fn read_property(
    runner: &(impl CommandRunner + ?Sized),
    adb: &ValidatedAdb,
    serial: &str,
    property: &str,
) -> Result<String, DiagnosticError> {
    let output = run_device_adb(runner, adb, serial, ["shell", "getprop", property]).await?;
    ensure_success(&output, property)?;
    Ok(output_text(&output.stdout, property)?.trim().to_owned())
}

async fn read_setting(
    runner: &(impl CommandRunner + ?Sized),
    adb: &ValidatedAdb,
    serial: &str,
    user_id: u32,
    key: &str,
) -> SettingObservation {
    let user = user_id.to_string();
    let result = run_device_adb(
        runner,
        adb,
        serial,
        ["shell", "settings", "--user", &user, "get", "secure", key],
    )
    .await
    .and_then(|output| {
        ensure_success(&output, key)?;
        parse_setting_value(&output.stdout)
    });
    let value = match result {
        Ok(value) => value,
        Err(error) => SettingValue::Unavailable {
            code: ErrorCode::SettingReadFailed.as_str().to_owned(),
            message: error.to_string(),
        },
    };
    SettingObservation {
        key: key.to_owned(),
        value,
    }
}

async fn run_adb<const N: usize>(
    runner: &(impl CommandRunner + ?Sized),
    adb: &ValidatedAdb,
    arguments: [&str; N],
) -> Result<CommandOutput, DiagnosticError> {
    let request = CommandRequest::new(
        &adb.path,
        arguments.into_iter().map(OsString::from),
        ADB_COMMAND_TIMEOUT,
        ADB_COMMAND_MAX_OUTPUT_BYTES,
    )?;
    Ok(run_command(runner, &request).await?)
}

async fn run_device_adb<const N: usize>(
    runner: &(impl CommandRunner + ?Sized),
    adb: &ValidatedAdb,
    serial: &str,
    arguments: [&str; N],
) -> Result<CommandOutput, DiagnosticError> {
    let mut command_arguments = vec![OsString::from("-s"), OsString::from(serial)];
    command_arguments.extend(arguments.into_iter().map(OsString::from));
    let request = CommandRequest::new(
        &adb.path,
        command_arguments,
        ADB_COMMAND_TIMEOUT,
        ADB_COMMAND_MAX_OUTPUT_BYTES,
    )?;
    Ok(run_command(runner, &request).await?)
}

fn ensure_success(output: &CommandOutput, stage: &str) -> Result<(), DiagnosticError> {
    if output.exit_code == Some(0) {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    Err(DiagnosticError::OutputInvalid {
        stage: stage.to_owned(),
        message: if stderr.is_empty() {
            format!("ADB exited with code {:?}", output.exit_code)
        } else {
            stderr
        },
    })
}

fn output_text<'a>(output: &'a [u8], stage: &str) -> Result<&'a str, DiagnosticError> {
    std::str::from_utf8(output).map_err(|_| DiagnosticError::OutputInvalid {
        stage: stage.to_owned(),
        message: "output was not valid UTF-8".to_owned(),
    })
}

fn split_first_field(value: &str) -> Option<(&str, &str)> {
    let index = value.find(char::is_whitespace)?;
    Some((&value[..index], value[index..].trim_start()))
}

fn attribute(value: &str, key: &str) -> Option<String> {
    value.split_whitespace().find_map(|item| {
        let (candidate, value) = item.split_once(':')?;
        (candidate == key).then(|| value.to_owned())
    })
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

#[cfg(test)]
mod tests {
    use std::{collections::VecDeque, path::PathBuf, sync::Mutex};

    use async_trait::async_trait;

    use super::*;

    #[test]
    fn parses_device_states_and_connection_details() {
        let output = b"List of devices attached\r\nUSB123 device usb:1-1 product:foo model:Pixel_8 device:shiba transport_id:1\r\n192.0.2.1:5555 offline transport_id:2\r\nLOCKED unauthorized usb:2-1\r\nNOPERM no permissions (missing udev rules)\r\n";

        let devices = parse_adb_devices(output).unwrap();

        assert_eq!(devices.len(), 4);
        assert_eq!(devices[0].state, DeviceConnectionState::Device);
        assert_eq!(devices[0].connection_type, ConnectionType::Usb);
        assert_eq!(devices[0].model.as_deref(), Some("Pixel 8"));
        assert_eq!(devices[1].connection_type, ConnectionType::Wireless);
        assert_eq!(devices[2].state, DeviceConnectionState::Unauthorized);
        assert_eq!(devices[3].state, DeviceConnectionState::NoPermissions);
    }

    #[test]
    fn rejects_non_utf8_device_output() {
        let error = parse_adb_devices(&[0xff]).unwrap_err();
        assert_eq!(error.code(), ErrorCode::OutputInvalid);
    }

    #[test]
    fn parses_provider_components_without_assigning_capabilities() {
        let output = b"2 services:\ncom.x8bit.bitwarden/.Autofill.CredentialProviderService\ncom.google.android.gms/com.google.Service\n";

        let providers = parse_provider_services(output).unwrap();

        assert_eq!(providers.len(), 2);
        assert_eq!(providers[0].package_name, "com.x8bit.bitwarden");
        assert_eq!(
            providers[0].service_class,
            ".Autofill.CredentialProviderService"
        );
    }

    #[test]
    fn distinguishes_missing_empty_value_and_unparseable_settings() {
        assert_eq!(
            parse_setting_value(b"null\n").unwrap(),
            SettingValue::Missing
        );
        assert_eq!(parse_setting_value(b"\n").unwrap(), SettingValue::Empty);
        assert!(matches!(
            parse_setting_value(b"com.example/.Provider\n").unwrap(),
            SettingValue::Value {
                components: Some(_),
                ..
            }
        ));
        assert!(matches!(
            parse_setting_value(b"oem-value\n").unwrap(),
            SettingValue::Value {
                components: None,
                ..
            }
        ));
    }

    #[test]
    fn reports_primary_enabled_and_autofill_mismatches() {
        let bitwarden =
            parse_component("com.x8bit.bitwarden/.Autofill.CredentialProviderService").unwrap();
        let google = parse_component("com.google.android.gms/com.google.Provider").unwrap();
        let mut report = report_with_settings(
            SettingValue::Value {
                raw: google.flattened.clone(),
                components: Some(vec![google.clone()]),
            },
            SettingValue::Value {
                raw: bitwarden.flattened.clone(),
                components: Some(vec![bitwarden.clone()]),
            },
            SettingValue::Value {
                raw: "com.x8bit.bitwarden/.AutofillService".to_owned(),
                components: Some(vec![
                    parse_component("com.x8bit.bitwarden/.AutofillService").unwrap(),
                ]),
            },
        );

        complete_report(&mut report, vec![bitwarden, google]);

        assert!(
            report
                .findings
                .iter()
                .any(|finding| { finding.code == FindingCode::PrimaryProviderNotEnabled })
        );
        assert!(
            report.findings.iter().any(|finding| {
                finding.code == FindingCode::AutofillProviderNotCredentialEnabled
            })
        );
    }

    struct ScriptedRunner {
        requests: Mutex<Vec<CommandRequest>>,
        outputs: Mutex<VecDeque<Result<CommandOutput, CommandError>>>,
    }

    #[async_trait]
    impl CommandRunner for ScriptedRunner {
        async fn run(&self, request: &CommandRequest) -> Result<CommandOutput, CommandError> {
            self.requests.lock().unwrap().push(request.clone());
            self.outputs.lock().unwrap().pop_front().unwrap()
        }
    }

    #[tokio::test]
    async fn diagnosis_uses_explicit_serial_and_foreground_user() {
        let outputs = [
            ok(b"List of devices attached\nSERIAL device usb:1-1 model:Phone\n"),
            ok(b"Example\n"),
            ok(b"Phone\n"),
            ok(b"device\n"),
            ok(b"14\n"),
            ok(b"34\n"),
            ok(b"10\n"),
            ok(b"com.example/.Provider\n"),
            ok(b"com.example/.Provider\n"),
            ok(b"com.example/.Provider\n"),
            ok(b"null\n"),
        ];
        let runner = ScriptedRunner {
            requests: Mutex::new(Vec::new()),
            outputs: Mutex::new(outputs.into_iter().map(Ok).collect()),
        };

        let report = diagnose_device(&runner, &test_adb(), "SERIAL")
            .await
            .unwrap();

        assert_eq!(report.android_user.unwrap().id, 10);
        let requests = runner.requests.lock().unwrap();
        for request in requests.iter().skip(1) {
            assert_eq!(request.arguments[0], OsString::from("-s"));
            assert_eq!(request.arguments[1], OsString::from("SERIAL"));
        }
        let setting_request = &requests[8];
        assert!(setting_request.arguments.contains(&OsString::from("10")));
    }

    #[tokio::test]
    async fn api_33_stops_before_user_and_provider_queries() {
        let outputs = [
            ok(b"List of devices attached\nSERIAL device model:Phone\n"),
            ok(b"Example\n"),
            ok(b"Phone\n"),
            ok(b"device\n"),
            ok(b"13\n"),
            ok(b"33\n"),
        ];
        let runner = ScriptedRunner {
            requests: Mutex::new(Vec::new()),
            outputs: Mutex::new(outputs.into_iter().map(Ok).collect()),
        };

        let report = diagnose_device(&runner, &test_adb(), "SERIAL")
            .await
            .unwrap();

        assert_eq!(report.status, DiagnosisStatus::Unsupported);
        assert_eq!(runner.requests.lock().unwrap().len(), 6);
    }

    fn ok(stdout: &[u8]) -> CommandOutput {
        CommandOutput {
            exit_code: Some(0),
            signal: None,
            stdout: stdout.to_vec(),
            stderr: Vec::new(),
        }
    }

    fn test_adb() -> ValidatedAdb {
        ValidatedAdb {
            path: PathBuf::from("/path with spaces/adb"),
            resolved_path: PathBuf::from("/path with spaces/adb"),
            version: "Android Debug Bridge version 1.0.41".to_owned(),
        }
    }

    fn report_with_settings(
        enabled: SettingValue,
        primary: SettingValue,
        autofill: SettingValue,
    ) -> DiagnosisReport {
        DiagnosisReport {
            schema_version: 1,
            mode: DiagnosisMode::Real,
            status: DiagnosisStatus::Complete,
            observed_at_unix_ms: 0,
            adb: test_adb(),
            device: DeviceInfo {
                serial: "SERIAL".to_owned(),
                connection_type: ConnectionType::Usb,
                manufacturer: "Example".to_owned(),
                model: "Phone".to_owned(),
                codename: "device".to_owned(),
                android_version: "14".to_owned(),
                api_level: 34,
            },
            android_user: Some(AndroidUser {
                id: 0,
                is_foreground: true,
            }),
            providers: Vec::new(),
            credential_state: CredentialState {
                enabled: SettingObservation {
                    key: "credential_service".to_owned(),
                    value: enabled,
                },
                primary: SettingObservation {
                    key: "credential_service_primary".to_owned(),
                    value: primary,
                },
                autofill: SettingObservation {
                    key: "autofill_service".to_owned(),
                    value: autofill,
                },
            },
            findings: Vec::new(),
        }
    }
}
