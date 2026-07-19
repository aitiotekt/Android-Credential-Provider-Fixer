import swc, { type Options } from "unplugin-swc";
import { WEBVIEW_SWC_TARGETS } from "./webview-targets.ts";

type SwcParserConfig = NonNullable<NonNullable<Options["jsc"]>["parser"]>;

// SWC supports this parser switch, but @swc/types does not expose it yet.
const parser = {
	syntax: "typescript",
	tsx: true,
	explicitResourceManagement: true,
} as SwcParserConfig & { explicitResourceManagement: true };

const SWC_COMPAT_OPTIONS = {
	jsc: {
		parser,
	},
	env: {
		targets: WEBVIEW_SWC_TARGETS,
		mode: "usage",
		coreJs: "3.50",
		shippedProposals: true,
	},
	include: ["**/*.{js,jsx,ts,tsx}"],
	exclude: ["**/node_modules/**"],
} satisfies Options;

export function createSwcCompatPlugin() {
	return swc.vite(SWC_COMPAT_OPTIONS);
}
