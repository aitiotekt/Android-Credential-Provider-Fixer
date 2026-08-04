import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
	await context.credentials.install();
});

test("an idle test remains usable after more than an hour", async ({
	page,
}) => {
	await page.clock.install();
	await page.goto("./?scene=webauthn-diagnosis-android-app");
	await page.getByRole("combobox").selectOption("en");
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await expect(
		page.getByRole("heading", { name: "Success: Test passkey created" }),
	).toBeVisible();
	await page.clock.fastForward(3_600_001);
	await expect(page.getByRole("alert")).toHaveCount(0);
	await page.getByRole("button", { name: "Verify test passkey" }).click();
	await expect(
		page.getByRole("heading", {
			name: "Success: Creation and signature verification succeeded",
		}),
	).toBeVisible();
});

test("cleared attempts cannot be resurrected by a late registration", async ({
	page,
}) => {
	await page.goto("./?scene=webauthn-diagnosis-android-app");
	await page.getByRole("combobox").selectOption("en");
	await page.evaluate(() => {
		const original = navigator.credentials.create.bind(navigator.credentials);
		navigator.credentials.create = async (options) => {
			const value = await original(options);
			await new Promise((resolve) => setTimeout(resolve, 500));
			return value;
		};
	});
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await page.getByRole("button", { name: "Clear test data" }).click();
	await page.waitForTimeout(700);
	await expect(
		page.getByRole("heading", { name: "Cleared: Page test data removed" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Verify test passkey" }),
	).toHaveCount(0);
});

for (const field of ["challenge", "origin", "crossOrigin"] as const) {
	test(`registration rejects modified ${field}`, async ({ page }) => {
		await page.goto("./?scene=webauthn-diagnosis-android-app");
		await page.getByRole("combobox").selectOption("en");
		await page.evaluate((field) => {
			const original = navigator.credentials.create.bind(navigator.credentials);
			navigator.credentials.create = async (options) => {
				const credential = (await original(options)) as PublicKeyCredential;
				const response = credential.response;
				const clientData = JSON.parse(
					new TextDecoder().decode(response.clientDataJSON),
				);
				clientData[field] = field === "crossOrigin" ? true : "mismatch";
				Object.defineProperty(response, "clientDataJSON", {
					value: new TextEncoder().encode(JSON.stringify(clientData)).buffer,
				});
				return credential;
			};
		}, field);
		await page.getByRole("checkbox").check();
		await page.getByRole("button", { name: "Create test passkey" }).click();
		await expect(page.getByRole("alert")).toContainText(
			"could not be verified",
		);
	});
}

test("register, cryptographically verify, and clear without response uploads", async ({
	page,
	context,
}) => {
	const requests: string[] = [];
	page.on("request", (request) => {
		if (
			request.method() !== "GET" ||
			!new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/)
		) {
			requests.push(request.url());
		}
	});
	await page.goto("./?scene=webauthn-diagnosis-android-app");
	await page.evaluate(() => {
		const original = navigator.credentials.create.bind(navigator.credentials);
		navigator.credentials.create = async (options) => {
			const request = options as CredentialCreationOptions;
			(
				window as typeof window & { offeredAlgorithms?: number[] }
			).offeredAlgorithms = request.publicKey?.pubKeyCredParams.map(
				({ alg }) => alg,
			);
			return original(options);
		};
	});
	await page.getByRole("combobox").selectOption("en");
	await expect(
		page.getByRole("button", { name: "Create test passkey" }),
	).toBeDisabled();
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await expect(
		page.getByRole("heading", { name: "Success: Test passkey created" }),
	).toBeVisible();
	expect(
		await page.evaluate(
			() =>
				(window as typeof window & { offeredAlgorithms?: number[] })
					.offeredAlgorithms,
		),
	).toEqual([-8, -7, -257]);
	expect(await context.credentials.get()).toHaveLength(1);
	await page.getByRole("button", { name: "Verify test passkey" }).click();
	await expect(
		page.getByRole("heading", {
			name: "Success: Creation and signature verification succeeded",
		}),
	).toBeVisible();
	expect(requests).toEqual([]);
	expect(
		await page.evaluate(() => [localStorage.length, sessionStorage.length]),
	).toEqual([0, 0]);
	await page.getByRole("button", { name: "Start a new test" }).click();
	await expect(
		page.getByRole("heading", { name: "Cleared: Page test data removed" }),
	).toBeVisible();
	// Clearing the RP is not deletion from a real password manager.
	expect(await context.credentials.get()).toHaveLength(1);
});

test("Chinese layout, refresh, and dark theme", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "dark" });
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto("./?scene=webauthn-diagnosis-android-app");
	await page.getByRole("combobox").selectOption("zh");
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
	await page.reload();
	await expect(
		page.getByRole("button", { name: /Verify test|验证测试/ }),
	).toHaveCount(0);
});

test("cancellation is recoverable and never reported as success", async ({
	page,
}) => {
	await page.goto("./?scene=webauthn-diagnosis-android-app");
	await page.getByRole("combobox").selectOption("en");
	await page.evaluate(() => {
		navigator.credentials.create = async () => {
			throw new DOMException("Cancelled", "NotAllowedError");
		};
	});
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await expect(page.getByRole("alert")).toContainText("did not complete");
	await expect(
		page.getByRole("button", { name: "Create test passkey" }),
	).toBeEnabled();
});

test("a modified signature is rejected", async ({ page }) => {
	await page.goto("./?scene=webauthn-diagnosis-android-app");
	await page.getByRole("combobox").selectOption("en");
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Create test passkey" }).click();
	await expect(
		page.getByRole("heading", { name: "Success: Test passkey created" }),
	).toBeVisible();
	await page.evaluate(() => {
		const original = navigator.credentials.get.bind(navigator.credentials);
		navigator.credentials.get = async (options) => {
			const credential = (await original(options)) as PublicKeyCredential;
			const response = credential.response as AuthenticatorAssertionResponse;
			const bytes = new Uint8Array(response.signature);
			bytes[bytes.length - 1] ^= 1;
			Object.defineProperty(response, "signature", { value: bytes.buffer });
			return credential;
		};
	});
	await page.getByRole("button", { name: "Verify test passkey" }).click();
	await expect(page.getByRole("alert")).toContainText("could not be verified");
});
