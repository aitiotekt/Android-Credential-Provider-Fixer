# 支持设备与排障

## 规划支持范围

| 环境 | 状态 |
| --- | --- |
| Android 14 / API 34 及以上 | 规划支持范围 |
| Xiaomi HyperOS | 初始验证环境 |
| 其他 OEM 设备 | 优先只读诊断；写入必须显示实验性警告 |
| Android 13 及以下 | 只显示设备信息，不支持修复 |
| 工作资料与其他 user | 检测并说明；v1 只修改显式确认的前台 user |

## 常见症状

- 密码管理器显示为首选，但 Google Password Manager 接管 passkey 创建。
- Autofill 正常，而 Credential Manager 没有绑定 provider。
- 禁用另一个 provider 后，WebAuthn 操作看起来没有响应。
- `credential_service_primary` 指向的 provider 不在 `credential_service` 中。

这些症状本身不能确定责任组件。service 注册、enabled 状态、primary 状态、autofill 状态、浏览器行为、provider 锁定状态和 OEM framework 行为都是不同事实。

## 低风险检查

更新密码管理器、浏览器与系统组件；通过密码管理器支持的入口进入 provider 设置；切换到其他选项再切回；重启设备；解锁一次 provider；然后分别重试 passkey 创建与登录。不要把删除已有 passkey 当作排障步骤。

ADB 缺失时，未来 UI 会展示可复制的安装说明和 Platform-Tools 官方链接，但不会运行 Homebrew、Winget、Scoop 或 Chocolatey。unauthorized 设备需要解锁并接受 USB 调试授权；offline 设备应优先重新连接，而不是直接重启全局 ADB 服务。

[English](../en/003-SUPPORT-AND-TROUBLESHOOTING.md) | [中文](003-SUPPORT-AND-TROUBLESHOOTING.md)
