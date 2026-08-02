package com.aitiotekt.webauthndiagnosis.platform

import org.junit.Assert.assertEquals
import org.junit.Test

class SettingsNavigationTest {
    @Test fun modernAndroidPrefersCredentialSettingsWithoutOpeningFallback() {
        for (sdk in listOf(34, 35, 36)) {
            val calls = mutableListOf<String>()
            val result = openSettingsDestination(sdk,
                { calls.add("credentials"); true },
                { calls.add("system"); true },
            )
            assertEquals(SettingsLaunchResult.CredentialProviders, result)
            assertEquals(listOf("credentials"), calls)
        }
    }

    @Test fun failedCredentialLaunchFallsBackInOrder() {
        val calls = mutableListOf<String>()
        val result = openSettingsDestination(34,
            { calls.add("credentials"); false },
            { calls.add("system"); true },
        )
        assertEquals(SettingsLaunchResult.SystemSettings, result)
        assertEquals(listOf("credentials", "system"), calls)
    }

    @Test fun olderAndroidDoesNotCallUnsupportedApi() {
        for (sdk in listOf(28, 33)) {
            assertEquals(SettingsLaunchResult.SystemSettings,
                openSettingsDestination(sdk, { error("Unsupported API called") }, { true }))
        }
    }

    @Test fun noLaunchIsReportedAsUnavailable() {
        assertEquals(SettingsLaunchResult.Unavailable,
            openSettingsDestination(34, { false }, { false }))
        assertEquals(SettingsLaunchResult.Unavailable,
            openSettingsDestination(33, { error("Unsupported API called") }, { false }))
    }
}
