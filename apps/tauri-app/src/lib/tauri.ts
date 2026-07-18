import { invoke } from "@tauri-apps/api/core";

export type ErrorEnvelope = {
	code: string;
	message: string;
};

export type AppInfo = {
	productName: string;
	version: string;
	developmentPhase: string;
	adbReadOperationsEnabled: boolean;
	adbWriteOperationsEnabled: boolean;
};

export type OnboardingStatus = "completed" | "skipped";
export type ThemePreference = "system" | "light" | "dark";

export type ValidatedAdb = {
	path: string;
	resolvedPath: string;
	version: string;
};

export type StartupState = {
	schemaVersion: number;
	onboardingVersion: number;
	onboardingStatus: OnboardingStatus | null;
	themePreference: ThemePreference;
	selectedAdb: ValidatedAdb | null;
	preferenceWarning: ErrorEnvelope | null;
};

export type AdbCandidate = {
	candidateId: string;
	source:
		| "explicit"
		| "saved"
		| "path"
		| "androidHome"
		| "androidSdkRoot"
		| "commonLocation";
	adb: ValidatedAdb;
};

export type AdbDiscovery = {
	schemaVersion: number;
	candidates: AdbCandidate[];
	failures: Array<ErrorEnvelope & { path: string; source: string }>;
};

export type DeviceState =
	| "device"
	| "unauthorized"
	| "offline"
	| "noPermissions"
	| "unknown";

export type DeviceChoice = {
	deviceId: string;
	serial: string;
	state: DeviceState;
	connectionType: "usb" | "wireless" | "unknown";
	product: string | null;
	model: string | null;
	device: string | null;
	transportId: string | null;
	details: string | null;
};

export type DeviceList = {
	schemaVersion: number;
	observedAtUnixMs: number;
	devices: DeviceChoice[];
};

export type ComponentName = {
	flattened: string;
	packageName: string;
	serviceClass: string;
};

export type SettingValue =
	| { kind: "missing" }
	| { kind: "empty" }
	| { kind: "value"; raw: string; components: ComponentName[] | null }
	| { kind: "unavailable"; code: string; message: string };

export type SettingObservation = {
	key: string;
	value: SettingValue;
};

export type DiagnosisReport = {
	schemaVersion: number;
	mode: "real" | "demo";
	status: "complete" | "incomplete" | "unsupported";
	observedAtUnixMs: number;
	adb: ValidatedAdb;
	device: {
		serial: string;
		connectionType: "usb" | "wireless" | "unknown";
		manufacturer: string;
		model: string;
		codename: string;
		androidVersion: string;
		apiLevel: number;
	};
	androidUser: { id: number; isForeground: boolean } | null;
	providers: Array<{
		component: ComponentName;
		enabled: boolean;
		primary: boolean;
		samePackageAsAutofill: boolean;
	}>;
	credentialState: {
		enabled: SettingObservation;
		primary: SettingObservation;
		autofill: SettingObservation;
	};
	findings: Array<{
		code: string;
		severity: "info" | "warning";
		relatedValue: string | null;
	}>;
};

export type ProviderChoice = DiagnosisReport["providers"][number] & {
	providerId: string;
};

export type InspectionView = {
	schemaVersion: number;
	report: DiagnosisReport;
	providers: ProviderChoice[];
};

export type ManagedSettingValue =
	| { kind: "missing" }
	| { kind: "empty" }
	| { kind: "value"; raw: string; parseable: boolean };

export type ManagedCredentialState = {
	enabled: ManagedSettingValue;
	primary: ManagedSettingValue;
};

export type ChangeKind = "pin" | "restore";
export type ChangeBlocker =
	| "ANDROID_VERSION_UNSUPPORTED"
	| "DIAGNOSIS_UNAVAILABLE"
	| "TARGET_NOT_REGISTERED"
	| "UNPARSED_CONFIRMATION_REQUIRED"
	| "STATE_CHANGED"
	| "SNAPSHOT_NOT_RESTORABLE"
	| "NO_CHANGE_REQUIRED";
export type ChangePreview = {
	schemaVersion: number;
	previewId: string;
	sourceSnapshotId: string | null;
	kind: ChangeKind;
	createdAtUnixMs: number;
	adb: ValidatedAdb;
	device: DiagnosisReport["device"];
	androidUser: NonNullable<DiagnosisReport["androidUser"]>;
	target: ComponentName;
	registeredProviders: string[];
	before: ManagedCredentialState;
	after: ManagedCredentialState;
	requiresUnparsedConfirmation: boolean;
	allowUnparsed: boolean;
	blockers: ChangeBlocker[];
};

