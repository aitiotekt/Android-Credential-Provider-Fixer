# Supported Devices and Troubleshooting

## Planned support

| Environment | Status |
| --- | --- |
| Android 14 / API 34 and newer | Planned supported range |
| Xiaomi HyperOS | Initial validated environment |
| Other OEM devices | Read-only diagnosis first; writes require an experimental warning |
| Android 13 and older | Device information only; repair unsupported |
| Work profiles and secondary users | Detect and explain; v1 modifies only the explicit foreground user |

## Typical symptoms

- A password manager is shown as preferred, but Google Password Manager handles passkey creation.
- Autofill works while Credential Manager does not bind the provider.
- Removing another provider makes a WebAuthn action appear unresponsive.
- `credential_service_primary` names a provider that is absent from `credential_service`.

These symptoms do not by themselves identify the faulty component. Registration, enabled state, primary state, autofill state, browser behavior, provider lock state, and OEM framework behavior are separate facts.

## Low-risk checks

Update the password manager, browser, and system components; enter provider settings through the password manager's supported settings flow; toggle the selection away and back; restart the device; unlock the provider once; then retry both passkey creation and sign-in. Do not delete existing passkeys as a troubleshooting step.

When ADB is missing, the future UI will show copyable installation instructions and the official Platform-Tools link. It will not run Homebrew, Winget, Scoop, or Chocolatey. Unauthorized devices require unlocking the phone and accepting the USB debugging prompt; offline devices should be reconnected before restarting any ADB service.

[English](003-SUPPORT-AND-TROUBLESHOOTING.md) | [中文](../zh/003-SUPPORT-AND-TROUBLESHOOTING.md)
