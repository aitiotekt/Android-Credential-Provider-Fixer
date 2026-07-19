# 参与贡献

感谢你帮助改进 Android Credential Provider Fixer。所有贡献都应保持项目范围收敛，并维护可审计的安全模型。

## 环境配置

```sh
mise trust
just setup
just verify
```

使用 `just dev` 运行桌面应用，使用 `just dev-cli --help` 运行 CLI，使用 `just dev-docs` 运行文档站。代码和代码注释使用英文；面向用户的文档在 `docs/en` 与 `docs/zh` 中成对维护。根 `CHANGELOG.md` 是英文真源，`docs/zh/CHANGELOG.md` 是中文真源。

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

修改受管文档别名后运行 `just sync-docs`；该命令拒绝覆盖普通文件。提交变更前先运行 `just format`，再运行 `just verify`。

[English](../../CONTRIBUTING.md) | [中文](CONTRIBUTING.md)
