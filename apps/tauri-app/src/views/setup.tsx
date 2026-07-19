import { For, Show } from "solid-js";
import { useInjected } from "../di/context";
import { ADB_SERVICE, WORKFLOW_SERVICE } from "../di/tokens";
import { entityOf, lastEntityOf } from "../domain/resource";
import { adbOptions } from "../domain/selectors";
import { type Messages } from "../i18n/translations";
import { type DeviceList } from "../lib/tauri";
import {
	Badge,
	Button,
	Card,
	Checkbox,
	CodeValue,
	Panel,
} from "../ui/primitives";

export function AdbView(props: { messages: Messages; demo: boolean }) {
	const adb = useInjected(ADB_SERVICE);
	const workflow = useInjected(WORKFLOW_SERVICE);
	const discovery = () => entityOf(adb.discovery());
	const selection = () => lastEntityOf(adb.selection());
	const options = () => adbOptions(discovery(), selection());
	return (
		<Panel class="grid gap-5">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="grid gap-2">
					<Badge tone="accent">ADB</Badge>
					<h1 class="text-3xl font-bold text-fg">{props.messages.adbTitle}</h1>
					<p class="text-base leading-7 text-fg-muted">
						{props.messages.adbBody}
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button
						disabled={workflow.busy()}
						onClick={() => void workflow.refreshAdb()}
					>
						{props.messages.refreshAdb}
					</Button>
					<Show when={!props.demo}>
						<Button
							disabled={workflow.busy()}
							onClick={() => void workflow.chooseAdb()}
						>
							{props.messages.chooseAdb}
						</Button>
					</Show>
				</div>
			</div>
			<Show when={adb.discovery().state === "resolving"}>
				<p>{props.messages.detectingAdb}</p>
			</Show>
			<div class="grid gap-3">
				<For each={options()}>
					{(option) => (
						<Card
							data-tour="adb-card"
							class={option.selected ? "border-accent" : undefined}
						>
							<div class="grid gap-3">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<Show when={option.selected}>
										<Badge tone="accent">{props.messages.selected}</Badge>
									</Show>
									<Show when={option.source}>
										{(source) => (
											<Badge>{props.messages.candidateSources[source()]}</Badge>
										)}
									</Show>
								</div>
								<div>
									<span class="text-xs text-fg-muted">
										{props.messages.path}
									</span>
									<CodeValue>{option.adb.path}</CodeValue>
								</div>
								<div>
									<span class="text-xs text-fg-muted">
										{props.messages.resolvedPath}
									</span>
									<CodeValue>{option.adb.resolvedPath}</CodeValue>
								</div>
								<p class="text-sm text-fg-muted">{option.adb.version}</p>
								<Show
									when={option.candidate}
									fallback={<Button disabled>{props.messages.selected}</Button>}
								>
									{(candidate) => (
										<Button
											variant={option.selected ? "subtle" : "surface"}
											disabled={option.selected || workflow.busy()}
											onClick={() => void workflow.selectAdb(candidate())}
										>
											{option.selected
												? props.messages.selected
												: props.messages.useAdb}
										</Button>
									)}
								</Show>
							</div>
						</Card>
					)}
				</For>
				<Show
					when={options().length === 0 && adb.discovery().state !== "resolving"}
				>
					<Card>
						<strong>{props.messages.adbNotFound}</strong>
						<p class="mt-2 text-sm text-fg-muted">
							{props.messages.adbInstall}
						</p>
					</Card>
				</Show>
			</div>
			<div class="flex justify-end">
				<Button
					data-tour="continue-adb"
					variant="solid"
					disabled={!entityOf(adb.selection()) || workflow.busy()}
					onClick={() => void workflow.continueToDevices()}
				>
					{props.messages.continueDevices}
				</Button>
			</div>
		</Panel>
	);
}

export function DeviceView(props: {
	messages: Messages;
	enumeration: DeviceList;
}) {
	const workflow = useInjected(WORKFLOW_SERVICE);
	return (
		<Panel class="grid gap-5">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="grid gap-2">
					<Badge tone="accent">{props.messages.stepDevice}</Badge>
					<h1 class="text-3xl font-bold">{props.messages.deviceTitle}</h1>
					<p class="text-fg-muted">{props.messages.deviceBody}</p>
				</div>
				<Button
					disabled={workflow.busy()}
					onClick={() => void workflow.continueToDevices()}
				>
					{props.messages.refreshDevices}
				</Button>
			</div>
			<div class="grid gap-3">
				<For each={props.enumeration.devices}>
					{(device) => (
						<Card data-tour="device-card">
							<div class="grid gap-3">
								<CodeValue>{device.serial}</CodeValue>
								<div class="flex flex-wrap gap-2">
									<Badge
										tone={device.state === "device" ? "accent" : "warning"}
									>
										{props.messages.deviceStates[device.state]}
									</Badge>
									<Badge>
										{props.messages.connectionTypes[device.connectionType]}
									</Badge>
								</div>
								<Button
									data-tour="select-device"
									disabled={device.state !== "device"}
									onClick={() => workflow.selectDevice(device)}
								>
									{props.messages.inspectThisDevice}
								</Button>
							</div>
						</Card>
					)}
				</For>
				<Show when={props.enumeration.devices.length === 0}>
					<p>{props.messages.noDevices}</p>
				</Show>
			</div>
			<Button variant="plain" onClick={() => workflow.backToAdb()}>
				{props.messages.back}
			</Button>
		</Panel>
	);
}

export function ConfirmationView(props: {
	messages: Messages;
	serial: string;
}) {
	const workflow = useInjected(WORKFLOW_SERVICE);
	return (
		<Panel data-tour="confirmation" class="grid gap-5">
			<Badge tone="accent">{props.messages.stepConfirm}</Badge>
			<h1 class="text-3xl font-bold">{props.messages.confirmTitle}</h1>
			<p class="text-fg-muted">{props.messages.confirmBody}</p>
			<CodeValue>{props.serial}</CodeValue>
			<p class="text-sm leading-6 text-fg-muted">
				{props.messages.diagnosisReadOnlyNote}
			</p>
			<Checkbox
				data-tour="confirm-check"
				checked={workflow.confirmed()}
				onInput={(event) => workflow.setConfirmed(event.currentTarget.checked)}
			>
				{props.messages.confirmCheckbox}
			</Checkbox>
			<div class="flex flex-wrap justify-between gap-3">
				<Button onClick={() => workflow.backToDevices()}>
					{props.messages.backToDevices}
				</Button>
				<Button
					data-tour="run-diagnosis"
					variant="solid"
					disabled={!workflow.confirmed() || workflow.busy()}
					onClick={() => void workflow.runDiagnosis()}
				>
					{props.messages.runDiagnosis}
				</Button>
			</div>
		</Panel>
	);
}
