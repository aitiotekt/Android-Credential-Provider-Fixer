import { type Accessor, createSignal, type Setter } from "solid-js";
import {
	advanceTutorialFromInteraction,
	startTutorial,
	stopTutorial,
	type TutorialScene,
} from "../app/tutorial";
import { type Messages } from "../i18n/translations";
import { type ErrorEnvelope } from "../lib/tauri";
import { type DeviceService } from "./devices";
import { type DiagnosisService } from "./diagnosis";
import { entityOf, errorFrom } from "./resource";
import { type SnapshotService } from "./snapshots";
import { type WorkflowService } from "./workflow";

export class TutorialService implements Disposable {
	readonly active: Accessor<boolean>;
	readonly error: Accessor<ErrorEnvelope | undefined>;
	private readonly setActive: Setter<boolean>;
	private readonly setError: Setter<ErrorEnvelope | undefined>;
	private generation = 0;
	private lifecycleGeneration = 0;
	private cancelTargetWait: (() => void) | undefined;
	private interactionRoot: Element | undefined;
	private readonly interactionListener = (event: Event) =>
		this.handleInteraction(event.target);
	private disposed = false;

	constructor(
		private readonly workflow: WorkflowService,
		private readonly devices: DeviceService,
		private readonly diagnoses: DiagnosisService,
		private readonly snapshots: SnapshotService,
	) {
		[this.active, this.setActive] = createSignal(false);
		[this.error, this.setError] = createSignal<ErrorEnvelope>();
	}

	async start(
		messages: Messages,
		settled: (completed: boolean) => void,
		sessionScopeId: string,
	): Promise<boolean> {
		this.cancelTargetWait?.();
		this.cancelTargetWait = undefined;
		const lifecycleGeneration = ++this.lifecycleGeneration;
		this.setActive(true);
		this.setError(undefined);
		const targetReady = await this.waitForTargets(
			[
				`[data-session-scope='${sessionScopeId}'] [data-tour='demo-banner']`,
				`[data-session-scope='${sessionScopeId}'] [data-tour='adb-card']`,
			],
			lifecycleGeneration,
		);
		if (!targetReady || lifecycleGeneration !== this.lifecycleGeneration) {
			if (lifecycleGeneration === this.lifecycleGeneration) {
				this.setActive(false);
				this.setError({
					code: "TUTORIAL_TARGET_UNAVAILABLE",
					message: "the tutorial start view did not become ready",
				});
			}
			return false;
		}
		const interactionRoot = document.querySelector(
			`[data-session-scope='${sessionScopeId}']`,
		);
		if (!interactionRoot) {
			this.setActive(false);
			this.setError({
				code: "TUTORIAL_TARGET_UNAVAILABLE",
				message: "the tutorial session view did not become ready",
			});
			return false;
		}
		this.attachInteractionRoot(interactionRoot);
		startTutorial(messages, {
			completed: () => {
				if (lifecycleGeneration !== this.lifecycleGeneration) {
					return;
				}
				this.detachInteractionRoot();
				this.setActive(false);
				settled(true);
			},
			dismissed: () => {
				if (lifecycleGeneration !== this.lifecycleGeneration) {
					return;
				}
				this.detachInteractionRoot();
				this.setActive(false);
				settled(false);
			},
			targetMissing: () =>
				this.setError({
					code: "TUTORIAL_TARGET_UNAVAILABLE",
					message: "tutorial target is unavailable",
				}),
			sceneChanged: (scene) => void this.showScene(scene),
		});
		return true;
	}

	async showScene(scene: TutorialScene): Promise<void> {
		try {
			this.setError(undefined);
			await this.replay(scene);
		} catch (reason) {
			this.setError(errorFrom(reason));
		}
	}

	private handleInteraction(target: EventTarget | null): void {
		if (target instanceof Element && target.closest("[data-tour-dismiss]")) {
			this.dismiss();
			return;
		}
		if (advanceTutorialFromInteraction(target)) {
			this.setError(undefined);
		}
	}

	dismiss(): void {
		if (!this.active()) {
			return;
		}
		this.generation += 1;
		this.cancelTargetWait?.();
		this.cancelTargetWait = undefined;
		stopTutorial();
		this.detachInteractionRoot();
		this.lifecycleGeneration += 1;
		this.setActive(false);
	}

	stop(): void {
		this.lifecycleGeneration += 1;
		this.generation += 1;
		this.cancelTargetWait?.();
		this.cancelTargetWait = undefined;
		stopTutorial();
		this.detachInteractionRoot();
		this.setActive(false);
	}

