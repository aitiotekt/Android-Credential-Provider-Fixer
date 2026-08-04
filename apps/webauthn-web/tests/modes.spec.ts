import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
	await context.credentials.install();
});

for (const query of ["", "?scene=unknown"]) {
	test(`generic entry defaults to exploration: ${query || "no scene"}`, async ({
		page,
	}) => {
		await page.goto(`./${query}`);
		await page.getByRole("combobox").selectOption("en");
		await expect(
			page.getByRole("button", { name: "Explore", exact: true }),
		).toHaveAttribute("aria-pressed", "true");
		await expect(
			page.getByRole("textbox", { name: "Username", exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Create test passkey" }),
		).toBeDisabled();
		await expect(
			page.getByRole("button", { name: "Verify test passkey" }),
		).toBeDisabled();
		await page.getByRole("checkbox").check();
		await expect(
			page.getByRole("button", { name: "Create test passkey" }),
		).toBeDisabled();
		await page.getByRole("textbox").fill("alice-test");
		await page.getByRole("button", { name: "Create test passkey" }).click();
		await expect(
			page.getByRole("heading", { name: "Success: Test passkey created" }),
		).toBeVisible();
		await page.getByRole("button", { name: "Verify test passkey" }).click();
		await expect(
			page.getByRole("heading", {
				name: "Success: Creation and signature verification succeeded",
			}),
		).toBeVisible();
		await expect(page.getByRole("textbox")).toHaveValue("alice-test");
		await expect(
			page.getByRole("button", { name: "Create test passkey" }),
		).toBeEnabled();
		await expect(
			page.getByRole("button", { name: "Verify test passkey" }),
		).toBeEnabled();
		await expect(page.locator("body")).not.toContainText("Android");
		await page.getByRole("button", { name: "Guided", exact: true }).click();
		await expect(
			page.getByRole("button", { name: "Start a new test" }),
		).toBeVisible();
		await expect(page.locator("body")).not.toContainText("Android");
	});
}

test("Android starts guided and mode switches retain the current credential", async ({
	page,
	context,
}) => {
	await page.goto("./?scene=webauthn-diagnosis-android-app");
	await page.getByRole("combobox").selectOption("en");
	await expect(
		page.getByRole("button", { name: "Guided", exact: true }),
	).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("textbox")).toHaveCount(0);
	await expect(page.locator('[aria-current="step"]')).toContainText("Create");
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await expect(page.locator('[aria-current="step"]')).toContainText("Verify");
	await page.getByRole("button", { name: "Explore", exact: true }).click();
	await expect(page.getByRole("textbox")).toHaveValue(/^WebAuthn test /);
	await expect(
		page.getByRole("button", { name: "Verify test passkey" }),
	).toBeEnabled();
	await page.getByRole("button", { name: "Guided", exact: true }).click();
	await page.getByRole("button", { name: "Verify test passkey" }).click();
	await expect(page.locator('[aria-current="step"]')).toContainText("Finish");
	await expect(page.getByRole("status")).toContainText(
		"Return to the Android app",
	);
	await expect(
		page.getByRole("button", { name: "Verify test passkey" }),
	).toHaveCount(0);
	expect(await context.credentials.get()).toHaveLength(1);
	await page.getByRole("button", { name: "Start a new test" }).click();
	await expect(page.locator('[aria-current="step"]')).toContainText("Create");
	await expect(page.getByRole("checkbox")).not.toBeChecked();
});

test("exploration uses fresh challenges and rejects a replay after success", async ({
	page,
}) => {
	await page.goto("./");
	await page.getByRole("combobox").selectOption("en");
	await page.getByRole("textbox").fill("repeat-test");
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await expect(
		page.getByRole("heading", { name: "Success: Test passkey created" }),
	).toBeVisible();
	await page.evaluate(() => {
		const original = navigator.credentials.get.bind(navigator.credentials);
		let previous: Credential | null;
		let previousChallenge: string;
		let calls = 0;
		navigator.credentials.get = async (options) => {
			const challenge = JSON.stringify(
				Array.from(
					new Uint8Array(options?.publicKey?.challenge as ArrayBuffer),
				),
			);
			if (challenge === previousChallenge) {
				throw new Error("Challenge was reused");
			}
			previousChallenge = challenge;
			if (++calls === 3) {
				return previous;
			}
			previous = await original(options);
			return previous;
		};
	});
	for (let attempt = 0; attempt < 2; attempt++) {
		await page.getByRole("button", { name: "Verify test passkey" }).click();
		await expect(
			page.getByRole("heading", {
				name: "Success: Creation and signature verification succeeded",
			}),
		).toBeVisible();
	}
	await page.getByRole("button", { name: "Verify test passkey" }).click();
	await expect(page.getByRole("alert")).toContainText("could not be verified");
});

test("editing the username, clearing, and refreshing discard the current registration", async ({
	page,
}) => {
	await page.goto("./");
	await page.getByRole("combobox").selectOption("en");
	await page.getByRole("textbox").fill("first-test");
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await expect(
		page.getByRole("button", { name: "Verify test passkey" }),
	).toBeEnabled();
	await page.getByRole("textbox").fill("second-test");
	await expect(
		page.getByRole("button", { name: "Verify test passkey" }),
	).toBeDisabled();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await expect(
		page.getByRole("button", { name: "Verify test passkey" }),
	).toBeEnabled();
	await page.getByRole("button", { name: "Clear test data" }).click();
	await expect(page.getByRole("textbox")).toHaveValue("");
	await expect(
		page.getByRole("button", { name: "Verify test passkey" }),
	).toBeDisabled();
	await page.getByRole("textbox").fill("refresh-test");
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await expect(
		page.getByRole("button", { name: "Verify test passkey" }),
	).toBeEnabled();
	await page.reload();
	await expect(page.getByRole("textbox")).toHaveValue("");
	await expect(
		page.getByRole("button", { name: /Verify test|验证测试/ }),
	).toBeDisabled();
});

test("clearing rejects late authentication and mode changes are disabled while busy", async ({
	page,
}) => {
	await page.goto("./");
	await page.getByRole("combobox").selectOption("en");
	await page.getByRole("textbox").fill("late-test");
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await expect(
		page.getByRole("button", { name: "Verify test passkey" }),
	).toBeEnabled();
	await page.evaluate(() => {
		const original = navigator.credentials.get.bind(navigator.credentials);
		navigator.credentials.get = async (options) => {
			const credential = await original(options);
			await new Promise((resolve) => setTimeout(resolve, 500));
			return credential;
		};
	});
	await page.getByRole("button", { name: "Verify test passkey" }).click();
	await expect(
		page.getByRole("button", { name: "Guided", exact: true }),
	).toBeDisabled();
	await expect(page.getByRole("textbox")).toBeDisabled();
	await page.getByRole("button", { name: "Clear test data" }).click();
	await page.waitForTimeout(700);
	await expect(
		page.getByRole("heading", { name: "Cleared: Page test data removed" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Verify test passkey" }),
	).toBeDisabled();
});

test("incomplete WebAuthn support is reported as unsupported", async ({
	page,
}) => {
	await page.goto("./?scene=webauthn-diagnosis-android-app");
	await page.getByRole("combobox").selectOption("en");
	await page.evaluate(() =>
		Object.defineProperty(globalThis, "PublicKeyCredential", {
			value: {},
			configurable: true,
		}),
	);
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await expect(page.getByRole("alert")).toContainText("does not support");
});

test("the operation deadline still rejects a late registration", async ({
	page,
}) => {
	await page.clock.install();
	await page.goto("./?scene=webauthn-diagnosis-android-app");
	await page.getByRole("combobox").selectOption("en");
	await page.evaluate(() => {
		const original = navigator.credentials.create.bind(navigator.credentials);
		navigator.credentials.create = async (options) => {
			const credential = await original(options);
			await new Promise<void>((resolve) => {
				(
					window as typeof window & { finishRegistration?: () => void }
				).finishRegistration = resolve;
			});
			return credential;
		};
	});
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await page.waitForFunction(
		() =>
			typeof (window as typeof window & { finishRegistration?: () => void })
				.finishRegistration === "function",
	);
	await page.clock.fastForward(300_001);
	await page.evaluate(() =>
		(
			window as typeof window & { finishRegistration?: () => void }
		).finishRegistration?.(),
	);
	await expect(page.getByRole("alert")).toContainText("exceeded five minutes");
	await expect(
		page.getByRole("button", { name: "Verify test passkey" }),
	).toHaveCount(0);
});

test("Chinese exploration fits a narrow dark viewport", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "dark" });
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto("./");
	await page.getByRole("combobox").selectOption("zh");
	await expect(
		page.getByRole("button", { name: "探索模式", exact: true }),
	).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("textbox").fill("测试用户");
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "创建测试通行密钥" }).click();
	await expect(
		page.getByRole("heading", { name: "成功：已创建测试通行密钥" }),
	).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
	await page.getByRole("button", { name: "验证测试通行密钥" }).click();
	await expect(page.getByRole("status")).not.toContainText("Android");
});
