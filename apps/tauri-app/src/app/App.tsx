import { type Injector } from "injection-js";
import {
	createMemo,
	createSignal,
	Match,
	onCleanup,
	onSettled,
	Show,
	Switch,
	untrack,
} from "solid-js";
import { type AppService } from "../application/app-service";
import { InjectorProvider, useInjected } from "../di/context";
import {
	createRootInjector,
	createSessionScope,
	type SessionScope,
} from "../di/providers";
import {
	ADB_SERVICE,
	APP_SERVICE,
	TUTORIAL_SERVICE,
	WORKFLOW_SERVICE,
} from "../di/tokens";
import { type AdbService } from "../domain/adb";
import { type AppGateway, type DeviceGateway } from "../domain/gateways";
import { entityOf } from "../domain/resource";
import { progressItems, workflowStep } from "../domain/selectors";
import { type TutorialService } from "../domain/tutorial-service";
import { type WorkflowService } from "../domain/workflow";
import { type Messages } from "../i18n/translations";
import { createDemoDeviceGateway } from "../infrastructure/demo-gateway";
import {
	createTauriAppGateway,
	createTauriDeviceGateway,
} from "../infrastructure/tauri-gateway";
import { type ErrorEnvelope, type ThemePreference } from "../lib/tauri";
import {
	Badge,
	Button,
	Notice,
	Panel,
	ProgressSteps,
	SegmentedControl,
} from "../ui/primitives";
import {
	ApplyingView,
	ChangePreviewView,
	OutcomeView,
	PlanView,
} from "../views/change";
import {
	DiagnosingView,
	DiagnosisErrorView,
	DiagnosisView,
} from "../views/diagnosis";
import { AdbView, ConfirmationView, DeviceView } from "../views/setup";
import { ErrorNotice } from "../views/shared";
import { SnapshotsView } from "../views/snapshots";
import {
	TutorialLaunchDialog,
	type TutorialLaunchPrompt,
} from "../views/tutorial-launch";
import { WelcomeView } from "../views/welcome";

export type { WorkflowStep } from "../domain/selectors";
export {
	adbOptions,
	blockerMessage,
	isCurrentSoleProvider,
	progressItems,
} from "../domain/selectors";
export { ReportPanel } from "../views/diagnosis";
export { ChangeRow } from "../views/shared";

export type AppProps = {
	appGateway?: AppGateway;
	deviceGateway?: DeviceGateway;
};

