import { type Messages } from "../i18n/translations";
import { Button, Panel } from "../ui/primitives";

export type TutorialLaunchPrompt = "switchLive" | "restartDemo";

export function TutorialLaunchDialog(props: {
	kind: TutorialLaunchPrompt;
	messages: Messages;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	const switchesFromLive = () => props.kind === "switchLive";
	return (
		<div class="fixed inset-0 z-50 grid place-items-center bg-overlay p-4">
			<Panel
				role="dialog"
				aria-modal="true"
				aria-labelledby="tutorial-switch-title"
				class="max-w-lg"
			>
				<h2 id="tutorial-switch-title" class="text-2xl font-bold">
					{switchesFromLive()
						? props.messages.tutorialSwitchTitle
						: props.messages.tutorialRestartTitle}
				</h2>
				<p class="mt-3 text-fg-muted">
					{switchesFromLive()
						? props.messages.tutorialSwitchBody
						: props.messages.tutorialRestartBody}
				</p>
				<div class="mt-6 flex flex-wrap justify-end gap-3">
					<Button autofocus onClick={props.onCancel}>
						{props.messages.stayInCurrentWorkflow}
					</Button>
					<Button variant="solid" onClick={props.onConfirm}>
						{switchesFromLive()
							? props.messages.switchAndStartTutorial
							: props.messages.restartTutorial}
					</Button>
				</div>
			</Panel>
		</div>
	);
}
