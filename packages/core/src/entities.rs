use serde::{Deserialize, Serialize};

use crate::{
    AdbCandidateSource, AdbSelectionId, AdbValidationFailure, DeviceEnumerationId, DeviceId,
    DeviceSummary, DiagnosisId, DiagnosisReport, DiscoveryId, ProviderId, ProviderService,
    ValidatedAdb,
};

pub const PUBLIC_SCHEMA_VERSION: u32 = 2;

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbCandidateEntity {
    pub candidate_id: String,
    pub source: AdbCandidateSource,
    pub adb: ValidatedAdb,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbDiscoveryEntity {
    pub schema_version: u32,
    pub discovery_id: DiscoveryId,
    pub session_revision: u64,
    pub completed_at_unix_ms: u64,
    pub candidates: Vec<AdbCandidateEntity>,
    pub failures: Vec<AdbValidationFailure>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbSelectionEntity {
    pub schema_version: u32,
    pub selection_id: AdbSelectionId,
    pub discovery_id: Option<DiscoveryId>,
    pub session_revision: u64,
    pub selected_at_unix_ms: u64,
    pub adb: ValidatedAdb,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceEntity {
    pub device_id: DeviceId,
    #[serde(flatten)]
    pub device: DeviceSummary,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceEnumerationEntity {
    pub schema_version: u32,
    pub enumeration_id: DeviceEnumerationId,
    pub selection_id: AdbSelectionId,
    pub session_revision: u64,
    pub observed_at_unix_ms: u64,
    pub devices: Vec<DeviceEntity>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderEntity {
    pub provider_id: ProviderId,
    pub diagnosis_id: DiagnosisId,
    #[serde(flatten)]
    pub provider: ProviderService,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosisEntity {
    pub schema_version: u32,
    pub diagnosis_id: DiagnosisId,
    pub session_revision: u64,
    pub enumeration_id: DeviceEnumerationId,
    pub device_id: DeviceId,
    pub started_at_unix_ms: u64,
    pub resolved_at_unix_ms: u64,
    pub report: DiagnosisReport,
    pub providers: Vec<ProviderEntity>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionContext {
    pub schema_version: u32,
    pub session_revision: u64,
    pub selection_id: Option<AdbSelectionId>,
    pub enumeration_id: Option<DeviceEnumerationId>,
    pub latest_diagnosis_id: Option<DiagnosisId>,
}
