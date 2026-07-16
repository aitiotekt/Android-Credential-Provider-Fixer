import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [solid()],
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
		target: ["es2022", "chrome105", "safari13"],
		minify: process.env.TAURI_DEBUG ? false : "oxc",
		sourcemap: Boolean(process.env.TAURI_DEBUG),
	},
});
