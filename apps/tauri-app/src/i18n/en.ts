import { type ChangeBlocker } from "../lib/tauri";

export const en = {
	language: "Language",
	english: "English",
	chinese: "中文",
	product: "Android Credential Provider Fixer",
	theme: "Appearance",
	themeSystem: "System",
	themeLight: "Light",
	themeDark: "Dark",
	simulated: "Simulated mode — no connected device is being read",
	backendConnecting: "Connecting to the local core…",
	backendUnavailable: "The local core is unavailable.",
	appReady: "The application is ready.",
	welcomeTitle: "Make hidden Credential Provider state visible.",
	welcomeBody:
		"Diagnose framework state, preview an exact change, and apply it only after an atomic snapshot and two confirmations.",
	startDiagnosis: "Start diagnosis",
	openDemo: "Explore simulated demo",
	startTutorial: "Start tutorial",
	tutorialSwitchTitle: "Switch to the guided demo?",
	tutorialSwitchBody:
		"Starting the tutorial will end the current live workflow and open an isolated simulated demo. The demo will not read or change a connected device.",
	tutorialRestartTitle: "Restart the guided demo?",
	tutorialRestartBody:
		"Starting again will reset the current simulated workflow to the first tutorial view.",
	stayInCurrentWorkflow: "Stay here",
	switchAndStartTutorial: "Switch and start tutorial",
	restartTutorial: "Restart tutorial",
	tutorialUnavailableDuringExecution:
		"Wait for the current device change to finish before opening the tutorial.",
	localOnly: "Local-only",
	localOnlyBody:
		"No analytics, uploads, bundled ADB, credential access, or silent downloads.",
	safetyTitle: "Narrow command boundary",
	safetyBody:
		"The Rust core permits only documented reads and two verified Credential Provider setting keys. There is no arbitrary terminal.",
	onboardingTitle: "Learn the workflow?",
	onboardingBody:
		"A guided simulated diagnosis explains ADB validation, explicit device selection, and conservative findings.",
	learnWithDemo: "Start guided demo",
	skipTutorial: "Skip for now",
	stepAdb: "ADB",
	stepDevice: "Device",
	stepConfirm: "Confirm",
	stepResult: "Diagnosis",
	progressLabel: "Diagnosis and change progress",
	progressConnect: "Connect",
	progressDevice: "Device",
	progressDiagnosis: "Diagnose",
	progressChange: "Change",
	progressRestore: "Restore",
	progressComplete: "Complete",
	adbTitle: "Select a validated ADB installation",
	adbBody:
		"The application uses Android SDK Platform-Tools already installed on this computer. It never downloads ADB.",
	detectingAdb: "Checking documented locations…",
	refreshAdb: "Detect again",
	chooseAdb: "Choose adb executable",
	useAdb: "Use this ADB",
	selected: "Selected",
	adbNotFound: "No valid ADB installation was found.",
	adbInstall:
		"Install Android SDK Platform-Tools, then detect again or select the adb executable.",
	continueDevices: "Continue to devices",
	path: "Path",
	resolvedPath: "Resolved path",
	version: "Version",
	source: "Source",
	deviceTitle: "Choose a device from the current ADB snapshot",
	deviceBody:
		"No device is selected automatically. Unauthorized or offline devices remain visible for troubleshooting.",
	refreshDevices: "Refresh device list",
	loadingDevices: "Reading adb devices -l…",
	noDevices: "No devices are visible to this ADB installation.",
	inspectThisDevice: "Inspect this device",
	state: "State",
	connection: "Connection",
	serial: "Device serial",
	component: "Component identifier",
	confirmTitle: "Confirm the device identity",
	confirmBody:
		"The backend will re-enumerate this serial before reading Android and Credential Provider state.",
	confirmCheckbox: "I confirm this is the Android device I intend to inspect.",
	diagnosisReadOnlyNote:
		"This diagnosis only reads the fixed device and Credential Provider state shown in this workflow. It does not change settings; any later change requires a separate preview and confirmation.",
	runDiagnosis: "Run diagnosis",
	diagnosing: "Reading Android and Credential Provider state…",
	diagnosisFailed: "Diagnosis could not be completed",
	retryDiagnosis: "Retry diagnosis",
	backToDevices: "Back to device selection",
	resultTitle: "Diagnosis results",
	resultCaution:
		"Registration and framework state do not prove passkey capability, browser compatibility, or an unlocked vault.",
	startOver: "Start over",
	exitDemo: "Exit demo",
	observed: "Observed",
	deviceInformation: "Device information",
	manufacturer: "Manufacturer",
	model: "Model",
	codename: "Codename",
	android: "Android",
	apiLevel: "API level",
	foregroundUser: "Foreground user",
	registeredProviders: "Registered Credential Providers",
	noProviders: "No registered providers were returned.",
	enabled: "Enabled",
	primary: "Primary",
	autofillPackage: "Same package as Autofill",
	credentialState: "Credential Manager state",
	setting: "Setting",
	value: "Observed value",
	missing: "Missing (`null`)",
	empty: "Empty",
	unavailable: "Unavailable",
	unknownValue: "Unknown state",
	findingsTitle: "Conservative findings",
	incomplete:
		"Some observations were unavailable or could not be parsed safely.",
	unsupported:
		"Credential Provider diagnostics require Android 14 / API 34 or newer.",
	warning: "Warning",
	info: "Information",
	yes: "Yes",
	no: "No",
	back: "Back",
	copy: "Copy",
	copied: "Copied",
	preferenceWarning: "A saved preference could not be used.",
	errorTitle: "The operation could not continue",
	errors: {
		COMMAND_INVALID: "The application rejected an invalid command request.",
		COMMAND_SPAWN_FAILED: "The required local process could not be started.",
		COMMAND_TIMEOUT: "The device command took too long and was stopped.",
		COMMAND_OUTPUT_TOO_LARGE:
			"The device returned more data than the safety limit allows.",
		COMMAND_OUTPUT_READ_FAILED: "The device command output could not be read.",
		COMMAND_WAIT_FAILED:
			"The application could not wait for the device command to finish.",
		COMMAND_TERMINATE_FAILED:
			"A timed-out device command could not be stopped cleanly.",
		ADB_NOT_FOUND: "No valid ADB installation was found.",
		ADB_NOT_EXECUTABLE:
			"The selected file is not an executable ADB installation.",
		ADB_VERSION_FAILED:
			"The selected executable did not pass ADB version validation.",
		ADB_SELECTION_STALE:
			"The ADB selection changed. Select the displayed ADB again and continue.",
		DEVICE_SELECTION_REQUIRED: "Select a device from the latest device list.",
		DEVICE_UNAUTHORIZED:
			"Android has not authorized this computer for the selected device.",
		DEVICE_OFFLINE: "The selected device is offline.",
		DEVICE_NO_PERMISSIONS:
			"This computer does not have permission to access the selected device.",
		DEVICE_CHANGED:
			"The device list changed. Refresh it and select the device again.",
		USER_QUERY_FAILED: "The current Android user could not be read.",
		PROVIDER_QUERY_FAILED: "Registered Credential Providers could not be read.",
		SETTING_READ_FAILED:
			"One or more required Android settings could not be read.",
		OUTPUT_INVALID:
			"The device returned data that could not be interpreted safely.",
		PREFERENCES_READ_FAILED: "Saved application preferences could not be read.",
		PREFERENCES_WRITE_FAILED: "The application preference could not be saved.",
		PREFERENCE_WRITE_FAILED: "The application preference could not be saved.",
		CHANGE_DIAGNOSIS_UNAVAILABLE:
			"Run a new diagnosis before preparing this change.",
		CHANGE_TARGET_NOT_REGISTERED:
			"The selected Credential Provider is no longer registered.",
		CHANGE_SETTING_UNAVAILABLE:
			"A required setting is unavailable, so this change is blocked.",
		CHANGE_SETTING_INVALID:
			"A setting value is outside the safe supported format.",
		CHANGE_CONFIRMATION_REQUIRED:
			"Confirm the unfamiliar OEM value before continuing.",
		CHANGE_NO_OP:
			"The current settings already match this Credential Provider.",
		CHANGE_PREVIEW_BLOCKED: "This change preview is no longer available.",
		CHANGE_PLAN_EXPIRED:
			"The operation plan expired. Create a new one from a fresh diagnosis.",
		CHANGE_PLAN_UNAVAILABLE:
			"The operation plan was already used or is no longer available.",
		CHANGE_STATE_CHANGED:
			"The device state changed. No write was performed; diagnose again.",
		SNAPSHOT_NOT_RESTORABLE:
			"This snapshot does not match the current device state and cannot be restored.",
		SNAPSHOT_NOT_FOUND: "The selected snapshot could not be found.",
		SNAPSHOT_STORAGE_FAILED: "The local snapshot could not be saved safely.",
		SNAPSHOT_INVALID:
			"The selected snapshot is invalid or uses an unsupported schema.",
		TUTORIAL_TARGET_UNAVAILABLE:
			"The tutorial control is not available in the current view.",
		TUTORIAL_SWITCH_UNAVAILABLE:
			"Wait for the current device change to finish before opening the tutorial.",
		SESSION_ENTITY_MISMATCH:
			"A response did not belong to the current operation. Refresh the current step before continuing.",
		UNEXPECTED_ERROR: "An unexpected application error occurred.",
	},
	safetyFooter:
		"Writes require an expiring plan, atomic snapshot, exact state recheck, read-back verification, and recovery.",
	previewPin: "Preview single-provider change",
	currentSoleProvider: "Current sole credential provider",
	snapshots: "Snapshots",
	changePlan: "Review changes",
	pinPreviewTitle: "Review single-provider change",
	restorePreviewTitle: "Review snapshot restore",
	exclusiveWarning:
		"This change replaces both enabled and primary provider state. Other fallback providers may disappear until restore.",
	planBlocked: "This preview cannot be applied",
	noChangeTitle: "No change is needed",
	allowUnparsed:
		"I understand an unfamiliar OEM value will be preserved in the snapshot but overwritten by this change.",
	confirmChangeRisk:
		"I reviewed the before and after values and understand the device-side effect.",
	createPlan: "Create five-minute operation plan",
	before: "Before",
	after: "After",
	finalConfirmation: "Final device confirmation",
	confirmDeviceWrite: "Confirm the exact device before applying",
	expiresAt: "Plan expires at",
	applyPin: "Set as the only credential provider",
	applyRestore: "Restore snapshot",
	applyingChange: "Applying and verifying the bounded change…",
	changeOutcome: "Verified change outcome",
	outcomeStatus: "Status",
	snapshotId: "Snapshot ID",
	verified: "Verified",
	stepFailed: "Not verified",
	snapshotWarning: "A snapshot record could not be used",
	done: "Finish and diagnose again",
	deviceStateChanged: "Device state changed; no write was performed",
	snapshotHistory: "Local snapshot history",
	noSnapshots: "No local snapshots are available.",
	previewRestore: "Preview restore",
	tourNext: "Next",
	tourPrevious: "Previous",
	tourDone: "Finish",
	tourProgress: "{{current}} of {{total}}",
	tourClose: "Close tutorial",
	tourTargetMissing:
		"The next tutorial control did not appear. The tutorial is still active; retry the current action or close and restart it.",
	tourDemoTitle: "A completely isolated simulation",
	tourDemoBody:
		"Every value in this walkthrough is bundled example data based on an anonymized investigation.",
	tourAdbTitle: "ADB is identified before use",
	tourAdbBody:
		"A real run validates the executable with a separate version argument and displays the exact path.",
	tourContinueTitle: "Continue with this validated ADB",
	tourContinueBody: "Click this button to reveal the current device snapshot.",
	tourDeviceTitle: "Every device state remains visible",
	tourDeviceBody:
		"Real runs distinguish ready, unauthorized, offline, and permission failures.",
	tourSelectTitle: "Selection is always explicit",
	tourSelectBody:
		"Click to choose this simulated device. The first device is never assumed.",
	tourConfirmTitle: "Confirm before device-specific reads",
	tourConfirmBody:
		"The real backend binds this screen to the latest enumeration and rechecks the serial.",
	tourRunTitle: "Only fixed read commands follow",
	tourRunBody:
		"Confirm the checkbox, then click to inspect the simulated framework state.",
	tourResultTitle: "Facts are separated from conclusions",
	tourResultBody:
		"The result shows raw settings and conservative mismatches without claiming which app or OEM is at fault.",
	tourProviderTitle: "The repair target is never assumed",
	tourProviderBody:
		"Choose one currently registered provider to preview a single-provider change.",
	tourPlanTitle: "Review the exact before and after values",
	tourPlanBody:
		"Only enabled and primary are managed; Autofill remains untouched.",
	tourRiskTitle: "Acknowledge the bounded side effect",
	tourRiskBody:
		"The selected provider becomes exclusive until the saved state is restored.",
	tourCreatePlanTitle: "Create an expiring one-use plan",
	tourCreatePlanBody:
		"Confirmation stores an atomic snapshot of the original state for five minutes.",
	tourWriteConfirmTitle: "Confirm the exact device again",
	tourWriteConfirmBody:
		"The real backend rechecks serial, user, providers, and settings before writing.",
	tourApplyTitle: "Every simulated write is verified",
	tourApplyBody:
		"A real failure triggers reverse-order automatic recovery and read-back.",
	tourOutcomeTitle: "The outcome remains auditable",
	tourOutcomeBody: "Each step and its snapshot ID are shown explicitly.",
	tourRestoreTitle: "Snapshots provide a guarded restore path",
	tourRestoreBody:
		"Restore is available only while current state still matches the state recorded after the change.",
	tourRestoreRiskBody:
		"Review the restore values and confirm them like any other device change.",
	tourRestoreApplyBody:
		"This simulated restore writes the saved original state in the safer reverse order.",
	reportStatuses: {
		complete: "Complete",
		incomplete: "Incomplete",
		unsupported: "Unsupported",
	},
	deviceStates: {
		device: "Ready",
		unauthorized: "Unauthorized",
		offline: "Offline",
		noPermissions: "No permissions",
		unknown: "Unknown",
	},
	connectionTypes: { usb: "USB", wireless: "Wireless", unknown: "Unknown" },
	candidateSources: {
		explicit: "Specified path",
		saved: "Saved preference",
		path: "PATH",
		androidHome: "ANDROID_HOME",
		androidSdkRoot: "ANDROID_SDK_ROOT",
		commonLocation: "Common location",
	},
	snapshotStatuses: {
		planned: "Planned",
		executing: "Executing",
		cancelled: "Cancelled",
		expired: "Expired",
		invalidated: "Invalidated",
		applied: "Applied",
		recovered: "Automatically recovered",
		recoveryFailed: "Recovery failed",
		restored: "Restored",
	},
	outcomeStatuses: {
		applied: "Applied and verified",
		restored: "Restored and verified",
		recovered: "Automatically recovered",
		recoveryFailed: "Automatic recovery failed",
	},
	executionStatuses: {
		applied: "Applied and verified",
		restored: "Restored and verified",
		recovered: "Automatically recovered",
		recoveryFailed: "Automatic recovery failed",
		cancelled: "Cancelled",
		expired: "Expired",
		invalidated: "Device state changed",
	},
	changeBlockers: {
		ANDROID_VERSION_UNSUPPORTED:
			"This Android version does not support Credential Provider changes.",
		DIAGNOSIS_UNAVAILABLE:
			"The current diagnosis does not contain all state required for a safe change.",
		TARGET_NOT_REGISTERED:
			"The selected credential provider is no longer registered.",
		UNPARSED_CONFIRMATION_REQUIRED:
			"An unfamiliar readable OEM value requires explicit confirmation.",
		STATE_CHANGED:
			"The device state has changed since this preview was prepared. Run the diagnosis again.",
		SNAPSHOT_NOT_RESTORABLE:
			"This snapshot cannot be restored from the device's current state.",
		NO_CHANGE_REQUIRED:
			"The current settings already match the selected credential provider. No device write or snapshot is needed.",
	} satisfies Record<ChangeBlocker, string>,
	tourDoneTitle: "The simulated state is restored",
	tourDoneBody:
		"The complete tutorial never contacted ADB or changed a connected device.",
	findings: {
		ANDROID_VERSION_UNSUPPORTED:
			"This Android version predates the platform Credential Provider API.",
		NO_REGISTERED_PROVIDER:
			"No registered Credential Provider service was returned.",
		ENABLED_PROVIDER_NOT_REGISTERED:
			"An enabled component was not present in service enumeration.",
		PRIMARY_PROVIDER_NOT_REGISTERED:
			"A primary component was not present in service enumeration.",
		PRIMARY_PROVIDER_NOT_ENABLED:
			"A primary component is absent from the enabled-provider state.",
		AUTOFILL_PROVIDER_NOT_CREDENTIAL_ENABLED:
			"The Autofill package registers a Credential Provider, but that provider is not enabled.",
		NO_ENABLED_PROVIDER: "No enabled Credential Provider is recorded.",
		NO_PRIMARY_PROVIDER: "No primary Credential Provider is recorded.",
		SETTING_VALUE_UNPARSEABLE:
			"An OEM setting value could not be parsed conservatively.",
		NO_INCONSISTENCY_DETECTED:
			"No modeled state inconsistency was detected; this is not a compatibility guarantee.",
	},
} as const;
