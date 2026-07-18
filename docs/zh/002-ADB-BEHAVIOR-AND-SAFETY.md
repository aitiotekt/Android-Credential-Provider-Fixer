# ADB 行为与安全

ADB 由用户自行安装和提供。应用会搜索 GUI 进程环境和文档列明的平台路径，以独立 `version` 参数验证每个候选项，展示选择路径与实际解析路径，并通过 Rust 原生文件选择器支持明确选择。应用永远不会下载或安装 Platform-Tools。

每条设备命令都使用 `adb -s SERIAL`。serial 只能来自当前 `adb devices -l` 结果，不能由前端自由输入。应用不会自动选择设备；unauthorized、offline、no-permission 和未发现设备是不同状态。诊断前后端会重新枚举。当前 Android user 来自 `am get-current-user`，并必须解析为非负整数。

Phase 1 只读取厂商、型号、codename、Android release/API、前台 user、注册 Credential Provider service，以及 `credential_service`、`credential_service_primary` 和 `autofill_service`。它不读取 build fingerprint、日志、账号、保险库或 passkey 材料。Setting 会明确表示不存在、空值、有值或不可读取；未知 OEM 序列化保留原值并使报告标记为 incomplete。

只有 package service enumeration 针对 `android.service.credentials.CredentialProviderService` 返回的 component 才能成为候选。注册 service 不等于已经证明支持 passkey、当前环境兼容或保险库已解锁。

## 已验证的有限写入

唯一写模式是 Exclusive Provider Pin：把明确选择且当前已注册的 component 同时写为 `credential_service` 与 `credential_service_primary`，不修改 `autofill_service`，应用状态不保留 fallback provider。可读取但陌生的 OEM raw 值需要额外确认并保存到快照；不可读取值禁止写入。

写操作需要 GUI 两次确认或 CLI `--apply`，以及后端生成的五分钟一次性 plan；plan 绑定设备、user、注册 Provider 集合、component 和 before-state。执行遇到漂移即中止，逐字段写入并回读，任何部分失败都会恢复两个受管字段。原 setting 不存在时使用 `settings delete`，空值和 raw 值作为独立参数恢复，绝不拼接 shell 字符串。

CI 和常规测试不会调用 ADB。真实设备只读测试需要显式环境开关；写测试还需要第二个独立开关，并且不会进入自动 CI。

[English](../en/002-ADB-BEHAVIOR-AND-SAFETY.md) | [中文](002-ADB-BEHAVIOR-AND-SAFETY.md)
