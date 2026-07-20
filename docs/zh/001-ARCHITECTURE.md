# 架构

仓库采用端口与适配器结构，但不会把每个小函数机械拆成独立层。

```text
SolidJS WebView -> 收敛的 Tauri IPC -> Tauri app adapter -> core use case
                                                        -> CommandRunner port
CLI presentation ------------------> CLI app adapter ----> CommandRunner port
```

## Core

`packages/core` 包含应用 DTO、领域状态、稳定错误码、use-case 编排和 adapter trait，不依赖 Tauri、Clap 或具体进程实现。`CommandRequest` 保存原生可执行路径、参数数组、超时与聚合输出上限；`CommandOutput` 以字节保存 stdout 和 stderr，避免非 UTF-8 设备输出被静默破坏。

Phase 1 ADB use case 只能使用已验证的 ADB 路径、当前设备快照中的 serial、解析后的非负 user ID、固定 Credential Provider service action 和三个 setting 的读取 allowlist 构造请求。通用 runner 只是 Rust 内部端口，不会成为 IPC 或 CLI 用户输入面。

应用模型明确区分值对象与实体。ADB 验证结果、设备属性、组件、设置值、诊断结论和错误是不可变值；ADB 发现、ADB 选择、设备枚举、诊断、预览、操作计划和执行是会话实体，具有不可混用的不透明 ID 与明确父 ID；快照是带 revision 的持久化实体。`DiagnosisReport.completeness` 只描述报告完整程度，与诊断实体的异步生命周期分离。

后端会话维护单调递增的 revision 与唯一的最新诊断 ID。每个异步操作都在开始时捕获 revision 与父实体 ID，并在发布结果前再次核对，因此迟到的旧诊断不能覆盖新的设备上下文。诊断仅在内存中保留最新实体，以及仍被预览、计划或执行引用的实体。

Core 所有的变更状态机与抽象快照存储使用 schema v2；`packages/storage` 是 GUI 与 CLI 共用的本地文件 adapter。预览、操作计划与执行都会保留源诊断 ID。创建计划时先原子保存 `planned` 快照，再消费预览；首次可能写入前先保存 `executing`。取消、过期、状态漂移、应用、自动恢复或手动恢复都会进入不可重放的终态。旧 v1 文件保留在磁盘，只作为不支持警告展示，绝不参与恢复。

## 应用

Tauri app 使用 `tauri-plugin-shell` 的 Rust API 实现 `CommandRunner`，不安装 JavaScript binding，WebView capability 中也没有 shell 权限。CLI 使用 `tokio::process::Command` 实现相同端口。两个 adapter 都使用参数数组、有限字节收集、超时和子进程终止。

前端负责展示、不透明候选项与设备选择、确认、本地化、主题和无障碍交互。有状态的应用服务使用 `class XxxService`，通过构造函数接收依赖，以 private 状态和原型方法明确实例边界。`injection-js` 使用 `InjectionToken`、显式的 `useFactory: (...deps) => new XxxService(...)` provider 与依赖列表组合服务，不使用装饰器、环境式注入或反射元数据。`createXxx()` 仅保留给无状态 controller、可替换 adapter 或可复用类库的构造边界。每个领域服务持有自己发布的事件：私有 RxJS `DomainEvent<T>` Subject 只向下游领域服务提供类型精确的只读 Observable。系统中没有共享事件总线、全局判别事件联合或事件类型过滤器；渲染层只读取 Solid 状态或不可变快照，不订阅这些事件。下游服务把上游事件转为可审计的 `invalidated` 状态，且不会修改其他服务的 signal。

