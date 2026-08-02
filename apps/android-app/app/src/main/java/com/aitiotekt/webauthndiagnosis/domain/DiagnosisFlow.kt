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

fun transition(state: DiagnosisState, event: DiagnosisEvent): DiagnosisState = when (event) {
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
