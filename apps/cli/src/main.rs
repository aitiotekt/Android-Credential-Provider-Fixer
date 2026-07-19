mod adapters;

use std::{
    io::{self, IsTerminal, Write},
    path::{Path, PathBuf},
    process::ExitCode,
    time::{SystemTime, UNIX_EPOCH},
};

use acp_fixer_core::{
    AdbDiscoveryContext, ChangeError, ChangeExecution, ChangeOutcome, ChangeOutcomeStatus,
    ChangePlan, ChangePreview, DeviceConnectionState, DeviceList, DiagnosisCompleteness,
    DiagnosisId, DiagnosisReport, DiagnosticError, DiscoveryId, ErrorEnvelope, ExecutionId,
    ExecutionStatus, FindingSeverity, PlanId, PreviewId, SnapshotId, SnapshotInventory,
    SnapshotStore, ValidatedAdb, canonical_component_name, create_change_plan, demo_fixture,
    diagnose_device, discover_adb, execute_change, invalidate_snapshot, list_devices,
    mark_snapshot_executing, mark_source_snapshot_restored, parse_component, prepare_pin,
    prepare_restore, update_snapshot_from_outcome, validate_adb,
};
use acp_fixer_storage::{FileSnapshotStore, default_app_data_dir};
use clap::{Args, Parser, Subcommand};
use serde::Serialize;
use serde_json::json;

const EXIT_ADB: u8 = 3;
const EXIT_DEVICE: u8 = 4;
const EXIT_DIAGNOSTIC_INCOMPLETE: u8 = 5;
const EXIT_PLAN: u8 = 6;
const EXIT_CHANGE: u8 = 7;

#[derive(Debug, Parser)]
#[command(
    name = "acp-fixer",
    version,
    about = "Diagnose and safely pin Android Credential Providers",
    long_about = "Discover ADB, inspect an explicitly selected Android 14+ device, preview bounded Credential Provider changes, and apply them only with --apply."
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
    /// Preview or apply an Exclusive Provider Pin.
    Pin(PinOptions),
    /// List local versioned snapshots without contacting ADB.
    Snapshots(SnapshotOptions),
    /// Preview or apply a restore from a local snapshot.
    Restore(RestoreOptions),
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

#[derive(Clone, Debug, Args)]
struct PinOptions {
    #[command(flatten)]
    diagnose: DiagnoseOptions,
    /// Select a component from the current registered provider list.
    #[arg(long, value_name = "COMPONENT")]
    provider: Option<String>,
    /// Permit overwriting a readable but conservatively unparseable OEM value.
    #[arg(long)]
    allow_unparsed: bool,
    /// Apply the previewed change. Without this flag the command is a dry-run.
    #[arg(long)]
    apply: bool,
}

#[derive(Clone, Debug, Args)]
struct SnapshotOptions {
    /// Filter snapshots by the exact stored device serial.
    #[arg(long, value_name = "SERIAL")]
    device: Option<String>,
    #[arg(long)]
    json: bool,
}

