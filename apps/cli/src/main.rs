mod adapters;

use std::{
    io::{self, IsTerminal, Write},
    path::{Path, PathBuf},
    process::ExitCode,
};

use acp_fixer_core::{
    AdbDiscoveryContext, DeviceConnectionState, DeviceList, DiagnosisReport, DiagnosisStatus,
    DiagnosticError, ErrorEnvelope, FindingSeverity, ValidatedAdb, demo_fixture, diagnose_device,
    discover_adb, list_devices, validate_adb,
};
use clap::{Args, Parser, Subcommand};
use serde::Serialize;
use serde_json::json;

const EXIT_ADB: u8 = 3;
const EXIT_DEVICE: u8 = 4;
const EXIT_DIAGNOSTIC_INCOMPLETE: u8 = 5;

#[derive(Debug, Parser)]
#[command(
    name = "acp-fixer",
    version,
    about = "Read-only Android Credential Provider diagnostics",
    long_about = "Discover ADB, inspect an explicitly selected Android 14+ device, and diagnose Credential Provider state without modifying the device."
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// List devices visible to a validated ADB installation.
    Devices(CommonOptions),
    /// Inspect Credential Provider state on an explicitly selected device.
    Diagnose(DiagnoseOptions),
    /// Print the deterministic, simulated Xiaomi/HyperOS example.
    Demo(OutputOptions),
}

#[derive(Clone, Debug, Args)]
struct OutputOptions {
    /// Emit one versioned JSON document.
    #[arg(long)]
    json: bool,
}

#[derive(Clone, Debug, Args)]
struct CommonOptions {
    /// Use this ADB executable after validating its identity.
    #[arg(long, value_name = "PATH")]
    adb: Option<PathBuf>,
    /// Emit one versioned JSON document.
    #[arg(long)]
    json: bool,
}

