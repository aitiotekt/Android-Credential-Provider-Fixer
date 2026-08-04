# 参与贡献

感谢你帮助改进 Android Credential Provider Fixer。所有贡献都应保持项目范围收敛，并维护可审计的安全模型。

## 环境配置

安装 [mise](https://mise.jdx.dev/)，使用 [mise.toml](https://github.com/aitiotekt/Android-Credential-Provider-Fixer/blob/main/mise.toml) 和 [rust-toolchain.toml](https://github.com/aitiotekt/Android-Credential-Provider-Fixer/blob/main/rust-toolchain.toml) 声明的工具版本。以这些文件为准，不在 README 中维护第二份版本清单。原生构建的系统依赖仍取决于目标平台。

Android 开发在 Android Studio 中打开仓库根目录，使用根 Gradle Wrapper，并通过 `ANDROID_HOME` 或根目录本地 `local.properties` 配置 SDK。模块任务、WebAuthn 开发及设备选择要求见[配套应用开发指南](005-WEBAUTHN-DIAGNOSIS.md#开发和发布)。

```sh
mise trust
just setup
just verify
```

使用 `just dev` 运行桌面应用，`just dev-cli --help` 运行 CLI，`just dev-docs` 运行文档站，`just dev-web` 运行 WebAuthn 网站。`just dev-android` 在明确选择设备后构建、安装并启动 Android 调试应用；非交互选择和监听模式见[开发指南](005-WEBAUTHN-DIAGNOSIS.md#开发和发布)。代码和代码注释使用英文；面向用户的文档在 `docs/en` 与 `docs/zh` 中成对维护。根 `CHANGELOG.md` 是英文真源，`docs/zh/CHANGELOG.md` 是中文真源。

## 图标资源

图标主文件为 `assets/icons/app-icon.png`（通用资源与 macOS Icon Composer 图稿）和 `assets/icons/app-icon-macos-legacy.png`（旧版 ICNS 所需的透明安全区域）。修改任一主文件后运行 `just sync-icons`。仓库结构与前端实现边界见[架构指南](001-ARCHITECTURE.md)。

## 文档职责

- **README：** 介绍工具、面向用户的能力、使用入口及必要的安全影响；其他内容使用简短概括和链接，不加入版本公告、工具链清单或实现细节。
- **专题指南：** 在对应文档中说明当前行为、用法、架构、支持范围和分发方式。
- **贡献指南：** 说明环境配置、开发命令、检查、工程约定和发布维护。
- **变更日志：** 将变化记录在 Unreleased 或引入变化的版本中，保留历史版本章节。
- **路线图：** 记录计划及完成状态，不把计划中的行为描述为已经可用。

保持中英文结构对应，相关主题通过链接串联，避免复制整段内容。

## 工程规则

- 领域策略与编排放在 `packages/core`，具体平台访问放在对应 app adapter。
- 不得向 WebView 暴露任意命令，也不得加入 shell 字符串执行。
- 设备写入只能存在于有限 Core change executor，并必须保留 plan、快照、状态检查、回读和恢复流程；不得增加第三个可写 setting key。
- 默认测试不得连接真实设备。
- Demo Mode 必须与真实发现和检查 adapter 隔离。
- 前端中有状态且只有单一实现的服务应使用 `class XxxService`、构造函数注入和明确的 public/private 边界。`createXxx()` 仅用于无状态辅助对象、可替换 adapter，或需要隐藏实现的可复用类库边界；异步流程不得依赖环境式注入。
- 前端资源所有权使用 TC39 显式资源管理：同步清理实现幂等的 `[Symbol.dispose]()`，词法作用域使用 `using`，聚合生命周期或可能部分构造失败时使用 `DisposableStack`。只有清理确实需要等待时才使用对应的异步形式。
- 单个清理栈命名为 `disposableStack`，或使用 `constructionStack` 这类描述职责的单数名称。`resource` 与 `resources` 保留给领域 `EntityResource` 状态；只有真正的栈集合才使用复数名称。
- Vite 与 Vitest 必须复用同一份 `unplugin-swc` 配置与 WebView target，使 `using` 在开发、构建和测试中都会 lowering，并按实际用法注入精确的 core-js 资源管理 polyfill。Solid 必须先于 SWC 转换；不要增加并行的顶层 Oxc 源码转换或手动 polyfill 入口。jsdom 测试不能证明 Safari 兼容性；未来的浏览器测试必须使用 Playwright WebKit 并复用相同配置。
- 领域事件应由发布它的服务持有：使用私有 `DomainEvent<T>` Subject，并仅向下游领域服务暴露只读 Observable。不要增加共享事件总线，渲染代码也不得订阅领域事件。
- 前端单元测试应放在最近模块层级的 `__tests__/` 目录中，不与生产源码并列。Rust 单元测试和集成测试继续遵循 Cargo 的标准目录结构。
- 行为变化应更新当前状态文档；历史变化应记录在 changelog 中。

修改受管文档别名后运行 `just sync-docs`；该命令拒绝覆盖普通文件。提交变更前依次运行 `just format`、`just verify` 和 `just release-check`。

## 发布维护

`acp-fixer-metadata.toml` 是发布元数据真源。使用 `just --list` 查看维护命令；若尚未激活 mise 工具链，通过 `mise exec -- just ...` 执行。

| 命令 | 用途 |
| --- | --- |
| `just set-version VERSION` | 同步发布元数据、根/app/docsite package、Tauri 配置、Cargo workspace 与 lockfile。接受 `X.Y.Z`、`X.Y.Z-alpha.N` 或 `X.Y.Z-beta.N`。 |
| `just check-version` | 检查版本一致性及对应的英中文 CHANGELOG 章节。 |
| `just set-macos-signing signed` / `just set-macos-signing unsigned` | 配置 macOS 预发布签名；macOS 稳定版始终强制签名。 |
| `just release-check` | 本地校验发布元数据、产物定义和 workflow 策略。 |
| `just stage-cli-release` | 构建并归档当前平台 CLI。 |
| `just build-tauri-release` | 构建当前平台 Tauri release 包。 |

开发期间，将新变更记录在 `CHANGELOG.md` 和 `docs/zh/CHANGELOG.md` 的注释 `## Unreleased` 区域内。即使元数据仍指向已有版本，也不要把新工作追加到旧版本章节。准备发布时，执行 `just set-version VERSION`，将累计条目统一移入对应的新版本可见章节，并保留空的 Unreleased 注释模板，再运行 `just check-version` 与 `just release-check`。设置版本不会自动生成或搬移 changelog 内容、创建提交/tag 或发布 Release。Windows 没有签名开关：所有发布均采用 GitHub Artifact Attestation 与 SHA-256，无需 Authenticode 凭据。发布流水线必须保持无 ADB 调用，不得把签名 secret 写入源码，也不得为签名 job 增加未签名降级路径。

[English](../../CONTRIBUTING.md) | [中文](CONTRIBUTING.md)
