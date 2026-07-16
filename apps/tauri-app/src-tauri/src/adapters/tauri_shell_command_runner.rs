use std::time::Duration;

use acp_fixer_core::{CommandError, CommandOutput, CommandRequest, CommandRunner};
use async_trait::async_trait;
use tauri::{AppHandle, Wry};
use tauri_plugin_shell::{ShellExt, process::CommandEvent};

#[derive(Debug)]
pub struct TauriShellCommandRunner {
    app: AppHandle<Wry>,
}

impl TauriShellCommandRunner {
    #[must_use]
    pub const fn new(app: AppHandle<Wry>) -> Self {
        Self { app }
    }
}

#[async_trait]
impl CommandRunner for TauriShellCommandRunner {
    async fn run(&self, request: &CommandRequest) -> Result<CommandOutput, CommandError> {
        request.validate()?;

        let (mut receiver, child) = self
            .app
            .shell()
            .command(&request.executable)
            .args(&request.arguments)
            .set_raw_out(true)
            .spawn()
            .map_err(|error| CommandError::Spawn {
                message: error.to_string(),
            })?;
        let collect = async {
            let mut stdout = Vec::new();
            let mut stderr = Vec::new();

            while let Some(event) = receiver.recv().await {
                match event {
                    CommandEvent::Stdout(bytes) => {
                        ensure_capacity(
                            stdout.len(),
                            stderr.len(),
                            bytes.len(),
                            request.max_output_bytes,
                        )?;
                        stdout.extend(bytes);
                    }
                    CommandEvent::Stderr(bytes) => {
                        ensure_capacity(
                            stdout.len(),
                            stderr.len(),
                            bytes.len(),
                            request.max_output_bytes,
                        )?;
                        stderr.extend(bytes);
                    }
                    CommandEvent::Error(message) => {
                        return Err(CommandError::ReadOutput { message });
                    }
                    CommandEvent::Terminated(payload) => {
                        return Ok(CommandOutput {
                            exit_code: payload.code,
                            signal: payload.signal,
                            stdout,
                            stderr,
                        });
                    }
                    _ => {}
                }
            }

            Err(CommandError::Wait {
                message: "process event stream ended before termination".to_owned(),
            })
        };

        match tokio_timeout(request.timeout, collect).await {
            Ok(Ok(output)) => Ok(output),
            Ok(Err(error)) | Err(error) => {
                child.kill().map_err(|kill_error| CommandError::Terminate {
                    message: kill_error.to_string(),
                })?;
                Err(error)
            }
        }
    }
}

async fn tokio_timeout<F>(
    timeout: Duration,
    future: F,
) -> Result<Result<CommandOutput, CommandError>, CommandError>
where
    F: Future<Output = Result<CommandOutput, CommandError>>,
{
    tokio::time::timeout(timeout, future)
        .await
        .map_err(|_| CommandError::Timeout {
            timeout_ms: timeout.as_millis().try_into().unwrap_or(u64::MAX),
        })
}

fn ensure_capacity(
    stdout_len: usize,
    stderr_len: usize,
    additional: usize,
    max_output_bytes: usize,
) -> Result<(), CommandError> {
    if stdout_len
        .saturating_add(stderr_len)
        .saturating_add(additional)
        > max_output_bytes
    {
        return Err(CommandError::OutputTooLarge {
            limit_bytes: max_output_bytes,
        });
    }
    Ok(())
}