#[derive(Clone, Debug, Args)]
struct DiagnoseOptions {
    /// Use this ADB executable after validating its identity.
    #[arg(long, value_name = "PATH")]
    adb: Option<PathBuf>,
    /// Select a serial from the current `adb devices -l` result.
    #[arg(long, value_name = "SERIAL")]
    device: Option<String>,
    /// Prompt for device selection even when terminal detection is unavailable.
    #[arg(long, conflicts_with_all = ["no_interactive", "json"])]
    interactive: bool,
    /// Never prompt for device selection.
    #[arg(long, conflicts_with = "interactive")]
    no_interactive: bool,
    /// Emit one versioned JSON document and disable implicit interaction.
    #[arg(long)]
    json: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DevicesDocument<'a> {
    schema_version: u32,
    adb: &'a ValidatedAdb,
    device_list: &'a DeviceList,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosisDocument<'a> {
    schema_version: u32,
    report: &'a DiagnosisReport,
}

#[tokio::main]
async fn main() -> ExitCode {
    let cli = Cli::parse();
    match run(cli).await {
        Ok(code) => ExitCode::from(code),
        Err(failure) => {
            failure.print();
            ExitCode::from(failure.exit_code)
        }
    }
}

async fn run(cli: Cli) -> Result<u8, CliFailure> {
    let runner = adapters::TokioCommandRunner;
    match cli.command {
        Commands::Devices(options) => {
            let adb = resolve_adb(&runner, options.adb.as_deref())
                .await
                .map_err(|error| CliFailure::new(error, options.json, EXIT_ADB))?;
            let device_list = list_devices(&runner, &adb)
                .await
                .map_err(|error| CliFailure::new(error, options.json, EXIT_ADB))?;
            if options.json {
                print_json(&DevicesDocument {
                    schema_version: 1,
                    adb: &adb,
                    device_list: &device_list,
                });
            } else {
                print_devices(&adb, &device_list);
            }
            Ok(0)
        }
        Commands::Diagnose(options) => {
            let adb = resolve_adb(&runner, options.adb.as_deref())
                .await
                .map_err(|error| CliFailure::new(error, options.json, EXIT_ADB))?;
            let device_list = list_devices(&runner, &adb)
                .await
                .map_err(|error| CliFailure::new(error, options.json, EXIT_ADB))?;
            let interactive = interaction_enabled(&options);
            let serial = match options.device {
                Some(serial) => {
                    validate_selected_serial(&device_list, &serial).map_err(|error| {
                        CliFailure::with_devices(error, options.json, device_list.clone())
                    })?
                }
                None if interactive => prompt_for_device(&device_list).map_err(|error| {
                    CliFailure::with_devices(error, options.json, device_list.clone())
                })?,
                None => {
                    if !options.json {
                        print_devices(&adb, &device_list);
                    }
                    return Err(CliFailure::with_devices(
                        DiagnosticError::DeviceSelectionRequired,
                        options.json,
                        device_list,
                    ));
                }
            };
            let report = diagnose_device(&runner, &adb, &serial)
                .await
                .map_err(|error| CliFailure::new(error, options.json, EXIT_DEVICE))?;
            if options.json {
                print_json(&DiagnosisDocument {
                    schema_version: 1,
                    report: &report,
                });
            } else {
                print_report(&report);
            }
            Ok(if report.status == DiagnosisStatus::Incomplete {
                EXIT_DIAGNOSTIC_INCOMPLETE
            } else {
                0
            })
        }
        Commands::Demo(options) => {
            let demo = demo_fixture();
            if options.json {
                print_json(&demo);
            } else {
                println!("SIMULATED DEMO — no ADB command was executed.\n");
                print_report(&demo.report);
            }
            Ok(0)
        }
    }
}

async fn resolve_adb(
    runner: &adapters::TokioCommandRunner,
    explicit: Option<&Path>,
) -> Result<ValidatedAdb, DiagnosticError> {
    if let Some(path) = explicit {
        return validate_adb(runner, path).await;
    }
    let result = discover_adb(runner, &AdbDiscoveryContext::from_environment(Vec::new())).await;
    result
        .candidates
        .into_iter()
        .next()
        .map(|candidate| candidate.adb)
        .ok_or(DiagnosticError::AdbNotFound)
}

fn interaction_enabled(options: &DiagnoseOptions) -> bool {
    if options.interactive {
        true
    } else if options.no_interactive || options.json {
        false
    } else {
        io::stdin().is_terminal() && io::stdout().is_terminal()
    }
}

fn validate_selected_serial(devices: &DeviceList, serial: &str) -> Result<String, DiagnosticError> {
    let device = devices
        .devices
        .iter()
        .find(|device| device.serial == serial)
        .ok_or_else(|| DiagnosticError::DeviceChanged {
            serial: serial.to_owned(),
        })?;
    match device.state {
        DeviceConnectionState::Device => Ok(serial.to_owned()),
        DeviceConnectionState::Unauthorized => Err(DiagnosticError::DeviceUnauthorized {
            serial: serial.to_owned(),
        }),
        DeviceConnectionState::Offline => Err(DiagnosticError::DeviceOffline {
            serial: serial.to_owned(),
        }),
        DeviceConnectionState::NoPermissions => Err(DiagnosticError::DeviceNoPermissions {
            serial: serial.to_owned(),
        }),
        DeviceConnectionState::Unknown => Err(DiagnosticError::DeviceChanged {
            serial: serial.to_owned(),
        }),
    }
}

fn prompt_for_device(devices: &DeviceList) -> Result<String, DiagnosticError> {
    let ready = devices
        .devices
        .iter()
        .filter(|device| device.state == DeviceConnectionState::Device)
        .collect::<Vec<_>>();
    if ready.is_empty() {
        return Err(DiagnosticError::DeviceSelectionRequired);
    }
    println!("Select the Android device to inspect:");
    for (index, device) in ready.iter().enumerate() {
        println!(
            "  {}) {}{}",
            index + 1,
            device.serial,
            device
                .model
                .as_ref()
                .map(|model| format!(" — {model}"))
                .unwrap_or_default()
        );
    }
    print!("Device number: ");
    io::stdout()
        .flush()
        .map_err(|error| DiagnosticError::OutputInvalid {
            stage: "interactive-selection".to_owned(),
            message: error.to_string(),
        })?;
    let mut input = String::new();
    io::stdin()
        .read_line(&mut input)
        .map_err(|error| DiagnosticError::OutputInvalid {
            stage: "interactive-selection".to_owned(),
            message: error.to_string(),
        })?;
    let index = input
        .trim()
        .parse::<usize>()
        .ok()
        .and_then(|value| value.checked_sub(1))
        .filter(|index| *index < ready.len())
        .ok_or(DiagnosticError::DeviceSelectionRequired)?;
    Ok(ready[index].serial.clone())
}

fn print_devices(adb: &ValidatedAdb, devices: &DeviceList) {
    println!("ADB: {}", adb.path.display());
    println!("Version: {}", adb.version);
    if devices.devices.is_empty() {
        println!("No devices found.");
        return;
    }
    println!("Devices:");
    for device in &devices.devices {
        println!(
            "  {}  {:?}{}",
            device.serial,
            device.state,
            device
                .model
                .as_ref()
                .map(|model| format!("  {model}"))
                .unwrap_or_default()
        );
    }
}

fn print_report(report: &DiagnosisReport) {
    println!("Mode: {:?}", report.mode);
    println!("Status: {:?}", report.status);
    println!("ADB: {}", report.adb.path.display());
    println!(
        "Device: {} {} ({}, Android {}, API {})",
        report.device.manufacturer,
        report.device.model,
        report.device.serial,
        report.device.android_version,
        report.device.api_level
    );
    if let Some(user) = &report.android_user {
        println!("Foreground Android user: {}", user.id);
    }
    println!("Registered Credential Providers:");
    if report.providers.is_empty() {
        println!("  none");
    }
    for provider in &report.providers {
        println!(
            "  {}  enabled={} primary={} autofill-package={}",
            provider.component.flattened,
            provider.enabled,
            provider.primary,
            provider.same_package_as_autofill
        );
    }
    println!("Credential state:");
    for observation in [
        &report.credential_state.enabled,
        &report.credential_state.primary,
        &report.credential_state.autofill,
    ] {
        println!("  {}: {:?}", observation.key, observation.value);
    }
    println!("Findings:");
    for finding in &report.findings {
        println!(
            "  {} {:?}{}",
            if finding.severity == FindingSeverity::Warning {
                "WARNING"
            } else {
                "INFO"
            },
            finding.code,
            finding
                .related_value
                .as_ref()
                .map(|value| format!(" — {value}"))
                .unwrap_or_default()
        );
    }
    println!(
        "\nRead-only result: no setting was changed. Registration and state do not prove passkey compatibility."
    );
}

fn print_json(value: &impl Serialize) {
    println!(
        "{}",
        serde_json::to_string_pretty(value).expect("serializable CLI output")
    );
}

struct CliFailure {
    error: DiagnosticError,
    json: bool,
    exit_code: u8,
    devices: Option<DeviceList>,
}

impl CliFailure {
    fn new(error: DiagnosticError, json: bool, exit_code: u8) -> Self {
        Self {
            error,
            json,
            exit_code,
            devices: None,
        }
    }

