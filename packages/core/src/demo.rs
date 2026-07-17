use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::{
    AndroidUser, ComponentName, ConnectionType, CredentialState, DeviceConnectionState, DeviceInfo,
    DeviceList, DeviceSummary, DiagnosisMode, DiagnosisReport, DiagnosisStatus, Finding,
    FindingCode, FindingSeverity, ProviderService, SettingObservation, SettingValue, ValidatedAdb,
};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DemoFixture {
    pub schema_version: u32,
    pub simulated: bool,
    pub adb: ValidatedAdb,
    pub devices: DeviceList,
    pub report: DiagnosisReport,
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
        schema_version: 1,
        mode: DiagnosisMode::Demo,
        status: DiagnosisStatus::Complete,
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
    DemoFixture {
        schema_version: 1,
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
