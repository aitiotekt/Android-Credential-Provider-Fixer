# Distribution and Store Preparation

## Downloads and requirements

Choose a published artifact from [GitHub Releases](https://github.com/aitiotekt/Android-Credential-Provider-Fixer/releases) that matches your operating system and architecture. Release notes and attached files determine what is actually available.

The supported desktop release targets are macOS 13.3 or newer on Apple Silicon and Intel, plus Windows x64. The macOS deployment target is aligned with the Safari 16.4-era CSS baseline required by the Tailwind CSS 4 interface. The release pipeline produces two DMGs and one NSIS installer. Stable macOS builds require Developer ID signing, Hardened Runtime, notarization, and stapling; Windows artifacts use GitHub Artifact Attestations and SHA-256 for every release channel, including alpha/beta, without Authenticode or CA credentials. They may still show Unknown Publisher or SmartScreen warnings. Alpha and beta macOS builds also follow the explicit metadata policy, and a signing failure never falls back to unsigned output.

Native CLI archives are built for macOS ARM64/x64, Windows x64, and Linux GNU ARM64/x64. Linux source builds remain supported, but no AppImage, Deb, or RPM is produced because WebKitGTK and application-package portability cannot yet be guaranteed. This is a project distribution decision, not a claim that Tauri does not support Linux.

The application does not bundle ADB, drivers, or an updater. Store descriptions must disclose the external Android SDK Platform-Tools requirement at the beginning. The guided Demo lets reviewers inspect diagnosis, planning, simulated Pin, snapshots, and simulated Restore without a device; it is visibly simulated, uses a bundled fixture, and cannot execute live ADB operations.

## Verify a download

Every release includes `SHA256SUMS`, `release-manifest.json` (schema v1), and GitHub Artifact Attestations. Compare the downloaded file's SHA-256 digest with its entry in `SHA256SUMS`. To verify its build provenance with the GitHub CLI:

```sh
gh attestation verify PATH_TO_DOWNLOAD --repo aitiotekt/Android-Credential-Provider-Fixer
```

Provenance does not provide Windows Verified Publisher identity. The manifest's `signed` field describes platform code signing only.

## Release and store policy

Release candidates are tied to an exact successful Tests run and source SHA. The release branch may publish only alpha/beta versions; stable versions require an exact version tag, a protected approval, and mandatory macOS signing/notarization. Windows also requires provenance and checksum generation for stable releases. The manifest `signed` field remains false for Windows because it records platform signing, not provenance. The workflow does not imply that an artifact has already been published: availability and its signed/notarized state must be read from the corresponding GitHub Release.

The documentation site is deployed from `main` to [acp-fixer.aitiotekt.com](https://acp-fixer.aitiotekt.com/). Desktop application stores, MSI/MSIX, macOS universal binaries, Linux GUI packages, automatic updates, and package registries remain out of scope. The Android companion has an independent store-only release process; see the [WebAuthn companion guide](005-WEBAUTHN-DIAGNOSIS.md#development-and-release). Release preparation commands belong in [Contributing](CONTRIBUTING.md#release-maintenance), and past changes in the [changelog](CHANGELOG.md).

[English](004-DISTRIBUTION-AND-STORE.md) | [中文](../zh/004-DISTRIBUTION-AND-STORE.md)
