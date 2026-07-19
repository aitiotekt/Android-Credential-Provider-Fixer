import { For, Show } from "solid-js";
import { useInjected } from "../di/context";
import { WORKFLOW_SERVICE } from "../di/tokens";
import { isCurrentSoleProvider } from "../domain/selectors";
import { type Messages } from "../i18n/translations";
import {
	type DiagnosisEntity,
	type DiagnosisReport,
	type ErrorEnvelope,
	type ProviderChoice,
} from "../lib/tauri";
import {
	Badge,
	Button,
	Card,
	CodeValue,
	Notice,
	Panel,
} from "../ui/primitives";
import { BooleanBadge, DataGrid, localizedError, settingText } from "./shared";

export function DiagnosingView(props: { messages: Messages }) {
	return (
		<Panel>
			<p class="text-base text-fg-muted">{props.messages.diagnosing}</p>
		</Panel>
	);
}

export function DiagnosisErrorView(props: {
	messages: Messages;
	error: ErrorEnvelope;
}) {
	const workflow = useInjected(WORKFLOW_SERVICE);
	return (
		<Panel class="grid gap-5">
			<h1 class="text-3xl font-bold">{props.messages.diagnosisFailed}</h1>
			<Notice tone="danger">
				{localizedError(props.messages, props.error)}
			</Notice>
			<div class="flex flex-wrap gap-3">
				<Button variant="solid" onClick={() => void workflow.retryDiagnosis()}>
					{props.messages.retryDiagnosis}
				</Button>
				<Button onClick={() => workflow.backToDevices()}>
					{props.messages.backToDevices}
				</Button>
			</div>
		</Panel>
	);
}

export function DiagnosisView(props: {
	messages: Messages;
	diagnosis: DiagnosisEntity;
}) {
	const workflow = useInjected(WORKFLOW_SERVICE);
	return (
		<ReportPanel
			messages={props.messages}
			report={props.diagnosis.report}
			providers={props.diagnosis.providers}
			busy={workflow.busy()}
			onPin={(provider) => void workflow.preparePin(provider)}
			onSnapshots={() => void workflow.openSnapshots()}
			onRestart={() => workflow.backToAdb()}
		/>
	);
}

export function ReportPanel(props: {
	messages: Messages;
	report: DiagnosisReport;
	providers: ProviderChoice[];
	busy: boolean;
	onPin: (provider: ProviderChoice) => void;
	onSnapshots: () => void;
	onRestart: () => void;
}) {
	const report = () => props.report;
	return (
		<Panel data-tour="diagnosis-result" class="grid gap-6">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="grid gap-2">
					<Badge tone="accent">{props.messages.stepResult}</Badge>
					<h1 class="text-3xl font-bold">{props.messages.resultTitle}</h1>
					<p class="text-fg-muted">{props.messages.resultCaution}</p>
				</div>
				<Badge
					tone={report().completeness === "complete" ? "accent" : "warning"}
				>
					{props.messages.reportStatuses[report().completeness]}
				</Badge>
			</div>
			<Show when={report().completeness === "incomplete"}>
				<Notice tone="warning">{props.messages.incomplete}</Notice>
			</Show>
			<Show when={report().completeness === "unsupported"}>
				<Notice tone="warning">{props.messages.unsupported}</Notice>
			</Show>
			<Card class="grid gap-4">
				<h2 class="text-xl font-semibold">
					{props.messages.deviceInformation}
				</h2>
				<DataGrid
					items={[
						{
							label: props.messages.manufacturer,
							value: report().device.manufacturer,
						},
						{ label: props.messages.model, value: report().device.model },
						{ label: props.messages.codename, value: report().device.codename },
						{
							label: props.messages.android,
							value: report().device.androidVersion,
						},
						{
							label: props.messages.apiLevel,
							value: String(report().device.apiLevel),
						},
						{
							label: props.messages.foregroundUser,
							value: report().androidUser
								? String(report().androidUser?.id)
								: props.messages.unavailable,
						},
					]}
				/>
				<p class="text-sm text-fg-muted">
					{props.messages.observed}:{" "}
					{new Date(report().observedAtUnixMs).toLocaleString()}
				</p>
			</Card>
			<section class="grid gap-3">
				<h2 class="text-xl font-semibold">
					{props.messages.registeredProviders}
				</h2>
				<For
					each={props.providers}
					fallback={<p>{props.messages.noProviders}</p>}
				>
					{(provider) => {
						const current = () => isCurrentSoleProvider(report(), provider);
						return (
							<Card class="grid gap-3">
								<span class="text-xs text-fg-muted">
									{props.messages.component}
								</span>
								<CodeValue>{provider.component.flattened}</CodeValue>
								<p class="text-sm text-fg-muted">
									{provider.component.packageName}
								</p>
								<div class="flex flex-wrap gap-2">
									<BooleanBadge
										label={props.messages.enabled}
										active={provider.enabled}
										messages={props.messages}
									/>
									<BooleanBadge
										label={props.messages.primary}
										active={provider.primary}
										messages={props.messages}
									/>
									<BooleanBadge
										label={props.messages.autofillPackage}
										active={provider.samePackageAsAutofill}
										messages={props.messages}
									/>
								</div>
								<Button
									data-tour="select-provider"
									variant={current() ? "subtle" : "surface"}
									disabled={props.busy || current()}
									onClick={() => props.onPin(provider)}
								>
									{current()
										? props.messages.currentSoleProvider
										: props.messages.previewPin}
								</Button>
							</Card>
						);
					}}
				</For>
			</section>
			<section class="grid gap-3">
				<h2 class="text-xl font-semibold">{props.messages.credentialState}</h2>
				<For
					each={[
						report().credentialState.enabled,
						report().credentialState.primary,
						report().credentialState.autofill,
					]}
				>
					{(setting) => (
						<Card>
							<CodeValue>{setting.key}</CodeValue>
							<p class="mt-3 text-sm text-fg-muted">
								{settingText(setting.value, props.messages)}
							</p>
						</Card>
					)}
				</For>
			</section>
			<section class="grid gap-3">
				<h2 class="text-xl font-semibold">{props.messages.findingsTitle}</h2>
				<For each={report().findings}>
					{(finding) => (
						<Notice tone={finding.severity === "warning" ? "warning" : "info"}>
							<strong>
								{finding.severity === "warning"
									? props.messages.warning
									: props.messages.info}
							</strong>
							<span>
								{props.messages.findings[
									finding.code as keyof typeof props.messages.findings
								] ?? finding.code}
							</span>
						</Notice>
					)}
				</For>
			</section>
			<div class="flex flex-wrap justify-between gap-3">
				<Button onClick={props.onRestart}>{props.messages.startOver}</Button>
				<Button onClick={props.onSnapshots}>{props.messages.snapshots}</Button>
			</div>
		</Panel>
	);
}
