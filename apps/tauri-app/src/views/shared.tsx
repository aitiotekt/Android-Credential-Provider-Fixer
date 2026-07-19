import { For, Show } from "solid-js";
import { type Messages } from "../i18n/translations";
import {
	type ErrorEnvelope,
	type ManagedSettingValue,
	type SettingValue,
} from "../lib/tauri";
import { Badge, CodeValue, Field, Notice } from "../ui/primitives";

export function localizedError(
	messages: Messages,
	error: ErrorEnvelope,
): string {
	return (
		messages.errors[error.code as keyof typeof messages.errors] ??
		messages.errors.UNEXPECTED_ERROR
	);
}

export function ErrorNotice(props: {
	messages: Messages;
	error?: ErrorEnvelope;
}) {
	return (
		<Show when={props.error}>
			{(error) => (
				<Notice
					tone="danger"
					role="alert"
					data-error-code={error().code}
					data-error-message={error().message}
				>
					<strong>{props.messages.errorTitle}</strong>
					<span>{localizedError(props.messages, error())}</span>
				</Notice>
			)}
		</Show>
	);
}

export function DataGrid(props: {
	items: Array<{ label: string; value: string }>;
}) {
	return (
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<For each={props.items}>
				{(item) => (
					<Field label={item.label}>
						<div class="border-b border-border pb-2 text-sm text-fg">
							{item.value}
						</div>
					</Field>
				)}
			</For>
		</div>
	);
}

export function BooleanBadge(props: {
	label: string;
	active: boolean;
	messages: Messages;
}) {
	return (
		<Badge tone={props.active ? "accent" : "neutral"}>
			{props.label}: {props.active ? props.messages.yes : props.messages.no}
		</Badge>
	);
}

export function settingText(value: SettingValue, messages: Messages): string {
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

export function managedText(
	value: ManagedSettingValue,
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

export function ChangeRow(props: {
	label: string;
	before: string;
	after: string;
	messages: Messages;
}) {
	return (
		<section
			data-setting-section
			class="grid gap-4 rounded-l2 border border-border bg-surface p-4 sm:p-5"
		>
			<h2 class="font-mono text-base font-semibold text-fg">{props.label}</h2>
			<Field label={props.messages.before} data-change-value>
				<CodeValue>{props.before}</CodeValue>
			</Field>
			<Field label={props.messages.after} data-change-value>
				<CodeValue>{props.after}</CodeValue>
			</Field>
		</section>
	);
}
