import { type DeviceGateway } from "../domain/gateways";
import {
	type AdbDiscovery,
	type AdbSelection,
	type ChangeExecution,
	type ChangeOutcome,
	type ChangePlan,
	type ChangePreview,
	type DemoFixture,
	type DeviceList,
	type DiagnosisEntity,
	type ProviderChoice,
	type SessionContext,
	type SnapshotInventory,
	type SnapshotRecord,
} from "../lib/tauri";

function fail(code: string, message: string): never {
	throw { code, message };
}

export function createDemoDeviceGateway(fixture: DemoFixture): DeviceGateway {
	let revision = 0;
	let latestDiagnosisId: string | null = null;
	let discovery: AdbDiscovery | undefined;
	let selection: AdbSelection | undefined;
	let enumeration: DeviceList | undefined;
	let diagnosis: DiagnosisEntity | undefined;
	let preview: ChangePreview | undefined;
	let plan: ChangePlan | undefined;
	let counter = 0;
	let inventory: SnapshotInventory = structuredClone(fixture.snapshots);
	const next = (kind: string) => `demo-${kind}-${++counter}`;
	const now = () => fixture.report.observedAtUnixMs + counter * 1_000;

	const makeExecution = (
		current: ChangePlan,
		status: ChangeExecution["status"],
		outcome: ChangeOutcome | null,
	): ChangeExecution => ({
		schemaVersion: 2,
		executionId: next("execution"),
		planId: current.planId,
		sourceDiagnosisId: current.sourceDiagnosisId,
		status,
		writeAttempted: status !== "cancelled",
		completedAtUnixMs: now(),
		outcome,
		error: null,
		persistenceWarning: null,
	});

	const gateway: DeviceGateway = {
		async getSessionContext(): Promise<SessionContext> {
			return {
				schemaVersion: 2,
				sessionRevision: revision,
				selectionId: selection?.selectionId ?? null,
				enumerationId: enumeration?.enumerationId ?? null,
				latestDiagnosisId,
			};
		},
		async discoverAdb() {
			revision += 1;
			discovery = {
				schemaVersion: 2,
				discoveryId: next("discovery"),
				sessionRevision: revision,
				completedAtUnixMs: now(),
				candidates: [
					{ candidateId: next("adb"), source: "explicit", adb: fixture.adb },
				],
				failures: [],
			};
			selection = undefined;
			enumeration = undefined;
			diagnosis = undefined;
			latestDiagnosisId = null;
			return discovery;
		},
		async selectAdbCandidate(discoveryId, candidateId) {
			const candidate = discovery?.candidates.find(
				(item) => item.candidateId === candidateId,
			);
			if (!candidate || discovery?.discoveryId !== discoveryId) {
				return fail(
					"ADB_SELECTION_STALE",
					"demo discovery is no longer current",
				);
			}
			revision += 1;
			selection = {
				schemaVersion: 2,
				selectionId: next("selection"),
				discoveryId,
				sessionRevision: revision,
				selectedAtUnixMs: now(),
				adb: candidate.adb,
			};
			return selection;
		},
		async chooseAdbExecutable() {
			if (!discovery) {
				await gateway.discoverAdb();
			}
			const currentDiscovery = discovery;
			const candidate = currentDiscovery?.candidates[0];
			return candidate
				? gateway.selectAdbCandidate(
						currentDiscovery.discoveryId,
						candidate.candidateId,
					)
				: null;
		},
		async listDevices(selectionId) {
			if (selection?.selectionId !== selectionId) {
				return fail("ADB_SELECTION_STALE", "demo ADB selection is stale");
			}
			revision += 1;
			enumeration = {
				schemaVersion: 2,
				enumerationId: next("enumeration"),
				selectionId,
				sessionRevision: revision,
				observedAtUnixMs: fixture.devices.observedAtUnixMs,
				devices: fixture.devices.devices.map((device, index) => ({
					...device,
					deviceId: `demo-device-${index}`,
				})),
			};
			return enumeration;
		},
		async resolveDiagnosis(enumerationId, deviceId) {
			if (
				enumeration?.enumerationId !== enumerationId ||
				!enumeration.devices.some((device) => device.deviceId === deviceId)
			) {
				return fail("DEVICE_CHANGED", "demo device selection is stale");
			}
			revision += 1;
			const diagnosisId = next("diagnosis");
			const providers: ProviderChoice[] = fixture.report.providers.map(
				(provider, index) => ({
					...provider,
					providerId: `demo-provider-${counter}-${index}`,
					diagnosisId,
				}),
			);
			diagnosis = {
				schemaVersion: 2,
				diagnosisId,
				sessionRevision: revision,
				enumerationId,
				deviceId,
				startedAtUnixMs: now(),
				resolvedAtUnixMs: now() + 1,
				report: fixture.report,
				providers,
			};
			latestDiagnosisId = diagnosisId;
			return diagnosis;
		},
		async preparePin(diagnosisId, providerId, allowUnparsed) {
			const provider = diagnosis?.providers.find(
				(item) => item.providerId === providerId,
			);
			if (!provider || diagnosis?.diagnosisId !== diagnosisId) {
				return fail("CHANGE_DIAGNOSIS_UNAVAILABLE", "demo diagnosis is stale");
			}
			const targetRaw = provider.component.flattened;
			preview = {
				...structuredClone(fixture.pinPreview),
				previewId: next("preview"),
				revision: 1,
				status: "ready",
				sourceDiagnosisId: diagnosisId,
				target: provider.component,
				after: {
					enabled: { kind: "value", raw: targetRaw, parseable: true },
					primary: { kind: "value", raw: targetRaw, parseable: true },
				},
				allowUnparsed,
			};
			return preview;
		},
		async authorizePinPreview(previewId) {
			if (preview?.previewId !== previewId || preview.kind !== "pin") {
				return fail("CHANGE_PREVIEW_STALE", "demo preview is stale");
			}
			preview = {
				...preview,
				revision: preview.revision + 1,
				allowUnparsed: true,
				blockers: preview.blockers.filter(
					(blocker) => blocker !== "UNPARSED_CONFIRMATION_REQUIRED",
				),
			};
			return preview;
		},
		async createPinPlan(previewId) {
			return createPlan(previewId);
		},
		async executePinPlan(planId) {
			return executePlan(planId, "applied");
		},
		async listSnapshots() {
			return structuredClone(inventory);
		},
		async prepareRestore(diagnosisId, snapshotId) {
			const snapshot = inventory.snapshots.find(
				(item) => item.snapshotId === snapshotId,
			);
			if (!snapshot || diagnosis?.diagnosisId !== diagnosisId) {
				return fail("SNAPSHOT_NOT_RESTORABLE", "demo snapshot is unavailable");
			}
			preview = {
				schemaVersion: 2,
				previewId: next("restore-preview"),
				revision: 1,
				status: "ready",
				sourceDiagnosisId: diagnosisId,
				sourceSnapshotId: snapshotId,
				kind: "restore",
				createdAtUnixMs: now(),
				adb: snapshot.adb,
				device: snapshot.device,
				androidUser: snapshot.androidUser,
				target: snapshot.target,
				registeredProviders: diagnosis.providers.map(
					(item) => item.component.flattened,
				),
				before: snapshot.intendedAfter,
				after: snapshot.before,
				requiresUnparsedConfirmation: false,
				allowUnparsed: false,
				blockers: [],
			};
			return preview;
		},
		async createRestorePlan(previewId) {
			return createPlan(previewId);
		},
		async executeRestorePlan(planId) {
			return executePlan(planId, "restored");
		},
		async cancelChangePlan(planId) {
			if (plan?.planId !== planId) {
				return fail("CHANGE_PLAN_UNAVAILABLE", "demo plan is unavailable");
			}
			return makeExecution(plan, "cancelled", null);
		},
	};

	function createPlan(previewId: string): ChangePlan {
		if (
			!preview ||
			preview.previewId !== previewId ||
			preview.blockers.length
		) {
			return fail("CHANGE_PREVIEW_BLOCKED", "demo preview is unavailable");
		}
		plan = {
			schemaVersion: 2,
			planId: next("plan"),
			snapshotId: next("snapshot"),
			sourcePreviewId: preview.previewId,
			sourceDiagnosisId: preview.sourceDiagnosisId,
			sourceSnapshotId: preview.sourceSnapshotId,
			status: "ready",
			createdAtUnixMs: now(),
			expiresAtUnixMs: now() + 300_000,
			kind: preview.kind,
			device: preview.device,
			androidUser: preview.androidUser,
			target: preview.target,
			before: preview.before,
			after: preview.after,
		};
		const snapshot: SnapshotRecord = {
			schemaVersion: 2,
			revision: 1,
			snapshotId: plan.snapshotId,
			planId: plan.planId,
			sourceDiagnosisId: plan.sourceDiagnosisId,
			sourceSnapshotId: plan.sourceSnapshotId,
			createdAtUnixMs: plan.createdAtUnixMs,
			updatedAtUnixMs: plan.createdAtUnixMs,
			status: "planned",
			kind: plan.kind,
			adb: preview.adb,
			device: plan.device,
			androidUser: plan.androidUser,
			target: plan.target,
			before: plan.before,
			intendedAfter: plan.after,
			lastObserved: null,
			message: null,
		};
		inventory = {
			...inventory,
			snapshots: [snapshot, ...inventory.snapshots],
		};
		return plan;
	}

	function executePlan(
		planId: string,
		status: "applied" | "restored",
	): ChangeExecution {
		if (!plan || plan.planId !== planId) {
			return fail("CHANGE_PLAN_UNAVAILABLE", "demo plan is unavailable");
		}
		const outcome: ChangeOutcome = {
			...structuredClone(fixture.pinOutcome),
			planId: plan.planId,
			snapshotId: plan.snapshotId,
			status,
			completedAtUnixMs: now(),
			observed: plan.after,
		};
		inventory = {
			...inventory,
			snapshots: inventory.snapshots.map((snapshot) =>
				snapshot.snapshotId === plan?.snapshotId
					? {
							...snapshot,
							revision: snapshot.revision + 1,
							status,
							lastObserved: plan.after,
						}
					: snapshot,
			),
		};
		return makeExecution(plan, status, outcome);
	}

	return gateway;
}
