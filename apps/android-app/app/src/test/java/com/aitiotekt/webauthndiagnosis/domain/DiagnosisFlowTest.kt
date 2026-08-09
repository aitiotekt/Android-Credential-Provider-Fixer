package com.aitiotekt.webauthndiagnosis.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class DiagnosisFlowTest {
    private val allStates = listOf(
        DiagnosisState.Preparation,
        DiagnosisState.TestReady,
        DiagnosisState.External("one"),
        DiagnosisState.External("one", leftActivity = true),
        DiagnosisState.AwaitingConfirmation("one"),
        DiagnosisState.UserReportedSuccess,
        DiagnosisState.Troubleshooting,
    )

    @Test fun everyStepCanReturnToPreparationWithoutLateBrowserResults() {
        for (state in allStates) {
            val reset = transition(state, DiagnosisEvent.Navigate(DiagnosisDestination.Preparation))
            assertEquals(DiagnosisState.Preparation, reset)
            assertEquals(reset, transition(reset, DiagnosisEvent.Resumed))
            assertEquals(reset, transition(reset, DiagnosisEvent.ConfirmManually))
            assertEquals(reset, transition(reset, DiagnosisEvent.Success))
            assertEquals(reset, restoreState(reset.stage(), null))
        }
    }

    @Test fun navigationCannotInventAResultAndCurrentStepPreservesTheAttempt() {
        for (state in allStates) {
            assertEquals(state, transition(state, DiagnosisEvent.Navigate(state.destination())))
            assertEquals(state, transition(state, DiagnosisEvent.Navigate(DiagnosisDestination.Result)))
            if (state.destination() != DiagnosisDestination.Result) {
                assertFalse(state.canNavigate(DiagnosisDestination.Result))
            }
        }
    }

    @Test fun testAndHelpNavigationDiscardPreviousConfirmation() {
        for (state in allStates) {
            for ((destination, expected) in listOf(
                DiagnosisDestination.Test to DiagnosisState.TestReady,
                DiagnosisDestination.Troubleshooting to DiagnosisState.Troubleshooting,
            )) {
                val next = transition(state, DiagnosisEvent.Navigate(destination))
                assertEquals(expected, next)
                assertEquals(next, transition(next, DiagnosisEvent.Resumed))
                assertEquals(next, transition(next, DiagnosisEvent.Success))
            }
        }
    }

    @Test fun backReturnsToEarlierStagesWithoutResurrectingAResult() {
        for (state in allStates) {
            val previous = transition(state, DiagnosisEvent.Back)
            val expected = if (state == DiagnosisState.Preparation || state == DiagnosisState.TestReady) DiagnosisState.Preparation else DiagnosisState.TestReady
            assertEquals(expected, previous)
            assertEquals(DiagnosisState.Preparation, transition(previous, DiagnosisEvent.Back))
            assertEquals(previous, transition(previous, DiagnosisEvent.Resumed))
            assertEquals(previous, transition(previous, DiagnosisEvent.Success))
        }
    }

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
