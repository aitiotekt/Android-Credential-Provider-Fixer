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
	Expired: "expired",
	VerificationFailed: "verificationFailed",
	UnsupportedOrigin: "unsupportedOrigin",
	UnsupportedAttestation: "unsupportedAttestation",
} as const;
export type TestError = (typeof TestError)[keyof typeof TestError];

export const TestStateKind = {
	Ready: "ready",
	Creating: "creating",
	Verifying: "verifying",
	Registered: "registered",
	Success: "success",
	Failed: "failed",
} as const;
export type TestStateKind = (typeof TestStateKind)[keyof typeof TestStateKind];

export type TestState =
	| { kind: typeof TestStateKind.Ready }
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
	private generation = 0;
	private credential?: WebAuthnCredential;
	private userId?: string;
	private expiresAt = 0;
	private name = "";
	private expiryTimer?: ReturnType<typeof setTimeout>;

	public constructor(
		private readonly origin: string,
		private readonly now: () => number = Date.now,
	) {}

	public clear(): void {
		this.generation++;
		WebAuthnAbortService.cancelCeremony();
		clearTimeout(this.expiryTimer);
		this.credential = undefined;
		this.userId = undefined;
		this.expiresAt = 0;
		this.name = "";
		this.resource[1]({ kind: TestStateKind.Ready });
	}

	public async register(): Promise<void> {
		this.clear();
		const token = this.generation;
		const deadline = this.now() + 300_000;
		try {
			this.requireSupport();
			const rp = relyingParty(this.origin);
			const challenge = randomId();
			this.userId = randomId();
			this.name = `WebAuthn test ${crypto.randomUUID().slice(0, 8)}`;
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
				throw new Error(TestError.Expired);
			}
			this.credential = credential;
			this.expiresAt = this.now() + 3_600_000;
			this.expiryTimer = setTimeout(() => {
				this.clear();
				this.resource[1]({
					kind: TestStateKind.Failed,
					error: TestError.Expired,
					canVerify: false,
				});
			}, 3_600_000);
			this.resource[1]({ kind: TestStateKind.Registered, name: this.name });
		} catch (error) {
			this.fail(error, token);
		}
	}

	public async authenticate(): Promise<void> {
		if (
			!this.credential ||
			!this.userId ||
			this.state().kind === TestStateKind.Verifying
		) {
			return;
		}
		const token = ++this.generation;
		const deadline = Math.min(this.now() + 300_000, this.expiresAt);
		try {
			if (this.now() >= deadline) {
				throw new Error(TestError.Expired);
			}
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
			await verifyAuthentication(response, credential, challenge, rp, userId);
			if (token !== this.generation) {
				return;
			}
			if (this.now() >= deadline) {
				throw new Error(TestError.Expired);
			}
			// A successful assertion ends the attempt. A second success requires a
			// new registration; captured responses cannot be resubmitted by the UI.
			this.credential = undefined;
			this.userId = undefined;
			this.resource[1]({ kind: TestStateKind.Success, name: this.name });
		} catch (error) {
			this.fail(error, token);
		}
	}

	public [Symbol.dispose](): void {
		this.clear();
	}

	private requireSupport(): void {
		if (
			!globalThis.isSecureContext ||
			!globalThis.PublicKeyCredential ||
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
			TestError.Expired,
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
		if (code === TestError.Expired) {
			this.clear();
		}
		this.resource[1]({
			kind: TestStateKind.Failed,
			error: code,
			canVerify: !!this.credential,
		});
	}
}
