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

export type ValidatedAdb = {
	path: string;
	resolvedPath: string;
	version: string;
};

export type StartupState = {
	schemaVersion: number;
	onboardingVersion: number;
	onboardingStatus: OnboardingStatus | null;
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

export type DemoFixture = {
	schemaVersion: number;
	simulated: true;
	adb: ValidatedAdb;
	devices: {
		observedAtUnixMs: number;
		devices: Array<Omit<DeviceChoice, "deviceId">>;
	};
	report: DiagnosisReport;
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

export function inspectDevice(deviceId: string): Promise<DiagnosisReport> {
	return invoke<DiagnosisReport>("inspect_device", { deviceId });
}

export function setOnboardingStatus(
	status: OnboardingStatus,
): Promise<StartupState> {
	return invoke<StartupState>("set_onboarding_status", { status });
}

export function getDemoFixture(): Promise<DemoFixture> {
	return invoke<DemoFixture>("get_demo_fixture");
}
