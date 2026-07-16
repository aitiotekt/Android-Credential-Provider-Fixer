# 参与贡献

感谢你帮助改进 Android Credential Provider Fixer。所有贡献都应保持项目范围收敛，并维护可审计的安全模型。

## 环境配置

```sh
mise trust
just setup
just verify
```

使用 `just dev` 运行桌面应用，使用 `just dev-cli --help` 运行 CLI，使用 `just dev-docs` 运行文档站。代码和代码注释使用英文；面向用户的文档在 `docs/en` 与 `docs/zh` 中成对维护。

## 工程规则

- 领域策略与编排放在 `packages/core`，具体平台访问放在对应 app adapter。
- 不得向 WebView 暴露任意命令，也不得加入 shell 字符串执行。
- 未实现获批的 plan、快照、验证和恢复流程前，不得加入设备写操作。
- 默认测试不得连接真实设备。
- 行为变化应更新当前状态文档；历史变化应记录在 changelog 中。

修改受管文档别名后运行 `just sync-docs`；该命令拒绝覆盖普通文件。提交变更前先运行 `just format`，再运行 `just verify`。

[English](../../CONTRIBUTING.md) | [中文](CONTRIBUTING.md)
