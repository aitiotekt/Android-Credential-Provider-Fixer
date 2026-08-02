import { defineConfig } from "vitest/config";
import { createSwcCompatPlugin } from "../tauri-app/config/swc-compat.ts";

export default defineConfig({
	plugins: [createSwcCompatPlugin()],
	test: { environment: "node", include: ["src/**/__tests__/*.test.ts"] },
});
