import { type Driver, driver } from "driver.js";
import "driver.js/dist/driver.css";
import { type Messages } from "../i18n/translations";

let activeDriver: Driver | undefined;

export function stopTutorial() {
	activeDriver?.destroy();
	activeDriver = undefined;
}

export function startTutorial(
	messages: Messages,
	callbacks: { completed: () => void; dismissed: () => void },
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
		steps: [
			{
				element: "[data-tour='demo-banner']",
				popover: {
					title: messages.tourDemoTitle,
					description: messages.tourDemoBody,
				},
			},
			{
				element: "[data-tour='adb-card']",
				popover: {
					title: messages.tourAdbTitle,
					description: messages.tourAdbBody,
				},
			},
			{
				element: "[data-tour='continue-adb']",
				advanceOnClick: true,
				disableActiveInteraction: false,
				popover: {
					title: messages.tourContinueTitle,
					description: messages.tourContinueBody,
				},
			},
			{
				element: "[data-tour='device-card']",
				waitForElement: 3_000,
				popover: {
					title: messages.tourDeviceTitle,
					description: messages.tourDeviceBody,
				},
			},
			{
				element: "[data-tour='select-device']",
				waitForElement: 3_000,
				advanceOnClick: true,
				disableActiveInteraction: false,
				popover: {
					title: messages.tourSelectTitle,
					description: messages.tourSelectBody,
				},
			},
			{
				element: "[data-tour='confirmation']",
				waitForElement: 3_000,
				popover: {
					title: messages.tourConfirmTitle,
					description: messages.tourConfirmBody,
				},
			},
			{
				element: "[data-tour='confirm-check']",
				waitForElement: 3_000,
				advanceOnClick: true,
				disableActiveInteraction: false,
				popover: {
					title: messages.tourConfirmTitle,
					description: messages.tourRunBody,
				},
			},
			{
				element: "[data-tour='run-diagnosis']",
				waitForElement: 3_000,
				advanceOnClick: true,
				disableActiveInteraction: false,
				popover: {
					title: messages.tourRunTitle,
					description: messages.tourRunBody,
				},
			},
			{
				element: "[data-tour='diagnosis-result']",
				waitForElement: 3_000,
				popover: {
					title: messages.tourResultTitle,
					description: messages.tourResultBody,
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
	requestAnimationFrame(() => tutorial.drive());
}
