import { type JSX } from "@solidjs/web";
import { For, omit, type ParentProps } from "solid-js";

export function cx(...classes: unknown[]) {
	return classes
		.filter((value): value is string => typeof value === "string")
		.join(" ");
}

export type ControlSize = "xs" | "sm" | "md" | "lg" | "xl";
export type ControlVariant =
	| "solid"
	| "subtle"
	| "surface"
	| "outline"
	| "plain";

const controlSizes: Record<ControlSize, string> = {
	xs: "min-h-8 px-3 text-xs",
	sm: "min-h-9 px-3.5 text-sm",
	md: "min-h-10 px-4 text-sm",
	lg: "min-h-11 px-5 text-base",
	xl: "min-h-12 px-6 text-base",
};

const controlVariants: Record<ControlVariant, string> = {
	solid:
		"border-accent bg-accent text-accent-contrast shadow-xs hover:bg-accent-hover active:bg-accent-active",
	subtle:
		"border-transparent bg-accent-subtle text-accent-strong hover:bg-accent-muted active:bg-accent-subtle",
	surface:
		"border-border-strong bg-surface text-fg shadow-xs hover:border-accent-muted hover:bg-surface-hover",
	outline:
		"border-border-strong bg-transparent text-fg hover:border-accent-muted hover:bg-surface-hover",
	plain:
		"border-transparent bg-transparent text-fg-muted hover:bg-surface-hover hover:text-fg",
};

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
	size?: ControlSize;
	variant?: ControlVariant;
	tone?: "accent" | "danger";
};

export function Button(props: ParentProps<ButtonProps>) {
	const buttonProps = omit(
		props,
		"size",
		"variant",
		"tone",
		"class",
		"children",
	);
	const tone = () =>
		props.tone === "danger"
			? "border-danger bg-danger text-danger-contrast hover:bg-danger-hover active:bg-danger-active"
			: controlVariants[props.variant ?? "surface"];
	return (
		<button
			{...buttonProps}
			class={cx(
				"inline-flex cursor-pointer items-center justify-center gap-2 rounded-l1 border font-semibold transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-focus/35 disabled:cursor-not-allowed disabled:opacity-45",
				controlSizes[props.size ?? "md"],
				tone(),
				props.class,
			)}
		>
			{props.children}
		</button>
	);
}

export function IconButton(
	props: ParentProps<ButtonProps & { label: string }>,
) {
	const buttonProps = omit(props, "label", "children", "class");
	return (
		<Button
			{...buttonProps}
			aria-label={props.label}
			title={props.label}
			class={cx("aspect-square px-0", props.class)}
		>
			{props.children}
		</Button>
	);
}

export function Panel(props: ParentProps<JSX.HTMLAttributes<HTMLElement>>) {
	const panelProps = omit(props, "class", "children");
	return (
		<section
			{...panelProps}
			class={cx(
				"rounded-l3 border border-border bg-panel p-5 shadow-md sm:p-6 lg:p-8",
				props.class,
			)}
		>
			{props.children}
		</section>
	);
}

export function Card(props: ParentProps<JSX.HTMLAttributes<HTMLElement>>) {
	const cardProps = omit(props, "class", "children");
	return (
		<article
			{...cardProps}
			class={cx(
				"rounded-l2 border border-border bg-surface p-4 shadow-xs sm:p-5",
				props.class,
			)}
		>
			{props.children}
		</article>
	);
}

type BadgeTone = "accent" | "warning" | "danger" | "neutral";

export function Badge(
	props: ParentProps<
		JSX.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }
	>,
) {
	const badgeProps = omit(props, "tone", "class", "children");
	const tones: Record<BadgeTone, string> = {
		accent: "bg-accent-subtle text-accent-strong",
		warning: "bg-warning-subtle text-warning-strong",
		danger: "bg-danger-subtle text-danger-strong",
		neutral: "bg-surface-hover text-fg-muted",
	};
	return (
		<span
			{...badgeProps}
			class={cx(
				"inline-flex min-h-6 w-fit items-center rounded-full px-2.5 text-xs font-semibold",
				tones[props.tone ?? "neutral"],
				props.class,
			)}
		>
			{props.children}
		</span>
	);
}

type NoticeTone = "info" | "warning" | "danger" | "success";

