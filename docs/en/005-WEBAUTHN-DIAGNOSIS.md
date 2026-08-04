# WebAuthn Diagnosis companion

[中文](../zh/005-WEBAUTHN-DIAGNOSIS.md)

The native Android app **WebAuthn Diagnosis** (`com.aitiotekt.webauthndiagnosis`) guides the user through setup, a browser test, and a user-reported result. It does not read provider settings, enumerate installed apps, run ADB or repair a device. It supports Android 9/API 28 and later; third-party provider guidance distinguishes Android 14 and later. On Android 14+, it first opens credential provider settings through AndroidX CredentialManager, using only its own app identity. Older systems or launch failures fall back to standard system settings with explicit manual search instructions. Returning does not prove settings changed; actual OEM routing remains subject to device validation.

The [test website](/webauthn/) creates a clearly named real test passkey and then verifies an authentication signature locally. The user must explicitly agree before creation. The credential may sync through their password manager. The site does not identify the actual provider; observe the browser prompt.

## Privacy and limits

The page holds only its current random test identity, public key and challenge in memory. It does not upload WebAuthn responses or use cookies, localStorage, sessionStorage, IndexedDB or analytics. A test lasts at most one hour; an operation expires after five minutes. Refreshing, closing or clearing the page discards the test. This does **not** delete the real passkey: remove the `WebAuthn test …` entry for `acp-fixer.aitiotekt.com` in the password manager.

Static requests are served by GitHub Pages, which may process IP addresses and access logs. Password-manager synchronization follows that provider's policy. `/webauthn/` shares the documentation origin; it is not a separate RP or storage security boundary.

Verification is a browser-local diagnostic, not server authentication, proof of a provider's security, or a guarantee that other applications work. Android has no automatic result callback; its success screen means the user confirmed both website steps.

## Development and release

Android release history: [Android changelog](CHANGELOG-ANDROID.md). It is versioned separately from the desktop changelog.

The Android toolchain is JDK 26, Gradle 9.7.1, AGP 9.4.0 and Kotlin/Compose 2.4.20, using built-in Kotlin. Android Studio must support AGP 9.4 (Quail 4/2026.1.4 or later compatible). The runtime JDK does not change the application's Java/Kotlin target 17 or Android SDK levels.

Open the repository root in Android Studio. Its Gradle multi-project build maps `:webauthn-diagnosis` to the Kotlin/Compose module under `apps/android-app/app`; use the root Wrapper and root-local `local.properties` or `ANDROID_HOME` for the SDK. Android retains independent versioning and store publishing. `apps/webauthn-web` uses Solid/Tailwind with the desktop's compatibility configuration, but no desktop IPC or domain services. Java and Gradle are default mise tools locally; CI selects Android tools only in Android jobs. Use `just check-android` for JVM tests, Lint and compilation without a device, and `just check-web` for WebAuthn checks after installing Playwright browsers.

`just set-version VERSION` (or `--app default` / `--app desktop`) updates desktop/CLI and Web package versions. `--app android` changes only Android and increments versionCode for a changed version. `--version-code N` allows an explicit larger code for an Android rebuild. Android has separate bilingual changelogs; Web changes remain in the root changelog. No command moves Unreleased text automatically.

The Web workflow combines VitePress and the test SPA in one Pages artifact. Only main deploys; release and PRs validate. Android's workflow is manually triggered from main/release and defaults to `build-only`: a signed AAB is retained in Actions for 30 days, not published as an APK or GitHub Release. Metadata policy `internal` enables Play internal-test upload after artifact retention. Upload failure fails the run without deleting the AAB or blindly retrying a possibly committed release.

Maintainers must configure Play App Signing, upload-key secrets and protected `android-release` Environment; API publishing additionally needs a narrowly authorized Play service account. The first Console initialization/upload, listing, privacy/Data safety declarations and account-specific testing requirements remain manual. Store-only distribution does not prohibit developers compiling a local debug APK, but sideload distribution is not supported.

## Android device development {#android-device-development}

Start an emulator in Android Studio's Device Manager first (Android 14+ is recommended for credential provider guidance), or explicitly connect an authorized development device. Run commands through the pinned mise environment:

```sh
mise exec -- just dev-android
mise exec -- just dev-android --device emulator-5554 --no-interactive
mise exec -- just dev-android --device emulator-5554 --watch
mise exec -- just dev-android --adb "/path with spaces/platform-tools/adb" --interactive
```

The first command lists running devices, with emulators first, and prompts for a number. Even a single device requires selection. Noninteractive input requires an exact `--device` serial; unavailable, unauthorized or offline targets are rejected. `--interactive` and `--no-interactive` override the default (both stdin and stdout must be terminals). `--help` performs no discovery or device operations.

`scripts/dev-cli.mts android dev` validates ADB from the explicit path, root `local.properties`, SDK environment variables, the usual SDK location or PATH. It uses the checked-in Gradle Wrapper JAR through Java on all platforms, avoiding Windows command-string execution, to build only `:webauthn-diagnosis:assembleDebug`. It then rechecks the selected transport and foreground user, replace-installs the debug APK and starts only this application's `MainActivity`. It does not start emulators, manage ADB servers, uninstall, clear application data or alter settings. A Play-signed installation may conflict with the debug signature; deployment fails rather than silently deleting it. Use a separate development emulator in that case.

`--watch` debounces Android source/resource and Gradle configuration edits, serializes deployments, and schedules a follow-up rebuild if files change during a build. Build failures leave it watching for the next edit. It never switches to another device or user automatically; restart and select again after a transport/user change. Ctrl+C stops watching and cancels the active command. Updates replace-install and relaunch the app: process/UI state is **not** guaranteed to survive. For supported in-place Compose edits, use Android Studio [Live Edit / Apply Changes](https://developer.android.com/studio/run#apply-changes); this CLI does not emulate those IDE features. Native changes do not reload the separate WebAuthn website.

This opt-in developer deployment does not change store-only distribution. Normal checks and CI use mocks and never install or launch an application on a device.

## Acceptance status

Automated browser tests use Playwright Credentials to substitute a virtual authenticator in Chromium and Firefox. WebKit coverage is temporarily disabled until Playwright's Linux WebKit virtual authenticator passes SimpleWebAuthn's `PublicKeyCredential` constructor check without a project-specific shim. These tests validate application behavior and signature rejection, not native OS, Google or Bitwarden integration. Real integration, accessibility/lifecycle checks on devices, Play uploading and policy approval require separate maintainer validation. Ordinary checks never start ADB or create real passkeys.
