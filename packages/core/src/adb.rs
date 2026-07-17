use std::{
    collections::HashSet,
    env,
    ffi::OsString,
    path::{Path, PathBuf},
    time::Duration,
};

use serde::{Deserialize, Serialize};

use crate::{CommandRequest, CommandRunner, DiagnosticError, run_command};

pub const ADB_VERSION_TIMEOUT: Duration = Duration::from_secs(5);
pub const ADB_VERSION_MAX_OUTPUT_BYTES: usize = 64 * 1024;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HostPlatform {
    MacOs,
    Windows,
    Linux,
}

impl HostPlatform {
    #[must_use]
    pub const fn current() -> Self {
        if cfg!(target_os = "macos") {
            Self::MacOs
        } else if cfg!(target_os = "windows") {
            Self::Windows
        } else {
            Self::Linux
        }
    }

    const fn executable_name(self) -> &'static str {
        match self {
            Self::Windows => "adb.exe",
            Self::MacOs | Self::Linux => "adb",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AdbCandidateSource {
    Explicit,
    Saved,
    Path,
    AndroidHome,
    AndroidSdkRoot,
    CommonLocation,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdbDiscoveryContext {
    pub platform: HostPlatform,
    pub explicit_paths: Vec<(PathBuf, AdbCandidateSource)>,
    pub path_entries: Vec<PathBuf>,
    pub android_home: Option<PathBuf>,
    pub android_sdk_root: Option<PathBuf>,
    pub home_dir: Option<PathBuf>,
    pub local_app_data: Option<PathBuf>,
    pub user_profile: Option<PathBuf>,
    pub chocolatey_install: Option<PathBuf>,
}

impl AdbDiscoveryContext {
    #[must_use]
    pub fn from_environment(explicit_paths: Vec<(PathBuf, AdbCandidateSource)>) -> Self {
        Self {
            platform: HostPlatform::current(),
            explicit_paths,
            path_entries: env::var_os("PATH")
                .map(|value| env::split_paths(&value).collect())
                .unwrap_or_default(),
            android_home: env::var_os("ANDROID_HOME").map(PathBuf::from),
            android_sdk_root: env::var_os("ANDROID_SDK_ROOT").map(PathBuf::from),
            home_dir: env::var_os("HOME").map(PathBuf::from),
            local_app_data: env::var_os("LOCALAPPDATA").map(PathBuf::from),
            user_profile: env::var_os("USERPROFILE").map(PathBuf::from),
            chocolatey_install: env::var_os("ChocolateyInstall").map(PathBuf::from),
        }
    }

    fn candidate_paths(&self) -> Vec<(PathBuf, AdbCandidateSource)> {
        let executable = self.platform.executable_name();
        let mut candidates = self.explicit_paths.clone();
        candidates.extend(
            self.path_entries
                .iter()
                .map(|entry| (entry.join(executable), AdbCandidateSource::Path)),
        );
        if let Some(root) = &self.android_home {
            candidates.push((
                root.join("platform-tools").join(executable),
                AdbCandidateSource::AndroidHome,
            ));
        }
        if let Some(root) = &self.android_sdk_root {
            candidates.push((
                root.join("platform-tools").join(executable),
                AdbCandidateSource::AndroidSdkRoot,
            ));
        }
        match self.platform {
            HostPlatform::MacOs => {
                candidates.extend([
                    (
                        PathBuf::from("/opt/homebrew/bin/adb"),
                        AdbCandidateSource::CommonLocation,
                    ),
                    (
                        PathBuf::from("/usr/local/bin/adb"),
                        AdbCandidateSource::CommonLocation,
                    ),
                ]);
                if let Some(home) = &self.home_dir {
                    candidates.push((
                        home.join("Library/Android/sdk/platform-tools/adb"),
                        AdbCandidateSource::CommonLocation,
                    ));
                }
            }
            HostPlatform::Windows => {
                if let Some(local) = &self.local_app_data {
                    candidates.extend([
                        (
                            local.join("Microsoft/WinGet/Links/adb.exe"),
                            AdbCandidateSource::CommonLocation,
                        ),
                        (
                            local.join("Android/Sdk/platform-tools/adb.exe"),
                            AdbCandidateSource::CommonLocation,
                        ),
                    ]);
                }
                if let Some(profile) = &self.user_profile {
                    candidates.push((
                        profile.join("scoop/shims/adb.exe"),
                        AdbCandidateSource::CommonLocation,
                    ));
                }
                if let Some(chocolatey) = &self.chocolatey_install {
                    candidates.push((
                        chocolatey.join("bin/adb.exe"),
                        AdbCandidateSource::CommonLocation,
                    ));
                }
            }
            HostPlatform::Linux => {
                if let Some(home) = &self.home_dir {
                    candidates.push((
                        home.join("Android/Sdk/platform-tools/adb"),
                        AdbCandidateSource::CommonLocation,
                    ));
                }
            }
        }
        candidates
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidatedAdb {
    pub path: PathBuf,
    pub resolved_path: PathBuf,
    pub version: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbCandidate {
    pub source: AdbCandidateSource,
    pub adb: ValidatedAdb,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbValidationFailure {
    pub source: AdbCandidateSource,
    pub path: PathBuf,
    pub code: String,
    pub message: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbDiscoveryResult {
    pub candidates: Vec<AdbCandidate>,
    pub failures: Vec<AdbValidationFailure>,
}

pub async fn validate_adb(
    runner: &(impl CommandRunner + ?Sized),
    path: &Path,
) -> Result<ValidatedAdb, DiagnosticError> {
    let metadata = path
        .metadata()
        .map_err(|error| DiagnosticError::AdbNotExecutable {
            path: path.to_path_buf(),
            message: error.to_string(),
        })?;
    if !metadata.is_file() {
        return Err(DiagnosticError::AdbNotExecutable {
            path: path.to_path_buf(),
            message: "path is not a regular file".to_owned(),
        });
    }
    let request = CommandRequest::new(
        path,
        [OsString::from("version")],
        ADB_VERSION_TIMEOUT,
        ADB_VERSION_MAX_OUTPUT_BYTES,
    )?;
    let output = run_command(runner, &request).await?;
    if output.exit_code != Some(0) {
        return Err(DiagnosticError::AdbVersionFailed {
            message: command_failure_message(&output.stderr, output.exit_code),
        });
    }
    let stdout = String::from_utf8(output.stdout).map_err(|_| DiagnosticError::OutputInvalid {
        stage: "adb-version".to_owned(),
        message: "ADB version output was not valid UTF-8".to_owned(),
    })?;
    let version = stdout
        .lines()
        .find(|line| line.starts_with("Android Debug Bridge version "))
        .ok_or_else(|| DiagnosticError::AdbVersionFailed {
            message: "executable did not identify itself as Android Debug Bridge".to_owned(),
        })?
        .trim()
        .to_owned();
    let resolved_path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    Ok(ValidatedAdb {
        path: path.to_path_buf(),
        resolved_path,
        version,
    })
}

pub async fn discover_adb(
    runner: &(impl CommandRunner + ?Sized),
    context: &AdbDiscoveryContext,
) -> AdbDiscoveryResult {
    let mut result = AdbDiscoveryResult {
        candidates: Vec::new(),
        failures: Vec::new(),
    };
    let mut seen = HashSet::new();
    for (path, source) in context.candidate_paths() {
        if !path.is_file() {
            continue;
        }
        let identity = path.canonicalize().unwrap_or_else(|_| path.clone());
        if !seen.insert(identity) {
            continue;
        }
        match validate_adb(runner, &path).await {
            Ok(adb) => result.candidates.push(AdbCandidate { source, adb }),
            Err(error) => result.failures.push(AdbValidationFailure {
                source,
                path,
                code: error.code().as_str().to_owned(),
                message: error.to_string(),
            }),
        }
    }
    result
}

fn command_failure_message(stderr: &[u8], exit_code: Option<i32>) -> String {
    let detail = String::from_utf8_lossy(stderr).trim().to_owned();
    if detail.is_empty() {
        format!("process exited with code {exit_code:?}")
    } else {
        detail
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use async_trait::async_trait;

    use super::*;
    use crate::{CommandError, CommandOutput};

    struct VersionRunner {
        requests: Mutex<Vec<CommandRequest>>,
        output: CommandOutput,
    }

    #[async_trait]
    impl CommandRunner for VersionRunner {
        async fn run(&self, request: &CommandRequest) -> Result<CommandOutput, CommandError> {
            self.requests.lock().unwrap().push(request.clone());
            Ok(self.output.clone())
        }
    }

    #[tokio::test]
    async fn validates_identity_with_a_separate_version_argument() {
        let test_path = std::env::current_exe().unwrap();
        let runner = VersionRunner {
            requests: Mutex::new(Vec::new()),
            output: CommandOutput {
                exit_code: Some(0),
                signal: None,
                stdout: b"Android Debug Bridge version 1.0.41\r\nVersion 36.0.0\r\n".to_vec(),
                stderr: Vec::new(),
            },
        };

        let adb = validate_adb(&runner, &test_path).await.unwrap();

        assert_eq!(adb.version, "Android Debug Bridge version 1.0.41");
        let requests = runner.requests.lock().unwrap();
        assert_eq!(requests[0].arguments, [OsString::from("version")]);
        assert_eq!(requests[0].timeout, ADB_VERSION_TIMEOUT);
    }

    #[tokio::test]
    async fn rejects_non_adb_executables() {
        let runner = VersionRunner {
            requests: Mutex::new(Vec::new()),
            output: CommandOutput {
                exit_code: Some(0),
                signal: None,
                stdout: b"not adb\n".to_vec(),
                stderr: Vec::new(),
            },
        };

        let error = validate_adb(&runner, &std::env::current_exe().unwrap())
            .await
            .unwrap_err();

        assert_eq!(error.code(), crate::ErrorCode::AdbVersionFailed);
    }

    #[test]
    fn discovery_order_starts_with_explicit_path_and_path_entries() {
        let context = AdbDiscoveryContext {
            platform: HostPlatform::Linux,
            explicit_paths: vec![(PathBuf::from("/explicit/adb"), AdbCandidateSource::Explicit)],
            path_entries: vec![PathBuf::from("/path-entry")],
            android_home: Some(PathBuf::from("/android-home")),
            android_sdk_root: None,
            home_dir: Some(PathBuf::from("/home/person")),
            local_app_data: None,
            user_profile: None,
            chocolatey_install: None,
        };

        let candidates = context.candidate_paths();

        assert_eq!(candidates[0].0, PathBuf::from("/explicit/adb"));
        assert_eq!(candidates[1].0, PathBuf::from("/path-entry/adb"));
        assert_eq!(
            candidates[2].0,
            PathBuf::from("/android-home/platform-tools/adb")
        );
    }
}