#[derive(Clone, Debug, Args)]
struct RestoreOptions {
    /// Restore this opaque local snapshot ID.
    #[arg(long, value_name = "ID")]
    snapshot: String,
    #[command(flatten)]
    diagnose: DiagnoseOptions,
    /// Apply the previewed restore. Without this flag the command is a dry-run.
    #[arg(long)]
    apply: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DevicesDocument<'a> {
    schema_version: u32,
    discovery_id: DiscoveryId,
    adb_selection_id: acp_fixer_core::AdbSelectionId,
    device_enumeration_id: acp_fixer_core::DeviceEnumerationId,
    adb: &'a ValidatedAdb,
    device_list: &'a DeviceList,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosisDocument<'a> {
    schema_version: u32,
    discovery_id: DiscoveryId,
    adb_selection_id: acp_fixer_core::AdbSelectionId,
    device_enumeration_id: acp_fixer_core::DeviceEnumerationId,
    diagnosis_id: DiagnosisId,
    report: &'a DiagnosisReport,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ChangeDocument<'a> {
    schema_version: u32,
    dry_run: bool,
    diagnosis_id: &'a DiagnosisId,
    preview: &'a ChangePreview,
    plan: Option<&'a ChangePlan>,
    execution: Option<&'a ChangeExecution>,
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
                    schema_version: 2,
                    discovery_id: DiscoveryId::from(new_id()),
                    adb_selection_id: new_id().into(),
                    device_enumeration_id: new_id().into(),
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
                    schema_version: 2,
                    discovery_id: DiscoveryId::from(new_id()),
                    adb_selection_id: new_id().into(),
                    device_enumeration_id: new_id().into(),
                    diagnosis_id: DiagnosisId::from(new_id()),
                    report: &report,
                });
            } else {
                print_report(&report);
            }
            Ok(
                if report.completeness == DiagnosisCompleteness::Incomplete {
                    EXIT_DIAGNOSTIC_INCOMPLETE
                } else {
                    0
                },
            )
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
        Commands::Pin(options) => run_pin(&runner, options).await,
        Commands::Snapshots(options) => run_snapshots(options),
        Commands::Restore(options) => run_restore(&runner, options).await,
    }
}

async fn run_pin(
    runner: &adapters::TokioCommandRunner,
    options: PinOptions,
) -> Result<u8, CliFailure> {
    let json = options.diagnose.json;
    let adb = resolve_adb(runner, options.diagnose.adb.as_deref())
        .await
        .map_err(|error| CliFailure::diagnostic(error, json, EXIT_ADB))?;
    let device_list = list_devices(runner, &adb)
        .await
        .map_err(|error| CliFailure::diagnostic(error, json, EXIT_ADB))?;
    let interactive = interaction_enabled(&options.diagnose);
    let serial = select_serial(
        options.diagnose.device.as_deref(),
        interactive,
        &device_list,
    )
    .map_err(|error| CliFailure::diagnostic(error, json, EXIT_DEVICE))?;
    let report = diagnose_device(runner, &adb, &serial)
        .await
        .map_err(|error| CliFailure::diagnostic(error, json, EXIT_DEVICE))?;
    let target = select_provider(&report, options.provider.as_deref(), interactive)
        .map_err(|error| CliFailure::change(error, json, EXIT_PLAN))?;
    let diagnosis_id = DiagnosisId::from(new_id());
    let preview = prepare_pin(
        &report,
        &target,
        options.allow_unparsed,
        diagnosis_id.clone(),
        PreviewId::from(new_id()),
        now_unix_ms(),
    )
    .map_err(|error| CliFailure::change(error, json, EXIT_PLAN))?;
    if !options.apply {
        print_change(&diagnosis_id, &preview, None, None, true, json);
        return Ok(if preview.eligible() { 0 } else { EXIT_PLAN });
    }
    let (plan, mut snapshot) = create_change_plan(
        &preview,
        PlanId::from(new_id()),
        SnapshotId::from(new_id()),
        now_unix_ms(),
    )
    .map_err(|error| CliFailure::change(error, json, EXIT_PLAN))?;
    let store = snapshot_store();
    store
        .save(&snapshot)
        .map_err(|error| CliFailure::change(error, json, EXIT_PLAN))?;
    mark_snapshot_executing(&mut snapshot, now_unix_ms())
        .map_err(|error| CliFailure::change(error, json, EXIT_PLAN))?;
    store
        .save(&snapshot)
        .map_err(|error| CliFailure::change(error, json, EXIT_PLAN))?;
    let outcome = match execute_change(runner, &plan, now_unix_ms()).await {
        Ok(outcome) => outcome,
        Err(error) => {
            invalidate_snapshot(&mut snapshot, now_unix_ms(), error.to_string())
                .map_err(|storage| CliFailure::change(storage, json, EXIT_CHANGE))?;
            store
                .save(&snapshot)
                .map_err(|storage| CliFailure::change(storage, json, EXIT_CHANGE))?;
            return Err(CliFailure::change(error, json, EXIT_PLAN));
        }
    };
    update_snapshot_from_outcome(&mut snapshot, &outcome);
    store
        .save(&snapshot)
        .map_err(|error| CliFailure::change(error, json, EXIT_CHANGE))?;
    let execution = execution_for(&plan, outcome.clone());
    print_change(
        &diagnosis_id,
        &preview,
        Some(&plan),
        Some(&execution),
        false,
        json,
    );
    Ok(change_exit_code(&outcome))
}

