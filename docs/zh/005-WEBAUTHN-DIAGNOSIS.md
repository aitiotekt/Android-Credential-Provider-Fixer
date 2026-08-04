# WebAuthn 诊断配套应用

[English](../en/005-WEBAUTHN-DIAGNOSIS.md)

原生 Android 应用 **WebAuthn 诊断**（`com.aitiotekt.webauthndiagnosis`）引导用户完成准备、浏览器测试与结果确认。它不读取提供方设置、不枚举应用、不运行 ADB，也不修复设备。最低支持 Android 9/API 28，第三方提供方说明区分 Android 14 及以上。在 Android 14+ 优先通过 AndroidX CredentialManager 打开凭据提供方设置，仅使用自身应用身份；较旧系统或启动失败时回退到系统设置，并明确提示手动搜索。返回不代表设置成功；实际 OEM 页面路由仍需设备验证。

[测试网站](/webauthn/) 创建名称明确的真实测试通行密钥，再在本地验证认证签名。创建前必须由用户明确同意；凭据可能由密码管理器同步。网站不识别实际提供方品牌，需要用户观察浏览器提示。

网站是通用测试工具。从文档站进入或没有已识别场景参数时，默认使用**探索模式**：在同一视图输入测试用户名、注册通行密钥并进行认证，每次认证使用新的挑战。修改用户名会丢弃之前的本地测试，页面仅保留当前用户名和凭据。

Android 应用通过 Custom Tabs 或浏览器回退打开 `/webauthn/?scene=webauthn-diagnosis-android-app`，默认进入**引导模式**，依次显示创建、验证和完成视图，并在成功后提醒返回 Android。普通访问不显示该提醒。工具栏可切换模式并保留当前测试；操作进行中禁用模式切换和用户名修改。场景参数仅影响展示，不覆盖来源地址，也不回传结果。

## 隐私和边界

页面仅在内存保存当前用户名、随机测试身份、公钥与挑战值，不上传 WebAuthn 响应，不使用 cookie、localStorage、sessionStorage、IndexedDB 或分析 SDK。不设会话时限，单次浏览器操作仍最多五分钟。刷新、关闭或清除页面即丢弃测试记录，**不会删除真实通行密钥**：请自行在密码管理器中删除 `acp-fixer.aitiotekt.com` 下与你输入的用户名或自动生成的 `WebAuthn test …` 名称对应的条目。

静态资源由 GitHub Pages 提供，托管方可能处理 IP 地址和访问日志；密码管理器同步适用其自身政策。`/webauthn/` 与文档站同源，不构成独立 RP 或存储安全边界。

验证只是浏览器本地诊断，不是服务端认证、提供方安全证明或其他应用正常的保证。Android 没有自动结果回传；成功视图代表用户确认网站两步都已完成。

## 开发和发布

Android 发布历史见 [Android 变更日志](CHANGELOG-ANDROID.md)，独立于桌面版本维护。

Android 工具链使用 JDK 26、Gradle 9.7.1、AGP 9.4.0 和 Kotlin/Compose 2.4.20，采用内置 Kotlin。Android Studio 需支持 AGP 9.4（Quail 4/2026.1.4 或后续兼容版本）。构建运行时 JDK 不改变应用 Java/Kotlin 目标 17 或 Android SDK 兼容范围。

在 Android Studio 中打开仓库根目录。根 Gradle multi-project build 将 `:webauthn-diagnosis` 映射至 `apps/android-app/app` 下的 Kotlin/Compose 模块；使用根 Wrapper，通过根目录的本地 `local.properties` 或 `ANDROID_HOME` 指定 SDK。Android 仍独立管理版本与商店发布。`apps/webauthn-web` 使用 Solid/Tailwind 和桌面的兼容配置，不引入桌面 IPC 或领域服务。本地 mise 默认安装 Java、Gradle；CI 只有 Android job 启用它们。`just check-android` 执行无设备 JVM 测试、Lint 和编译；安装 Playwright 浏览器后使用 `just check-web` 验证网站。

