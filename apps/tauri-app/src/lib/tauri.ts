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
export type EntityId<_Name extends string> = string;
export type DiscoveryId = EntityId<"Discovery">;
export type AdbSelectionId = EntityId<"AdbSelection">;
export type DeviceEnumerationId = EntityId<"DeviceEnumeration">;
export type DeviceId = EntityId<"Device">;
export type DiagnosisId = EntityId<"Diagnosis">;
export type ProviderId = EntityId<"Provider">;
export type PreviewId = EntityId<"Preview">;
export type PlanId = EntityId<"Plan">;
export type ExecutionId = EntityId<"Execution">;
export type SnapshotId = EntityId<"Snapshot">;

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
	adbSelection: AdbSelection | null;
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
	discoveryId: DiscoveryId;
	sessionRevision: number;
	completedAtUnixMs: number;
	candidates: AdbCandidate[];
	failures: Array<ErrorEnvelope & { path: string; source: string }>;
};

export type AdbSelection = {
	schemaVersion: number;
	selectionId: AdbSelectionId;
	discoveryId: DiscoveryId | null;
	sessionRevision: number;
	selectedAtUnixMs: number;
	adb: ValidatedAdb;
};

export type DeviceState =
	| "device"
	| "unauthorized"
	| "offline"
	| "noPermissions"
	| "unknown";

export type DeviceChoice = {
	deviceId: DeviceId;
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
	enumerationId: DeviceEnumerationId;
	selectionId: AdbSelectionId;
	sessionRevision: number;
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
	completeness: "complete" | "incomplete" | "unsupported";
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
	providerId: ProviderId;
	diagnosisId: DiagnosisId;
};

export type DiagnosisEntity = {
	schemaVersion: number;
	diagnosisId: DiagnosisId;
	sessionRevision: number;
	enumerationId: DeviceEnumerationId;
	deviceId: DeviceId;
	startedAtUnixMs: number;
	resolvedAtUnixMs: number;
	report: DiagnosisReport;
	providers: ProviderChoice[];
};

export type SessionContext = {
	schemaVersion: number;
	sessionRevision: number;
	selectionId: AdbSelectionId | null;
	enumerationId: DeviceEnumerationId | null;
	latestDiagnosisId: DiagnosisId | null;
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
	previewId: PreviewId;
	revision: number;
	status: "ready" | "consumed" | "invalidated";
	sourceDiagnosisId: DiagnosisId;
	sourceSnapshotId: SnapshotId | null;
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
	planId: PlanId;
	snapshotId: SnapshotId;
	sourcePreviewId: PreviewId;
	sourceDiagnosisId: DiagnosisId;
	sourceSnapshotId: SnapshotId | null;
	status:
		| "ready"
		| "executing"
		| "cancelled"
		| "expired"
		| "invalidated"
		| "completed";
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
	planId: PlanId;
	snapshotId: SnapshotId;
	status: "applied" | "restored" | "recovered" | "recoveryFailed";
	completedAtUnixMs: number;
	steps: Array<{ key: string; success: boolean; error: string | null }>;
	recoverySteps: Array<{ key: string; success: boolean; error: string | null }>;
	observed: ManagedCredentialState;
};

export type ChangeExecution = {
	schemaVersion: number;
	executionId: ExecutionId;
	planId: PlanId;
	sourceDiagnosisId: DiagnosisId;
	status:
		| "applied"
		| "restored"
		| "recovered"
		| "recoveryFailed"
		| "cancelled"
		| "expired"
		| "invalidated";
	writeAttempted: boolean;
	completedAtUnixMs: number;
	outcome: ChangeOutcome | null;
	error: ErrorEnvelope | null;
	persistenceWarning: ErrorEnvelope | null;
};

export type SnapshotRecord = {
	schemaVersion: number;
	revision: number;
	snapshotId: SnapshotId;
	planId: PlanId;
	sourceDiagnosisId: DiagnosisId;
	sourceSnapshotId: SnapshotId | null;
	createdAtUnixMs: number;
	updatedAtUnixMs: number;
	status:
		| "planned"
		| "executing"
		| "cancelled"
		| "expired"
		| "invalidated"
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
