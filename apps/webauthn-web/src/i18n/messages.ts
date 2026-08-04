export const en = {
	title: "WebAuthn Diagnosis",
	language: "Language",
	mode: "Test mode",
	explore: "Explore",
	guided: "Guided",
	exploreHelp:
		"Choose a test username, register a passkey, and authenticate as often as you like on this page. Changing the username starts a new test.",
	guidedHelp:
		"Follow three steps: create a test passkey, verify it, and review the result.",
	username: "Username",
	usernamePlaceholder: "e.g. passkey-test",
	usernameHelp:
		"Use a test name of up to 64 characters. Only the current test is kept in this page's memory.",
	restart: "Start a new test",
	intro: "Test creating and using a passkey in this browser.",
	consent:
		"I understand this creates a real test passkey in my password manager. It may sync to other devices; I will delete it manually afterward.",
	create: "Create test passkey",
	verify: "Verify test passkey",
	clear: "Clear test data",
	creating: "In progress: Creating a test passkey",
	verifying: "In progress: Verifying the passkey",
	workingHelp: "Complete the request in your browser to continue.",
	cleared: "Cleared: Page test data removed",
	clearedHelp:
		"You can start a new test. Any passkey in your password manager still needs to be deleted manually.",
	ready: "Ready to test",
	registered: "Success: Test passkey created",
	success: "Success: Creation and signature verification succeeded",
	registeredHelp:
		"Next: Use the same passkey to verify a fresh challenge. Check the browser prompt for your intended provider.",
	successHelp:
		"This verifies this test session locally, not a server login or every app.",
	androidReturn:
		"Next: Return to the Android app and confirm your result there.",
	privacyTitle: "Privacy and cleanup",
	privacy:
		"The username, test identifier, public key and current challenge stay in this page's memory. No WebAuthn responses are uploaded. Refreshing, closing the page or clearing data ends this test; there is no session time limit.",
	cleanup:
		"Clearing this page does not delete the passkey in your password manager. Under acp-fixer.aitiotekt.com, find the username you entered or the generated WebAuthn test name and delete that entry there.",
	hosting:
		"GitHub Pages serves the site's files and may process IP addresses and access logs. Your password manager may sync the test passkey under its own policy.",
	help: "If your provider is missing, check its setup and your system's password/passkey settings. A failed test alone does not establish a device fault.",
	desktop: "ACP Fixer documentation",
	testName: "Test entry",
	stepCreate: "Create",
	stepVerify: "Verify",
	stepFinish: "Finish",
	errors: {
		cancelled: {
			summary: "Not completed: Browser request did not finish",
			detail:
				"The browser did not complete the request. It may have been cancelled, timed out, or found no usable credential. Try again.",
		},
		unsupported: {
			summary: "Unavailable: This environment does not support the test",
			detail:
				"This browser or context does not support the requested passkey test. Try an updated browser outside an embedded frame.",
		},
		timedOut: {
			summary: "Timed out: Browser operation took too long",
			detail:
				"This browser operation exceeded five minutes. Try again; any passkey already created must be removed manually after testing.",
		},
		invalidUsername: {
			summary: "Cannot start: Check the username",
			detail: "Enter a test username of 1 to 64 characters.",
		},
		verificationFailed: {
			summary: "Failed: Response verification did not pass",
			detail:
				"The response could not be verified. Start a new test; this does not identify a provider or device fault.",
		},
		unsupportedOrigin: {
			summary: "Unavailable: Testing is disabled on this address",
			detail:
				"Testing is disabled on this origin. Open the official test website, or http://localhost:1430/webauthn/ for local development. IP addresses such as 127.0.0.1 cannot be used for this test.",
		},
		unsupportedAttestation: {
			summary: "Failed: Attestation format is not accepted",
			detail:
				"The authenticator returned an attestation format this privacy-focused test does not accept.",
		},
	},
};
export type Messages = {
	[K in keyof typeof en]: K extends "errors"
		? { [E in keyof typeof en.errors]: { summary: string; detail: string } }
		: string;
};
export const zh: Messages = {
	title: "WebAuthn 诊断",
	language: "语言",
	mode: "测试模式",
	explore: "探索模式",
	guided: "引导模式",
	exploreHelp:
		"输入测试用户名，注册通行密钥，然后在当前页面按需反复认证。修改用户名会开始新的测试。",
	guidedHelp: "依次创建测试通行密钥、验证并查看结果，完成三步测试。",
	username: "用户名",
	usernamePlaceholder: "例如 passkey-test",
	usernameHelp: "请使用不超过 64 个字符的测试名称。页面内存仅保留当前测试。",
	restart: "开始新测试",
	intro: "检查在当前浏览器中创建和使用通行密钥的流程。",
	consent:
		"我理解这会在密码管理器中创建真实测试通行密钥，可能同步到其他设备；测试后需要自行删除。",
	create: "创建测试通行密钥",
	verify: "验证测试通行密钥",
	clear: "清除测试数据",
	creating: "进行中：正在创建测试通行密钥",
	verifying: "进行中：正在验证通行密钥",
	workingHelp: "请在浏览器弹窗中完成操作。",
	cleared: "已清除：当前页面的测试数据",
	clearedHelp: "可以开始新的测试。密码管理器中的通行密钥仍需自行删除。",
	ready: "准备测试",
	registered: "成功：已创建测试通行密钥",
	success: "成功：通行密钥创建与签名验证均已完成",
	registeredHelp:
		"下一步：请使用刚创建的通行密钥完成验证，并观察浏览器弹窗是否使用了你预期的凭据提供方。",
	successHelp:
		"这仅代表本次测试在本地验证成功，不代表服务端登录或所有应用正常。",
	androidReturn: "下一步：请返回 Android 应用确认结果。",
	privacyTitle: "隐私与清理",
	privacy:
		"用户名、测试标识、公钥和当前随机挑战仅保存在当前页面内存，不上传 WebAuthn 响应。刷新、关闭页面或清除数据会结束测试，不设会话时限。",
	cleanup:
		"清除页面数据不会删除密码管理器中的通行密钥。请在 acp-fixer.aitiotekt.com 下找到你输入的用户名或自动生成的 WebAuthn test 名称，并自行删除对应条目。",
	hosting:
		"GitHub Pages 提供网站静态资源，可能处理 IP 地址和访问日志。密码管理器可能按照其自身政策同步测试通行密钥。",
	help: "如果未看到预期提供方，请检查密码管理器配置以及系统的密码、通行密钥设置。一次失败不能确定设备故障。",
	desktop: "ACP Fixer 使用文档",
	testName: "测试条目",
	stepCreate: "创建",
	stepVerify: "验证",
	stepFinish: "完成",
	errors: {
		cancelled: {
			summary: "未完成：浏览器请求未完成",
			detail:
				"浏览器未完成请求：可能已取消、超时，或没有找到可用凭据。可以重试。",
		},
		unsupported: {
			summary: "不可用：当前环境不支持此测试",
			detail:
				"当前浏览器或页面环境不支持此测试。请使用更新的浏览器，并避免在嵌入页面中打开。",
		},
		timedOut: {
			summary: "已超时：浏览器操作超过时限",
			detail:
				"本次浏览器操作已超过五分钟，请重试。如已创建通行密钥，测试后仍需自行删除。",
		},
		invalidUsername: {
			summary: "无法开始：请检查用户名",
			detail: "请输入 1 至 64 个字符的测试用户名。",
		},
		verificationFailed: {
			summary: "失败：返回结果未通过验证",
			detail: "无法验证返回结果，请重新测试。这不能确定是提供方或设备故障。",
		},
		unsupportedOrigin: {
			summary: "不可用：当前地址不允许测试",
			detail:
				"当前地址不允许进行测试。请打开正式测试网站；本地开发请使用 http://localhost:1430/webauthn/，不能使用 127.0.0.1 等 IP 地址。",
		},
		unsupportedAttestation: {
			summary: "失败：不接受此证明格式",
			detail: "认证器返回了本测试出于隐私考虑不接受的证明格式。",
		},
	},
};
