mod adapters;

use acp_fixer_core::app_info;
use clap::Parser;

#[derive(Debug, Parser)]
#[command(
    name = "acp-fixer",
    version,
    about = "Diagnose and repair Android Credential Provider state",
    long_about = "Android Credential Provider Fixer engineering baseline. ADB diagnostics and repair commands are not implemented yet."
)]
struct Cli {}

fn main() {
    let _cli = Cli::parse();
    let _runner = adapters::TokioCommandRunner;
    let info = app_info();

    println!(
        "{} {} ({})",
        info.product_name, info.version, info.development_phase
    );
}

#[cfg(test)]
mod tests {
    use clap::CommandFactory;

    use super::*;

    #[test]
    fn cli_definition_is_valid() {
        Cli::command().debug_assert();
    }
}
