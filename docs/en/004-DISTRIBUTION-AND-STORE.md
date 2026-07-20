# Distribution and Store Preparation

The supported desktop release targets are macOS 13.3 or newer on Apple Silicon and Intel, plus Windows x64. The macOS deployment target is aligned with the Safari 16.4-era CSS baseline required by the Tailwind CSS 4 interface. The release pipeline produces two DMGs and one NSIS installer. Stable macOS builds require Developer ID signing, Hardened Runtime, notarization, and stapling; stable Windows builds require Authenticode signing and timestamping. Alpha and beta builds may be unsigned only when that policy is explicit in the versioned project metadata, and a signing failure never falls back to unsigned output.

Native CLI archives are built for macOS ARM64/x64, Windows x64, and Linux GNU ARM64/x64. Linux source builds remain supported, but no AppImage, Deb, or RPM is produced because WebKitGTK and application-package portability cannot yet be guaranteed. This is a project distribution decision, not a claim that Tauri does not support Linux.

The application does not bundle ADB, drivers, or an updater. Store descriptions must disclose the external Android SDK Platform-Tools requirement at the beginning. The guided Demo lets reviewers inspect diagnosis, planning, simulated Pin, snapshots, and simulated Restore without a device; it is visibly simulated, uses a bundled fixture, and cannot execute live ADB operations.

Version `0.1.0-alpha.6` adds the release and documentation workflows. Every Release contains `SHA256SUMS`, a schema-v1 build manifest, GUI/CLI third-party notices, and GitHub artifact attestations. Release candidates are tied to an exact successful Tests run and source SHA. The release branch may publish only alpha/beta versions; stable versions require an exact version tag, a protected approval, and mandatory platform signing. The workflow does not imply that an artifact has already been published: availability and its signed/notarized state must be read from the corresponding GitHub Release.

The documentation site is deployed from `main` to [acp-fixer.aitiotekt.com](https://acp-fixer.aitiotekt.com/). Application stores, MSI/MSIX, macOS universal binaries, Linux GUI packages, automatic updates, and package registries remain out of scope.

[English](004-DISTRIBUTION-AND-STORE.md) | [中文](../zh/004-DISTRIBUTION-AND-STORE.md)
