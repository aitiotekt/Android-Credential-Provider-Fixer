package com.aitiotekt.webauthndiagnosis.ui

import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.aitiotekt.webauthndiagnosis.R
import com.aitiotekt.webauthndiagnosis.domain.DiagnosisEvent
import com.aitiotekt.webauthndiagnosis.domain.DiagnosisDestination
import com.aitiotekt.webauthndiagnosis.domain.DiagnosisState
import com.aitiotekt.webauthndiagnosis.domain.DiagnosisViewModel
import com.aitiotekt.webauthndiagnosis.domain.canNavigate
import com.aitiotekt.webauthndiagnosis.domain.destination
import com.aitiotekt.webauthndiagnosis.platform.ExternalNavigation
import com.aitiotekt.webauthndiagnosis.platform.SettingsLaunchResult
import java.util.UUID

@Composable
fun DiagnosisApp(model: DiagnosisViewModel, navigation: ExternalNavigation) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()) {
        var launchFailed by remember(model.state) { mutableStateOf(false) }
        var settingsResult by remember(model.state) { mutableStateOf<SettingsLaunchResult?>(null) }
        fun open(action: () -> Boolean) {
            settingsResult = null
            launchFailed = !action()
        }
        fun openSettings() {
            settingsResult = navigation.openSettings()
            launchFailed = settingsResult == SettingsLaunchResult.Unavailable
        }
        val settingsLabel = stringResource(if (Build.VERSION.SDK_INT >= 34) R.string.open_credential_settings else R.string.open_settings)
        BackHandler(enabled = model.state != DiagnosisState.Preparation) { model.send(DiagnosisEvent.Back) }
        Scaffold(topBar = {
            StepMenu(model.state) { model.send(DiagnosisEvent.Navigate(it)) }
        }) { padding ->
            key(model.state) {
                Column(
                    Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    if (launchFailed) { Text(stringResource(R.string.launch_failed), color = MaterialTheme.colorScheme.error) }
                    if (settingsResult == SettingsLaunchResult.SystemSettings) { Notice(stringResource(R.string.settings_fallback)) }
                    when (model.state) {
                        DiagnosisState.Preparation -> {
                            Text(stringResource(R.string.preparation), style = MaterialTheme.typography.titleLarge)
                            Text(stringResource(R.string.android_version, Build.VERSION.RELEASE, Build.VERSION.SDK_INT))
                            Text(stringResource(if (Build.VERSION.SDK_INT >= 34) R.string.support_modern else R.string.support_older))
                            Text(stringResource(R.string.settings_help))
                            OutlinedButton(onClick = { openSettings() }) { Text(settingsLabel) }
                            Button(onClick = { model.send(DiagnosisEvent.Continue) }) { Text(stringResource(R.string.continue_test)) }
                        }
                        DiagnosisState.TestReady -> {
                            Text(stringResource(R.string.test_title), style = MaterialTheme.typography.titleLarge)
                            Text(stringResource(R.string.test_explanation))
                            Notice(stringResource(R.string.real_credential))
                            Button(onClick = {
                                val opened = navigation.openTest()
                                launchFailed = !opened
                                if (opened) { model.send(DiagnosisEvent.BrowserOpened(UUID.randomUUID().toString())) }
                            }) { Text(stringResource(R.string.open_test)) }
                        }
                        is DiagnosisState.External -> {
                            Text(stringResource(R.string.test_external))
                            Button(onClick = { model.send(DiagnosisEvent.ConfirmManually) }) { Text(stringResource(R.string.confirm_result)) }
                        }
                        is DiagnosisState.AwaitingConfirmation -> {
                            Text(stringResource(R.string.confirm_title), style = MaterialTheme.typography.titleLarge)
                            Text(stringResource(R.string.confirm_question))
                            Button(onClick = { model.send(DiagnosisEvent.Success) }) { Text(stringResource(R.string.answer_yes)) }
                            OutlinedButton(onClick = { model.send(DiagnosisEvent.Problem) }) { Text(stringResource(R.string.answer_no)) }
                            TextButton(onClick = { model.send(DiagnosisEvent.Retry) }) { Text(stringResource(R.string.answer_unknown)) }
                        }
                        DiagnosisState.UserReportedSuccess -> {
                            Text(stringResource(R.string.success_title), style = MaterialTheme.typography.titleLarge)
                            Text(stringResource(R.string.success_explanation))
                            Notice(stringResource(R.string.cleanup))
                            Button(onClick = { model.send(DiagnosisEvent.Finish) }) { Text(stringResource(R.string.finish)) }
                            TextButton(onClick = { model.send(DiagnosisEvent.Retry) }) { Text(stringResource(R.string.retry)) }
                            TextButton(onClick = { open(navigation::openProject) }) { Text(stringResource(R.string.support_project)) }
                        }
                        DiagnosisState.Troubleshooting -> {
                            Text(stringResource(R.string.troubleshoot), style = MaterialTheme.typography.titleLarge)
                            Text(stringResource(R.string.troubleshoot_help))
                            OutlinedButton(onClick = { openSettings() }) { Text(settingsLabel) }
                            Button(onClick = { model.send(DiagnosisEvent.Retry) }) { Text(stringResource(R.string.retry)) }
                            Notice(stringResource(R.string.desktop_help))
                            TextButton(onClick = { open(navigation::openReleases) }) { Text(stringResource(R.string.desktop_releases)) }
                        }
                    }
                    Text(stringResource(R.string.privacy), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun StepMenu(state: DiagnosisState, navigate: (DiagnosisDestination) -> Unit) {
    var expanded by remember(state) { mutableStateOf(false) }
    Surface {
        Row(
            Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(stringResource(R.string.app_name), Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
            Box {
                TextButton(onClick = { expanded = true }) { Text(stringResource(R.string.steps_menu)) }
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    for (destination in DiagnosisDestination.entries) {
                        val label = when (destination) {
                            DiagnosisDestination.Preparation -> R.string.preparation
                            DiagnosisDestination.Test -> R.string.test_title
                            DiagnosisDestination.Result -> R.string.result_step
                            DiagnosisDestination.Troubleshooting -> R.string.troubleshoot
                        }
                        DropdownMenuItem(
                            text = { Text(stringResource(label)) },
                            enabled = state.canNavigate(destination),
                            trailingIcon = {
                                if (state.destination() == destination) { Text(stringResource(R.string.current_step)) }
                            },
                            onClick = {
                                expanded = false
                                navigate(destination)
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun Notice(message: String) {
    Card(Modifier.fillMaxWidth()) { Text(message, Modifier.padding(16.dp)) }
}
