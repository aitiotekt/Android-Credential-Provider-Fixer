import {
	createMemo,
	createSignal,
	For,
	Match,
	onCleanup,
	onSettled,
	Show,
	Switch,
} from "solid-js";
import { createLocaleController } from "../i18n/locale";
import { type Messages } from "../i18n/translations";
import {
	type AdbCandidate,
	type AdbDiscovery,
	type AppInfo,
	chooseAdbExecutable,
	type DemoFixture,
	type DeviceChoice,
	type DeviceList,
	type DiagnosisReport,
	discoverAdb,
	type ErrorEnvelope,
	getAppInfo,
	getDemoFixture,
	getStartupState,
	inspectDevice,
	listDevices,
	type SettingObservation,
	type SettingValue,
	type StartupState,
	selectAdbCandidate,
	setOnboardingStatus,
	type ValidatedAdb,
} from "../lib/tauri";
import { startTutorial, stopTutorial } from "./tutorial";

type WorkflowStep =
	| "welcome"
	| "adb"
	| "devices"
	| "confirm"
	| "diagnosing"
	| "result";

type Mode = "real" | "demo";

export function App() {
	const i18n = createLocaleController();
	const text = i18n.messages;
	const [step, setStep] = createSignal<WorkflowStep>("welcome");
	const [mode, setMode] = createSignal<Mode>("real");
	const [appInfo, setAppInfo] = createSignal<AppInfo>();
	const [startup, setStartup] = createSignal<StartupState>();
	const [connectionError, setConnectionError] = createSignal(false);
	const [showOnboarding, setShowOnboarding] = createSignal(false);
	const [tutorialActive, setTutorialActive] = createSignal(false);
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal<ErrorEnvelope>();
	const [discovery, setDiscovery] = createSignal<AdbDiscovery>();
	const [selectedAdb, setSelectedAdb] = createSignal<ValidatedAdb>();
	const [deviceList, setDeviceList] = createSignal<DeviceList>();
	const [selectedDevice, setSelectedDevice] = createSignal<DeviceChoice>();
	const [confirmed, setConfirmed] = createSignal(false);
	const [report, setReport] = createSignal<DiagnosisReport>();
	const [demo, setDemo] = createSignal<DemoFixture>();
	const [copied, setCopied] = createSignal<string>();

	const steps = createMemo(() => [
		{ id: "adb", label: text().stepAdb },
		{ id: "devices", label: text().stepDevice },
		{ id: "confirm", label: text().stepConfirm },
		{ id: "result", label: text().stepResult },
	]);

	onSettled(() => {
		void Promise.all([getAppInfo(), getStartupState()])
			.then(([info, state]) => {
				setAppInfo(info);
				setStartup(state);
				setSelectedAdb(state.selectedAdb ?? undefined);
				setShowOnboarding(state.onboardingStatus === null);
			})
			.catch(() => setConnectionError(true));
	});

	onCleanup(stopTutorial);

	async function startReal() {
		stopTutorial();
		setTutorialActive(false);
		setMode("real");
		resetWorkflow();
		setStep("adb");
		await detectAdb();
	}

	async function enterDemo(guided: boolean) {
		stopTutorial();
		setMode("demo");
		resetWorkflow();
		setBusy(true);
		try {
			const fixture = await getDemoFixture();
			setDemo(fixture);
			setSelectedAdb(fixture.adb);
			setStep("adb");
			if (guided) {
				setTutorialActive(true);
				startTutorial(text(), {
					completed: () => finishTutorial("completed"),
					dismissed: () => finishTutorial("skipped"),
				});
			}
		} catch (reason) {
			setError(errorFrom(reason));
		} finally {
			setBusy(false);
		}
	}

	function finishTutorial(status: "completed" | "skipped") {
		setTutorialActive(false);
		setShowOnboarding(false);
		void setOnboardingStatus(status)
			.then(setStartup)
			.catch(() => undefined);
	}

	function skipOnboarding() {
		setShowOnboarding(false);
		void setOnboardingStatus("skipped")
			.then(setStartup)
			.catch(() => undefined);
	}

	function resetWorkflow() {
		setError(undefined);
		setDiscovery(undefined);
		setDeviceList(undefined);
		setSelectedDevice(undefined);
		setConfirmed(false);
		setReport(undefined);
		setDemo(undefined);
		if (mode() === "demo") {
			setSelectedAdb(undefined);
		} else {
			setSelectedAdb(startup()?.selectedAdb ?? undefined);
		}
	}

	async function detectAdb() {
		if (mode() === "demo") {
			return;
		}
		setBusy(true);
		setError(undefined);
		try {
			setDiscovery(await discoverAdb());
		} catch (reason) {
			setError(errorFrom(reason));
		} finally {
			setBusy(false);
		}
	}

	async function useCandidate(candidate: AdbCandidate) {
		setBusy(true);
		setError(undefined);
		try {
			setSelectedAdb(await selectAdbCandidate(candidate.candidateId));
		} catch (reason) {
			setError(errorFrom(reason));
		} finally {
			setBusy(false);
		}
	}

	async function chooseAdb() {
		setBusy(true);
		setError(undefined);
		try {
			const adb = await chooseAdbExecutable();
			if (adb) {
				setSelectedAdb(adb);
			}
		} catch (reason) {
			setError(errorFrom(reason));
		} finally {
			setBusy(false);
		}
	}

	async function continueToDevices() {
		setError(undefined);
		setSelectedDevice(undefined);
		setConfirmed(false);
		if (mode() === "demo") {
			const fixture = demo();
			if (!fixture) {
				return;
			}
			setDeviceList({
				schemaVersion: fixture.schemaVersion,
				observedAtUnixMs: fixture.devices.observedAtUnixMs,
				devices: fixture.devices.devices.map((device, index) => ({
					...device,
					deviceId: `demo-device-${index}`,
				})),
			});
			setStep("devices");
			return;
		}
		setBusy(true);
		try {
			setDeviceList(await listDevices());
			setStep("devices");
		} catch (reason) {
			setError(errorFrom(reason));
		} finally {
			setBusy(false);
		}
	}

	function chooseDevice(device: DeviceChoice) {
		if (device.state !== "device") {
			return;
		}
		setSelectedDevice(device);
		setConfirmed(false);
		setStep("confirm");
	}

	async function runDiagnosis() {
		const device = selectedDevice();
		if (!device || !confirmed()) {
			return;
		}
		setStep("diagnosing");
		setError(undefined);
		if (mode() === "demo") {
			const fixture = demo();
			if (fixture) {
				setReport(fixture.report);
				setStep("result");
			}
			return;
		}
		try {
			setReport(await inspectDevice(device.deviceId));
			setStep("result");
		} catch (reason) {
			setError(errorFrom(reason));
			setStep("confirm");
		}
	}

	function leaveDemo() {
		stopTutorial();
		setTutorialActive(false);
		setMode("real");
		resetWorkflow();
		setStep("welcome");
	}

	async function copy(value: string, key: string) {
		await navigator.clipboard?.writeText(value);
		setCopied(key);
		window.setTimeout(() => setCopied(undefined), 1_200);
	}

	return (
		<main class="app-shell">
			<header class="app-header">
				<div class="brand-lockup">
					<img class="brand-mark" src="/app-icon.png" alt="" />
					<div>
						<strong>{text().product}</strong>
						<span>{text().phase}</span>
					</div>
				</div>
				<div class="header-actions">
					<button
						class="button button-quiet"
						type="button"
						disabled={tutorialActive() || connectionError()}
						onClick={() => void enterDemo(true)}
					>
						{text().startTutorial}
					</button>
					<label class="language-picker">
						<span>{text().language}</span>
						<select
							disabled={tutorialActive()}
							value={i18n.locale()}
							onInput={(event) =>
								i18n.setLocale(event.currentTarget.value as "en" | "zh")
							}
						>
							<option value="en">{text().english}</option>
							<option value="zh">{text().chinese}</option>
						</select>
					</label>
				</div>
			</header>

			<Show when={mode() === "demo"}>
				<div class="demo-banner" data-tour="demo-banner" role="status">
					<strong>{text().simulated}</strong>
					<button class="button-link" type="button" onClick={leaveDemo}>
						{text().exitDemo}
					</button>
				</div>
			</Show>

			<Show when={step() !== "welcome"}>
				<nav class="stepper" aria-label={text().phase}>
					<For each={steps()}>
						{(item, index) => (
							<div
								class={`stepper-item ${stepIndex(step()) >= index() ? "is-active" : ""}`}
							>
								<span>{index() + 1}</span>
								{item.label}
							</div>
						)}
					</For>
				</nav>
			</Show>

			<Show when={startup()?.preferenceWarning}>
				<div class="notice notice-warning">
					<strong>{text().preferenceWarning}</strong>
					<span>{startup()?.preferenceWarning?.message}</span>
				</div>
			</Show>

			<Show when={error()}>
				<div class="notice notice-error" role="alert">
					<strong>{error()?.code}</strong>
					<span>{error()?.message}</span>
				</div>
			</Show>

			<Switch>
				<Match when={step() === "welcome"}>
					<Welcome
						messages={text()}
						connected={Boolean(appInfo())}
						connectionError={connectionError()}
						onStart={() => void startReal()}
						onDemo={() => void enterDemo(false)}
					/>
				</Match>
				<Match when={step() === "adb"}>
					<AdbPanel
						messages={text()}
						busy={busy()}
						discovery={discovery()}
						selected={selectedAdb()}
						demo={mode() === "demo"}
						onDetect={() => void detectAdb()}
						onChoose={() => void chooseAdb()}
						onSelect={(candidate) => void useCandidate(candidate)}
						onContinue={() => void continueToDevices()}
						onCopy={(value, key) => void copy(value, key)}
						copied={copied()}
					/>
				</Match>
				<Match when={step() === "devices"}>
					<DevicePanel
						messages={text()}
						devices={deviceList()}
						busy={busy()}
						demo={mode() === "demo"}
						onRefresh={() => void continueToDevices()}
						onSelect={chooseDevice}
						onBack={() => setStep("adb")}
					/>
				</Match>
				<Match when={step() === "confirm"}>
					<ConfirmationPanel
						messages={text()}
						device={selectedDevice()}
						confirmed={confirmed()}
						onConfirmed={setConfirmed}
						onRun={() => void runDiagnosis()}
						onBack={() => setStep("devices")}
					/>
				</Match>
				<Match when={step() === "diagnosing"}>
					<section class="workflow-panel centered-panel" aria-live="polite">
						<div class="spinner" aria-hidden="true" />
						<h1>{text().diagnosing}</h1>
					</section>
				</Match>
				<Match when={step() === "result" && report()}>
					<ReportPanel
						messages={text()}
						report={report() as DiagnosisReport}
						demo={mode() === "demo"}
						onRestart={() =>
							mode() === "demo" ? leaveDemo() : void startReal()
						}
					/>
				</Match>
			</Switch>

			<footer>
				<span>{text().readOnlyFooter}</span>
				<Show when={appInfo()}>
					<code>{appInfo()?.version}</code>
				</Show>
			</footer>

			<Show when={showOnboarding()}>
				<div class="modal-backdrop" role="presentation">
					<section
						class="onboarding-dialog"
						role="dialog"
						aria-modal="true"
						aria-labelledby="onboarding-title"
					>
						<span class="status-pill">{text().readOnly}</span>
						<h2 id="onboarding-title">{text().onboardingTitle}</h2>
						<p>{text().onboardingBody}</p>
						<div class="button-row">
							<button
								class="button button-primary"
								type="button"
								onClick={() => {
									setShowOnboarding(false);
									void enterDemo(true);
								}}
							>
								{text().learnWithDemo}
							</button>
							<button class="button" type="button" onClick={skipOnboarding}>
								{text().skipTutorial}
							</button>
						</div>
					</section>
				</div>
			</Show>
		</main>
	);
}

