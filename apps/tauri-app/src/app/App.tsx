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
	type ChangeBlocker,
	type ChangeOutcome,
	type ChangePlan,
	type ChangePreview,
	type ComponentName,
	chooseAdbExecutable,
	createPinPlan,
	createRestorePlan,
	type DemoFixture,
	type DeviceChoice,
	type DeviceList,
	type DiagnosisReport,
	discardChangePlan,
	discoverAdb,
	type ErrorEnvelope,
	executePinPlan,
	executeRestorePlan,
	getAppInfo,
	getDemoFixture,
	getStartupState,
	inspectDevice,
	listDevices,
	listSnapshots,
	type ProviderChoice,
	preparePin,
	prepareRestore,
	type SettingObservation,
	type SettingValue,
	type SnapshotInventory,
	type SnapshotRecord,
	type StartupState,
	selectAdbCandidate,
	setOnboardingStatus,
	setThemePreference,
	type ThemePreference,
	type ValidatedAdb,
} from "../lib/tauri";
import { createThemeController } from "../theme/theme";
import {
	Badge,
	Button,
	Card,
	Checkbox,
	CodeValue,
	cx,
	Field,
	Notice,
	Panel,
	type ProgressItem,
	ProgressSteps,
	SegmentedControl,
} from "../ui/primitives";
import {
	advanceTutorial,
	startTutorial,
	stopTutorial,
	type TutorialScene,
} from "./tutorial";

export type WorkflowStep =
	| "welcome"
	| "adb"
	| "devices"
	| "confirm"
	| "diagnosing"
	| "result"
	| "plan"
	| "planConfirm"
	| "applying"
	| "outcome"
	| "snapshots";

type Mode = "real" | "demo";

