set windows-shell := ["pwsh.exe", "-NoLogo", "-ExecutionPolicy", "RemoteSigned", "-Command"]

import "justfiles/setup.just"
import "justfiles/dev.just"
import "justfiles/quality.just"
import "justfiles/build.just"
import "justfiles/test.just"
