use std::{process::Stdio, time::Duration};

use acp_fixer_core::{CommandError, CommandOutput, CommandRequest, CommandRunner};
use async_trait::async_trait;
use tokio::{
    io::{AsyncRead, AsyncReadExt},
    process::{Child, Command},
    sync::mpsc,
    time::{Instant, MissedTickBehavior, interval, sleep_until},
};

#[derive(Debug, Default)]
pub struct TokioCommandRunner;

enum StreamMessage {
    Stdout(Vec<u8>),
    Stderr(Vec<u8>),
    ReadFailed(String),
}

#[async_trait]
impl CommandRunner for TokioCommandRunner {
    async fn run(&self, request: &CommandRequest) -> Result<CommandOutput, CommandError> {
        request.validate()?;

        let mut child = Command::new(&request.executable)
            .args(&request.arguments)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|error| CommandError::Spawn {
                message: error.to_string(),
            })?;

        collect_output(&mut child, request.timeout, request.max_output_bytes).await
    }
}

async fn collect_output(
    child: &mut Child,
    timeout: Duration,
    max_output_bytes: usize,
) -> Result<CommandOutput, CommandError> {
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| CommandError::ReadOutput {
            message: "stdout pipe was not available".to_owned(),
        })?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| CommandError::ReadOutput {
            message: "stderr pipe was not available".to_owned(),
        })?;
    let (sender, mut receiver) = mpsc::channel(16);
    let stdout_task = tokio::spawn(read_stream(stdout, sender.clone(), true));
    let stderr_task = tokio::spawn(read_stream(stderr, sender, false));
    let deadline = sleep_until(Instant::now() + timeout);
    tokio::pin!(deadline);
    let mut process_poll = interval(Duration::from_millis(10));
    process_poll.set_missed_tick_behavior(MissedTickBehavior::Skip);
    let mut stdout_bytes = Vec::new();
    let mut stderr_bytes = Vec::new();

    let status = loop {
        tokio::select! {
            _ = process_poll.tick() => {
                if let Some(status) = child.try_wait().map_err(|error| CommandError::Wait {
                    message: error.to_string(),
                })? {
                    break status;
                }
            }
            () = &mut deadline => {
                terminate(child).await?;
                stdout_task.abort();
                stderr_task.abort();
                return Err(CommandError::Timeout {
                    timeout_ms: duration_millis(timeout),
                });
            }
            message = receiver.recv() => {
                let Some(message) = message else {
                    continue;
                };
                if let Err(error) = append_message(
                    message,
                    &mut stdout_bytes,
                    &mut stderr_bytes,
                    max_output_bytes,
                ) {
                    terminate(child).await?;
                    stdout_task.abort();
                    stderr_task.abort();
                    return Err(error);
                }
            }
        }
    };

    while let Some(message) = receiver.recv().await {
        append_message(
            message,
            &mut stdout_bytes,
            &mut stderr_bytes,
            max_output_bytes,
        )?;
    }
    stdout_task
        .await
        .map_err(|error| CommandError::ReadOutput {
            message: error.to_string(),
        })?;
    stderr_task
        .await
        .map_err(|error| CommandError::ReadOutput {
            message: error.to_string(),
        })?;

    #[cfg(unix)]
    use std::os::unix::process::ExitStatusExt;

    Ok(CommandOutput {
        exit_code: status.code(),
        #[cfg(unix)]
        signal: status.signal(),
        #[cfg(not(unix))]
        signal: None,
        stdout: stdout_bytes,
        stderr: stderr_bytes,
    })
}

async fn read_stream(
    mut stream: impl AsyncRead + Unpin,
    sender: mpsc::Sender<StreamMessage>,
    is_stdout: bool,
) {
    let mut buffer = vec![0; 8 * 1024];
    loop {
        match stream.read(&mut buffer).await {
            Ok(0) => break,
            Ok(count) => {
                let bytes = buffer[..count].to_vec();
                let message = if is_stdout {
                    StreamMessage::Stdout(bytes)
                } else {
                    StreamMessage::Stderr(bytes)
                };
                if sender.send(message).await.is_err() {
                    break;
                }
            }
            Err(error) => {
                let _ = sender
                    .send(StreamMessage::ReadFailed(error.to_string()))
                    .await;
                break;
            }
        }
    }
}

fn append_message(
    message: StreamMessage,
    stdout: &mut Vec<u8>,
    stderr: &mut Vec<u8>,
    max_output_bytes: usize,
) -> Result<(), CommandError> {
    match message {
        StreamMessage::Stdout(bytes) => {
            ensure_capacity(stdout.len(), stderr.len(), bytes.len(), max_output_bytes)?;
            stdout.extend(bytes);
        }
        StreamMessage::Stderr(bytes) => {
            ensure_capacity(stdout.len(), stderr.len(), bytes.len(), max_output_bytes)?;
            stderr.extend(bytes);
        }
        StreamMessage::ReadFailed(message) => {
            return Err(CommandError::ReadOutput { message });
        }
    }
    Ok(())
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

async fn terminate(child: &mut Child) -> Result<(), CommandError> {
    child.kill().await.map_err(|error| CommandError::Terminate {
        message: error.to_string(),
    })
}

fn duration_millis(duration: Duration) -> u64 {
    duration.as_millis().try_into().unwrap_or(u64::MAX)
}
