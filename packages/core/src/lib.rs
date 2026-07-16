//! Platform-independent application contracts and orchestration.

mod command;
mod error;
mod metadata;

pub use command::{CommandOutput, CommandRequest, CommandRunner, run_command};
pub use error::{CommandError, ErrorCode, ErrorEnvelope};
pub use metadata::{AppInfo, app_info};
