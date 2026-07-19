import { type Messages } from "../i18n/translations";
import {
	type AdbCandidate,
	type AdbDiscovery,
	type AdbSelection,
	type ChangeBlocker,
	type ComponentName,
	type DiagnosisReport,
	type ProviderChoice,
	type SettingValue,
	type ValidatedAdb,
} from "../lib/tauri";
import { type ProgressItem } from "../ui/primitives";
import { type WorkflowView } from "./workflow";

export type AdbOption = {
	key: string;
	adb: ValidatedAdb;
	candidate?: AdbCandidate;
	source?: AdbCandidate["source"];
	selected: boolean;
};

export function adbOptions(
	discovery: AdbDiscovery | undefined,
	selected: AdbSelection | undefined,
): AdbOption[] {
	const options: AdbOption[] = [];
	const seen = new Set<string>();
	let includesSelection = false;
	const selectionBelongsToDiscovery = Boolean(
		selected &&
			(!discovery ||
				selected.discoveryId === discovery.discoveryId ||
				(selected.discoveryId === null &&
					selected.sessionRevision >= discovery.sessionRevision)),
	);
	for (const candidate of discovery?.candidates ?? []) {
		const identity = candidate.adb.resolvedPath;
		if (seen.has(identity)) {
			continue;
		}
		seen.add(identity);
		const isSelected =
			selectionBelongsToDiscovery && selected?.adb.resolvedPath === identity;
		includesSelection ||= isSelected;
		options.push({
			key: candidate.candidateId,
			adb: isSelected && selected ? selected.adb : candidate.adb,
			candidate,
			source: candidate.source,
			selected: isSelected,
		});
	}
	if (selected && selectionBelongsToDiscovery && !includesSelection) {
		options.unshift({
			key: `selected:${selected.selectionId}`,
			adb: selected.adb,
			selected: true,
		});
	}
	return options;
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

export function blockerMessage(
	messages: Messages,
	blocker: ChangeBlocker,
): string {
	return messages.changeBlockers[blocker];
}

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

export function workflowStep(view: WorkflowView): WorkflowStep {
	switch (view.kind) {
		case "adb":
			return "adb";
		case "devices":
			return "devices";
		case "confirmation":
			return "confirm";
		case "diagnosing":
		case "diagnosisError":
			return "diagnosing";
		case "result":
			return "result";
		case "preview":
			return "plan";
		case "plan":
			return "planConfirm";
		case "applying":
			return "applying";
		case "outcome":
			return "outcome";
		case "snapshots":
			return "snapshots";
	}
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
