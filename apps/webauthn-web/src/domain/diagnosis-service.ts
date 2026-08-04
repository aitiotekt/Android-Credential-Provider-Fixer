import {
	startAuthentication,
	startRegistration,
	WebAuthnAbortService,
} from "@simplewebauthn/browser";
import { type WebAuthnCredential } from "@simplewebauthn/server";
import { createSignal } from "solid-js";
import {
	relyingParty,
	SUPPORTED_ALGORITHM_IDS,
	verifyAuthentication,
	verifyRegistration,
} from "./verification";

export const TestError = {
	Cancelled: "cancelled",
	Unsupported: "unsupported",
	TimedOut: "timedOut",
	InvalidUsername: "invalidUsername",
	VerificationFailed: "verificationFailed",
	UnsupportedOrigin: "unsupportedOrigin",
	UnsupportedAttestation: "unsupportedAttestation",
} as const;
export type TestError = (typeof TestError)[keyof typeof TestError];

export const TestMode = {
	Explore: "explore",
	Guided: "guided",
} as const;
export type TestMode = (typeof TestMode)[keyof typeof TestMode];

export const ANDROID_SCENE = "webauthn-diagnosis-android-app";

export const TestStateKind = {
	Ready: "ready",
	Cleared: "cleared",
	Creating: "creating",
	Verifying: "verifying",
	Registered: "registered",
	Success: "success",
	Failed: "failed",
} as const;
export type TestStateKind = (typeof TestStateKind)[keyof typeof TestStateKind];

export type TestState =
	| { kind: typeof TestStateKind.Ready | typeof TestStateKind.Cleared }
	| {
			kind: typeof TestStateKind.Creating | typeof TestStateKind.Verifying;
			name: string;
	  }
	| {
			kind: typeof TestStateKind.Registered | typeof TestStateKind.Success;
			name: string;
	  }
	| {
			kind: typeof TestStateKind.Failed;
			error: TestError;
			canVerify: boolean;
	  };

function randomId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

export class DiagnosisService {
	private readonly resource = createSignal<TestState>({
		kind: TestStateKind.Ready,
	});
	public readonly state = this.resource[0];
	private readonly modeSignal;
	public readonly mode;
	private readonly usernameSignal = createSignal("");
	public readonly username = this.usernameSignal[0];
	public readonly isAndroidScene: boolean;
	private generation = 0;
	private credential?: WebAuthnCredential;
	private userId?: string;
	private name = "";

	public constructor(
		private readonly origin: string,
		scene: string | null = null,
		private readonly now: () => number = Date.now,
	) {
		this.isAndroidScene = scene === ANDROID_SCENE;
		this.modeSignal = createSignal<TestMode>(
			this.isAndroidScene ? TestMode.Guided : TestMode.Explore,
		);
		this.mode = this.modeSignal[0];
	}

	public isBusy(): boolean {
		return (
			this.state().kind === TestStateKind.Creating ||
			this.state().kind === TestStateKind.Verifying
		);
	}

	public canAuthenticate(): boolean {
		return !this.isBusy() && !!this.credential;
	}

	public setMode(mode: TestMode): void {
		if (!this.isBusy()) {
			this.modeSignal[1](mode);
		}
	}

	public setUsername(username: string): void {
		if (this.isBusy() || username === this.username()) {
			return;
		}
		// A credential is bound to its original user, never to an edited label.
		this.reset();
		this.usernameSignal[1](username);
	}

	public clear(): void {
		this.reset();
		this.resource[1]({ kind: TestStateKind.Cleared });
	}

	private reset(): void {
		this.generation++;
		WebAuthnAbortService.cancelCeremony();
		this.credential = undefined;
		this.userId = undefined;
		this.name = "";
		this.usernameSignal[1]("");
		this.resource[1]({ kind: TestStateKind.Ready });
	}