function Welcome(props: {
	messages: Messages;
	connected: boolean;
	connectionError: boolean;
	onStart: () => void;
	onDemo: () => void;
}) {
	return (
		<>
			<section class="hero">
				<p class="eyebrow">{props.messages.phase}</p>
				<h1>{props.messages.welcomeTitle}</h1>
				<p class="summary">{props.messages.welcomeBody}</p>
				<div class="button-row hero-actions">
					<button
						class="button button-primary"
						type="button"
						disabled={!props.connected}
						onClick={props.onStart}
					>
						{props.messages.startDiagnosis}
					</button>
					<button
						class="button"
						type="button"
						disabled={!props.connected}
						onClick={props.onDemo}
					>
						{props.messages.openDemo}
					</button>
				</div>
				<p class={`connection-copy ${props.connectionError ? "is-error" : ""}`}>
					{props.connectionError
						? props.messages.backendUnavailable
						: props.connected
							? "● Local core connected"
							: props.messages.backendConnecting}
				</p>
			</section>
			<section class="feature-grid">
				<article class="feature-card">
					<h2>{props.messages.localOnly}</h2>
					<p>{props.messages.localOnlyBody}</p>
				</article>
				<article class="feature-card">
					<h2>{props.messages.safetyTitle}</h2>
					<p>{props.messages.safetyBody}</p>
				</article>
			</section>
		</>
	);
}

