use std::{ffi::OsString, path::PathBuf, time::Duration};

use async_trait::async_trait;

use crate::CommandError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommandRequest {
    pub executable: PathBuf,
    pub arguments: Vec<OsString>,
    pub timeout: Duration,
    pub max_output_bytes: usize,
}

impl CommandRequest {
    pub fn new(
        executable: impl Into<PathBuf>,
        arguments: impl IntoIterator<Item = impl Into<OsString>>,
        timeout: Duration,
        max_output_bytes: usize,
    ) -> Result<Self, CommandError> {
        let request = Self {
            executable: executable.into(),
            arguments: arguments.into_iter().map(Into::into).collect(),
            timeout,
            max_output_bytes,
        };
        request.validate()?;
        Ok(request)
    }

    pub fn validate(&self) -> Result<(), CommandError> {
        if self.executable.as_os_str().is_empty() {
            return Err(CommandError::Invalid {
                message: "executable path must not be empty".to_owned(),
            });
        }
        if self.timeout.is_zero() {
            return Err(CommandError::Invalid {
                message: "timeout must be greater than zero".to_owned(),
            });
        }
        if self.max_output_bytes == 0 {
            return Err(CommandError::Invalid {
                message: "maximum output size must be greater than zero".to_owned(),
            });
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommandOutput {
    pub exit_code: Option<i32>,
    pub signal: Option<i32>,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

#[async_trait]
pub trait CommandRunner: Send + Sync {
    async fn run(&self, request: &CommandRequest) -> Result<CommandOutput, CommandError>;
}

pub async fn run_command(
    runner: &(impl CommandRunner + ?Sized),
    request: &CommandRequest,
) -> Result<CommandOutput, CommandError> {
    request.validate()?;
    runner.run(request).await
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;

    struct RecordingRunner {
        requests: Mutex<Vec<CommandRequest>>,
        result: Result<CommandOutput, CommandError>,
    }

    #[async_trait]
    impl CommandRunner for RecordingRunner {
        async fn run(&self, request: &CommandRequest) -> Result<CommandOutput, CommandError> {
            self.requests.lock().unwrap().push(request.clone());
            self.result.clone()
        }
    }

    fn request() -> CommandRequest {
        CommandRequest::new(
            "/path with spaces/adb",
            ["-s", "serial with spaces", "devices"],
            Duration::from_secs(5),
            1024,
        )
        .unwrap()
    }

    #[tokio::test]
    async fn preserves_argument_boundaries_and_raw_output() {
        let expected = CommandOutput {
            exit_code: Some(7),
            signal: None,
            stdout: vec![0xff, b'\n'],
            stderr: b"diagnostic".to_vec(),
        };
        let runner = RecordingRunner {
            requests: Mutex::new(Vec::new()),
            result: Ok(expected.clone()),
        };
        let request = request();

        let actual = run_command(&runner, &request).await.unwrap();

        assert_eq!(actual, expected);
        assert_eq!(runner.requests.lock().unwrap().as_slice(), &[request]);
    }

    #[tokio::test]
    async fn preserves_output_limit_errors() {
        let expected = CommandError::OutputTooLarge { limit_bytes: 8 };
        let runner = RecordingRunner {
            requests: Mutex::new(Vec::new()),
            result: Err(expected.clone()),
        };

        assert_eq!(run_command(&runner, &request()).await, Err(expected));
    }

    #[tokio::test]
    async fn preserves_timeout_errors() {
        let expected = CommandError::Timeout { timeout_ms: 5_000 };
        let runner = RecordingRunner {
            requests: Mutex::new(Vec::new()),
            result: Err(expected.clone()),
        };

        assert_eq!(run_command(&runner, &request()).await, Err(expected));
    }

    #[test]
    fn rejects_invalid_limits_before_execution() {
        let error = CommandRequest::new("adb", ["version"], Duration::ZERO, 0).unwrap_err();

        assert_eq!(error.code(), crate::ErrorCode::CommandInvalid);
    }
}
