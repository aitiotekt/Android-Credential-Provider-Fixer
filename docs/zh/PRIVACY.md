# 隐私政策

Android Credential Provider Fixer 在本地执行所有工作，不收集、传输、出售或共享设备标识、凭据、passkey、应用清单或诊断日志。

Phase 1 只读取所选设备的 serial 与连接状态、厂商、型号、codename、Android/API 版本、前台 user ID、已注册 Credential Provider component，以及三个文档列明的 Credential Manager/Autofill setting。它不会读取 build fingerprint、密码管理器保险库、passkey 材料、账号或无关应用清单。

所选 ADB 路径和 onboarding 状态保存在应用私有配置目录中。快照与报告导出尚未实现；后续报告只会在用户主动操作后生成，并默认遮盖可识别信息。

应用不包含分析统计或崩溃上传 SDK。网络链接只会在用户主动操作后打开，ADB 永远不会被静默下载。

[English](../../PRIVACY.md) | [中文](PRIVACY.md)
