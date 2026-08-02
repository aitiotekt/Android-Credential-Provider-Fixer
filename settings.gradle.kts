pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "Android-Credential-Provider-Fixer"
include(":webauthn-diagnosis")
project(":webauthn-diagnosis").projectDir = file("apps/android-app/app")