fn run_snapshots(options: SnapshotOptions) -> Result<u8, CliFailure> {
    let mut inventory = snapshot_store()
        .list()
        .map_err(|error| CliFailure::change(error, options.json, EXIT_PLAN))?;
    if let Some(serial) = options.device {
        inventory
            .snapshots
            .retain(|snapshot| snapshot.device.serial == serial);
    }
    if options.json {
        print_json(&inventory);
    } else {
        print_snapshots(&inventory);
    }
    Ok(0)
}

async fn run_restore(
    runner: &adapters::TokioCommandRunner,
    options: RestoreOptions,
) -> Result<u8, CliFailure> {
    let json = options.diagnose.json;
    let store = snapshot_store();
    let mut source = store
        .load(&SnapshotId::from(options.snapshot.as_str()))
        .map_err(|error| CliFailure::change(error, json, EXIT_PLAN))?;
    let adb = resolve_adb(runner, options.diagnose.adb.as_deref())
        .await
        .map_err(|error| CliFailure::diagnostic(error, json, EXIT_ADB))?;
    let device_list = list_devices(runner, &adb)
        .await
        .map_err(|error| CliFailure::diagnostic(error, json, EXIT_ADB))?;
    let interactive = interaction_enabled(&options.diagnose);
    let serial = select_serial(
        options.diagnose.device.as_deref(),
        interactive,
        &device_list,
    )
    .map_err(|error| CliFailure::diagnostic(error, json, EXIT_DEVICE))?;
    let report = diagnose_device(runner, &adb, &serial)
        .await
        .map_err(|error| CliFailure::diagnostic(error, json, EXIT_DEVICE))?;
    let diagnosis_id = DiagnosisId::from(new_id());
    let preview = prepare_restore(
        &report,
        &source,
        diagnosis_id.clone(),
        PreviewId::from(new_id()),
        now_unix_ms(),
    )
    .map_err(|error| CliFailure::change(error, json, EXIT_PLAN))?;
    if !options.apply {
        print_change(&diagnosis_id, &preview, None, None, true, json);
        return Ok(if preview.eligible() { 0 } else { EXIT_PLAN });
    }
    let (plan, mut restore_snapshot) = create_change_plan(
        &preview,
        PlanId::from(new_id()),
        SnapshotId::from(new_id()),
        now_unix_ms(),
    )
    .map_err(|error| CliFailure::change(error, json, EXIT_PLAN))?;
    store
        .save(&restore_snapshot)
        .map_err(|error| CliFailure::change(error, json, EXIT_PLAN))?;
    mark_snapshot_executing(&mut restore_snapshot, now_unix_ms())
        .map_err(|error| CliFailure::change(error, json, EXIT_PLAN))?;
    store
        .save(&restore_snapshot)
        .map_err(|error| CliFailure::change(error, json, EXIT_PLAN))?;
    let outcome = match execute_change(runner, &plan, now_unix_ms()).await {
        Ok(outcome) => outcome,
        Err(error) => {
            invalidate_snapshot(&mut restore_snapshot, now_unix_ms(), error.to_string())
                .map_err(|storage| CliFailure::change(storage, json, EXIT_CHANGE))?;
            store
                .save(&restore_snapshot)
                .map_err(|storage| CliFailure::change(storage, json, EXIT_CHANGE))?;
            return Err(CliFailure::change(error, json, EXIT_PLAN));
        }
    };
    update_snapshot_from_outcome(&mut restore_snapshot, &outcome);
    store
        .save(&restore_snapshot)
        .map_err(|error| CliFailure::change(error, json, EXIT_CHANGE))?;
    if outcome.status == ChangeOutcomeStatus::Restored {
        mark_source_snapshot_restored(&mut source, &outcome)
            .map_err(|error| CliFailure::change(error, json, EXIT_CHANGE))?;
        store
            .save(&source)
            .map_err(|error| CliFailure::change(error, json, EXIT_CHANGE))?;
    }
    let execution = execution_for(&plan, outcome.clone());
    print_change(
        &diagnosis_id,
        &preview,
        Some(&plan),
        Some(&execution),
        false,
        json,
    );
    Ok(change_exit_code(&outcome))
}

