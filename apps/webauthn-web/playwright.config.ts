import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	use: {
		baseURL: "http://localhost:1430/webauthn/",
		trace: "retain-on-failure",
	},
	projects: [
		{ name: "chromium", use: { browserName: "chromium" } },
		{ name: "firefox", use: { browserName: "firefox" } },
		// Re-enable after Playwright's Linux WebKit virtual authenticator passes
		// SimpleWebAuthn's PublicKeyCredential constructor check without a local shim.
		// { name: "webkit", use: { browserName: "webkit" } },
	],
	webServer: {
		command:
			"pnpm build && pnpm exec vite preview --host localhost --port 1430 --strictPort",
		url: "http://localhost:1430/webauthn/",
		reuseExistingServer: false,
	},
});
