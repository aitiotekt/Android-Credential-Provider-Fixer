// Gradle manages Android modules only; pnpm and Cargo retain their own builds.
buildscript {
    dependencies {
        // Upgrade AGP's built-in Kotlin compiler together with the Compose plugin.
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.20")
    }
}

plugins {
    id("com.android.application") version "9.4.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.20" apply false
}
