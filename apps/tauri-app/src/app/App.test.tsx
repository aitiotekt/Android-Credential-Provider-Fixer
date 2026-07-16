import { render } from "@solidjs/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { getAppInfo } = vi.hoisted(() => ({ getAppInfo: vi.fn() }));

vi.mock("../lib/tauri", () => ({ getAppInfo }));

async function flushPromises() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("App", () => {
	let container: HTMLDivElement;
	let dispose: (() => void) | undefined;

	beforeEach(() => {
		window.localStorage.clear();
		Object.defineProperty(window.navigator, "language", {
			configurable: true,
			value: "en-US",
		});
		getAppInfo.mockReset();
		container = document.createElement("div");
		document.body.append(container);
	});

	afterEach(() => {
		dispose?.();
		container.remove();
	});

	it("renders connected metadata and switches to Chinese", async () => {
		getAppInfo.mockResolvedValue({
			productName: "Android Credential Provider Fixer",
			version: "0.1.0-alpha.1",
			developmentPhase: "engineering-baseline",
			adbOperationsEnabled: false,
		});
		dispose = render(() => <App />, container);

		await flushPromises();
		expect(container.textContent).toContain("Connected");
		expect(container.textContent).toContain("0.1.0-alpha.1");

		const select = container.querySelector("select");
		expect(select).not.toBeNull();
		if (!select) {
			return;
		}
		select.value = "zh";
		select.dispatchEvent(new Event("input", { bubbles: true }));
		await flushPromises();

		expect(container.textContent).toContain("工程基线");
		expect(window.localStorage.getItem("acp-fixer.locale")).toBe("zh");
	});

	it("shows an unavailable state when IPC fails", async () => {
		getAppInfo.mockRejectedValue(new Error("IPC unavailable"));
		dispose = render(() => <App />, container);

		await flushPromises();
		expect(container.textContent).toContain("Unavailable");
	});
});