    fn with_devices(error: DiagnosticError, json: bool, devices: DeviceList) -> Self {
        Self {
            error,
            json,
            exit_code: EXIT_DEVICE,
            devices: Some(devices),
        }
    }

    fn print(&self) {
        if self.json {
            println!(
                "{}",
                serde_json::to_string_pretty(&json!({
                    "schemaVersion": 1,
                    "error": ErrorEnvelope::from(&self.error),
                    "deviceList": self.devices,
                }))
                .expect("serializable CLI error")
            );
        } else {
            eprintln!("error [{}]: {}", self.error.code().as_str(), self.error);
        }
    }
}

#[cfg(test)]
mod tests {
    use clap::{CommandFactory, Parser};

    use super::*;

    #[test]
    fn cli_definition_is_valid() {
        Cli::command().debug_assert();
    }

    #[test]
    fn json_and_interactive_are_rejected_together() {
        let error =
            Cli::try_parse_from(["acp-fixer", "diagnose", "--json", "--interactive"]).unwrap_err();

        assert_eq!(error.kind(), clap::error::ErrorKind::ArgumentConflict);
    }

    #[test]
    fn noninteractive_requires_an_enumerated_serial() {
        let devices = DeviceList {
            observed_at_unix_ms: 0,
            devices: Vec::new(),
        };

        let error = validate_selected_serial(&devices, "invented").unwrap_err();

        assert_eq!(error.code(), acp_fixer_core::ErrorCode::DeviceChanged);
    }
}
