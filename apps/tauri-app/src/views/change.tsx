import { For, Show } from "solid-js";
import { useInjected } from "../di/context";
import { CHANGE_SERVICE, WORKFLOW_SERVICE } from "../di/tokens";
import { blockerMessage } from "../domain/selectors";
import { type Messages } from "../i18n/translations";
import {
	type ChangeExecution,
	type ChangePlan,
	type ChangePreview,
} from "../lib/tauri";
import {
	Badge,
	Button,
	Card,
	Checkbox,
	CodeValue,
	Notice,
	Panel,
} from "../ui/primitives";
import { ChangeRow, managedText } from "./shared";

export function ChangePreviewView(props: {
	messages: Messages;
	preview: ChangePreview;
}) {
	const workflow = useInjected(WORKFLOW_SERVICE);
	const changes = useInjected(CHANGE_SERVICE);
	const noChange = () => props.preview.blockers.includes("NO_CHANGE_REQUIRED");
	const remainingBlockers = () =>
		props.preview.blockers.filter(
			(blocker) => blocker !== "UNPARSED_CONFIRMATION_REQUIRED",
		);
	return (
		<Panel data-tour="plan-preview" class="grid gap-6">
			<div class="grid gap-2">
				<Badge tone="accent">{props.messages.changePlan}</Badge>
				<h1 class="text-3xl font-bold">
					{props.preview.kind === "pin"
						? props.messages.pinPreviewTitle
						: props.messages.restorePreviewTitle}
				</h1>
			</div>
			<Notice tone="warning">{props.messages.exclusiveWarning}</Notice>
			<div class="grid gap-4">
				<ChangeRow
					label="credential_service"
					before={managedText(props.preview.before.enabled, props.messages)}
					after={managedText(props.preview.after.enabled, props.messages)}
					messages={props.messages}
				/>
				<ChangeRow
					label="credential_service_primary"
					before={managedText(props.preview.before.primary, props.messages)}
					after={managedText(props.preview.after.primary, props.messages)}
					messages={props.messages}
				/>
			</div>
			<Show when={noChange()}>
				<Notice tone="info">
					<strong>{props.messages.noChangeTitle}</strong>
					<span>{blockerMessage(props.messages, "NO_CHANGE_REQUIRED")}</span>
				</Notice>
			</Show>
			<Show when={remainingBlockers().length > 0}>
				<Notice tone="danger">
					<strong>{props.messages.planBlocked}</strong>
					<ul class="list-disc pl-5">
						<For each={remainingBlockers()}>
							{(blocker) => <li>{blockerMessage(props.messages, blocker)}</li>}
						</For>
					</ul>
				</Notice>
			</Show>
			<Show when={props.preview.requiresUnparsedConfirmation}>
				<Checkbox
					data-tour="risk-confirm"
					tone="danger"
					checked={changes.allowUnparsed()}
					onInput={(event) =>
						changes.setAllowUnparsed(event.currentTarget.checked)
					}
				>
					{props.messages.allowUnparsed}
				</Checkbox>
			</Show>
			<Checkbox
				data-tour="risk-confirm"
				checked={changes.riskConfirmed()}
				onInput={(event) =>
					changes.setRiskConfirmed(event.currentTarget.checked)
				}
			>
				{props.messages.confirmChangeRisk}
			</Checkbox>
			<div class="flex flex-wrap justify-between gap-3">
				<Button onClick={() => workflow.closePreview()}>
					{props.messages.back}
				</Button>
				<Button
					data-tour="create-plan"
					variant="solid"
					disabled={
						workflow.busy() ||
						noChange() ||
						remainingBlockers().length > 0 ||
						!changes.riskConfirmed() ||
						(props.preview.requiresUnparsedConfirmation &&
							!changes.allowUnparsed())
					}
					onClick={() => void workflow.createPlan()}
				>
					{props.messages.createPlan}
				</Button>
			</div>
		</Panel>
	);
}

export function PlanView(props: { messages: Messages; plan: ChangePlan }) {
	const workflow = useInjected(WORKFLOW_SERVICE);
	const changes = useInjected(CHANGE_SERVICE);
	return (
		<Panel data-tour="device-write-confirm" class="grid gap-5">
			<Badge tone="warning">{props.messages.finalConfirmation}</Badge>
			<h1 class="text-3xl font-bold">{props.messages.confirmDeviceWrite}</h1>
			<Card class="grid gap-3">
				<CodeValue>{props.plan.device.serial}</CodeValue>
				<CodeValue>{props.plan.target.flattened}</CodeValue>
				<p class="text-sm text-fg-muted">
					{props.messages.foregroundUser}: {props.plan.androidUser.id}
				</p>
				<p class="text-sm text-fg-muted">
					{props.messages.expiresAt}:{" "}
					{new Date(props.plan.expiresAtUnixMs).toLocaleString()}
				</p>
			</Card>
			<Checkbox
				data-tour="device-write-check"
				checked={changes.deviceConfirmed()}
				onInput={(event) =>
					changes.setDeviceConfirmed(event.currentTarget.checked)
				}
			>
				{props.messages.confirmDeviceWrite}
			</Checkbox>
			<div class="flex flex-wrap justify-between gap-3">
				<Button onClick={() => void workflow.cancelPlan()}>
					{props.messages.back}
				</Button>
				<Button
					data-tour="apply-change"
					variant="solid"
					disabled={!changes.deviceConfirmed() || workflow.busy()}
					onClick={() => void workflow.executePlan()}
				>
					{props.plan.kind === "pin"
						? props.messages.applyPin
						: props.messages.applyRestore}
				</Button>
			</div>
		</Panel>
	);
}

export function ApplyingView(props: { messages: Messages }) {
	return (
		<Panel>
			<p class="text-base text-fg-muted">{props.messages.applyingChange}</p>
		</Panel>
	);
}

export function OutcomeView(props: {
	messages: Messages;
	execution: ChangeExecution;
}) {
	const workflow = useInjected(WORKFLOW_SERVICE);
	const status = () => props.execution.outcome?.status;
	const statusLabel = () => {
		const current = status();
		return current
			? props.messages.outcomeStatuses[current]
			: props.messages.executionStatuses[props.execution.status];
	};
	return (
		<Panel data-tour="change-outcome" class="grid gap-5">
			<Badge
				tone={props.execution.status === "recoveryFailed" ? "danger" : "accent"}
			>
				{statusLabel()}
			</Badge>
			<h1 class="text-3xl font-bold">
				{props.execution.status === "invalidated"
					? props.messages.deviceStateChanged
					: props.messages.changeOutcome}
			</h1>
			<Show when={props.execution.outcome}>
				{(outcome) => (
					<Card class="grid gap-3">
						<p>{props.messages.snapshotId}</p>
						<CodeValue>{outcome().snapshotId}</CodeValue>
						<For each={outcome().steps}>
							{(step) => (
								<p class="text-sm">
									{step.key}:{" "}
									{step.success
										? props.messages.verified
										: props.messages.stepFailed}
								</p>
							)}
						</For>
					</Card>
				)}
			</Show>
			<Show when={props.execution.persistenceWarning}>
				<Notice tone="danger">{props.messages.snapshotWarning}</Notice>
			</Show>
			<div class="flex flex-wrap gap-3">
				<Button
					data-tour="open-snapshots"
					onClick={() => void workflow.openSnapshots()}
				>
					{props.messages.snapshots}
				</Button>
				<Button
					data-tour-dismiss
					variant="solid"
					onClick={() => void workflow.finishAndDiagnoseAgain()}
				>
					{props.messages.done}
				</Button>
			</div>
		</Panel>
	);
}
