import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [solid()],
	test: {
		environment: "jsdom",
		environmentOptions: {
			jsdom: { url: "http://localhost:1420" },
		},
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		setupFiles: ["./src/test/setup.ts"],
	},
});
