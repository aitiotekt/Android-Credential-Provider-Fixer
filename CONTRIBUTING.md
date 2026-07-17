# Contributing

Thank you for helping improve Android Credential Provider Fixer. Contributions should preserve the project's narrow, auditable security model.

## Setup

```sh
mise trust
just setup
just verify
```

Use `just dev` for the desktop app, `just dev-cli --help` for the CLI, and `just dev-docs` for documentation. Code and code comments are written in English. User-facing documentation is maintained in matching `docs/en` and `docs/zh` files. Root `CHANGELOG.md` is the English source and `docs/zh/CHANGELOG.md` is the Chinese source.

## Engineering rules

- Keep domain policy and orchestration in `packages/core`; concrete platform access belongs in an app adapter.
- Do not expose arbitrary commands to the WebView or add shell-string execution.
- Do not add device writes without the approved plan/snapshot/verification/recovery flow.
- Do not test against a real device by default.
- Keep Demo Mode isolated from live discovery and inspection adapters.
- Update current-state docs with behavior changes; record historical changes in a changelog.

Run `just sync-docs` after changing managed documentation aliases. The command refuses to overwrite ordinary files. Before submitting changes, run `just format` followed by `just verify`.

[English](CONTRIBUTING.md) | [中文](docs/zh/CONTRIBUTING.md)
