import {
	type AdbCandidate,
	type AdbDiscovery,
	type AdbSelection,
	type AdbSelectionId,
	type AppInfo,
	type ChangeExecution,
	type ChangePlan,
	type ChangePreview,
	type DemoFixture,
	type DeviceEnumerationId,
	type DeviceId,
	type DeviceList,
	type DiagnosisEntity,
	type DiagnosisId,
	type DiscoveryId,
	type OnboardingStatus,
	type PlanId,
	type PreviewId,
	type ProviderId,
	type SessionContext,
	type SnapshotId,
	type SnapshotInventory,
	type StartupState,
	type ThemePreference,
} from "../lib/tauri";

export interface AppGateway {
	getAppInfo(): Promise<AppInfo>;
	getStartupState(): Promise<StartupState>;
	setOnboardingStatus(status: OnboardingStatus): Promise<StartupState>;
	setThemePreference(preference: ThemePreference): Promise<StartupState>;
	getDemoFixture(): Promise<DemoFixture>;
}

export interface DeviceGateway {
	getSessionContext(): Promise<SessionContext>;
	discoverAdb(): Promise<AdbDiscovery>;
	selectAdbCandidate(
		discoveryId: DiscoveryId,
		candidateId: AdbCandidate["candidateId"],
	): Promise<AdbSelection>;
	chooseAdbExecutable(): Promise<AdbSelection | null>;
	listDevices(selectionId: AdbSelectionId): Promise<DeviceList>;
	resolveDiagnosis(
		enumerationId: DeviceEnumerationId,
		deviceId: DeviceId,
	): Promise<DiagnosisEntity>;
	preparePin(
		diagnosisId: DiagnosisId,
		providerId: ProviderId,
		allowUnparsed: boolean,
	): Promise<ChangePreview>;
	authorizePinPreview(previewId: PreviewId): Promise<ChangePreview>;
	createPinPlan(previewId: PreviewId): Promise<ChangePlan>;
	executePinPlan(planId: PlanId): Promise<ChangeExecution>;
	listSnapshots(): Promise<SnapshotInventory>;
	prepareRestore(
		diagnosisId: DiagnosisId,
		snapshotId: SnapshotId,
	): Promise<ChangePreview>;
	createRestorePlan(previewId: PreviewId): Promise<ChangePlan>;
	executeRestorePlan(planId: PlanId): Promise<ChangeExecution>;
	cancelChangePlan(planId: PlanId): Promise<ChangeExecution>;
}
