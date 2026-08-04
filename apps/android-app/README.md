# WebAuthn Diagnosis

Native Kotlin/Compose companion (`com.aitiotekt.webauthndiagnosis`). Open the **repository root** in Android Studio, not this directory. The root Gradle multi-project build maps `:webauthn-diagnosis` to `apps/android-app/app`; other platforms remain managed by pnpm/Cargo. Use the repository's mise JDK for Gradle, the root wrapper, and Android SDK 36. Set `ANDROID_HOME` or repository-root `local.properties`; never commit machine paths.

When reopening an existing checkout, close the old nested Android Studio project and open the repository root. Configure Gradle to use the Wrapper and the mise JDK 26; use the Project view to see all monorepo files. If you previously created `apps/android-app/local.properties`, move its SDK configuration to the root `local.properties`. Do not overwrite existing root settings or commit `.idea` machine configuration.

The build uses Gradle 9.7.1, AGP 9.4.0 and Kotlin/Compose compiler 2.4.20. Use Android Studio Quail 4 (2026.1.4) or a later compatible version. AGP's built-in Kotlin is enabled; the root buildscript upgrades its compiler dependency to match Compose without applying the old Kotlin Android plugin. Java/Kotlin compilation still targets 17, with minSdk 28 and compileSdk/targetSdk 36 unchanged. The Kotlin vendor's fully tested matrix currently stops below this latest stable Gradle/AGP pair; repository build checks are necessary and do not replace IDE/device validation.

From the repository root:

```sh
mise install
mise exec -- just check-android
mise exec -- just set-version VERSION --app android
mise exec -- just set-version VERSION --app android --version-code CODE
```

For direct Gradle tasks from the root, use `./gradlew :webauthn-diagnosis:assembleDebug` (Windows: `.\gradlew.bat :webauthn-diagnosis:assembleDebug`). Module outputs stay under `apps/android-app/app/build`; the release bundle is named `webauthn-diagnosis-release.aab` before staging.

The second command runs JVM tests, Lint and debug compilation, not installation. Debug APKs are developer artifacts, not a supported sideload distribution. Configure an upload key before `just build-android-release`; public distribution is Google Play only. No native WebAuthn calls, WebView, ADB or setting writes are implemented.

On Android 14+, settings navigation first uses AndroidX CredentialManager's `createSettingsPendingIntent()` with this app's own identity. Older Android versions or unavailable/cancelled/blocked launches fall back to system settings and show manual search instructions. No third-party provider package or OEM activity is hardcoded. Returning from settings never confirms a configuration change; actual emulator/OEM page routing still needs device validation.

## Store preparation

1. Create the Play Console app and enable Play App Signing. Verify account contact details and the inactive-account notice separately.
2. Keep the upload keystore backed up securely. In the protected `android-release` GitHub Environment (main/release refs only), configure `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
3. Run the **Android** workflow manually from main or release. The default metadata policy is `build-only`. Download the signed AAB and SHA256SUMS from the run; perform the first Console upload and app initialization manually.
4. Before API publishing, grant a service account only the necessary access to this application's testing releases. Store its JSON as `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` in the same Environment. Run `just set-android-publish internal` to change the reviewed repository policy; `build-only` disables upload.
5. Upload failure leaves the AAB artifact (30 days) and fails the workflow. Inspect Console after an uncertain commit before retrying. Rebuilds with different bytes need a new versionCode; do not assume a run retry can reuse an already uploaded code. There is no automatic production-track promotion.
6. Complete store listing, privacy policy, Data safety and any account-specific production testing requirements in Console. Internal testing is not a guarantee of public approval.

Test Google and Bitwarden manually through the real browser only after explicit consent: setup → create → verify → return → confirm → manually remove the test passkey. CI virtual credentials cannot certify this integration. Also check cancellation, task switching, rotation, process restoration and older Android guidance.

Android changelogs: [English](../../CHANGELOG-ANDROID.md), [中文](../../docs/zh/CHANGELOG-ANDROID.md).

The fixed test URL is opened with `scene=webauthn-diagnosis-android-app` in both Custom Tabs and the external-browser fallback. This selects the website's guided mode and Android return guidance; no browser result is automatically reported to the app.