`just set-version VERSION`（或 `--app default` / `--app desktop`）更新桌面、CLI 和 Web package 版本。`--app android` 仅更新 Android，新版本自动增加 versionCode；Android 重构建可用 `--version-code N` 显式指定更大编号。Android 独立维护双语变更日志，Web 变更仍进入根变更日志；命令不会自动搬移 Unreleased 内容。

Web 流水线合并 VitePress 与 SPA 为一个 Pages 产物，仅 main 部署，release 和 PR 只验证。Android 流水线由维护者在 main/release 手动触发，默认 `build-only`，签名 AAB 在 Actions 保留 30 天，不发布 APK 或 Android GitHub Release。元数据 `internal` 策略在保存产物后上传 Play 内部测试；上传失败使任务失败，保留 AAB，不盲目重试可能已提交的发布。

维护者需要配置 Play App Signing、上传密钥与受保护的 `android-release` Environment；API 上传另需最小授权的 Play 服务账号。首次 Console 初始化与上传、商店材料、隐私/Data safety 和账号相关测试条件仍需人工处理。仅商店分发不禁止开发者编译本地 debug APK，但不提供侧载分发渠道。

## Android 设备开发 {#android-device-development}

先在 Android Studio 的 Device Manager 中启动模拟器（凭据提供方指引建议使用 Android 14+），或明确连接已授权的开发设备。通过固定的 mise 工具链运行：

```sh
mise exec -- just dev-android
mise exec -- just dev-android --device emulator-5554 --no-interactive
mise exec -- just dev-android --device emulator-5554 --watch
mise exec -- just dev-android --adb "/path with spaces/platform-tools/adb" --interactive
```

第一条命令列出已运行的设备，模拟器优先，通过编号选择；即使只有一台也不自动选择。非交互模式必须提供精确的 `--device` 序列号，离线、未授权等不可用目标会被拒绝。默认仅在 stdin 和 stdout 都为终端时交互，`--interactive` 与 `--no-interactive` 可显式覆盖。`--help` 不发现 ADB、不操作设备。

`scripts/dev-cli.mts android dev` 从显式路径、根 `local.properties`、SDK 环境变量、常见 SDK 位置或 PATH 查找并验证 ADB。所有平台均通过 Java 执行仓库内 Gradle Wrapper JAR，避免 Windows 命令字符串执行，仅构建 `:webauthn-diagnosis:assembleDebug`。安装前重新检查所选设备连接标识和前台 Android 用户，再覆盖安装 debug APK，仅启动本应用的 `MainActivity`。不会启动模拟器、管理 ADB server、卸载、清空应用数据或修改设置。商店签名版本可能与 debug 签名冲突：命令会失败，不会自动删除已有应用；建议使用独立开发模拟器。

`--watch` 对 Android 源码、资源及 Gradle 配置变动防抖，串行执行部署；构建期间的改动会触发后续构建。构建失败后继续等待下一次修改。不会自动切换设备或 Android 用户，连接标识或用户变化后应停止命令并重新选择。Ctrl+C 停止监听并取消当前命令。更新方式为覆盖安装后重新启动，**不保证保留进程或界面状态**。需要支持范围内的 Compose 原位更新时，请使用 Android Studio [Live Edit / Apply Changes](https://developer.android.com/studio/run#apply-changes)，本 CLI 不模拟 IDE 的这些能力。原生改动不会刷新独立的 WebAuthn 网站。

这一主动触发的开发部署不改变仅商店分发策略；常规检查与 CI 使用模拟执行器，不向设备安装或启动应用。

## 验收状态

自动化通过 Playwright Credentials 在 Chromium 和 Firefox 中替换虚拟认证器。WebKit 覆盖暂时停用，待 Playwright 的 Linux WebKit 虚拟认证器无需项目专用兼容补丁即可通过 SimpleWebAuthn 的 `PublicKeyCredential` 构造函数检查后恢复。这些测试验证应用流程及签名拒绝逻辑，不代表真实系统、Google 或 Bitwarden 集成已通过。真实集成、设备上的无障碍和生命周期、Play 上传及审核均需维护者另行验证。普通检查不启动 ADB，也不创建真实通行密钥。