export function App() {
	const i18n = createLocaleController();
	const text = i18n.messages;
	const theme = createThemeController();
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
	const [providers, setProviders] = createSignal<ProviderChoice[]>([]);
	const [selectedProvider, setSelectedProvider] =
		createSignal<ProviderChoice>();
	const [preview, setPreview] = createSignal<ChangePreview>();
	const [plan, setPlan] = createSignal<ChangePlan>();
	const [outcome, setOutcome] = createSignal<ChangeOutcome>();
	const [snapshots, setSnapshots] = createSignal<SnapshotInventory>();
	const [riskConfirmed, setRiskConfirmed] = createSignal(false);
	const [allowUnparsed, setAllowUnparsed] = createSignal(false);
	const [demo, setDemo] = createSignal<DemoFixture>();
	const [copied, setCopied] = createSignal<string>();
	const [themeSaving, setThemeSaving] = createSignal(false);

	const progress = createMemo(() =>
		progressItems(step(), preview()?.kind === "restore", text()),
	);

	onSettled(() => {
		void Promise.all([getAppInfo(), getStartupState()])
			.then(([info, state]) => {
				setAppInfo(info);
				setStartup(state);
				theme.setPreference(state.themePreference);
				setSelectedAdb(state.selectedAdb ?? undefined);
				setShowOnboarding(state.onboardingStatus === null);
			})
			.catch(() => setConnectionError(true));
	});

	onCleanup(stopTutorial);

	async function chooseTheme(preference: ThemePreference) {
		const previous = theme.preference();
		theme.setPreference(preference);
		setThemeSaving(true);
		setError(undefined);
		try {
			const state = await setThemePreference(preference);
			setStartup(state);
			theme.setPreference(state.themePreference);
		} catch (reason) {
			theme.setPreference(previous);
			setError(errorFrom(reason));
		} finally {
			setThemeSaving(false);
		}
	}

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
					sceneChanged: showTutorialScene,
					targetMissing: () =>
						setError({
							code: "TUTORIAL_TARGET_UNAVAILABLE",
							message: text().tourTargetMissing,
						}),
				});
			}
		} catch (reason) {
			setError(errorFrom(reason));
		} finally {
			setBusy(false);
		}
	}

	function showTutorialScene(scene: TutorialScene) {
		const fixture = demo();
		if (mode() !== "demo" || !fixture) {
			return;
		}
		const device = fixture.devices.devices[0];
		const choice = device
			? { ...device, deviceId: "demo-device-0" }
			: undefined;
		const fixtureProviders = fixture.report.providers.map(
			(provider, index) => ({
				...provider,
				providerId: `demo-provider-${index}`,
			}),
		);
		const provider = fixtureProviders[0];
		setError(undefined);
		setSelectedAdb(fixture.adb);

		switch (scene) {
			case "adb":
				setStep("adb");
				return;
			case "devices":
				setDeviceList({
					schemaVersion: fixture.schemaVersion,
					observedAtUnixMs: fixture.devices.observedAtUnixMs,
					devices: choice ? [choice] : [],
				});
				setStep("devices");
				return;
			case "confirmation":
				if (!choice) {
					return;
				}
				setSelectedDevice(choice);
				setConfirmed(false);
				setStep("confirm");
				return;
			case "diagnosis":
				if (!choice) {
					return;
				}
				setSelectedDevice(choice);
				setConfirmed(true);
				setReport(fixture.report);
				setProviders(fixtureProviders);
				setStep("result");
				return;
			case "pinPreview":
				if (!choice || !provider) {
					return;
				}
				setSelectedDevice(choice);
				setSelectedProvider(provider);
				setPreview(fixture.pinPreview);
				setPlan(undefined);
				setRiskConfirmed(false);
				setStep("plan");
				return;
			case "pinConfirmation": {
				const pinPlan = demoPlan(fixture.pinPreview);
				setPreview(fixture.pinPreview);
				setRiskConfirmed(true);
				setPlan(pinPlan);
				setStep("planConfirm");
				return;
			}
			case "pinOutcome":
				setOutcome(fixture.pinOutcome);
				setStep("outcome");
				return;
			case "snapshots":
				setOutcome(fixture.pinOutcome);
				setSnapshots(fixture.snapshots);
				setStep("snapshots");
				return;
			case "restorePreview": {
				const source =
					fixture.snapshots.snapshots.find(
						(snapshot) => snapshot.status === "applied",
					) ?? fixture.snapshots.snapshots[0];
				if (!source) {
					return;
				}
				setPreview(demoRestorePreview(source));
				setPlan(undefined);
				setRiskConfirmed(false);
				setStep("plan");
				return;
			}
			case "restoreConfirmation": {
				const restorePreview = preview();
				if (restorePreview?.kind !== "restore") {
					return;
				}
				setRiskConfirmed(true);
				setPlan(demoPlan(restorePreview));
				setStep("planConfirm");
				return;
			}
			case "restoreOutcome": {
				const restorePlan = plan();
				if (restorePlan?.kind !== "restore") {
					return;
				}
				setOutcome(demoRestoreOutcome(restorePlan));
				setStep("outcome");
			}
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
		setProviders([]);
		setSelectedProvider(undefined);
		setPreview(undefined);
		setPlan(undefined);
		setOutcome(undefined);
		setSnapshots(undefined);
		setRiskConfirmed(false);
		setAllowUnparsed(false);
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
			advanceTutorial("[data-tour='device-card']");
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
		advanceTutorial("[data-tour='confirmation']");
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
				setProviders(
					fixture.report.providers.map((provider, index) => ({
						...provider,
						providerId: `demo-provider-${index}`,
					})),
				);
				setStep("result");
				advanceTutorial("[data-tour='diagnosis-result']");
			}
			return;
		}
		try {
			const inspection = await inspectDevice(device.deviceId);
			setReport(inspection.report);
			setProviders(inspection.providers);
			setStep("result");
			advanceTutorial("[data-tour='diagnosis-result']");
		} catch (reason) {
			setError(errorFrom(reason));
			setStep("confirm");
		}
	}

	async function beginPin(provider: ProviderChoice) {
		const device = selectedDevice();
		if (!device) {
			return;
		}
		setSelectedProvider(provider);
		setRiskConfirmed(false);
		setAllowUnparsed(false);
		setError(undefined);
		try {
			const next =
				mode() === "demo"
					? demo()?.pinPreview
					: await preparePin(device.deviceId, provider.providerId, false);
			if (next) {
				setPreview(next);
				setStep("plan");
				advanceTutorial("[data-tour='plan-preview']");
			}
		} catch (reason) {
			setError(errorFrom(reason));
		}
	}

	async function confirmPreview() {
		const current = preview();
		const device = selectedDevice();
		const provider = selectedProvider();
		if (!current || !device || !provider || !riskConfirmed()) {
			return;
		}
		setBusy(true);
		setError(undefined);
		try {
			let eligible = current;
			if (
				current.kind === "pin" &&
				current.requiresUnparsedConfirmation &&
				allowUnparsed() &&
				mode() === "real"
			) {
				eligible = await preparePin(device.deviceId, provider.providerId, true);
				setPreview(eligible);
			}
			if (eligible.blockers.length > 0) {
				return;
			}
			const nextPlan =
				mode() === "demo"
					? demoPlan(eligible)
					: eligible.kind === "pin"
						? await createPinPlan(eligible.previewId)
						: await createRestorePlan(eligible.previewId);
			setPlan(nextPlan);
			setStep("planConfirm");
			advanceTutorial("[data-tour='device-write-confirm']");
		} catch (reason) {
			setError(errorFrom(reason));
		} finally {
			setBusy(false);
		}
	}

	async function applyPlan() {
		const current = plan();
		if (!current) {
			return;
		}
		setStep("applying");
		setError(undefined);
		try {
			const nextOutcome =
				mode() === "demo"
					? current.kind === "pin"
						? demo()?.pinOutcome
						: demoRestoreOutcome(current)
					: current.kind === "pin"
						? await executePinPlan(current.planId)
						: await executeRestorePlan(current.planId);
			if (nextOutcome) {
				setOutcome(nextOutcome);
				setStep("outcome");
				advanceTutorial("[data-tour='change-outcome']");
			}
		} catch (reason) {
			setError(errorFrom(reason));
			setStep("planConfirm");
		}
	}

	async function abandonPlan() {
		const current = plan();
		if (current && mode() === "real") {
			try {
				await discardChangePlan(current.planId);
			} catch (reason) {
				setError(errorFrom(reason));
				return;
			}
		}
		setPlan(undefined);
		setStep("plan");
	}

	async function openSnapshots() {
		setError(undefined);
		try {
			setSnapshots(
				mode() === "demo" ? demo()?.snapshots : await listSnapshots(),
			);
			setStep("snapshots");
			advanceTutorial("[data-tour='preview-restore']");
		} catch (reason) {
			setError(errorFrom(reason));
		}
	}

	async function beginRestore(snapshot: SnapshotRecord) {
		const device = selectedDevice();
		if (!device) {
			return;
		}
		setRiskConfirmed(false);
		setAllowUnparsed(false);
		setError(undefined);
		try {
			const next =
				mode() === "demo"
					? demoRestorePreview(snapshot)
					: await prepareRestore(device.deviceId, snapshot.snapshotId);
			setPreview(next);
			setStep("plan");
			advanceTutorial("[data-tour='risk-confirm']");
		} catch (reason) {
			setError(errorFrom(reason));
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
		<main class="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 text-fg sm:px-6 lg:px-8">
			<header class="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
				<div class="flex min-w-0 items-center gap-3">
					<img
						class="size-10 rounded-l2 shadow-xs"
						src="/app-icon.png"
						alt=""
					/>
					<strong class="truncate text-base font-semibold">
						{text().product}
					</strong>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<Button
						variant="plain"
						size="sm"
						type="button"
						disabled={tutorialActive() || connectionError()}
						onClick={() => void enterDemo(true)}
					>
						{text().startTutorial}
					</Button>
					<SegmentedControl
						label={text().theme}
						value={theme.preference()}
						disabled={themeSaving()}
						options={[
							{ value: "system", label: text().themeSystem },
							{ value: "light", label: text().themeLight },
							{ value: "dark", label: text().themeDark },
						]}
						onChange={(value) => void chooseTheme(value)}
					/>
					<label class="flex items-center gap-2 text-xs font-medium text-fg-muted">
						<span class="sr-only">{text().language}</span>
						<select
							class="min-h-9 rounded-l1 border border-border-strong bg-surface px-3 text-sm text-fg outline-none focus-visible:ring-3 focus-visible:ring-focus/35"
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
				<Notice
					tone="warning"
					class="justify-between"
					data-tour="demo-banner"
					role="status"
				>
					<strong>{text().simulated}</strong>
					<Button variant="plain" size="xs" type="button" onClick={leaveDemo}>
						{text().exitDemo}
					</Button>
				</Notice>
			</Show>

			<Show when={step() !== "welcome"}>
				<ProgressSteps label={text().progressLabel} items={progress()} />
			</Show>

			<Show when={startup()?.preferenceWarning}>
				<Notice tone="warning">
					<strong>{text().preferenceWarning}</strong>
					<span>{startup()?.preferenceWarning?.message}</span>
				</Notice>
			</Show>

			<Show when={error()}>
				<Notice tone="danger" role="alert">
					<strong>{error()?.code}</strong>
					<span>{error()?.message}</span>
				</Notice>
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
						onConfirmed={(value) => {
							setConfirmed(value);
							if (value) {
								advanceTutorial("[data-tour='run-diagnosis']");
							}
						}}
						onRun={() => void runDiagnosis()}
						onBack={() => setStep("devices")}
					/>
				</Match>
				<Match when={step() === "diagnosing"}>
					<Panel
						class="grid min-h-80 place-items-center text-center"
						aria-live="polite"
					>
						<div
							class="size-10 animate-spin rounded-full border-3 border-accent-subtle border-t-accent"
							aria-hidden="true"
						/>
						<h1 class="text-2xl font-semibold">{text().diagnosing}</h1>
					</Panel>
				</Match>
				<Match when={step() === "result" && report()}>
					<ReportPanel
						messages={text()}
						report={report() as DiagnosisReport}
						providers={providers()}
						demo={mode() === "demo"}
						onPin={(provider) => void beginPin(provider)}
						onSnapshots={() => void openSnapshots()}
						onRestart={() =>
							mode() === "demo" ? leaveDemo() : void startReal()
						}
					/>
				</Match>
				<Match when={step() === "plan" && preview()}>
					<PlanPreviewPanel
						messages={text()}
						preview={preview() as ChangePreview}
						riskConfirmed={riskConfirmed()}
						allowUnparsed={allowUnparsed()}
						busy={busy()}
						onRisk={(value) => {
							setRiskConfirmed(value);
							if (value) {
								advanceTutorial("[data-tour='create-plan']");
							}
						}}
						onAllowUnparsed={setAllowUnparsed}
						onContinue={() => void confirmPreview()}
						onBack={() =>
							setStep(preview()?.kind === "restore" ? "snapshots" : "result")
						}
					/>
				</Match>
				<Match when={step() === "planConfirm" && plan()}>
					<DeviceWriteConfirmation
						messages={text()}
						plan={plan() as ChangePlan}
						onApply={() => void applyPlan()}
						onBack={() => void abandonPlan()}
					/>
				</Match>
				<Match when={step() === "applying"}>
					<Panel
						class="grid min-h-80 place-items-center text-center"
						aria-live="polite"
					>
						<div
							class="size-10 animate-spin rounded-full border-3 border-accent-subtle border-t-accent"
							aria-hidden="true"
						/>
						<h1 class="text-2xl font-semibold">{text().applyingChange}</h1>
					</Panel>
				</Match>
				<Match when={step() === "outcome" && outcome()}>
					<OutcomePanel
						messages={text()}
						outcome={outcome() as ChangeOutcome}
						onSnapshots={() => void openSnapshots()}
						onDone={() => (mode() === "demo" ? leaveDemo() : setStep("result"))}
					/>
				</Match>
				<Match when={step() === "snapshots" && snapshots()}>
					<SnapshotsPanel
						messages={text()}
						inventory={snapshots() as SnapshotInventory}
						onRestore={(snapshot) => void beginRestore(snapshot)}
						onBack={() => setStep(outcome() ? "outcome" : "result")}
					/>
				</Match>
			</Switch>

			<footer class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-fg-muted">
				<span class="max-w-3xl">{text().safetyFooter}</span>
				<Show when={appInfo()}>
					<code>{appInfo()?.version}</code>
				</Show>
			</footer>

			<Show when={showOnboarding()}>
				<div
					class="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
					role="presentation"
				>
					<section
						class="w-full max-w-lg rounded-l3 border border-border bg-panel p-6 shadow-md"
						role="dialog"
						aria-modal="true"
						aria-labelledby="onboarding-title"
					>
						<h2 id="onboarding-title" class="text-xl font-semibold">
							{text().onboardingTitle}
						</h2>
						<p class="mt-2 text-sm leading-6 text-fg-muted">
							{text().onboardingBody}
						</p>
						<div class="mt-6 flex flex-wrap gap-3">
							<Button
								variant="solid"
								type="button"
								onClick={() => {
									setShowOnboarding(false);
									void enterDemo(true);
								}}
							>
								{text().learnWithDemo}
							</Button>
							<Button type="button" onClick={skipOnboarding}>
								{text().skipTutorial}
							</Button>
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
			<section class="mx-auto w-full max-w-4xl py-12 sm:py-18">
				<h1 class="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
					{props.messages.welcomeTitle}
				</h1>
				<p class="mt-4 max-w-3xl text-base leading-7 text-fg-muted">
					{props.messages.welcomeBody}
				</p>
				<div class="mt-7 flex flex-wrap gap-3">
					<Button
						variant="solid"
						size="lg"
						type="button"
						disabled={!props.connected}
						onClick={props.onStart}
					>
						{props.messages.startDiagnosis}
					</Button>
					<Button
						size="lg"
						type="button"
						disabled={!props.connected}
						onClick={props.onDemo}
					>
						{props.messages.openDemo}
					</Button>
				</div>
				<p
					class={cx(
						"mt-5 text-sm font-medium",
						props.connectionError
							? "text-danger-strong"
							: "text-success-strong",
					)}
				>
					{props.connectionError
						? props.messages.backendUnavailable
						: props.connected
							? props.messages.appReady
							: props.messages.backendConnecting}
				</p>
			</section>
			<section class="grid gap-4 md:grid-cols-2">
				<Card>
					<h2 class="text-lg font-semibold">{props.messages.localOnly}</h2>
					<p class="mt-2 text-sm leading-6 text-fg-muted">
						{props.messages.localOnlyBody}
					</p>
				</Card>
				<Card>
					<h2 class="text-lg font-semibold">{props.messages.safetyTitle}</h2>
					<p class="mt-2 text-sm leading-6 text-fg-muted">
						{props.messages.safetyBody}
					</p>
				</Card>
			</section>
		</>
	);
}