export type ChangePlan = {
	schemaVersion: number;
	planId: string;
	snapshotId: string;
	sourceSnapshotId: string | null;
	createdAtUnixMs: number;
	expiresAtUnixMs: number;
	kind: ChangeKind;
	device: DiagnosisReport["device"];
	androidUser: NonNullable<DiagnosisReport["androidUser"]>;
	target: ComponentName;
	before: ManagedCredentialState;
	after: ManagedCredentialState;
};

export type ChangeOutcome = {
	schemaVersion: number;
	planId: string;
	snapshotId: string;
	status: "applied" | "restored" | "recovered" | "recoveryFailed";
	completedAtUnixMs: number;
	steps: Array<{ key: string; success: boolean; error: string | null }>;
	recoverySteps: Array<{ key: string; success: boolean; error: string | null }>;
	observed: ManagedCredentialState;
};

export type SnapshotRecord = {
	schemaVersion: number;
	revision: number;
	snapshotId: string;
	planId: string;
	sourceSnapshotId: string | null;
	createdAtUnixMs: number;
	updatedAtUnixMs: number;
	status:
		| "planned"
		| "expired"
		| "applied"
		| "recovered"
		| "recoveryFailed"
		| "restored";
	kind: ChangeKind;
	adb: ValidatedAdb;
	device: DiagnosisReport["device"];
	androidUser: NonNullable<DiagnosisReport["androidUser"]>;
	target: ComponentName;
	before: ManagedCredentialState;
	intendedAfter: ManagedCredentialState;
	lastObserved: ManagedCredentialState | null;
	message: string | null;
};

export type SnapshotInventory = {
	schemaVersion: number;
	snapshots: SnapshotRecord[];
	warnings: Array<{ file: string; code: string; message: string }>;
};

export type DemoFixture = {
	schemaVersion: number;
	simulated: true;
	adb: ValidatedAdb;
	devices: {
		observedAtUnixMs: number;
		devices: Array<Omit<DeviceChoice, "deviceId">>;
	};
	report: DiagnosisReport;
	pinPreview: ChangePreview;
	pinOutcome: ChangeOutcome;
	snapshots: SnapshotInventory;
};

export function getAppInfo(): Promise<AppInfo> {
	return invoke<AppInfo>("get_app_info");
}

export function getStartupState(): Promise<StartupState> {
	return invoke<StartupState>("get_startup_state");
}

export function discoverAdb(): Promise<AdbDiscovery> {
	return invoke<AdbDiscovery>("discover_adb");
}

export function selectAdbCandidate(candidateId: string): Promise<ValidatedAdb> {
	return invoke<ValidatedAdb>("select_adb_candidate", { candidateId });
}

export function chooseAdbExecutable(): Promise<ValidatedAdb | null> {
	return invoke<ValidatedAdb | null>("choose_adb_executable");
}

export function listDevices(): Promise<DeviceList> {
	return invoke<DeviceList>("list_devices");
}

export function inspectDevice(deviceId: string): Promise<InspectionView> {
	return invoke<InspectionView>("inspect_device", { deviceId });
}

export function preparePin(
	deviceId: string,
	providerId: string,
	allowUnparsed: boolean,
): Promise<ChangePreview> {
	return invoke<ChangePreview>("prepare_pin", {
		deviceId,
		providerId,
		allowUnparsed,
	});
}

export function createPinPlan(previewId: string): Promise<ChangePlan> {
	return invoke<ChangePlan>("create_pin_plan", { previewId });
}

export function executePinPlan(planId: string): Promise<ChangeOutcome> {
	return invoke<ChangeOutcome>("execute_pin_plan", { planId });
}

export function listSnapshots(): Promise<SnapshotInventory> {
	return invoke<SnapshotInventory>("list_snapshots");
}

export function prepareRestore(
	deviceId: string,
	snapshotId: string,
): Promise<ChangePreview> {
	return invoke<ChangePreview>("prepare_restore", { deviceId, snapshotId });
}

export function createRestorePlan(previewId: string): Promise<ChangePlan> {
	return invoke<ChangePlan>("create_restore_plan", { previewId });
}

export function executeRestorePlan(planId: string): Promise<ChangeOutcome> {
	return invoke<ChangeOutcome>("execute_restore_plan", { planId });
}

export function discardChangePlan(planId: string): Promise<void> {
	return invoke<void>("discard_change_plan", { planId });
}

export function setOnboardingStatus(
	status: OnboardingStatus,
): Promise<StartupState> {
	return invoke<StartupState>("set_onboarding_status", { status });
}

export function setThemePreference(
	preference: ThemePreference,
): Promise<StartupState> {
	return invoke<StartupState>("set_theme_preference", { preference });
}

export function getDemoFixture(): Promise<DemoFixture> {
	return invoke<DemoFixture>("get_demo_fixture");
}
