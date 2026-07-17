# Distribution and Store Preparation

The first supported binaries will target macOS Apple Silicon, macOS Intel, and Windows x64. GitHub Releases will contain signed installers, checksums, release notes, and signing information. macOS builds require Developer ID signing, Hardened Runtime, notarization, and stapling. Windows builds require Authenticode signing; Microsoft Store submission will prefer MSIX when compatible with the final Tauri packaging flow.

Linux source builds are allowed and tested, but no AppImage, Deb, or RPM is planned for the first release because WebKitGTK and application-package portability cannot yet be guaranteed. This is a project distribution decision, not a claim that Tauri does not support Linux.

The application does not bundle ADB, drivers, or an updater. Store descriptions must disclose the external Android SDK Platform-Tools requirement at the beginning. The Phase 1 guided Demo lets reviewers inspect the read-only workflow without a device; it is visibly simulated, uses a bundled fixture, and cannot execute live ADB operations.

Version `0.1.0-alpha.2` has CI build verification only. There is no release workflow, signing secret interface, notarization job, documentation deployment, or published installer. These are Phase 4 tasks and must not be represented as complete before signed artifacts are manually validated.

[English](004-DISTRIBUTION-AND-STORE.md) | [中文](../zh/004-DISTRIBUTION-AND-STORE.md)