export function Notice(
	props: ParentProps<
		JSX.HTMLAttributes<HTMLDivElement> & { tone?: NoticeTone }
	>,
) {
	const noticeProps = omit(props, "tone", "class", "children");
	const tones: Record<NoticeTone, string> = {
		info: "border-info-border bg-info-subtle text-info-strong",
		warning: "border-warning-border bg-warning-subtle text-warning-strong",
		danger: "border-danger-border bg-danger-subtle text-danger-strong",
		success: "border-success-border bg-success-subtle text-success-strong",
	};
	return (
		<div
			{...noticeProps}
			class={cx(
				"flex flex-wrap items-start gap-2 rounded-l2 border px-4 py-3 text-sm leading-6",
				tones[props.tone ?? "info"],
				props.class,
			)}
		>
			{props.children}
		</div>
	);
}

export function Field(
	props: ParentProps<JSX.HTMLAttributes<HTMLDivElement> & { label: string }>,
) {
	const fieldProps = omit(props, "label", "class", "children");
	return (
		<div {...fieldProps} class={cx("grid gap-1.5", props.class)}>
			<span class="text-xs font-medium text-fg-muted">{props.label}</span>
			{props.children}
		</div>
	);
}

export function Checkbox(
	props: ParentProps<
		Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "type"> & {
			tone?: "neutral" | "danger";
		}
	>,
) {
	const inputProps = omit(props, "tone", "class", "children");
	return (
		<label
			class={cx(
				"flex cursor-pointer items-start gap-3 rounded-l2 border p-4 text-sm leading-6",
				props.tone === "danger"
					? "border-warning-border bg-warning-subtle text-fg"
					: "border-border-strong bg-surface text-fg",
				props.class,
			)}
		>
			<input
				{...inputProps}
				type="checkbox"
				class="mt-0.5 size-5 shrink-0 accent-accent outline-none focus-visible:ring-3 focus-visible:ring-focus/35"
			/>
			<span>{props.children}</span>
		</label>
	);
}

export type SegmentOption<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>(props: {
	label: string;
	value: T;
	options: Array<SegmentOption<T>>;
	disabled?: boolean;
	onChange: (value: T) => void;
}) {
	return (
		<fieldset class="min-w-0" disabled={props.disabled}>
			<legend class="sr-only">{props.label}</legend>
			<div
				class="inline-flex rounded-l2 border border-border-strong bg-surface p-1 shadow-xs"
				role="radiogroup"
				aria-label={props.label}
			>
				<For each={props.options}>
					{(option) => (
						<label
							class={cx(
								"relative cursor-pointer rounded-l1 px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3",
								props.value === option.value
									? "bg-accent text-accent-contrast shadow-xs"
									: "text-fg-muted hover:bg-surface-hover hover:text-fg",
							)}
						>
							<input
								type="radio"
								name="theme-preference"
								value={option.value}
								checked={props.value === option.value}
								onInput={() => props.onChange(option.value)}
								class="sr-only"
							/>
							{option.label}
						</label>
					)}
				</For>
			</div>
		</fieldset>
	);
}

export type ProgressState = "completed" | "current" | "upcoming";
export type ProgressItem = { label: string; state: ProgressState };

export function ProgressSteps(props: { label: string; items: ProgressItem[] }) {
	return (
		<nav class="overflow-x-auto py-1" aria-label={props.label}>
			<ol class="grid min-w-160 grid-cols-5 gap-2">
				<For each={props.items}>
					{(item, index) => (
						<li
							data-state={item.state}
							aria-current={item.state === "current" ? "step" : undefined}
							class={cx(
								"flex min-h-11 items-center gap-2 rounded-l2 border px-3 text-sm font-medium",
								item.state === "completed" &&
									"border-success-border bg-success-subtle text-success-strong",
								item.state === "current" &&
									"border-accent bg-accent-subtle text-accent-strong shadow-xs",
								item.state === "upcoming" &&
									"border-border bg-surface text-fg-muted",
							)}
						>
							<span
								class={cx(
									"grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold",
									item.state === "current" && "bg-accent text-accent-contrast",
									item.state === "completed" &&
										"bg-success text-success-contrast",
									item.state === "upcoming" && "bg-surface-hover text-fg-muted",
								)}
							>
								{item.state === "completed" ? "✓" : index() + 1}
							</span>
							<span>{item.label}</span>
						</li>
					)}
				</For>
			</ol>
		</nav>
	);
}

export function CodeValue(props: ParentProps<JSX.HTMLAttributes<HTMLElement>>) {
	const codeProps = omit(props, "class", "children");
	return (
		<code
			{...codeProps}
			class={cx(
				"block min-w-0 select-text [overflow-wrap:anywhere] rounded-l1 bg-code px-3 py-2 font-mono text-sm leading-6 text-fg",
				props.class,
			)}
		>
			{props.children}
		</code>
	);
}
