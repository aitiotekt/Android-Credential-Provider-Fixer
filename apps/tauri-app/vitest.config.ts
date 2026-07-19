import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";
import { createSwcCompatPlugin } from "./config/swc-compat.ts";

export default defineConfig({
	plugins: [solid(), createSwcCompatPlugin()],
	test: {
		environment: "jsdom",
		environmentOptions: {
			jsdom: { url: "http://localhost:1420" },
		},
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		setupFiles: ["./src/test/setup.ts"],
	},
});
