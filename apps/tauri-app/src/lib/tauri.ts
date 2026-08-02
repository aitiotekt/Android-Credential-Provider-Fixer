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

export const OnboardingStatus = {
	Completed: "completed",
	Skipped: "skipped",
} as const;
export type OnboardingStatus =
	(typeof OnboardingStatus)[keyof typeof OnboardingStatus];

export const ThemePreference = {
	System: "system",
	Light: "light",
	Dark: "dark",
} as const;
export type ThemePreference =
	(typeof ThemePreference)[keyof typeof ThemePreference];
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

export const AdbCandidateSource = {
	Explicit: "explicit",
	Saved: "saved",
	Path: "path",
	AndroidHome: "androidHome",
	AndroidSdkRoot: "androidSdkRoot",
	CommonLocation: "commonLocation",
} as const;
export type AdbCandidateSource =
	(typeof AdbCandidateSource)[keyof typeof AdbCandidateSource];

export type AdbCandidate = {
	candidateId: string;
	source: AdbCandidateSource;
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

export const DeviceState = {
	Device: "device",
	Unauthorized: "unauthorized",
	Offline: "offline",
	NoPermissions: "noPermissions",
	Unknown: "unknown",
} as const;
export type DeviceState = (typeof DeviceState)[keyof typeof DeviceState];

export const ConnectionType = {
	Usb: "usb",
	Wireless: "wireless",
	Unknown: "unknown",
} as const;
export type ConnectionType =
	(typeof ConnectionType)[keyof typeof ConnectionType];

export type DeviceChoice = {
	deviceId: DeviceId;
	serial: string;
	state: DeviceState;
	connectionType: ConnectionType;
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

export const SettingValueKind = {
	Missing: "missing",
	Empty: "empty",
	Value: "value",
	Unavailable: "unavailable",
} as const;
export type SettingValueKind =
	(typeof SettingValueKind)[keyof typeof SettingValueKind];

export type SettingValue =
	| { kind: typeof SettingValueKind.Missing }
	| { kind: typeof SettingValueKind.Empty }
	| {
			kind: typeof SettingValueKind.Value;
			raw: string;
			components: ComponentName[] | null;
	  }
	| {
			kind: typeof SettingValueKind.Unavailable;
			code: string;
			message: string;
	  };

export type SettingObservation = {
	key: string;
	value: SettingValue;
};

export type DiagnosisReport = {
	schemaVersion: number;
	mode: SessionMode;
	completeness: DiagnosisCompleteness;
	observedAtUnixMs: number;
	adb: ValidatedAdb;
	device: {
		serial: string;
		connectionType: ConnectionType;
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
		severity: FindingSeverity;
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

export const SessionMode = {
	Real: "real",
	Demo: "demo",
} as const;
export type SessionMode = (typeof SessionMode)[keyof typeof SessionMode];

export const DiagnosisCompleteness = {
	Complete: "complete",
	Incomplete: "incomplete",
	Unsupported: "unsupported",
} as const;
export type DiagnosisCompleteness =
	(typeof DiagnosisCompleteness)[keyof typeof DiagnosisCompleteness];

export const FindingSeverity = {
	Info: "info",
	Warning: "warning",
} as const;
export type FindingSeverity =
	(typeof FindingSeverity)[keyof typeof FindingSeverity];

export type ManagedSettingValue =
	| { kind: typeof SettingValueKind.Missing }
	| { kind: typeof SettingValueKind.Empty }
	| { kind: typeof SettingValueKind.Value; raw: string; parseable: boolean };

export type ManagedCredentialState = {
	enabled: ManagedSettingValue;
	primary: ManagedSettingValue;
};

export const ChangeKind = {
	Pin: "pin",
	Restore: "restore",
} as const;
export type ChangeKind = (typeof ChangeKind)[keyof typeof ChangeKind];

export const ChangeBlocker = {
	AndroidVersionUnsupported: "ANDROID_VERSION_UNSUPPORTED",
	DiagnosisUnavailable: "DIAGNOSIS_UNAVAILABLE",
	TargetNotRegistered: "TARGET_NOT_REGISTERED",
	UnparsedConfirmationRequired: "UNPARSED_CONFIRMATION_REQUIRED",
	StateChanged: "STATE_CHANGED",
	SnapshotNotRestorable: "SNAPSHOT_NOT_RESTORABLE",
	NoChangeRequired: "NO_CHANGE_REQUIRED",
} as const;
export type ChangeBlocker = (typeof ChangeBlocker)[keyof typeof ChangeBlocker];

export const ChangePreviewStatus = {
	Ready: "ready",
	Consumed: "consumed",
	Invalidated: "invalidated",
} as const;
export type ChangePreviewStatus =
	(typeof ChangePreviewStatus)[keyof typeof ChangePreviewStatus];
export type ChangePreview = {
	schemaVersion: number;
	previewId: PreviewId;
	revision: number;
	status: ChangePreviewStatus;
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
	status: ChangePlanStatus;
	createdAtUnixMs: number;
	expiresAtUnixMs: number;
	kind: ChangeKind;
	device: DiagnosisReport["device"];
	androidUser: NonNullable<DiagnosisReport["androidUser"]>;
	target: ComponentName;
	before: ManagedCredentialState;
	after: ManagedCredentialState;
};

export const ChangePlanStatus = {
	Ready: "ready",
	Executing: "executing",
	Cancelled: "cancelled",
	Expired: "expired",
	Invalidated: "invalidated",
	Completed: "completed",
} as const;
export type ChangePlanStatus =
	(typeof ChangePlanStatus)[keyof typeof ChangePlanStatus];

export const ChangeOutcomeStatus = {
	Applied: "applied",
	Restored: "restored",
	Recovered: "recovered",
	RecoveryFailed: "recoveryFailed",
} as const;
export type ChangeOutcomeStatus =
	(typeof ChangeOutcomeStatus)[keyof typeof ChangeOutcomeStatus];

export type ChangeOutcome = {
	schemaVersion: number;
	planId: PlanId;
	snapshotId: SnapshotId;
	status: ChangeOutcomeStatus;
	completedAtUnixMs: number;
	steps: Array<{ key: string; success: boolean; error: string | null }>;
	recoverySteps: Array<{ key: string; success: boolean; error: string | null }>;
	observed: ManagedCredentialState;
};

export const ChangeExecutionStatus = {
	Applied: "applied",
	Restored: "restored",
	Recovered: "recovered",
	RecoveryFailed: "recoveryFailed",
	Cancelled: "cancelled",
	Expired: "expired",
	Invalidated: "invalidated",
} as const;
export type ChangeExecutionStatus =
	(typeof ChangeExecutionStatus)[keyof typeof ChangeExecutionStatus];

export type ChangeExecution = {
	schemaVersion: number;
	executionId: ExecutionId;
	planId: PlanId;
	sourceDiagnosisId: DiagnosisId;
	status: ChangeExecutionStatus;
	writeAttempted: boolean;
	completedAtUnixMs: number;
	outcome: ChangeOutcome | null;
	error: ErrorEnvelope | null;
	persistenceWarning: ErrorEnvelope | null;
};

export const SnapshotStatus = {
	Planned: "planned",
	Executing: "executing",
	Cancelled: "cancelled",
	Expired: "expired",
	Invalidated: "invalidated",
	Applied: "applied",
	Recovered: "recovered",
	RecoveryFailed: "recoveryFailed",
	Restored: "restored",
} as const;
export type SnapshotStatus =
	(typeof SnapshotStatus)[keyof typeof SnapshotStatus];

export type SnapshotRecord = {
	schemaVersion: number;
	revision: number;
	snapshotId: SnapshotId;
	planId: PlanId;
	sourceDiagnosisId: DiagnosisId;
	sourceSnapshotId: SnapshotId | null;
	createdAtUnixMs: number;
	updatedAtUnixMs: number;
	status: SnapshotStatus;
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
