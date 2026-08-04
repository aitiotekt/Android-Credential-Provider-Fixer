# Windows requires PowerShell 7.5+ for -CommandWithArgs argument forwarding.
set windows-shell := ["pwsh.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "RemoteSigned", "-CommandWithArgs"]

import "justfiles/setup.just"
import "justfiles/dev.just"
import "justfiles/quality.just"
import "justfiles/build.just"
import "justfiles/test.just"
import "justfiles/maintenance.just"