function AdbPanel(props: {
	messages: Messages;
	busy: boolean;
	discovery?: AdbDiscovery;
	selected?: ValidatedAdb;
	demo: boolean;
	copied?: string;
	onDetect: () => void;
	onChoose: () => void;
	onSelect: (candidate: AdbCandidate) => void;
	onContinue: () => void;
	onCopy: (value: string, key: string) => void;
}) {
	return (
		<section class="workflow-panel">
			<div class="panel-heading">
				<div>
					<p class="eyebrow">01 · {props.messages.stepAdb}</p>
					<h1>{props.messages.adbTitle}</h1>
					<p>{props.messages.adbBody}</p>
				</div>
				<Show when={!props.demo}>
					<div class="button-row">
						<button
							class="button"
							type="button"
							disabled={props.busy}
							onClick={props.onDetect}
						>
							{props.messages.refreshAdb}
						</button>
						<button
							class="button"
							type="button"
							disabled={props.busy}
							onClick={props.onChoose}
						>
							{props.messages.chooseAdb}
						</button>
					</div>
				</Show>
			</div>
			<Show when={props.busy}>
				<p class="loading-copy">{props.messages.detectingAdb}</p>
			</Show>
			<Show when={props.selected}>
				{(adb) => (
					<article class="data-card selected-card" data-tour="adb-card">
						<div class="card-title-row">
							<strong>{props.messages.selected}</strong>
							<span class="status-pill">{props.messages.readOnly}</span>
						</div>
						<DataRow label={props.messages.path} value={adb().path} />
						<DataRow
							label={props.messages.resolvedPath}
							value={adb().resolvedPath}
						/>
						<DataRow label={props.messages.version} value={adb().version} />
					</article>
				)}
			</Show>
			<Show
				when={
					!props.demo &&
					props.discovery &&
					props.discovery.candidates.length === 0
				}
			>
				<div class="empty-state">
					<h2>{props.messages.adbNotFound}</h2>
					<p>{props.messages.adbInstall}</p>
					<InstallCommand
						command="brew install --cask android-platform-tools"
						copyLabel={
							props.copied === "brew"
								? props.messages.copied
								: props.messages.copy
						}
						onCopy={() =>
							props.onCopy("brew install --cask android-platform-tools", "brew")
						}
					/>
					<InstallCommand
						command="winget install --id Google.PlatformTools --exact"
						copyLabel={
							props.copied === "winget"
								? props.messages.copied
								: props.messages.copy
						}
						onCopy={() =>
							props.onCopy(
								"winget install --id Google.PlatformTools --exact",
								"winget",
							)
						}
					/>
				</div>
			</Show>
			<Show
				when={
					!props.demo &&
					props.discovery &&
					props.discovery.candidates.length > 0
				}
			>
				<div class="card-list">
					<For each={props.discovery?.candidates}>
						{(candidate) => (
							<article class="data-card">
								<DataRow
									label={props.messages.path}
									value={candidate.adb.path}
								/>
								<DataRow
									label={props.messages.version}
									value={candidate.adb.version}
								/>
								<DataRow
									label={props.messages.source}
									value={candidate.source}
								/>
								<button
									class="button button-small"
									type="button"
									disabled={
										props.busy || candidate.adb.path === props.selected?.path
									}
									onClick={() => props.onSelect(candidate)}
								>
									{candidate.adb.path === props.selected?.path
										? props.messages.selected
										: props.messages.useAdb}
								</button>
							</article>
						)}
					</For>
				</div>
			</Show>
			<div class="panel-actions">
				<button
					class="button button-primary"
					type="button"
					data-tour="continue-adb"
					disabled={!props.selected || props.busy}
					onClick={props.onContinue}
				>
					{props.messages.continueDevices}
				</button>
			</div>
		</section>
	);
}

