import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [tailwindcss(), solid()],
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
		target: ["es2022", "chrome111", "safari16.4"],
		minify: process.env.TAURI_DEBUG ? false : "oxc",
		sourcemap: Boolean(process.env.TAURI_DEBUG),
	},
});
