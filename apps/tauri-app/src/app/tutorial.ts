import { type Driver, driver } from "driver.js";
import "driver.js/dist/driver.css";
import { type Messages } from "../i18n/translations";

let activeDriver: Driver | undefined;
let activeTargetMissing: ((selector: string) => void) | undefined;
let advanceGeneration = 0;

export type TutorialScene =
	| "adb"
	| "devices"
	| "confirmation"
	| "diagnosis"
	| "pinPreview"
	| "pinConfirmation"
	| "pinOutcome"
	| "snapshots"
	| "restorePreview"
	| "restoreConfirmation"
	| "restoreOutcome";

export function stopTutorial() {
	advanceGeneration += 1;
	activeDriver?.destroy();
	activeDriver = undefined;
	activeTargetMissing = undefined;
}

export function advanceTutorial(nextElement: string) {
	const tutorial = activeDriver;
	if (!tutorial?.isActive()) {
		return;
	}
	const nextIndex = (tutorial.getActiveIndex() ?? -1) + 1;
	moveWhenTargetReady(tutorial, nextIndex, nextElement);
}

function moveWhenTargetReady(
	tutorial: Driver,
	index: number,
	targetSelector: string,
) {
	const generation = ++advanceGeneration;
	const deadline = performance.now() + 3_000;
	const moveWhenReady = () => {
		if (generation !== advanceGeneration || activeDriver !== tutorial) {
			return;
		}
		if (document.querySelector(targetSelector)) {
			tutorial.moveTo(index);
			return;
		}
		if (performance.now() < deadline) {
			requestAnimationFrame(moveWhenReady);
			return;
		}
		activeTargetMissing?.(targetSelector);
	};
	requestAnimationFrame(moveWhenReady);
}

function sceneForStep(
	step: ReturnType<Driver["getActiveStep"]>,
): TutorialScene | undefined {
	return step?.data?.scene as TutorialScene | undefined;
}

