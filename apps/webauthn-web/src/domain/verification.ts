import {
	type AuthenticationResponseJSON,
	type RegistrationResponseJSON,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type WebAuthnCredential,
} from "@simplewebauthn/server";
import {
	decodeAttestationObject,
	decodeClientDataJSON,
	isoBase64URL,
} from "@simplewebauthn/server/helpers";

export type RelyingParty = { origin: string; id: string };

// These algorithms cover the standard passkey key types while avoiding PQC
// algorithms that are not consistently supported by local WebCrypto runtimes.
export const SUPPORTED_ALGORITHM_IDS = [-8, -7, -257] as const;

export function relyingParty(origin: string): RelyingParty {
	const url = new URL(origin);
	if (
		origin !== "https://acp-fixer.aitiotekt.com" &&
		!(url.protocol === "http:" && url.hostname === "localhost")
	) {
		throw new Error("unsupportedOrigin");
	}
	return { origin: url.origin, id: url.hostname };
}

function requireSameOrigin(clientData: string) {
	const data = decodeClientDataJSON(clientData);
	if (data.crossOrigin || data.topOrigin) {
		throw new Error("verificationFailed");
	}
}

export async function verifyRegistration(
	response: RegistrationResponseJSON,
	challenge: string,
	rp: RelyingParty,
): Promise<WebAuthnCredential> {
	requireSameOrigin(response.response.clientDataJSON);
	// This diagnostic requests no attestation. Do not enter certificate/metadata
	// verification paths that could perform network requests or identify a vendor.
	const attestation = decodeAttestationObject(
		isoBase64URL.toBuffer(response.response.attestationObject),
	);
	if (
		attestation.get("fmt") !== "none" ||
		attestation.get("attStmt").size !== 0
	) {
		throw new Error("unsupportedAttestation");
	}
	const result = await verifyRegistrationResponse({
		response,
		expectedChallenge: challenge,
		expectedOrigin: rp.origin,
		expectedRPID: rp.id,
		requireUserVerification: true,
		supportedAlgorithmIDs: [...SUPPORTED_ALGORITHM_IDS],
	});
	if (!result.verified) {
		throw new Error("verificationFailed");
	}
	return result.registrationInfo.credential;
}

export async function verifyAuthentication(
	response: AuthenticationResponseJSON,
	credential: WebAuthnCredential,
	challenge: string,
	rp: RelyingParty,
	userId: string,
): Promise<void> {
	requireSameOrigin(response.response.clientDataJSON);
	if (
		response.id !== credential.id ||
		(response.response.userHandle != null &&
			response.response.userHandle !== userId)
	) {
		throw new Error("verificationFailed");
	}
	const result = await verifyAuthenticationResponse({
		response,
		credential,
		expectedChallenge: challenge,
		expectedOrigin: rp.origin,
		expectedRPID: rp.id,
		requireUserVerification: true,
	});
	if (!result.verified) {
		throw new Error("verificationFailed");
	}
}
