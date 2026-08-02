import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { createSwcCompatPlugin } from "../tauri-app/config/swc-compat.ts";
import { WEBVIEW_TARGETS } from "../tauri-app/config/webview-targets.ts";

export default defineConfig({
	base: "/webauthn/",
	plugins: [tailwindcss(), solid(), createSwcCompatPlugin()],
	server: { port: 1430, strictPort: true },
	build: { target: WEBVIEW_TARGETS, minify: "oxc" },
});