export type AdbOption = {
	key: string;
	adb: ValidatedAdb;
	candidate?: AdbCandidate;
	source?: AdbCandidate["source"];
	selected: boolean;
};

export function adbOptions(
	discovery: AdbDiscovery | undefined,
	selected: ValidatedAdb | undefined,
): AdbOption[] {
	const options: AdbOption[] = [];
	const seen = new Set<string>();
	let includesSelection = false;

	for (const candidate of discovery?.candidates ?? []) {
		const identity = candidate.adb.resolvedPath;
		if (seen.has(identity)) {
			continue;
		}
		seen.add(identity);
		const isSelected = selected?.resolvedPath === identity;
		includesSelection ||= isSelected;
		options.push({
			key: candidate.candidateId,
			adb: isSelected && selected ? selected : candidate.adb,
			candidate,
			source: candidate.source,
			selected: isSelected,
		});
	}

	if (selected && !includesSelection) {
		options.unshift({
			key: `selected:${selected.resolvedPath}`,
			adb: selected,
			selected: true,
		});
	}

	return options;
}

export function AdbPanel(props: {
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
	const options = () => adbOptions(props.discovery, props.selected);
	return (
		<Panel>
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="max-w-3xl">
					<Badge tone="accent">{props.messages.stepAdb}</Badge>
					<h1 class="mt-3 text-3xl font-semibold tracking-tight">
						{props.messages.adbTitle}
					</h1>
					<p class="mt-3 text-base leading-7 text-fg-muted">
						{props.messages.adbBody}
					</p>
				</div>
				<Show when={!props.demo}>
					<div class="flex flex-wrap gap-2">
						<Button
							type="button"
							disabled={props.busy}
							onClick={props.onDetect}
						>
							{props.messages.refreshAdb}
						</Button>
						<Button
							type="button"
							disabled={props.busy}
							onClick={props.onChoose}
						>
							{props.messages.chooseAdb}
						</Button>
					</div>
				</Show>
			</div>
			<Show when={props.busy}>
				<Notice class="mt-5">{props.messages.detectingAdb}</Notice>
			</Show>
			<Show when={!props.demo && props.discovery && options().length === 0}>
				<Notice tone="warning" class="mt-6 grid gap-3">
					<strong>{props.messages.adbNotFound}</strong>
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
				</Notice>
			</Show>
			<Show when={options().length > 0}>
				<div class="mt-6 grid gap-3">
					<For each={options()}>
						{(option) => (
							<Card
								class={option.selected ? "border-accent-muted" : undefined}
								data-tour={option.selected ? "adb-card" : undefined}
							>
								<Show when={option.selected}>
									<div class="mb-4 flex items-center justify-between gap-3">
										<Badge tone="accent">{props.messages.selected}</Badge>
									</div>
								</Show>
								<DataRow label={props.messages.path} value={option.adb.path} />
								<DataRow
									label={props.messages.resolvedPath}
									value={option.adb.resolvedPath}
								/>
								<DataRow
									label={props.messages.version}
									value={option.adb.version}
								/>
								<Show when={option.source}>
									{(source) => (
										<DataRow
											label={props.messages.source}
											value={candidateSourceMessage(props.messages, source())}
										/>
									)}
								</Show>
								<Button
									size="sm"
									class="mt-4"
									type="button"
									disabled={props.busy || option.selected || !option.candidate}
									onClick={() => {
										if (option.candidate) {
											props.onSelect(option.candidate);
										}
									}}
								>
									{option.selected
										? props.messages.selected
										: props.messages.useAdb}
								</Button>
							</Card>
						)}
					</For>
				</div>
			</Show>
			<div class="mt-6 flex justify-end">
				<Button
					variant="solid"
					type="button"
					data-tour="continue-adb"
					disabled={!props.selected || props.busy}
					onClick={props.onContinue}
				>
					{props.messages.continueDevices}
				</Button>
			</div>
		</Panel>
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
		<Panel>
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="max-w-3xl">
					<Badge tone="accent">{props.messages.stepDevice}</Badge>
					<h1 class="mt-3 text-3xl font-semibold tracking-tight">
						{props.messages.deviceTitle}
					</h1>
					<p class="mt-3 text-base leading-7 text-fg-muted">
						{props.messages.deviceBody}
					</p>
				</div>
				<Show when={!props.demo}>
					<Button type="button" disabled={props.busy} onClick={props.onRefresh}>
						{props.messages.refreshDevices}
					</Button>
				</Show>
			</div>
			<Show when={props.busy}>
				<Notice class="mt-5">{props.messages.loadingDevices}</Notice>
			</Show>
			<Show when={props.devices?.devices.length === 0}>
				<Notice tone="warning" class="mt-5">
					{props.messages.noDevices}
				</Notice>
			</Show>
			<div class="mt-6 grid gap-3 md:grid-cols-2">
				<For each={props.devices?.devices}>
					{(device, index) => (
						<Card data-tour={index() === 0 ? "device-card" : undefined}>
							<div class="mb-4 flex items-center justify-between gap-3">
								<strong>{device.model ?? device.serial}</strong>
								<Badge tone={device.state === "device" ? "accent" : "warning"}>
									{deviceStateMessage(props.messages, device.state)}
								</Badge>
							</div>
							<DataRow label={props.messages.serial} value={device.serial} />
							<DataRow
								label={props.messages.connection}
								value={connectionMessage(props.messages, device.connectionType)}
							/>
							<Button
								size="sm"
								class="mt-4"
								type="button"
								data-tour={index() === 0 ? "select-device" : undefined}
								disabled={device.state !== "device"}
								onClick={() => props.onSelect(device)}
							>
								{props.messages.inspectThisDevice}
							</Button>
						</Card>
					)}
				</For>
			</div>
			<div class="mt-6">
				<Button type="button" onClick={props.onBack}>
					{props.messages.back}
				</Button>
			</div>
		</Panel>
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
		<Panel data-tour="confirmation">
			<div class="max-w-3xl">
				<Badge tone="accent">{props.messages.stepConfirm}</Badge>
				<h1 class="mt-3 text-3xl font-semibold tracking-tight">
					{props.messages.confirmTitle}
				</h1>
				<p class="mt-3 text-base leading-7 text-fg-muted">
					{props.messages.confirmBody}
				</p>
			</div>
			<Show when={props.device}>
				{(device) => (
					<Card class="mt-6 grid gap-3 sm:grid-cols-2">
						<DataRow
							label={props.messages.model}
							value={device().model ?? "—"}
						/>
						<DataRow label={props.messages.serial} value={device().serial} />
						<DataRow
							label={props.messages.connection}
							value={connectionMessage(props.messages, device().connectionType)}
						/>
					</Card>
				)}
			</Show>
			<p class="mt-4 max-w-3xl text-sm leading-6 text-fg-muted">
				{props.messages.diagnosisReadOnlyNote}
			</p>
			<Checkbox
				class="mt-6"
				data-tour="confirm-check"
				checked={props.confirmed}
				onInput={(event) => props.onConfirmed(event.currentTarget.checked)}
			>
				{props.messages.confirmCheckbox}
			</Checkbox>
			<div class="mt-6 flex flex-wrap justify-between gap-3">
				<Button type="button" onClick={props.onBack}>
					{props.messages.back}
				</Button>
				<Button
					variant="solid"
					type="button"
					data-tour="run-diagnosis"
					disabled={!props.confirmed}
					onClick={props.onRun}
				>
					{props.messages.runDiagnosis}
				</Button>
			</div>
		</Panel>
	);
}

function canonicalComponentName(component: ComponentName): string {
	const serviceClass = component.serviceClass.startsWith(".")
		? `${component.packageName}${component.serviceClass}`
		: component.serviceClass;
	return `${component.packageName}/${serviceClass}`;
}

function settingContainsOnlyProvider(
	value: SettingValue,
	target: ComponentName,
): boolean {
	return (
		value.kind === "value" &&
		value.components !== null &&
		value.components.length === 1 &&
		canonicalComponentName(value.components[0]) ===
			canonicalComponentName(target)
	);
}

export function isCurrentSoleProvider(
	report: DiagnosisReport,
	provider: ProviderChoice,
): boolean {
	return (
		settingContainsOnlyProvider(
			report.credentialState.enabled.value,
			provider.component,
		) &&
		settingContainsOnlyProvider(
			report.credentialState.primary.value,
			provider.component,
		)
	);
}

export function ReportPanel(props: {
	messages: Messages;
	report: DiagnosisReport;
	providers: ProviderChoice[];
	demo: boolean;
	onPin: (provider: ProviderChoice) => void;
	onSnapshots: () => void;
	onRestart: () => void;
}) {
	return (
		<Panel data-tour="diagnosis-result">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="max-w-3xl">
					<Badge tone="accent">{props.messages.stepResult}</Badge>
					<h1 class="mt-3 text-3xl font-semibold tracking-tight">
						{props.messages.resultTitle}
					</h1>
					<p class="mt-3 text-base leading-7 text-fg-muted">
						{props.messages.resultCaution}
					</p>
				</div>
				<Badge tone={props.report.status === "complete" ? "accent" : "warning"}>
					{reportStatusMessage(props.messages, props.report.status)}
				</Badge>
			</div>
			<Show when={props.report.status === "incomplete"}>
				<Notice tone="warning" class="mt-5">
					{props.messages.incomplete}
				</Notice>
			</Show>
			<Show when={props.report.status === "unsupported"}>
				<Notice tone="warning" class="mt-5">
					{props.messages.unsupported}
				</Notice>
			</Show>
			<Card class="mt-6">
				<h2 class="text-lg font-semibold">
					{props.messages.deviceInformation}
				</h2>
				<div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
				<p class="mt-4 text-xs text-fg-muted">
					{props.messages.observed}:{" "}
					{new Date(props.report.observedAtUnixMs).toLocaleString()}
				</p>
			</Card>
			<section class="mt-6">
				<h2 class="text-lg font-semibold">
					{props.messages.registeredProviders}
				</h2>
				<Show when={props.providers.length === 0}>
					<Notice class="mt-3">{props.messages.noProviders}</Notice>
				</Show>
				<div class="mt-3 grid gap-3">
					<For each={props.providers}>
						{(provider) => {
							const currentSoleProvider = () =>
								isCurrentSoleProvider(props.report, provider);
							return (
								<Card>
									<Field label={props.messages.component}>
										<CodeValue>{provider.component.flattened}</CodeValue>
									</Field>
									<p class="mt-2 text-sm text-fg-muted">
										{provider.component.packageName}
									</p>
									<div class="mt-4 flex flex-wrap gap-2">
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
									<Button
										size="sm"
										variant={currentSoleProvider() ? "subtle" : "solid"}
										class={cx(
											"mt-4",
											currentSoleProvider() && "disabled:opacity-100",
										)}
										type="button"
										data-tour="select-provider"
										disabled={currentSoleProvider()}
										onClick={() => props.onPin(provider)}
									>
										{currentSoleProvider()
											? props.messages.currentSoleProvider
											: props.messages.previewPin}
									</Button>
								</Card>
							);
						}}
					</For>
				</div>
			</section>
			<section class="mt-6">
				<h2 class="text-lg font-semibold">{props.messages.credentialState}</h2>
				<div class="mt-3 grid gap-3">
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
			<section class="mt-6">
				<h2 class="text-lg font-semibold">{props.messages.findingsTitle}</h2>
				<div class="mt-3 grid gap-3">
					<For each={props.report.findings}>
						{(finding) => (
							<Notice
								tone={finding.severity === "warning" ? "warning" : "info"}
							>
								<div class="grid gap-1">
									<strong>
										{finding.severity === "warning"
											? props.messages.warning
											: props.messages.info}
									</strong>
									<p>{findingMessage(props.messages, finding.code)}</p>
									<Show when={finding.relatedValue}>
										<CodeValue>{finding.relatedValue}</CodeValue>
									</Show>
								</div>
							</Notice>
						)}
					</For>
				</div>
			</section>
			<div class="mt-6 flex flex-wrap justify-between gap-3">
				<Button type="button" onClick={props.onSnapshots}>
					{props.messages.snapshots}
				</Button>
				<Button variant="solid" type="button" onClick={props.onRestart}>
					{props.demo ? props.messages.exitDemo : props.messages.startOver}
				</Button>
			</div>
		</Panel>
	);
}

function PlanPreviewPanel(props: {
	messages: Messages;
	preview: ChangePreview;
	riskConfirmed: boolean;
	allowUnparsed: boolean;
	busy: boolean;
	onRisk: (value: boolean) => void;
	onAllowUnparsed: (value: boolean) => void;
	onContinue: () => void;
	onBack: () => void;
}) {
	const onlyUnparsedBlocker = () =>
		props.preview.blockers.every(
			(blocker) => blocker === "UNPARSED_CONFIRMATION_REQUIRED",
		);
	const onlyNoChangeBlocker = () =>
		props.preview.blockers.length === 1 &&
		props.preview.blockers[0] === "NO_CHANGE_REQUIRED";
	return (
		<Panel data-tour="plan-preview">
			<Badge tone="accent">{props.messages.changePlan}</Badge>
			<h1 class="mt-3 text-3xl font-semibold tracking-tight">
				{props.preview.kind === "pin"
					? props.messages.pinPreviewTitle
					: props.messages.restorePreviewTitle}
			</h1>
			<Notice tone="warning" class="mt-5">
				{props.messages.exclusiveWarning}
			</Notice>
			<div class="mt-6 grid gap-4" data-change-sections>
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
			<Show when={props.preview.blockers.length > 0}>
				<Notice
					tone={onlyNoChangeBlocker() ? "info" : "danger"}
					class="mt-5 grid gap-2"
				>
					<strong>
						{onlyNoChangeBlocker()
							? props.messages.noChangeTitle
							: props.messages.planBlocked}
					</strong>
					<ul class="list-disc pl-5">
						<For each={props.preview.blockers}>
							{(blocker) => <li>{blockerMessage(props.messages, blocker)}</li>}
						</For>
					</ul>
				</Notice>
			</Show>
			<Show when={props.preview.requiresUnparsedConfirmation}>
				<Checkbox
					class="mt-5"
					tone="danger"
					checked={props.allowUnparsed}
					onInput={(event) =>
						props.onAllowUnparsed(event.currentTarget.checked)
					}
				>
					{props.messages.allowUnparsed}
				</Checkbox>
			</Show>
			<Checkbox
				class="mt-5"
				data-tour="risk-confirm"
				checked={props.riskConfirmed}
				onInput={(event) => props.onRisk(event.currentTarget.checked)}
			>
				{props.messages.confirmChangeRisk}
			</Checkbox>
			<div class="mt-6 flex flex-wrap justify-between gap-3">
				<Button type="button" onClick={props.onBack}>
					{props.messages.back}
				</Button>
				<Button
					variant="solid"
					type="button"
					data-tour="create-plan"
					disabled={
						props.busy ||
						!props.riskConfirmed ||
						(props.preview.requiresUnparsedConfirmation &&
							!props.allowUnparsed) ||
						(props.preview.blockers.length > 0 && !onlyUnparsedBlocker())
					}
					onClick={props.onContinue}
				>
					{props.messages.createPlan}
				</Button>
			</div>
		</Panel>
	);
}

export function ChangeRow(props: {
	label: string;
	before: string;
	after: string;
	messages: Messages;
}) {
	return (
		<Card class="grid gap-4" data-setting-section={props.label}>
			<h2 class="font-mono text-base font-semibold [overflow-wrap:anywhere]">
				{props.label}
			</h2>
			<Field label={props.messages.before}>
				<CodeValue data-change-value="before">{props.before}</CodeValue>
			</Field>
			<Field label={props.messages.after}>
				<CodeValue data-change-value="after">{props.after}</CodeValue>
			</Field>
		</Card>
	);
}

function DeviceWriteConfirmation(props: {
	messages: Messages;
	plan: ChangePlan;
	onApply: () => void;
	onBack: () => void;
}) {
	return (
		<Panel data-tour="device-write-confirm">
			<Badge tone="warning">{props.messages.finalConfirmation}</Badge>
			<h1 class="mt-3 text-3xl font-semibold tracking-tight">
				{props.messages.confirmDeviceWrite}
			</h1>
			<div class="mt-6 grid gap-4 sm:grid-cols-2">
				<DataRow label={props.messages.model} value={props.plan.device.model} />
				<DataRow
					label={props.messages.serial}
					value={props.plan.device.serial}
				/>
				<DataRow
					label={props.messages.foregroundUser}
					value={String(props.plan.androidUser.id)}
				/>
				<DataRow
					label={props.messages.component}
					value={props.plan.target.flattened}
				/>
			</div>
			<Notice tone="warning" class="mt-5">
				{props.messages.expiresAt}:{" "}
				{new Date(props.plan.expiresAtUnixMs).toLocaleTimeString()}
			</Notice>
			<div class="mt-6 flex flex-wrap justify-between gap-3">
				<Button type="button" onClick={props.onBack}>
					{props.messages.back}
				</Button>
				<Button
					tone="danger"
					variant="solid"
					type="button"
					data-tour="apply-change"
					onClick={props.onApply}
				>
					{props.plan.kind === "pin"
						? props.messages.applyPin
						: props.messages.applyRestore}
				</Button>
			</div>
		</Panel>
	);
}

function OutcomePanel(props: {
	messages: Messages;
	outcome: ChangeOutcome;
	onSnapshots: () => void;
	onDone: () => void;
}) {
	return (
		<Panel data-tour="change-outcome">
			<Badge
				tone={props.outcome.status === "recoveryFailed" ? "danger" : "accent"}
			>
				{props.messages.changeOutcome}
			</Badge>
			<h1 class="mt-3 text-3xl font-semibold tracking-tight">
				{props.messages.outcomeStatus}:{" "}
				{outcomeStatusMessage(props.messages, props.outcome.status)}
			</h1>
			<div class="mt-6">
				<DataRow
					label={props.messages.snapshotId}
					value={props.outcome.snapshotId}
				/>
			</div>
			<div class="mt-5 grid gap-3">
				<For each={[...props.outcome.steps, ...props.outcome.recoverySteps]}>
					{(step) => (
						<Card class="flex flex-wrap items-center justify-between gap-3">
							<code class="[overflow-wrap:anywhere]">{step.key}</code>
							<Badge tone={step.success ? "accent" : "danger"}>
								{step.success ? props.messages.verified : step.error}
							</Badge>
						</Card>
					)}
				</For>
			</div>
			<div class="mt-6 flex flex-wrap justify-between gap-3">
				<Button
					type="button"
					data-tour="open-snapshots"
					onClick={props.onSnapshots}
				>
					{props.messages.snapshots}
				</Button>
				<Button variant="solid" type="button" onClick={props.onDone}>
					{props.messages.done}
				</Button>
			</div>
		</Panel>
	);
}

function SnapshotsPanel(props: {
	messages: Messages;
	inventory: SnapshotInventory;
	onRestore: (snapshot: SnapshotRecord) => void;
	onBack: () => void;
}) {
	return (
		<Panel>
			<Badge tone="accent">{props.messages.snapshots}</Badge>
			<h1 class="mt-3 text-3xl font-semibold tracking-tight">
				{props.messages.snapshotHistory}
			</h1>
			<Show when={props.inventory.snapshots.length === 0}>
				<Notice class="mt-5">{props.messages.noSnapshots}</Notice>
			</Show>
			<div class="mt-6 grid gap-3">
				<For each={props.inventory.snapshots}>
					{(snapshot) => (
						<Card>
							<CodeValue>{snapshot.snapshotId}</CodeValue>
							<p class="mt-3 text-sm text-fg-muted">
								{snapshot.device.model} · {snapshot.device.serial}
							</p>
							<Badge
								class="mt-3"
								tone={
									snapshot.status === "applied"
										? "accent"
										: snapshot.status === "recoveryFailed"
											? "danger"
											: "neutral"
								}
							>
								{snapshotStatusMessage(props.messages, snapshot.status)}
							</Badge>
							<Button
								size="sm"
								class="mt-4"
								type="button"
								data-tour="preview-restore"
								disabled={snapshot.status !== "applied"}
								onClick={() => props.onRestore(snapshot)}
							>
								{props.messages.previewRestore}
							</Button>
						</Card>
					)}
				</For>
			</div>
			<div class="mt-6">
				<Button type="button" onClick={props.onBack}>
					{props.messages.back}
				</Button>
			</div>
		</Panel>
	);
}

function DataRow(props: { label: string; value: string }) {
	return (
		<div class="grid min-w-0 gap-1 border-b border-border py-2 last:border-b-0">
			<span class="text-xs font-medium text-fg-muted">{props.label}</span>
			<code class="select-text text-sm [overflow-wrap:anywhere]">
				{props.value}
			</code>
		</div>
	);
}

function Flag(props: { label: string; active: boolean; messages: Messages }) {
	return (
		<Badge tone={props.active ? "accent" : "neutral"}>
			{props.label}: {props.active ? props.messages.yes : props.messages.no}
		</Badge>
	);
}

function SettingRow(props: {
	observation: SettingObservation;
	messages: Messages;
}) {
	return (
		<Card class="grid gap-2">
			<code class="font-semibold [overflow-wrap:anywhere]">
				{props.observation.key}
			</code>
			<CodeValue>
				{settingValue(props.observation.value, props.messages)}
			</CodeValue>
		</Card>
	);
}

function InstallCommand(props: {
	command: string;
	copyLabel: string;
	onCopy: () => void;
}) {
	return (
		<div class="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-l1 bg-code p-2 pl-3">
			<code class="min-w-0 select-text text-xs [overflow-wrap:anywhere]">
				{props.command}
			</code>
			<Button variant="plain" size="xs" type="button" onClick={props.onCopy}>
				{props.copyLabel}
			</Button>
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

function managedText(
	value: import("../lib/tauri").ManagedSettingValue,
	messages: Messages,
): string {
	switch (value.kind) {
		case "missing":
			return messages.missing;
		case "empty":
			return messages.empty;
		case "value":
			return value.raw;
	}
}

function demoPlan(preview: ChangePreview): ChangePlan {
	const now = Date.now();
	return {
		schemaVersion: 1,
		planId: `demo-plan-${preview.kind}`,
		snapshotId: `demo-snapshot-${preview.kind}`,
		sourceSnapshotId: preview.sourceSnapshotId,
		createdAtUnixMs: now,
		expiresAtUnixMs: now + 300_000,
		kind: preview.kind,
		device: preview.device,
		androidUser: preview.androidUser,
		target: preview.target,
		before: preview.before,
		after: preview.after,
	};
}

function demoRestorePreview(snapshot: SnapshotRecord): ChangePreview {
	return {
		schemaVersion: 1,
		previewId: "demo-preview-restore",
		sourceSnapshotId: snapshot.snapshotId,
		kind: "restore",
		createdAtUnixMs: Date.now(),
		adb: snapshot.adb ?? {
			path: "<demo>/adb",
			resolvedPath: "<demo>/adb",
			version: "simulated",
		},
		device: snapshot.device,
		androidUser: snapshot.androidUser,
		target: snapshot.target,
		registeredProviders: [],
		before: snapshot.lastObserved ?? snapshot.intendedAfter,
		after: snapshot.before,
		requiresUnparsedConfirmation: false,
		allowUnparsed: true,
		blockers: [],
	};
}

function demoRestoreOutcome(plan: ChangePlan): ChangeOutcome {
	return {
		schemaVersion: 1,
		planId: plan.planId,
		snapshotId: plan.snapshotId,
		status: "restored",
		completedAtUnixMs: Date.now(),
		steps: [
			{ key: "credential_service_primary", success: true, error: null },
			{ key: "credential_service", success: true, error: null },
		],
		recoverySteps: [],
		observed: plan.after,
	};
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

export function progressItems(
	step: WorkflowStep,
	restore: boolean,
	messages: Messages,
): ProgressItem[] {
	const current = progressIndex(step);
	const labels = [
		messages.progressConnect,
		messages.progressDevice,
		messages.progressDiagnosis,
		restore ? messages.progressRestore : messages.progressChange,
		messages.progressComplete,
	];
	return labels.map((label, index) => ({
		label,
		state:
			index < current
				? "completed"
				: index === current
					? "current"
					: "upcoming",
	}));
}

function progressIndex(step: WorkflowStep): number {
	switch (step) {
		case "welcome":
		case "adb":
			return 0;
		case "devices":
			return 1;
		case "confirm":
		case "diagnosing":
		case "result":
			return 2;
		case "plan":
		case "planConfirm":
		case "applying":
		case "snapshots":
			return 3;
		case "outcome":
			return 4;
	}
}

function reportStatusMessage(
	messages: Messages,
	status: DiagnosisReport["status"],
): string {
	return messages.reportStatuses[status];
}

function deviceStateMessage(
	messages: Messages,
	state: DeviceChoice["state"],
): string {
	return messages.deviceStates[state];
}

function connectionMessage(
	messages: Messages,
	type: DeviceChoice["connectionType"],
): string {
	return messages.connectionTypes[type];
}

function candidateSourceMessage(
	messages: Messages,
	source: AdbCandidate["source"],
): string {
	return messages.candidateSources[source];
}

function snapshotStatusMessage(
	messages: Messages,
	status: SnapshotRecord["status"],
): string {
	return messages.snapshotStatuses[status];
}

function outcomeStatusMessage(
	messages: Messages,
	status: ChangeOutcome["status"],
): string {
	return messages.outcomeStatuses[status];
}

export function blockerMessage(
	messages: Messages,
	blocker: ChangeBlocker,
): string {
	return messages.changeBlockers[blocker];
}