export function startTutorial(
	messages: Messages,
	callbacks: {
		completed: () => void;
		dismissed: () => void;
		targetMissing?: (selector: string) => void;
		sceneChanged?: (scene: TutorialScene) => void;
	},
) {
	stopTutorial();
	let settled = false;
	const reducedMotion = window.matchMedia?.(
		"(prefers-reduced-motion: reduce)",
	).matches;
	const tutorial = driver({
		animate: !reducedMotion,
		duration: reducedMotion ? 0 : 260,
		allowClose: true,
		allowKeyboardControl: true,
		showProgress: true,
		smoothScroll: true,
		nextBtnText: messages.tourNext,
		prevBtnText: messages.tourPrevious,
		doneBtnText: messages.tourDone,
		progressText: messages.tourProgress,
		popoverClass: "acp-tour",
		onPopoverRender: (popover) => {
			popover.closeButton.setAttribute("aria-label", messages.tourClose);
			popover.closeButton.setAttribute("title", messages.tourClose);
		},
		onNextClick: (_element, step, { driver: current, index }) => {
			const nextIndex = (index ?? -1) + 1;
			const nextStep = current.getConfig().steps?.[nextIndex];
			const selector =
				typeof nextStep?.element === "string" ? nextStep.element : undefined;
			const scene = sceneForStep(nextStep);
			if (!selector || !scene) {
				return;
			}
			if (scene !== sceneForStep(step)) {
				callbacks.sceneChanged?.(scene);
			}
			moveWhenTargetReady(current, nextIndex, selector);
		},
		onPrevClick: (_element, step, { driver: current, index }) => {
			const previousIndex = (index ?? 0) - 1;
			const previousStep = current.getConfig().steps?.[previousIndex];
			const selector =
				typeof previousStep?.element === "string"
					? previousStep.element
					: undefined;
			const scene = sceneForStep(previousStep);
			if (!selector || !scene) {
				return;
			}
			if (scene !== sceneForStep(step)) {
				callbacks.sceneChanged?.(scene);
			}
			moveWhenTargetReady(current, previousIndex, selector);
		},
		steps: [
			{
				element: "[data-tour='demo-banner']",
				data: { scene: "adb" },
				popover: {
					title: messages.tourDemoTitle,
					description: messages.tourDemoBody,
				},
			},
			{
				element: "[data-tour='adb-card']",
				data: { scene: "adb" },
				popover: {
					title: messages.tourAdbTitle,
					description: messages.tourAdbBody,
				},
			},
			{
				element: "[data-tour='continue-adb']",
				data: { scene: "adb" },
				disableActiveInteraction: false,
				popover: {
					title: messages.tourContinueTitle,
					description: messages.tourContinueBody,
				},
			},
			{
				element: "[data-tour='device-card']",
				data: { scene: "devices" },
				waitForElement: 3_000,
				popover: {
					title: messages.tourDeviceTitle,
					description: messages.tourDeviceBody,
				},
			},
			{
				element: "[data-tour='select-device']",
				data: { scene: "devices" },
				waitForElement: 3_000,
				disableActiveInteraction: false,
				popover: {
					title: messages.tourSelectTitle,
					description: messages.tourSelectBody,
				},
			},
			{
				element: "[data-tour='confirmation']",
				data: { scene: "confirmation" },
				waitForElement: 3_000,
				popover: {
					title: messages.tourConfirmTitle,
					description: messages.tourConfirmBody,
				},
			},
			{
				element: "[data-tour='confirm-check']",
				data: { scene: "confirmation" },
				waitForElement: 3_000,
				disableActiveInteraction: false,
				popover: {
					title: messages.tourConfirmTitle,
					description: messages.tourRunBody,
				},
			},
			{
				element: "[data-tour='run-diagnosis']",
				data: { scene: "confirmation" },
				waitForElement: 3_000,
				disableActiveInteraction: false,
				popover: {
					title: messages.tourRunTitle,
					description: messages.tourRunBody,
				},
			},
			{
				element: "[data-tour='diagnosis-result']",
				data: { scene: "diagnosis" },
				waitForElement: 3_000,
				popover: {
					title: messages.tourResultTitle,
					description: messages.tourResultBody,
				},
			},
			{
				element: "[data-tour='select-provider']",
				data: { scene: "diagnosis" },
				disableActiveInteraction: false,
				popover: {
					title: messages.tourProviderTitle,
					description: messages.tourProviderBody,
				},
			},
			{
				element: "[data-tour='plan-preview']",
				data: { scene: "pinPreview" },
				waitForElement: 3_000,
				popover: {
					title: messages.tourPlanTitle,
					description: messages.tourPlanBody,
				},
			},
			{
				element: "[data-tour='risk-confirm']",
				data: { scene: "pinPreview" },
				disableActiveInteraction: false,
				popover: {
					title: messages.tourRiskTitle,
					description: messages.tourRiskBody,
				},
			},
			{
				element: "[data-tour='create-plan']",
				data: { scene: "pinPreview" },
				disableActiveInteraction: false,
				popover: {
					title: messages.tourCreatePlanTitle,
					description: messages.tourCreatePlanBody,
				},
			},
			{
				element: "[data-tour='device-write-confirm']",
				data: { scene: "pinConfirmation" },
				waitForElement: 3_000,
				popover: {
					title: messages.tourWriteConfirmTitle,
					description: messages.tourWriteConfirmBody,
				},
			},
			{
				element: "[data-tour='apply-change']",
				data: { scene: "pinConfirmation" },
				disableActiveInteraction: false,
				popover: {
					title: messages.tourApplyTitle,
					description: messages.tourApplyBody,
				},
			},
			{
				element: "[data-tour='change-outcome']",
				data: { scene: "pinOutcome" },
				waitForElement: 3_000,
				popover: {
					title: messages.tourOutcomeTitle,
					description: messages.tourOutcomeBody,
				},
			},
			{
				element: "[data-tour='open-snapshots']",
				data: { scene: "pinOutcome" },
				disableActiveInteraction: false,
				popover: {
					title: messages.tourRestoreTitle,
					description: messages.tourRestoreBody,
				},
			},
			{
				element: "[data-tour='preview-restore']",
				data: { scene: "snapshots" },
				waitForElement: 3_000,
				disableActiveInteraction: false,
				popover: {
					title: messages.tourRestoreTitle,
					description: messages.tourRestoreBody,
				},
			},
			{
				element: "[data-tour='risk-confirm']",
				data: { scene: "restorePreview" },
				waitForElement: 3_000,
				disableActiveInteraction: false,
				popover: {
					title: messages.tourRiskTitle,
					description: messages.tourRestoreRiskBody,
				},
			},
			{
				element: "[data-tour='create-plan']",
				data: { scene: "restorePreview" },
				disableActiveInteraction: false,
				popover: {
					title: messages.tourCreatePlanTitle,
					description: messages.tourCreatePlanBody,
				},
			},
			{
				element: "[data-tour='apply-change']",
				data: { scene: "restoreConfirmation" },
				waitForElement: 3_000,
				disableActiveInteraction: false,
				popover: {
					title: messages.tourApplyTitle,
					description: messages.tourRestoreApplyBody,
				},
			},
			{
				element: "[data-tour='change-outcome']",
				data: { scene: "restoreOutcome" },
				waitForElement: 3_000,
				popover: {
					title: messages.tourDoneTitle,
					description: messages.tourDoneBody,
				},
			},
		],
		onDoneClick: () => {
			settled = true;
			callbacks.completed();
			tutorial.destroy();
		},
		onCloseClick: () => {
			settled = true;
			callbacks.dismissed();
			tutorial.destroy();
		},
		onDestroyed: () => {
			if (!settled) {
				callbacks.dismissed();
			}
			if (activeDriver === tutorial) {
				activeDriver = undefined;
			}
		},
	});
	activeDriver = tutorial;
	activeTargetMissing = callbacks.targetMissing;
	requestAnimationFrame(() => tutorial.drive());
}