function DevicePanel(props: {
	messages: Messages;
	devices?: DeviceList;
	busy: boolean;
	demo: boolean;
	onRefresh: () => void;
	onSelect: (device: DeviceChoice) => void;
	onBack: () => void;
}) {
	return (
		<section class="workflow-panel">
			<div class="panel-heading">
				<div>
					<p class="eyebrow">02 · {props.messages.stepDevice}</p>
					<h1>{props.messages.deviceTitle}</h1>
					<p>{props.messages.deviceBody}</p>
				</div>
				<Show when={!props.demo}>
					<button
						class="button"
						type="button"
						disabled={props.busy}
						onClick={props.onRefresh}
					>
						{props.messages.refreshDevices}
					</button>
				</Show>
			</div>
			<Show when={props.busy}>
				<p>{props.messages.loadingDevices}</p>
			</Show>
			<Show when={props.devices?.devices.length === 0}>
				<div class="empty-state">{props.messages.noDevices}</div>
			</Show>
			<div class="card-list device-list">
				<For each={props.devices?.devices}>
					{(device, index) => (
						<article
							class="data-card"
							data-tour={index() === 0 ? "device-card" : undefined}
						>
							<div class="card-title-row">
								<strong>{device.model ?? device.serial}</strong>
								<span class={`device-state state-${device.state}`}>
									{device.state}
								</span>
							</div>
							<DataRow label="Serial" value={device.serial} />
							<DataRow
								label={props.messages.connection}
								value={device.connectionType}
							/>
							<button
								class="button button-small"
								type="button"
								data-tour={index() === 0 ? "select-device" : undefined}
								disabled={device.state !== "device"}
								onClick={() => props.onSelect(device)}
							>
								{props.messages.inspectThisDevice}
							</button>
						</article>
					)}
				</For>
			</div>
			<div class="panel-actions">
				<button class="button" type="button" onClick={props.onBack}>
					{props.messages.back}
				</button>
			</div>
		</section>
	);
}