订阅与会话 scope 的资源所有权遵循 TC39 显式资源管理：同步资源提供幂等的 `[Symbol.dispose]()`，词法所有者使用 `using`，动态聚合使用 `DisposableStack`。单个清理栈命名为 `disposableStack`，或使用 `constructionStack` 这类描述职责的单数名称；`resource` 与 `resources` 专指领域 `EntityResource` 状态。Subject 完成与 RxJS subscription 退订由发布或订阅服务自己的资源栈持有，只有确实需要等待的清理才使用异步形式。TypeScript 仅启用范围明确的 `ESNext.Disposable` 提案类型库。Vite 与 Vitest 复用同一份 `unplugin-swc` 兼容配置。Chrome 111、Edge 111 与 Safari 16.4 的具体引擎版本是唯一真源；Vite target 字符串与 SWC target map 从同一对象派生，不再混用浏览器版本和 ECMAScript 年度版本。Solid 编译器先运行，SWC 随后 lowering `using`，并根据实际用法注入精确的 core-js `Symbol.dispose`、`DisposableStack` 与 `SuppressedError` 模块。`unplugin-swc` 会关闭 Vite 顶层 Oxc 源码转换，但仍保留如实声明的最终 `build.target` 与 Oxc minifier。仅供宿主工具使用的构建和测试配置位于 `apps/tauri-app/config`，不会混入 WebView 源码图。jsdom 单元测试不代表 Safari 兼容性，源码 lowering 也不能证明 Vite 开发客户端支持最低版本生产 WebView；未来的 Vitest Browser 测试将使用独立的 Playwright WebKit 项目并复用相同转换配置。

`WorkflowService.view` 根据这些资源派生唯一当前领域视图。页面容器只注入自身服务与 workflow 意图，展示组件只接收值和回调。诊断资源分为 `idle`、`resolving`、`resolved`、`failed` 和保留但不可继续使用的 `invalidated`；只有实体 ID 与会话最新诊断 ID 一致时才渲染结果。前端不解析 ADB 输出。Tailwind CSS 4 使用 CSS-first 语义 token，本地 Solid 组件原语提供一致的尺寸、variant、嵌套圆角、焦点状态和间距，不增加组件运行时依赖。Park UI 仅作为设计规范参考；工作流组件不依赖 Park UI、Ark UI 或 Panda CSS。

IPC schema v2 将 ADB 选择绑定到 Discovery ID，将设备枚举绑定到 ADB Selection ID，将诊断绑定到 Enumeration 与 Device ID，并将所有变更实体绑定到 Diagnosis ID。原生路径与设备序列号保留在后端会话中；跟随系统、浅色和深色偏好由后端验证并保存在应用私有偏好文件中，WebView 不获得文件系统权限。每次真实或演示工作流都运行在可统一释放的子 Injector 中；根 Injector 不提供 `DeviceGateway`，真实子 Injector 绑定 Tauri adapter，演示子 Injector 只绑定确定性的 fixture adapter，因此演示模式无法回退到设备 IPC。

子 Session scope 同时是其对象图的 arena 式生命周期边界。服务、自有 Subject、subscription、Solid effect 与教程资源都登记在该 scope 下，并按依赖安全的逆序整体释放；渲染层不持有或逐个清理领域订阅。使用子 Injector 的组件必须位于以 Session scope 身份为 key 的 Solid 边界下，因此替换 scope 会重建所有 Context 使用者，不会让它们继续连接旧工作流对象图。全局教程入口替换当前真实或演示 scope 前必须确认，设备写入期间拒绝切换，并且始终创建新的隔离演示 Session，从第一个工作流视图及其 DOM 目标挂载后启动 Driver.js。教程元数据区分纯说明目标和可操作控件；用户成功操作当前高亮控件后，只有在下一目标挂载时才推进，离开引导路径则先结束 Driver 再继续工作流。锁定操作结果会继续进入快照与还原教程，而不是提前结束。演示标识和退出操作在 session shell 层统一渲染，因此每个模拟流程视图都有一致的退出路径，退出时会释放完整 Demo scope。

## 交付架构

`acp-fixer-metadata.toml` 是版本、发布 target 和预发布签名策略的真源。`scripts/lib/release` 下的类型化模块负责版本/ref 策略、staging、许可证声明、manifest 与幂等决策；GitHub workflow YAML 只负责调度。Tests、Release 和 Docs 使用独立 workflow 与最小权限。发布必须绑定精确的成功 Tests run 与源码 SHA；各平台 job 先上传私有输入，再由唯一汇总 job 验证完整的八产物矩阵，之后才生成 attestation 并发布。稳定版 macOS 和 Windows 产物不能降级为未签名。workflow 与发布工具永不发现或调用 ADB。

[English](../en/001-ARCHITECTURE.md) | [中文](001-ARCHITECTURE.md)
