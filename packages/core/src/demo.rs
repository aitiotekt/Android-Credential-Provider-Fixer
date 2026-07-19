use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::{
    AndroidUser, ChangeOutcome, ChangeOutcomeStatus, ChangePreview, ChangeStepOutcome,
    ComponentName, ConnectionType, CredentialState, DeviceConnectionState, DeviceInfo, DeviceList,
    DeviceSummary, DiagnosisCompleteness, DiagnosisMode, DiagnosisReport, Finding, FindingCode,
    FindingSeverity, ProviderService, SettingMutation, SettingObservation, SettingValue,
    SnapshotInventory, SnapshotStatus, ValidatedAdb, create_change_plan, prepare_pin,
};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DemoFixture {
    pub schema_version: u32,
    pub simulated: bool,
    pub adb: ValidatedAdb,
    pub devices: DeviceList,
    pub report: DiagnosisReport,
    pub pin_preview: ChangePreview,
    pub pin_outcome: ChangeOutcome,
    pub snapshots: SnapshotInventory,
}

#[must_use]
pub fn demo_fixture() -> DemoFixture {
    const OBSERVED_AT: u64 = 1_788_220_800_000;
    let adb = ValidatedAdb {
        path: PathBuf::from("<demo>/android-sdk/platform-tools/adb"),
        resolved_path: PathBuf::from("<demo>/android-sdk/platform-tools/adb"),
        version: "Android Debug Bridge version 1.0.41 (simulated)".to_owned(),
    };
    let device = DeviceInfo {
        serial: "DEMO-XIAOMI-DEVICE".to_owned(),
        connection_type: ConnectionType::Usb,
        manufacturer: "Xiaomi".to_owned(),
        model: "Anonymized Xiaomi device".to_owned(),
        codename: "demo-device".to_owned(),
        android_version: "16 (HyperOS demo)".to_owned(),
        api_level: 36,
    };
    let bitwarden_provider = component(
        "com.x8bit.bitwarden/.Autofill.CredentialProviderService",
        "com.x8bit.bitwarden",
        ".Autofill.CredentialProviderService",
    );
    let google_provider = component(
        "com.google.android.gms/com.google.android.gms.auth.api.credentials.credman.service.PasswordAndPasskeyService",
        "com.google.android.gms",
        "com.google.android.gms.auth.api.credentials.credman.service.PasswordAndPasskeyService",
    );
    let bitwarden_autofill = component(
        "com.x8bit.bitwarden/com.x8bit.bitwarden.Autofill.AutofillService",
        "com.x8bit.bitwarden",
        "com.x8bit.bitwarden.Autofill.AutofillService",
    );
    let report = DiagnosisReport {
        schema_version: 2,
        mode: DiagnosisMode::Demo,
        completeness: DiagnosisCompleteness::Complete,
        observed_at_unix_ms: OBSERVED_AT,
        adb: adb.clone(),
        device: device.clone(),
        android_user: Some(AndroidUser {
            id: 0,
            is_foreground: true,
        }),
        providers: vec![
            ProviderService {
                component: bitwarden_provider.clone(),
                enabled: false,
                primary: false,
                same_package_as_autofill: true,
            },
            ProviderService {
                component: google_provider.clone(),
                enabled: true,
                primary: false,
                same_package_as_autofill: false,
            },
        ],
        credential_state: CredentialState {
            enabled: observation(
                "credential_service",
                SettingValue::Value {
                    raw: google_provider.flattened.clone(),
                    components: Some(vec![google_provider]),
                },
            ),
            primary: observation("credential_service_primary", SettingValue::Missing),
            autofill: observation(
                "autofill_service",
                SettingValue::Value {
                    raw: bitwarden_autofill.flattened.clone(),
                    components: Some(vec![bitwarden_autofill]),
                },
            ),
        },
        findings: vec![
            Finding {
                code: FindingCode::AutofillProviderNotCredentialEnabled,
                severity: FindingSeverity::Warning,
                related_value: Some("com.x8bit.bitwarden".to_owned()),
            },
            Finding {
                code: FindingCode::NoPrimaryProvider,
                severity: FindingSeverity::Info,
                related_value: None,
            },
        ],
    };
    let pin_preview = prepare_pin(
        &report,
        &bitwarden_provider,
        false,
        crate::DiagnosisId::from("demo-diagnosis"),
        crate::PreviewId::from("demo-preview-pin"),
        OBSERVED_AT,
    )
    .expect("demo pin preview");
    let (plan, mut snapshot) = create_change_plan(
        &pin_preview,
        crate::PlanId::from("demo-plan-pin"),
        crate::SnapshotId::from("demo-snapshot-pin"),
        OBSERVED_AT,
    )
    .expect("demo pin plan");
    snapshot.status = SnapshotStatus::Applied;
    snapshot.revision = 2;
    snapshot.last_observed = Some(plan.after.clone());
    let pin_outcome = ChangeOutcome {
        schema_version: 2,
        plan_id: plan.plan_id,
        snapshot_id: plan.snapshot_id,
        status: ChangeOutcomeStatus::Applied,
        completed_at_unix_ms: OBSERVED_AT + 1_000,
        steps: vec![
            demo_step("credential_service"),
            demo_step("credential_service_primary"),
        ],
        recovery_steps: Vec::new(),
        observed: plan.after,
    };
    DemoFixture {
        schema_version: 2,
        simulated: true,
        adb,
        devices: DeviceList {
            observed_at_unix_ms: OBSERVED_AT,
            devices: vec![DeviceSummary {
                serial: device.serial.clone(),
                state: DeviceConnectionState::Device,
                connection_type: device.connection_type,
                product: Some("demo_product".to_owned()),
                model: Some(device.model),
                device: Some(device.codename),
                transport_id: Some("demo".to_owned()),
                details: None,
            }],
        },
        report,
        pin_preview,
        pin_outcome,
        snapshots: SnapshotInventory {
            schema_version: 2,
            snapshots: vec![snapshot],
            warnings: Vec::new(),
        },
    }
}

fn demo_step(key: &str) -> ChangeStepOutcome {
    ChangeStepOutcome {
        key: key.to_owned(),
        mutation: SettingMutation::Put,
        success: true,
        observed: None,
        error: None,
    }
}

fn component(flattened: &str, package_name: &str, service_class: &str) -> ComponentName {
    ComponentName {
        flattened: flattened.to_owned(),
        package_name: package_name.to_owned(),
        service_class: service_class.to_owned(),
    }
}

fn observation(key: &str, value: SettingValue) -> SettingObservation {
    SettingObservation {
        key: key.to_owned(),
        value,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn demo_is_visibly_simulated_and_reproduces_the_documented_mismatch() {
        let demo = demo_fixture();

        assert!(demo.simulated);
        assert_eq!(demo.report.mode, DiagnosisMode::Demo);
        assert!(
            demo.report.findings.iter().any(|finding| {
                finding.code == FindingCode::AutofillProviderNotCredentialEnabled
            })
        );
        assert!(demo.adb.path.to_string_lossy().contains("<demo>"));
    }
}
