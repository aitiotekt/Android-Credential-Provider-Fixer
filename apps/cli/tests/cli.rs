use std::process::Command;

use serde_json::Value;

fn cli() -> Command {
    Command::new(env!("CARGO_BIN_EXE_acp-fixer"))
}

#[test]
fn help_lists_the_phase_one_commands() {
    let output = cli().arg("--help").output().unwrap();

    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("devices"));
    assert!(stdout.contains("diagnose"));
    assert!(stdout.contains("demo"));
}

#[test]
fn version_matches_workspace_version() {
    let output = cli().arg("--version").output().unwrap();

    assert!(output.status.success());
    assert_eq!(
        String::from_utf8(output.stdout).unwrap().trim(),
        "acp-fixer 0.1.0-alpha.2"
    );
}

#[test]
fn demo_json_is_one_versioned_simulated_document() {
    let output = cli().args(["demo", "--json"]).output().unwrap();

    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    let document: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(document["schemaVersion"], 1);
    assert_eq!(document["simulated"], true);
    assert_eq!(document["report"]["mode"], "demo");
}

#[test]
fn json_rejects_forced_interaction_as_usage_error() {
    let output = cli()
        .args(["diagnose", "--json", "--interactive"])
        .output()
        .unwrap();

    assert_eq!(output.status.code(), Some(2));
    assert!(output.stdout.is_empty());
    assert!(!output.stderr.is_empty());
}