fn select_serial(
    requested: Option<&str>,
    interactive: bool,
    devices: &DeviceList,
) -> Result<String, DiagnosticError> {
    match requested {
        Some(serial) => validate_selected_serial(devices, serial),
        None if interactive => prompt_for_device(devices),
        None => Err(DiagnosticError::DeviceSelectionRequired),
    }
}

fn select_provider(
    report: &DiagnosisReport,
    requested: Option<&str>,
    interactive: bool,
) -> Result<acp_fixer_core::ComponentName, ChangeError> {
    if let Some(requested) = requested {
        let parsed = parse_component(requested).ok_or(ChangeError::TargetNotRegistered)?;
        let canonical = canonical_component_name(&parsed);
        return report
            .providers
            .iter()
            .find(|provider| canonical_component_name(&provider.component) == canonical)
            .map(|provider| provider.component.clone())
            .ok_or(ChangeError::TargetNotRegistered);
    }
    if !interactive {
        return Err(ChangeError::TargetNotRegistered);
    }
    println!("Select the registered Credential Provider to pin:");
    for (index, provider) in report.providers.iter().enumerate() {
        println!("  {}) {}", index + 1, provider.component.flattened);
    }
    print!("Provider number: ");
    io::stdout()
        .flush()
        .map_err(|error| ChangeError::SnapshotStorage {
            message: error.to_string(),
        })?;
    let mut input = String::new();
    io::stdin()
        .read_line(&mut input)
        .map_err(|error| ChangeError::SnapshotStorage {
            message: error.to_string(),
        })?;
    let index = input
        .trim()
        .parse::<usize>()
        .ok()
        .and_then(|value| value.checked_sub(1))
        .filter(|index| *index < report.providers.len())
        .ok_or(ChangeError::TargetNotRegistered)?;
    Ok(report.providers[index].component.clone())
}