export function App(props: AppProps = {}) {
	const root = createRootInjector(props.appGateway ?? createTauriAppGateway());
	const app = root.get(APP_SERVICE) as AppService;
	const [scope, setScope] = createSignal<SessionScope>();
	const [demo, setDemo] = createSignal(false);
	const [home, setHome] = createSignal(true);
	const [shellError, setShellError] = createSignal<ErrorEnvelope>();
	const [tutorialLaunchPrompt, setTutorialLaunchPrompt] =
		createSignal<TutorialLaunchPrompt>();
	const [sessionTransitioning, setSessionTransitioning] = createSignal(false);
	const ready = createMemo(() => {
		const resource = app.resource();
		return resource.state === "ready" ? resource : undefined;
	});
	const currentWorkflow = createMemo(() => {
		const current = scope();
		return current
			? (current.injector.get(WORKFLOW_SERVICE) as WorkflowService)
			: undefined;
	});
	const currentTutorial = createMemo(() => {
		const current = scope();
		return current
			? (current.injector.get(TUTORIAL_SERVICE) as TutorialService)
			: undefined;
	});
	const tutorialSwitchBlocked = createMemo(
		() => currentWorkflow()?.view().kind === "applying",
	);
	const tutorialActive = createMemo(() => currentTutorial()?.active() ?? false);

	onSettled(() => void app.initialize());
	onCleanup(() => {
		scope()?.[Symbol.dispose]();
		app[Symbol.dispose]();
	});

	const replaceScope = (next: SessionScope) => {
		scope()?.[Symbol.dispose]();
		setScope(next);
		setHome(false);
	};

	const startLive = async () => {
		const resource = ready();
		if (!resource || sessionTransitioning()) {
			return;
		}
		setSessionTransitioning(true);
		setShellError(undefined);
		let next: SessionScope | undefined;
		try {
			next = createSessionScope(
				root,
				props.deviceGateway ?? createTauriDeviceGateway(),
				resource.startup.adbSelection ?? undefined,
			);
			await (next.injector.get(WORKFLOW_SERVICE) as WorkflowService).start();
			setDemo(false);
			replaceScope(next);
			next = undefined;
		} catch (reason) {
			setShellError({
				code: "UNEXPECTED_ERROR",
				message: reason instanceof Error ? reason.message : String(reason),
			});
		} finally {
			next?.[Symbol.dispose]();
			setSessionTransitioning(false);
		}
	};

	const startDemo = async (guided: boolean) => {
		if (sessionTransitioning()) {
			return;
		}
		if (tutorialSwitchBlocked()) {
			setShellError({
				code: "TUTORIAL_SWITCH_UNAVAILABLE",
				message: "a device change is currently executing",
			});
			return;
		}
		setSessionTransitioning(true);
		setShellError(undefined);
		let next: SessionScope | undefined;
		try {
			const fixture = await app.loadDemoFixture();
			next = createSessionScope(root, createDemoDeviceGateway(fixture));
			const workflow = next.injector.get(WORKFLOW_SERVICE) as WorkflowService;
			const adb = next.injector.get(ADB_SERVICE) as AdbService;
			const tutorial = next.injector.get(TUTORIAL_SERVICE) as TutorialService;
			await workflow.start();
			const discovery = entityOf(adb.discovery());
			if (discovery?.candidates[0]) {
				await workflow.selectAdb(discovery.candidates[0]);
			}
			const activeWorkflow = currentWorkflow();
			if (activeWorkflow?.view().kind === "plan") {
				const cancellation = await activeWorkflow.cancelPlan();
				if (!cancellation.ok) {
					setShellError(cancellation.error);
					return;
				}
			}
			if (activeWorkflow?.view().kind === "applying") {
				setShellError({
					code: "TUTORIAL_SWITCH_UNAVAILABLE",
					message: "a device change started before the tutorial switch",
				});
				return;
			}
			setDemo(true);
			const sessionScopeId = next.id;
			replaceScope(next);
			next = undefined;
			if (guided) {
				await tutorial.start(
					app.messages(),
					(completed) => {
						void app.setOnboarding(completed ? "completed" : "skipped");
					},
					sessionScopeId,
				);
			}
		} catch (reason) {
			setShellError({
				code: "UNEXPECTED_ERROR",
				message: reason instanceof Error ? reason.message : String(reason),
			});
		} finally {
			next?.[Symbol.dispose]();
			setSessionTransitioning(false);
		}
	};

	const requestTutorial = () => {
		if (sessionTransitioning() || tutorialActive()) {
			return;
		}
		if (tutorialSwitchBlocked()) {
			setShellError({
				code: "TUTORIAL_SWITCH_UNAVAILABLE",
				message: "a device change is currently executing",
			});
			return;
		}
		if (!scope() || home()) {
			void startDemo(true);
			return;
		}
		setTutorialLaunchPrompt(demo() ? "restartDemo" : "switchLive");
	};

	const confirmTutorialLaunch = async () => {
		setTutorialLaunchPrompt(undefined);
		await startDemo(true);
	};

	const exitSession = () => {
		scope()?.[Symbol.dispose]();
		setScope(undefined);
		setDemo(false);
		setHome(true);
	};

	const setTheme = async (preference: ThemePreference) => {
		const result = await app.setTheme(preference);
		setShellError(result.ok ? undefined : result.error);
	};

	return (
		<div class="min-h-screen bg-canvas text-fg">
			<div class="mx-auto grid min-h-screen w-full max-w-7xl grid-rows-[auto_auto_1fr_auto] gap-5 px-4 py-5 sm:px-6 lg:px-8">
				<header class="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
					<div class="flex min-w-0 items-center gap-3">
						<img src="/app-icon.png" alt="" class="size-11 rounded-l2" />
						<strong class="truncate text-lg">{app.messages().product}</strong>
					</div>
					<div class="flex flex-wrap items-center justify-end gap-3">
						<Button
							variant="plain"
							disabled={
								sessionTransitioning() ||
								tutorialActive() ||
								tutorialSwitchBlocked()
							}
							title={
								tutorialSwitchBlocked()
									? app.messages().tutorialUnavailableDuringExecution
									: undefined
							}
							onClick={requestTutorial}
						>
							{app.messages().startTutorial}
						</Button>
						<SegmentedControl
							label={app.messages().theme}
							value={app.themePreference()}
							disabled={app.preferenceSaving()}
							options={[
								{ value: "system", label: app.messages().themeSystem },
								{ value: "light", label: app.messages().themeLight },
								{ value: "dark", label: app.messages().themeDark },
							]}
							onChange={(value) => void setTheme(value)}
						/>
						<select
							aria-label={app.messages().language}
							class="min-h-9 rounded-l1 border border-border-strong bg-surface px-3 text-sm"
							value={app.locale()}
							onInput={(event) =>
								app.setLocale(event.currentTarget.value as "en" | "zh")
							}
						>
							<option value="en">{app.messages().english}</option>
							<option value="zh">{app.messages().chinese}</option>
						</select>
					</div>
				</header>

				<Show keyed when={!home() ? scope() : undefined} fallback={<div />}>
					{(current) => (
						<SessionProgress
							injector={current.injector}
							messages={app.messages()}
						/>
					)}
				</Show>

				<main class="min-w-0">
					<ErrorNotice messages={app.messages()} error={shellError()} />
					<Switch>
						<Match when={app.resource().state === "loading"}>
							<Panel>
								<p>{app.messages().backendConnecting}</p>
							</Panel>
						</Match>
						<Match when={app.resource().state === "failed"}>
							<Panel>
								<Notice tone="danger">
									{app.messages().backendUnavailable}
								</Notice>
							</Panel>
						</Match>
						<Match when={home() || !scope()}>
							<WelcomeView
								messages={app.messages()}
								onStart={() => void startLive()}
								onDemo={() => void startDemo(false)}
							/>
						</Match>
						<Match when={scope()}>
							<Show keyed when={scope()}>
								{(current) => (
									<InjectorProvider injector={current.injector}>
										<SessionView
											scopeId={current.id}
											messages={app.messages()}
											demo={demo()}
											onExit={exitSession}
										/>
									</InjectorProvider>
								)}
							</Show>
						</Match>
					</Switch>
				</main>

				<footer class="flex items-center justify-between gap-4 text-xs text-fg-subtle">
					<span>{app.messages().safetyFooter}</span>
					<Show when={ready()}>
						{(resource) => <span>{resource().info.version}</span>}
					</Show>
				</footer>
			</div>

			<Show when={ready()?.startup.onboardingStatus === null && home()}>
				<div class="fixed inset-0 z-50 grid place-items-center bg-overlay p-4">
					<Panel role="dialog" aria-modal="true" class="max-w-lg">
						<h2 class="text-2xl font-bold">{app.messages().onboardingTitle}</h2>
						<p class="mt-3 text-fg-muted">{app.messages().onboardingBody}</p>
						<div class="mt-6 flex flex-wrap gap-3">
							<Button variant="solid" onClick={() => void startDemo(true)}>
								{app.messages().learnWithDemo}
							</Button>
							<Button onClick={() => void app.setOnboarding("skipped")}>
								{app.messages().skipTutorial}
							</Button>
						</div>
					</Panel>
				</div>
			</Show>

			<Show when={tutorialLaunchPrompt()}>
				{(prompt) => (
					<TutorialLaunchDialog
						kind={prompt()}
						messages={app.messages()}
						onCancel={() => setTutorialLaunchPrompt(undefined)}
						onConfirm={() => void confirmTutorialLaunch()}
					/>
				)}
			</Show>
		</div>
	);
}

