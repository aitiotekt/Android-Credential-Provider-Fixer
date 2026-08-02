package com.aitiotekt.webauthndiagnosis.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class DiagnosisFlowTest {
    @Test fun settingsReturnDoesNotConfirm() {
        for (state in listOf(DiagnosisState.Preparation, DiagnosisState.Troubleshooting)) {
            val left = transition(state, DiagnosisEvent.LeftActivity)
            assertEquals(state, transition(left, DiagnosisEvent.Resumed))
            assertEquals(state, transition(state, DiagnosisEvent.Success))
        }
    }
    @Test fun browserReturnConfirmsExactlyOnce() {
        val opened = transition(DiagnosisState.TestReady, DiagnosisEvent.BrowserOpened("attempt-1"))
        assertEquals(opened, transition(opened, DiagnosisEvent.Resumed))
        val left = transition(opened, DiagnosisEvent.LeftActivity)
        val returned = transition(left, DiagnosisEvent.Resumed)
        assertEquals(DiagnosisState.AwaitingConfirmation("attempt-1"), returned)
        assertEquals(returned, transition(returned, DiagnosisEvent.Resumed))
        assertEquals(DiagnosisState.UserReportedSuccess, transition(returned, DiagnosisEvent.Success))
    }
    @Test fun invalidEventsCannotReportSuccess() {
        assertEquals(DiagnosisState.TestReady, transition(DiagnosisState.TestReady, DiagnosisEvent.Success))
        assertEquals(DiagnosisState.TestReady, transition(DiagnosisState.TestReady, DiagnosisEvent.BrowserOpened("")))
    }
    @Test fun processRestorationPreservesUncertainty() {
        assertEquals(DiagnosisState.AwaitingConfirmation("one"), restoreState("external", "one"))
        assertEquals(DiagnosisState.TestReady, restoreState("external", null))
        assertEquals(DiagnosisState.Preparation, restoreState("corrupt", "one"))
    }
    @Test fun unknownAndProblemCanRetry() {
        val confirmation = DiagnosisState.AwaitingConfirmation("one")
        assertEquals(DiagnosisState.TestReady, transition(confirmation, DiagnosisEvent.Retry))
        assertEquals(DiagnosisState.Troubleshooting, transition(confirmation, DiagnosisEvent.Problem))
        assertEquals(DiagnosisState.TestReady, transition(DiagnosisState.Troubleshooting, DiagnosisEvent.Retry))
    }
}
