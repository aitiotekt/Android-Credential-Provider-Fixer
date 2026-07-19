import { invoke } from "@tauri-apps/api/core";
import { type AppGateway, type DeviceGateway } from "../domain/gateways";
import {
	type AdbCandidate,
	type AdbDiscovery,
	type AdbSelection,
	type AppInfo,
	type ChangeExecution,
	type ChangePlan,
	type ChangePreview,
	type DemoFixture,
	type DeviceList,
	type DiagnosisEntity,
	type OnboardingStatus,
	type SessionContext,
	type SnapshotInventory,
	type StartupState,
	type ThemePreference,
} from "../lib/tauri";

export function createTauriAppGateway(): AppGateway {
	return {
		getAppInfo: () => invoke<AppInfo>("get_app_info"),
		getStartupState: () => invoke<StartupState>("get_startup_state"),
		setOnboardingStatus: (status: OnboardingStatus) =>
			invoke<StartupState>("set_onboarding_status", { status }),
		setThemePreference: (preference: ThemePreference) =>
			invoke<StartupState>("set_theme_preference", { preference }),
		getDemoFixture: () => invoke<DemoFixture>("get_demo_fixture"),
	};
}

export function createTauriDeviceGateway(): DeviceGateway {
	return {
		getSessionContext: () => invoke<SessionContext>("get_session_context"),
		discoverAdb: () => invoke<AdbDiscovery>("discover_adb"),
		selectAdbCandidate: (discoveryId, candidateId) =>
			invoke<AdbSelection>("select_adb_candidate", {
				discoveryId,
				candidateId,
			}),
		chooseAdbExecutable: () =>
			invoke<AdbSelection | null>("choose_adb_executable"),
		listDevices: (selectionId) =>
			invoke<DeviceList>("list_devices", { selectionId }),
		resolveDiagnosis: (enumerationId, deviceId) =>
			invoke<DiagnosisEntity>("resolve_diagnosis", {
				enumerationId,
				deviceId,
			}),
		preparePin: (diagnosisId, providerId, allowUnparsed) =>
			invoke<ChangePreview>("prepare_pin", {
				diagnosisId,
				providerId,
				allowUnparsed,
			}),
		authorizePinPreview: (previewId) =>
			invoke<ChangePreview>("authorize_pin_preview", { previewId }),
		createPinPlan: (previewId) =>
			invoke<ChangePlan>("create_pin_plan", { previewId }),
		executePinPlan: (planId) =>
			invoke<ChangeExecution>("execute_pin_plan", { planId }),
		listSnapshots: () => invoke<SnapshotInventory>("list_snapshots"),
		prepareRestore: (diagnosisId, snapshotId) =>
			invoke<ChangePreview>("prepare_restore", {
				diagnosisId,
				snapshotId,
			}),
		createRestorePlan: (previewId) =>
			invoke<ChangePlan>("create_restore_plan", { previewId }),
		executeRestorePlan: (planId) =>
			invoke<ChangeExecution>("execute_restore_plan", { planId }),
		cancelChangePlan: (planId) =>
			invoke<ChangeExecution>("cancel_change_plan", { planId }),
	};
}

export type TauriAdbCandidate = AdbCandidate;