	public async register(): Promise<void> {
		if (this.isBusy()) {
			return;
		}
		const username = this.username().trim();
		this.reset();
		this.usernameSignal[1](username);
		const token = this.generation;
		const deadline = this.now() + 300_000;
		try {
			this.requireSupport();
			if (
				(this.mode() === TestMode.Explore && !username) ||
				username.length > 64
			) {
				throw new Error(TestError.InvalidUsername);
			}
			const rp = relyingParty(this.origin);
			const challenge = randomId();
			this.userId = randomId();
			this.name =
				username || `WebAuthn test ${crypto.randomUUID().slice(0, 8)}`;
			this.usernameSignal[1](this.name);
			this.resource[1]({ kind: TestStateKind.Creating, name: this.name });
			// Invoke within the click task; awaiting option generation first can lose
			// Safari's user activation. No platform/vendor is selected by the app.
			const response = await startRegistration({
				optionsJSON: {
					rp: { id: rp.id, name: "WebAuthn Diagnosis" },
					user: { id: this.userId, name: this.name, displayName: this.name },
					challenge,
					timeout: 300_000,
					attestation: "none",
					pubKeyCredParams: [
						...SUPPORTED_ALGORITHM_IDS.map((alg) => ({
							type: "public-key" as const,
							alg,
						})),
					],
					authenticatorSelection: {
						residentKey: "required",
						userVerification: "required",
					},
				},
			});
			if (token !== this.generation) {
				return;
			}
			const credential = await verifyRegistration(response, challenge, rp);
			if (token !== this.generation) {
				return;
			}
			if (this.now() >= deadline) {
				throw new Error(TestError.TimedOut);
			}
			this.credential = credential;
			this.resource[1]({ kind: TestStateKind.Registered, name: this.name });
		} catch (error) {
			this.fail(error, token);
		}
	}

	public async authenticate(): Promise<void> {
		if (!this.credential || !this.userId || this.isBusy()) {
			return;
		}
		const token = ++this.generation;
		const deadline = this.now() + 300_000;
		try {
			const challenge = randomId();
			const rp = relyingParty(this.origin);
			const credential = this.credential;
			const userId = this.userId;
			this.resource[1]({ kind: TestStateKind.Verifying, name: this.name });
			const response = await startAuthentication({
				optionsJSON: {
					rpId: rp.id,
					challenge,
					timeout: 300_000,
					userVerification: "required",
					allowCredentials: [{ id: credential.id, type: "public-key" }],
				},
			});
			if (token !== this.generation) {
				return;
			}
			const counter = await verifyAuthentication(
				response,
				credential,
				challenge,
				rp,
				userId,
			);
			if (token !== this.generation) {
				return;
			}
			if (this.now() >= deadline) {
				throw new Error(TestError.TimedOut);
			}
			// Repeated exploration uses a fresh challenge and the last verified counter.
			this.credential = { ...credential, counter };
			this.resource[1]({ kind: TestStateKind.Success, name: this.name });
		} catch (error) {
			this.fail(error, token);
		}
	}

	public [Symbol.dispose](): void {
		this.reset();
	}

	private requireSupport(): void {
		if (
			!globalThis.isSecureContext ||
			typeof globalThis.PublicKeyCredential !== "function" ||
			!navigator.credentials ||
			window.top !== window.self
		) {
			throw new Error(TestError.Unsupported);
		}
	}

	private fail(error: unknown, token: number): void {
		if (token !== this.generation) {
			return;
		}
		console.error(`[WebAuthn] ${this.state().kind} failed`, error);
		const name = error instanceof Error ? error.name : "";
		const message = error instanceof Error ? error.message : "";
		const known = [
			TestError.TimedOut,
			TestError.InvalidUsername,
			TestError.Unsupported,
			TestError.UnsupportedOrigin,
			TestError.UnsupportedAttestation,
		] as const;
		let code: TestError =
			known.find((value) => value === message) ?? TestError.VerificationFailed;
		if (name === "NotAllowedError" || name === "AbortError") {
			code = TestError.Cancelled;
		}
		if (name === "NotSupportedError") {
			code = TestError.Unsupported;
		}
		this.resource[1]({
			kind: TestStateKind.Failed,
			error: code,
			canVerify: !!this.credential,
		});
	}
}