function ConfirmationPanel(props: {
	messages: Messages;
	device?: DeviceChoice;
	confirmed: boolean;
	onConfirmed: (value: boolean) => void;
	onRun: () => void;
	onBack: () => void;
}) {
	return (
		<section class="workflow-panel" data-tour="confirmation">
			<div class="panel-heading">
				<div>
					<p class="eyebrow">03 · {props.messages.stepConfirm}</p>
					<h1>{props.messages.confirmTitle}</h1>
					<p>{props.messages.confirmBody}</p>
				</div>
			</div>
			<Show when={props.device}>
				{(device) => (
					<article class="identity-card">
						<strong>{device().model ?? device().serial}</strong>
						<code>{device().serial}</code>
						<span>{device().connectionType}</span>
					</article>
				)}
			</Show>
			<label class="confirmation-check" data-tour="confirm-check">
				<input
					type="checkbox"
					checked={props.confirmed}
					onInput={(event) => props.onConfirmed(event.currentTarget.checked)}
				/>
				<span>{props.messages.confirmCheckbox}</span>
			</label>
			<div class="panel-actions split-actions">
				<button class="button" type="button" onClick={props.onBack}>
					{props.messages.back}
				</button>
				<button
					class="button button-primary"
					type="button"
					data-tour="run-diagnosis"
					disabled={!props.confirmed}
					onClick={props.onRun}
				>
					{props.messages.runDiagnosis}
				</button>
			</div>
		</section>
	);
}

