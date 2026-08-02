package com.aitiotekt.webauthndiagnosis

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.aitiotekt.webauthndiagnosis.domain.DiagnosisEvent
import com.aitiotekt.webauthndiagnosis.domain.DiagnosisViewModel
import com.aitiotekt.webauthndiagnosis.platform.ExternalNavigation
import com.aitiotekt.webauthndiagnosis.ui.DiagnosisApp

class MainActivity : ComponentActivity() {
    private val model: DiagnosisViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val navigation = ExternalNavigation(this)
        setContent { DiagnosisApp(model, navigation) }
    }

    override fun onPause() {
        model.send(DiagnosisEvent.LeftActivity)
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        model.send(DiagnosisEvent.Resumed)
    }
}