fn snapshot_store() -> FileSnapshotStore {
    FileSnapshotStore::new(default_app_data_dir().join("snapshots"))
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn change_exit_code(outcome: &ChangeOutcome) -> u8 {
    match outcome.status {
        ChangeOutcomeStatus::Applied | ChangeOutcomeStatus::Restored => 0,
        ChangeOutcomeStatus::Recovered | ChangeOutcomeStatus::RecoveryFailed => EXIT_CHANGE,
    }
}

fn execution_for(plan: &ChangePlan, outcome: ChangeOutcome) -> ChangeExecution {
    ChangeExecution {
        schema_version: 2,
        execution_id: ExecutionId::from(new_id()),
        plan_id: plan.plan_id.clone(),
        source_diagnosis_id: plan.source_diagnosis_id.clone(),
        status: match outcome.status {
            ChangeOutcomeStatus::Applied => ExecutionStatus::Applied,
            ChangeOutcomeStatus::Restored => ExecutionStatus::Restored,
            ChangeOutcomeStatus::Recovered => ExecutionStatus::Recovered,
            ChangeOutcomeStatus::RecoveryFailed => ExecutionStatus::RecoveryFailed,
        },
        write_attempted: true,
        completed_at_unix_ms: outcome.completed_at_unix_ms,
        outcome: Some(outcome),
        error: None,
        persistence_warning: None,
    }
}

fn print_change(
    diagnosis_id: &DiagnosisId,
    preview: &ChangePreview,
    plan: Option<&ChangePlan>,
    execution: Option<&ChangeExecution>,
    dry_run: bool,
    json: bool,
) {
    if json {
        print_json(&ChangeDocument {
            schema_version: 2,
            dry_run,
            diagnosis_id,
            preview,
            plan,
            execution,
        });
        return;
    }
    println!("Change: {:?}", preview.kind);
    println!(
        "Device: {} ({})",
        preview.device.model, preview.device.serial
    );
    println!("Android user: {}", preview.android_user.id);
    println!("Provider: {}", preview.target.flattened);
    println!("Before: {:?}", preview.before);
    println!("After: {:?}", preview.after);
    if !preview.blockers.is_empty() {
        println!("Blocked: {:?}", preview.blockers);
    }
    if dry_run {
        println!("\nDRY RUN — no snapshot was created and no setting was changed.");
    } else if let Some(outcome) = execution.and_then(|value| value.outcome.as_ref()) {
        println!("Outcome: {:?}", outcome.status);
        println!("Snapshot: {}", outcome.snapshot_id);
    }
}

fn print_snapshots(inventory: &SnapshotInventory) {
    if inventory.snapshots.is_empty() {
        println!("No local snapshots.");
    }
    for snapshot in &inventory.snapshots {
        println!(
            "{}  {:?}  {}  user {}  {}",
            snapshot.snapshot_id,
            snapshot.status,
            snapshot.device.serial,
            snapshot.android_user.id,
            snapshot.target.flattened
        );
    }
    for warning in &inventory.warnings {
        eprintln!(
            "warning [{}]: {}: {}",
            warning.code, warning.file, warning.message
        );
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
    println!("Status: {:?}", report.completeness);
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
        "\nDiagnosis result: no setting was changed. Registration and state do not prove passkey compatibility."
    );
}

fn print_json(value: &impl Serialize) {
    println!(
        "{}",
        serde_json::to_string_pretty(value).expect("serializable CLI output")
    );
}

struct CliFailure {
    error: ErrorEnvelope,
    message: String,
    json: bool,
    exit_code: u8,
    devices: Option<DeviceList>,
}

impl CliFailure {
    fn new(error: DiagnosticError, json: bool, exit_code: u8) -> Self {
        Self::diagnostic(error, json, exit_code)
    }

    fn diagnostic(error: DiagnosticError, json: bool, exit_code: u8) -> Self {
        Self {
            error: ErrorEnvelope::from(&error),
            message: error.to_string(),
            json,
            exit_code,
            devices: None,
        }
    }

    fn change(error: ChangeError, json: bool, exit_code: u8) -> Self {
        Self {
            error: ErrorEnvelope::from(&error),
            message: error.to_string(),
            json,
            exit_code,
            devices: None,
        }
    }

    fn with_devices(error: DiagnosticError, json: bool, devices: DeviceList) -> Self {
        Self {
            error: ErrorEnvelope::from(&error),
            message: error.to_string(),
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
                    "schemaVersion": 2,
                    "error": self.error,
                    "deviceList": self.devices,
                }))
                .expect("serializable CLI error")
            );
        } else {
            eprintln!("error [{}]: {}", self.error.code, self.message);
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

    #[test]
    fn pin_and_restore_are_dry_runs_unless_apply_is_explicit() {
        let pin = Cli::try_parse_from([
            "acp-fixer",
            "pin",
            "--device",
            "SERIAL",
            "--provider",
            "com.example/.Provider",
        ])
        .unwrap();
        let restore = Cli::try_parse_from([
            "acp-fixer",
            "restore",
            "--snapshot",
            "snapshot-id",
            "--device",
            "SERIAL",
        ])
        .unwrap();

        assert!(matches!(pin.command, Commands::Pin(options) if !options.apply));
        assert!(matches!(restore.command, Commands::Restore(options) if !options.apply));
    }
}
