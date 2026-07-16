# 隐私政策

Android Credential Provider Fixer 在本地执行所有工作，不收集、传输、出售或共享设备标识、凭据、passkey、应用清单或诊断日志。

当前工程基线不会执行 ADB，也不会访问 Android 设备。未来的诊断构建只会读取项目文档列明的设备与 Credential Provider 元数据，不会读取密码管理器保险库内容或 passkey 材料。

本地设置、快照和报告将保存在应用数据目录中。报告只会在用户主动操作后生成，并默认遮盖完整 serial、可识别的 fingerprint 数据、用户名、宿主机路径、凭据标识和无关 package 数据。

应用不包含分析统计或崩溃上传 SDK。网络链接只会在用户主动操作后打开，ADB 永远不会被静默下载。

[English](../../PRIVACY.md) | [中文](PRIVACY.md)
