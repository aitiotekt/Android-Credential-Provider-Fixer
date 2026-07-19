import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { createSwcCompatPlugin } from "./config/swc-compat.ts";
import { WEBVIEW_TARGETS } from "./config/webview-targets.ts";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [tailwindcss(), solid(), createSwcCompatPlugin()],
	clearScreen: false,
	server: {
		host: host || false,
		port: 1420,
		strictPort: true,
		watch: {
			ignored: ["**/src-tauri/**"],
		},
	},
	build: {
		target: WEBVIEW_TARGETS,
		minify: process.env.TAURI_DEBUG ? false : "oxc",
		sourcemap: Boolean(process.env.TAURI_DEBUG),
	},
});
