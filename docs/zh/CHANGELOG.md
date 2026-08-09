# 变更日志

项目的重要变化记录在这里。当前仍是预发布软件，不承诺预发布版本之间的诊断 JSON schema 保持稳定。

<!--
## Unreleased

Agent：新增变更统一记录在这里，并同步英文根 CHANGELOG.md。
即使元数据仍指向已有版本，也不得把新工作追加到已有版本章节。
执行 just set-version VERSION 后，将累计条目移入本注释下方新的可见版本章节
（标题为 ## VERSION）；保留这个空模板供后续使用，再运行 just check-version
和 just release-check。set-version 不会自动搬移 changelog 条目。
-->

## 0.1.0-beta.3

- 将桌面与文档站图标统一为 Android 的白底、青绿色与金色设计，以扳手表达修复、放大镜表达诊断；保留现有资源尺寸并重新编译 macOS Icon Composer 的 Assets.car 目录。
- 图标同步现在会更新 Icon Composer 图稿并通过 Xcode 编译 Assets.car，跨平台检查可发现过期图稿；为文档站与 WebAuthn 网站添加对应的 favicon。
- 将文档与 WebAuthn 验证集中到 Tests 流水线；Web 仅在 main 测试成功后或 main 手动运行时构建部署，锁定来源提交并跳过过期提交。

## 0.1.0-beta.2

- 新增 WebAuthn 诊断 Android 配套应用，以及仅在页面内存保存状态的测试站，注册与签名验证均在浏览器本地完成。
- 将 WebAuthn 网站改为通用测试工具：支持用户名探索、三步引导、Android 场景返回提示和显著结果概括，并取消一小时会话时限。开发入口改用 localhost，避免 Firefox 在 `127.0.0.1` 下因无效域名失败。
- 将文档站与 `/webauthn/` 合并为仅 main 部署的 Web 发布；从文档站以整页加载测试应用，并按职责整理双语文档。
- 将 Android 签名 AAB／商店发布从桌面发布中分离，Android 使用独立版本和变更日志。Android 开发改用 Unix/PowerShell 原生 Just recipe（Windows 需 PowerShell 7.5+）。
- 加强发布过程：签名 macOS DMG 先公证并附加票据，发布未完成则失败，并修复 Windows CLI ZIP 打包。暂时停止生成第三方许可证声明。
- WebAuthn 浏览器测试暂时仅覆盖 Chromium 和 Firefox，待 Playwright 恢复 Linux WebKit 虚拟认证器支持后再加回。

## 0.1.0-beta.1

- 新增 `just set-version` 和 `just set-macos-signing`，以及用于累计后续变更的 Unreleased 变更日志流程。
- Windows 所有渠道改为 GitHub Artifact Attestation 与 SHA-256，移除 Authenticode 和 PFX。macOS 仍可配置预发布签名，稳定版强制签名与公证。Release notes 区分来源证明与平台签名。

## 0.1.0-alpha.6

- 发布 macOS ARM64/x64、Windows x64、Linux GNU ARM64/x64 原生 CLI 归档，两个 macOS 架构的 Tauri DMG，以及 Windows x64 NSIS 安装包。
- 新增 Tests、Release、Docs 流水线，以及版本元数据、SHA-256、schema v1 manifest、GitHub attestation、由本日志生成的 Release notes 和生成的第三方许可证声明。稳定版需受保护审批；macOS 需 Developer ID 签名与公证；当时 Windows 仍要求 Authenticode。
- 将双语 VitePress 文档站部署到 `acp-fixer.aitiotekt.com`。
- npm/crates 发布、自动更新、应用商店、Linux GUI 包，以及 CI 中的 ADB 仍不在范围内。

## 0.1.0-alpha.5

- 将桌面前端重构为注入式领域服务、可释放的真实/演示会话 scope 和显式资源清理；演示模式无法访问真实 ADB。
- 补齐引导式演示：替换进行中的会话前需确认，退出入口固定在会话外壳，并覆盖锁定与快照恢复。
- 中英文文案拆为独立真源。IPC、Core、CLI 与 snapshot schema v2 仍与 alpha.4 兼容。

## 0.1.0-alpha.4

- 将发现、选择、诊断、预览、计划、执行和快照建模为带身份的实体。会话 revision 会拒绝迟到结果，并阻止跨诊断复用。
- GUI IPC、CLI JSON 和快照升级为 schema v2。写入前先持久化 `executing`；取消、漂移和所有结果均为终态。v1 快照仅作为不支持警告保留。
- 仅在诊断仍为会话最新结果时展示；已保存的 ADB 选择会绑定到新的发现；桌面错误改为本地化文案，不再显示内部错误码。

## 0.1.0-alpha.3

- 新增锁定单一凭据提供方和受保护的恢复：明确选择、变更预览、五分钟一次性计划、原子快照、回读验证和自动恢复。
- CLI 新增默认 dry-run 的 `pin`、`snapshots` 和 `restore`；只有 `--apply` 才会写入设备。
- 桌面界面改用 Tailwind CSS 4、五阶段进度和可持久化的明暗外观；macOS 最低版本为 13.3。
- 本地化面向用户的文案，不再暴露内部枚举；演示模式扩展到模拟锁定与恢复。
- 写入仍仅限 `credential_service` 与 `credential_service_primary`。

## 0.1.0-alpha.2

- 新增只读 ADB 发现、设备枚举、兼容性检查、凭据提供方诊断，以及对应的 `devices`、`diagnose` 和 `demo` CLI。
- 新增双语桌面工作流、ADB 选择持久化，以及基于脱敏 Xiaomi/HyperOS 调查的隔离引导式演示。
- 设置写入、快照、恢复和分发仍不在范围内。

## 0.1.0-alpha.1

- 建立 Tauri/SolidJS、CLI、共享 Core、文档、工具链、图标与 CI 工程基线。

[English](../../CHANGELOG.md) | [中文](CHANGELOG.md)