function SessionProgress(props: { injector: Injector; messages: Messages }) {
	const injector = untrack(() => props.injector);
	const workflow = injector.get<WorkflowService>(WORKFLOW_SERVICE);
	return (
		<ProgressSteps
			label={props.messages.progressLabel}
			items={progressItems(
				workflowStep(workflow.view()),
				workflow.isRestoreFlow(),
				props.messages,
			)}
		/>
	);
}

function SessionView(props: {
	scopeId: string;
	messages: Messages;
	demo: boolean;
	onExit: () => void;
}) {
	const workflow = useInjected(WORKFLOW_SERVICE);
	const tutorial = useInjected(TUTORIAL_SERVICE);
	const view = workflow.view;
	return (
		<div data-session-scope={props.scopeId} class="grid gap-4">
			<Show when={props.demo}>
				<div
					data-tour="demo-banner"
					class="flex flex-wrap items-center justify-between gap-3 rounded-l2 border border-warning-border bg-warning-subtle p-3"
				>
					<Badge tone="warning">{props.messages.simulated}</Badge>
					<Button size="sm" variant="outline" onClick={props.onExit}>
						{props.messages.exitDemo}
					</Button>
				</div>
			</Show>
			<ErrorNotice
				messages={props.messages}
				error={workflow.error() ?? tutorial.error()}
			/>
			<Switch>
				<Match when={view().kind === "adb"}>
					<AdbView messages={props.messages} demo={props.demo} />
				</Match>
				<Match when={view().kind === "devices"}>
					{() => {
						const current = view();
						return current.kind === "devices" ? (
							<DeviceView
								messages={props.messages}
								enumeration={current.enumeration}
							/>
						) : null;
					}}
				</Match>
				<Match when={view().kind === "confirmation"}>
					{() => {
						const current = view();
						return current.kind === "confirmation" ? (
							<ConfirmationView
								messages={props.messages}
								serial={current.selection.device.serial}
							/>
						) : null;
					}}
				</Match>
				<Match when={view().kind === "diagnosing"}>
					<DiagnosingView messages={props.messages} />
				</Match>
				<Match when={view().kind === "diagnosisError"}>
					{() => {
						const current = view();
						return current.kind === "diagnosisError" ? (
							<DiagnosisErrorView
								messages={props.messages}
								error={current.resource.error}
							/>
						) : null;
					}}
				</Match>
				<Match when={view().kind === "result"}>
					{() => {
						const current = view();
						return current.kind === "result" ? (
							<DiagnosisView
								messages={props.messages}
								diagnosis={current.diagnosis}
							/>
						) : null;
					}}
				</Match>
				<Match when={view().kind === "preview"}>
					{() => {
						const current = view();
						return current.kind === "preview" ? (
							<ChangePreviewView
								messages={props.messages}
								preview={current.preview}
							/>
						) : null;
					}}
				</Match>
				<Match when={view().kind === "plan"}>
					{() => {
						const current = view();
						return current.kind === "plan" ? (
							<PlanView messages={props.messages} plan={current.plan} />
						) : null;
					}}
				</Match>
				<Match when={view().kind === "applying"}>
					<ApplyingView messages={props.messages} />
				</Match>
				<Match when={view().kind === "outcome"}>
					{() => {
						const current = view();
						return current.kind === "outcome" ? (
							<OutcomeView
								messages={props.messages}
								execution={current.execution}
							/>
						) : null;
					}}
				</Match>
				<Match when={view().kind === "snapshots"}>
					{() => {
						const current = view();
						return current.kind === "snapshots" ? (
							<SnapshotsView
								messages={props.messages}
								inventory={current.inventory}
							/>
						) : null;
					}}
				</Match>
			</Switch>
		</div>
	);
}
