package com.aitiotekt.webauthndiagnosis.domain

sealed interface DiagnosisState {
    data object Preparation : DiagnosisState
    data object TestReady : DiagnosisState
    data class External(val attemptId: String, val leftActivity: Boolean = false) : DiagnosisState
    data class AwaitingConfirmation(val attemptId: String) : DiagnosisState
    data object UserReportedSuccess : DiagnosisState
    data object Troubleshooting : DiagnosisState
}

sealed interface DiagnosisEvent {
    data class Navigate(val destination: DiagnosisDestination) : DiagnosisEvent
    data object Back : DiagnosisEvent
    data object Continue : DiagnosisEvent
    data class BrowserOpened(val attemptId: String) : DiagnosisEvent
    data object LeftActivity : DiagnosisEvent
    data object Resumed : DiagnosisEvent
    data object ConfirmManually : DiagnosisEvent
    data object Success : DiagnosisEvent
    data object Problem : DiagnosisEvent
    data object Retry : DiagnosisEvent
    data object Finish : DiagnosisEvent
}

enum class DiagnosisDestination { Preparation, Test, Result, Troubleshooting }

fun DiagnosisState.destination(): DiagnosisDestination = when (this) {
    DiagnosisState.Preparation -> DiagnosisDestination.Preparation
    DiagnosisState.TestReady -> DiagnosisDestination.Test
    is DiagnosisState.External, is DiagnosisState.AwaitingConfirmation, DiagnosisState.UserReportedSuccess -> DiagnosisDestination.Result
    DiagnosisState.Troubleshooting -> DiagnosisDestination.Troubleshooting
}

fun DiagnosisState.canNavigate(destination: DiagnosisDestination): Boolean =
    destination != DiagnosisDestination.Result || this.destination() == DiagnosisDestination.Result

fun transition(state: DiagnosisState, event: DiagnosisEvent): DiagnosisState = when (event) {
    is DiagnosisEvent.Navigate -> when {
        !state.canNavigate(event.destination) || state.destination() == event.destination -> state
        event.destination == DiagnosisDestination.Preparation -> DiagnosisState.Preparation
        event.destination == DiagnosisDestination.Test -> DiagnosisState.TestReady
        event.destination == DiagnosisDestination.Troubleshooting -> DiagnosisState.Troubleshooting
        else -> state
    }
    DiagnosisEvent.Back -> when (state) {
        DiagnosisState.Preparation, DiagnosisState.TestReady -> DiagnosisState.Preparation
        else -> DiagnosisState.TestReady
    }
    DiagnosisEvent.Continue -> if (state == DiagnosisState.Preparation) DiagnosisState.TestReady else state
    is DiagnosisEvent.BrowserOpened -> if (state == DiagnosisState.TestReady && event.attemptId.isNotBlank()) DiagnosisState.External(event.attemptId) else state
    DiagnosisEvent.LeftActivity -> if (state is DiagnosisState.External) state.copy(leftActivity = true) else state
    DiagnosisEvent.Resumed -> if (state is DiagnosisState.External && state.leftActivity) DiagnosisState.AwaitingConfirmation(state.attemptId) else state
    DiagnosisEvent.ConfirmManually -> if (state is DiagnosisState.External) DiagnosisState.AwaitingConfirmation(state.attemptId) else state
    DiagnosisEvent.Success -> if (state is DiagnosisState.AwaitingConfirmation) DiagnosisState.UserReportedSuccess else state
    DiagnosisEvent.Problem -> if (state is DiagnosisState.AwaitingConfirmation) DiagnosisState.Troubleshooting else state
    DiagnosisEvent.Retry -> if (state !is DiagnosisState.External) DiagnosisState.TestReady else state
    DiagnosisEvent.Finish -> DiagnosisState.Preparation
}

fun restoreState(stage: String?, attemptId: String?): DiagnosisState = when (stage) {
    "ready" -> DiagnosisState.TestReady
    // After process restoration the browser's outcome is unknown, never success.
    "external", "awaiting" -> attemptId?.takeIf { it.isNotBlank() }?.let { DiagnosisState.AwaitingConfirmation(it) } ?: DiagnosisState.TestReady
    "success" -> DiagnosisState.UserReportedSuccess
    "problem" -> DiagnosisState.Troubleshooting
    else -> DiagnosisState.Preparation
}

fun DiagnosisState.stage(): String = when (this) {
    DiagnosisState.Preparation -> "preparation"
    DiagnosisState.TestReady -> "ready"
    is DiagnosisState.External -> "external"
    is DiagnosisState.AwaitingConfirmation -> "awaiting"
    DiagnosisState.UserReportedSuccess -> "success"
    DiagnosisState.Troubleshooting -> "problem"
}
