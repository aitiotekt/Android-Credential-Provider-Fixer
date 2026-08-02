package com.aitiotekt.webauthndiagnosis.domain

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel

class DiagnosisViewModel(private val saved: SavedStateHandle) : ViewModel() {
    var state by mutableStateOf(restoreState(saved["stage"], saved["attemptId"]))
        private set

    fun send(event: DiagnosisEvent) {
        state = transition(state, event)
        saved["stage"] = state.stage()
        saved["attemptId"] = when (val current = state) {
            is DiagnosisState.External -> current.attemptId
            is DiagnosisState.AwaitingConfirmation -> current.attemptId
            else -> null
        }
    }
}
