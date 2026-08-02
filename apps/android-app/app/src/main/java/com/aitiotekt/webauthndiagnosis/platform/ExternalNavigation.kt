package com.aitiotekt.webauthndiagnosis.platform

import android.app.Activity
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import androidx.credentials.CredentialManager
import com.aitiotekt.webauthndiagnosis.BuildConfig

class ExternalNavigation(private val activity: Activity) {
    fun openTest(): Boolean = safely {
        CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(activity, BuildConfig.TEST_URL.toUri())
    } || openUrl(BuildConfig.TEST_URL)

    fun openSettings(): SettingsLaunchResult = openSettingsDestination(
        sdkInt = Build.VERSION.SDK_INT,
        openCredentials = {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                safely {
                    // AndroidX uses our package identity. Do not target another provider
                    // or interpret a settings result as proof that a provider is enabled.
                    CredentialManager.create(activity).createSettingsPendingIntent().send()
                }
            } else {
                false
            }
        },
        openSystem = { safely { activity.startActivity(Intent(Settings.ACTION_SETTINGS)) } },
    )

    fun openProject(): Boolean = openUrl("https://github.com/aitiotekt/Android-Credential-Provider-Fixer")
    fun openReleases(): Boolean = openUrl("https://github.com/aitiotekt/Android-Credential-Provider-Fixer/releases")

    private fun openUrl(url: String): Boolean = safely {
        activity.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()).addCategory(Intent.CATEGORY_BROWSABLE))
    }

    private fun safely(action: () -> Unit): Boolean = try {
        action()
        true
    } catch (_: ActivityNotFoundException) {
        false
    } catch (_: SecurityException) {
        false
    } catch (_: PendingIntent.CanceledException) {
        false
    } catch (_: UnsupportedOperationException) {
        false
    }
}

enum class SettingsLaunchResult { CredentialProviders, SystemSettings, Unavailable }

internal fun openSettingsDestination(
    sdkInt: Int,
    openCredentials: () -> Boolean,
    openSystem: () -> Boolean,
): SettingsLaunchResult = when {
    sdkInt >= 34 && openCredentials() -> SettingsLaunchResult.CredentialProviders
    openSystem() -> SettingsLaunchResult.SystemSettings
    else -> SettingsLaunchResult.Unavailable
}