function ReportPanel(props: {
	messages: Messages;
	report: DiagnosisReport;
	demo: boolean;
	onRestart: () => void;
}) {
	return (
		<section class="workflow-panel report-panel" data-tour="diagnosis-result">
			<div class="panel-heading">
				<div>
					<p class="eyebrow">04 · {props.messages.stepResult}</p>
					<h1>{props.messages.resultTitle}</h1>
					<p>{props.messages.resultCaution}</p>
				</div>
				<span class={`report-status status-${props.report.status}`}>
					{props.report.status}
				</span>
			</div>
			<Show when={props.report.status === "incomplete"}>
				<div class="notice notice-warning">{props.messages.incomplete}</div>
			</Show>
			<Show when={props.report.status === "unsupported"}>
				<div class="notice notice-warning">{props.messages.unsupported}</div>
			</Show>
			<section class="result-section">
				<h2>{props.messages.deviceInformation}</h2>
				<div class="facts-grid">
					<DataRow
						label={props.messages.manufacturer}
						value={props.report.device.manufacturer}
					/>
					<DataRow
						label={props.messages.model}
						value={props.report.device.model}
					/>
					<DataRow
						label={props.messages.codename}
						value={props.report.device.codename}
					/>
					<DataRow
						label={props.messages.android}
						value={props.report.device.androidVersion}
					/>
					<DataRow
						label={props.messages.apiLevel}
						value={String(props.report.device.apiLevel)}
					/>
					<DataRow
						label={props.messages.foregroundUser}
						value={
							props.report.androidUser
								? String(props.report.androidUser.id)
								: "—"
						}
					/>
				</div>
				<p class="observed-at">
					{props.messages.observed}:{" "}
					{new Date(props.report.observedAtUnixMs).toLocaleString()}
				</p>
			</section>
			<section class="result-section">
				<h2>{props.messages.registeredProviders}</h2>
				<Show when={props.report.providers.length === 0}>
					<p>{props.messages.noProviders}</p>
				</Show>
				<div class="provider-list">
					<For each={props.report.providers}>
						{(provider) => (
							<article class="provider-card">
								<code>{provider.component.flattened}</code>
								<span>{provider.component.packageName}</span>
								<div class="provider-flags">
									<Flag
										label={props.messages.enabled}
										active={provider.enabled}
										messages={props.messages}
									/>
									<Flag
										label={props.messages.primary}
										active={provider.primary}
										messages={props.messages}
									/>
									<Flag
										label={props.messages.autofillPackage}
										active={provider.samePackageAsAutofill}
										messages={props.messages}
									/>
								</div>
							</article>
						)}
					</For>
				</div>
			</section>
			<section class="result-section">
				<h2>{props.messages.credentialState}</h2>
				<div class="setting-table">
					<For
						each={[
							props.report.credentialState.enabled,
							props.report.credentialState.primary,
							props.report.credentialState.autofill,
						]}
					>
						{(observation) => (
							<SettingRow observation={observation} messages={props.messages} />
						)}
					</For>
				</div>
			</section>
			<section class="result-section">
				<h2>{props.messages.findingsTitle}</h2>
				<div class="finding-list">
					<For each={props.report.findings}>
						{(finding) => (
							<article class={`finding finding-${finding.severity}`}>
								<strong>
									{finding.severity === "warning"
										? props.messages.warning
										: props.messages.info}
								</strong>
								<p>{findingMessage(props.messages, finding.code)}</p>
								<Show when={finding.relatedValue}>
									<code>{finding.relatedValue}</code>
								</Show>
							</article>
						)}
					</For>
				</div>
			</section>
			<div class="panel-actions">
				<button
					class="button button-primary"
					type="button"
					onClick={props.onRestart}
				>
					{props.demo ? props.messages.exitDemo : props.messages.startOver}
				</button>
			</div>
		</section>
	);
}

function DataRow(props: { label: string; value: string }) {
	return (
		<div class="data-row">
			<span>{props.label}</span>
			<code>{props.value}</code>
		</div>
	);
}

function Flag(props: { label: string; active: boolean; messages: Messages }) {
	return (
		<span class={`flag ${props.active ? "is-active" : ""}`}>
			{props.label}: {props.active ? props.messages.yes : props.messages.no}
		</span>
	);
}

function SettingRow(props: {
	observation: SettingObservation;
	messages: Messages;
}) {
	return (
		<div class="setting-row">
			<code>{props.observation.key}</code>
			<span>{settingValue(props.observation.value, props.messages)}</span>
		</div>
	);
}

function InstallCommand(props: {
	command: string;
	copyLabel: string;
	onCopy: () => void;
}) {
	return (
		<div class="install-command">
			<code>{props.command}</code>
			<button class="button-link" type="button" onClick={props.onCopy}>
				{props.copyLabel}
			</button>
		</div>
	);
}

function settingValue(value: SettingValue, messages: Messages): string {
	switch (value.kind) {
		case "missing":
			return messages.missing;
		case "empty":
			return messages.empty;
		case "value":
			return value.raw;
		case "unavailable":
			return `${messages.unavailable}: ${value.message}`;
	}
}

function findingMessage(messages: Messages, code: string): string {
	return messages.findings[code as keyof typeof messages.findings] ?? code;
}

function errorFrom(reason: unknown): ErrorEnvelope {
	if (
		typeof reason === "object" &&
		reason !== null &&
		"code" in reason &&
		"message" in reason
	) {
		return reason as ErrorEnvelope;
	}
	return {
		code: "UNEXPECTED_ERROR",
		message: reason instanceof Error ? reason.message : String(reason),
	};
}

function stepIndex(step: WorkflowStep): number {
	switch (step) {
		case "welcome":
		case "adb":
			return 0;
		case "devices":
			return 1;
		case "confirm":
		case "diagnosing":
			return 2;
		case "result":
			return 3;
	}
}
