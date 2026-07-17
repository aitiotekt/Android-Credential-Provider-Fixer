# Supported Devices and Troubleshooting

## Current diagnostic support

| Environment | Status |
| --- | --- |
| Android 14 / API 34 and newer | Phase 1 read-only diagnosis |
| Xiaomi HyperOS | Initial investigation and Demo scenario |
| Other OEM devices | Conservative read-only diagnosis; unfamiliar values remain unparsed |
| Android 13 and older | Device information only; repair unsupported |
| Work profiles and secondary users | Phase 1 reads only the explicit foreground user |

## Typical symptoms

- A password manager is shown as preferred, but Google Password Manager handles passkey creation.
- Autofill works while Credential Manager does not bind the provider.
- Removing another provider makes a WebAuthn action appear unresponsive.
- `credential_service_primary` names a provider that is absent from `credential_service`.

These symptoms do not by themselves identify the faulty component. Registration, enabled state, primary state, autofill state, browser behavior, provider lock state, and OEM framework behavior are separate facts.

## Low-risk checks

Update the password manager, browser, and system components; enter provider settings through the password manager's supported settings flow; toggle the selection away and back; restart the device; unlock the provider once; then retry both passkey creation and sign-in. Do not delete existing passkeys as a troubleshooting step.

When ADB is missing, the UI shows copyable installation instructions. It does not run Homebrew, Winget, Scoop, or Chocolatey. Unauthorized devices require unlocking the phone and accepting the USB debugging prompt; offline devices should be reconnected before restarting any ADB service. `acp-fixer devices` exposes the same states for CLI troubleshooting.

[English](003-SUPPORT-AND-TROUBLESHOOTING.md) | [中文](../zh/003-SUPPORT-AND-TROUBLESHOOTING.md)