	[Symbol.dispose](): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.stop();
	}

	private async replay(scene: TutorialScene): Promise<void> {
		const currentGeneration = ++this.generation;
		this.workflow.resetToAdb();
		const isCurrent = () => currentGeneration === this.generation;
		if (scene === "adb") {
			return;
		}
		await this.workflow.continueToDevices();
		if (!isCurrent() || scene === "devices") {
			return;
		}
		const enumeration = entityOf(this.devices.enumeration());
		const device = enumeration?.devices.find((item) => item.state === "device");
		if (!device) {
			throw new Error("demo device is unavailable");
		}
		this.workflow.selectDevice(device);
		if (scene === "confirmation") {
			return;
		}
		if (!entityOf(this.devices.selection())) {
			const result = this.devices.select(device);
			if (!result.ok) {
				throw result.error;
			}
		}
		this.workflow.setConfirmed(true);
		const diagnosisResult = await this.diagnoses.resolve();
		if (!diagnosisResult.ok) {
			throw diagnosisResult.error;
		}
		if (!entityOf(this.diagnoses.resource())) {
			throw new Error("demo diagnosis response was discarded");
		}
		if (!isCurrent() || scene === "diagnosis") {
			return;
		}
		const diagnosis = entityOf(this.diagnoses.resource());
		const provider =
			diagnosis?.providers.find(
				(item) => item.samePackageAsAutofill && !item.enabled,
			) ?? diagnosis?.providers[0];
		if (!provider) {
			throw new Error("demo provider is unavailable");
		}
		await this.workflow.preparePin(provider);
		if (!isCurrent() || scene === "pinPreview") {
			return;
		}
		this.workflow.confirmPreviewRisk(true);
		await Promise.resolve();
		await this.workflow.createPlan();
		if (!isCurrent() || scene === "pinConfirmation") {
			return;
		}
		this.workflow.confirmPlanDevice();
		await Promise.resolve();
		await this.workflow.executePlan();
		if (!isCurrent() || scene === "pinOutcome") {
			return;
		}
		await this.workflow.openSnapshots();
		if (!isCurrent() || scene === "snapshots") {
			return;
		}
		const inventory = entityOf(this.snapshots.inventory());
		const snapshot = inventory?.snapshots.find(
			(item) => item.status === "applied",
		);
		if (!snapshot) {
			throw new Error("demo snapshot is unavailable");
		}
		await this.workflow.prepareRestore(snapshot);
		if (!isCurrent() || scene === "restorePreview") {
			return;
		}
		this.workflow.confirmPreviewRisk();
		await Promise.resolve();
		await this.workflow.createPlan();
		if (!isCurrent() || scene === "restoreConfirmation") {
			return;
		}
		this.workflow.confirmPlanDevice();
		await Promise.resolve();
		await this.workflow.executePlan();
		await Promise.resolve();
		if (scene === "restoreOutcome" && this.workflow.view().kind !== "outcome") {
			throw new Error(`demo restore ended at ${this.workflow.view().kind}`);
		}
	}

	private attachInteractionRoot(root: Element): void {
		this.detachInteractionRoot();
		this.interactionRoot = root;
		root.addEventListener("click", this.interactionListener);
	}

	private detachInteractionRoot(): void {
		this.interactionRoot?.removeEventListener(
			"click",
			this.interactionListener,
		);
		this.interactionRoot = undefined;
	}

	private waitForTargets(
		selectors: readonly string[],
		lifecycleGeneration: number,
	): Promise<boolean> {
		const targetsExist = () =>
			selectors.every((selector) => document.querySelector(selector));
		if (targetsExist()) {
			return Promise.resolve(true);
		}
		return new Promise((resolve) => {
			let settled = false;
			const finish = (ready: boolean) => {
				if (settled) {
					return;
				}
				settled = true;
				observer.disconnect();
				window.clearTimeout(timeoutId);
				if (this.cancelTargetWait === cancel) {
					this.cancelTargetWait = undefined;
				}
				resolve(ready);
			};
			const check = () => {
				if (lifecycleGeneration !== this.lifecycleGeneration) {
					finish(false);
					return;
				}
				if (targetsExist()) {
					finish(true);
				}
			};
			const observer = new MutationObserver(check);
			const timeoutId = window.setTimeout(() => finish(false), 3_000);
			const cancel = () => finish(false);
			this.cancelTargetWait = cancel;
			observer.observe(document.documentElement, {
				childList: true,
				subtree: true,
			});
			queueMicrotask(check);
		});
	}
}
