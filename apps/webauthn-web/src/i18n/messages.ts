export const en = {
	title: "WebAuthn Diagnosis",
	language: "Language",
	intro: "Test creating and using a passkey in this browser.",
	consent:
		"I understand this creates a real test passkey in my password manager. It may sync to other devices; I will delete it manually afterward.",
	create: "Create test passkey",
	verify: "Verify test passkey",
	clear: "Clear test data",
	working: "Waiting for your browser…",
	ready: "Ready to test",
	registered: "Test passkey created",
	success: "Creation and signature verification succeeded",
	registeredHelp:
		"Now use the same passkey to verify a fresh challenge. Check the browser prompt for your intended provider.",
	successHelp:
		"This verifies this test session locally, not a server login or every app. Return to the Android app and confirm your result there.",
	privacyTitle: "Privacy and cleanup",
	privacy:
		"Challenges, the test identifier and public key stay in this page's memory. No WebAuthn responses are uploaded. Refreshing, closing the page or clearing data ends this test. A session expires after one hour.",
	cleanup:
		"Clearing this page does not delete the passkey in your password manager. Look for the WebAuthn test entry for acp-fixer.aitiotekt.com and delete it there.",
	hosting:
		"GitHub Pages serves the site's files and may process IP addresses and access logs. Your password manager may sync the test passkey under its own policy.",
	help: "If your provider is missing, check its setup and your system's password/passkey settings. A failed test alone does not establish a device fault.",
	desktop: "ACP Fixer documentation",
	testName: "Test entry",
	stepCreate: "Create",
	stepVerify: "Verify",
	stepFinish: "Finish",
	errors: {
		cancelled:
			"The browser did not complete the request. It may have been cancelled, timed out, or found no usable credential. Try again.",
		unsupported:
			"This browser or context does not support the requested passkey test. Try an updated browser outside an embedded frame.",
		expired:
			"This test has expired. Clear the old test passkey in your password manager and start again.",
		verificationFailed:
			"The response could not be verified. Start a new test; this does not identify a provider or device fault.",
		unsupportedOrigin:
			"Testing is disabled on this origin. Open the official test website, or http://localhost:1430/webauthn/ for local development. IP addresses such as 127.0.0.1 cannot be used for this test.",
		unsupportedAttestation:
			"The authenticator returned an attestation format this privacy-focused test does not accept.",
	},
};
export type Messages = {
	[K in keyof typeof en]: K extends "errors"
		? { [E in keyof typeof en.errors]: string }
		: string;
};
export const zh: Messages = {
	title: "WebAuthn 诊断",
	language: "语言",
	intro: "检查在当前浏览器中创建和使用通行密钥的流程。",
	consent:
		"我理解这会在密码管理器中创建真实测试通行密钥，可能同步到其他设备；测试后需要自行删除。",
	create: "创建测试通行密钥",
	verify: "验证测试通行密钥",
	clear: "清除测试数据",
	working: "正在等待浏览器操作…",
	ready: "准备测试",
	registered: "已创建测试通行密钥",
	success: "创建与签名验证成功",
	registeredHelp:
		"请使用刚创建的通行密钥完成验证，并观察浏览器弹窗是否使用了你预期的凭据提供方。",
	successHelp:
		"这仅代表本次测试在本地验证成功，不代表服务端登录或所有应用正常。请返回 Android 应用确认结果。",
	privacyTitle: "隐私与清理",
	privacy:
		"随机挑战、测试标识和公钥仅保存在当前页面内存，不上传 WebAuthn 响应。刷新、关闭页面或清除数据会结束测试。会话最多保留一小时。",
	cleanup:
		"清除页面数据不会删除密码管理器中的通行密钥。请找到 acp-fixer.aitiotekt.com 下名称以 WebAuthn test 开头的测试条目并自行删除。",
	hosting:
		"GitHub Pages 提供网站静态资源，可能处理 IP 地址和访问日志。密码管理器可能按照其自身政策同步测试通行密钥。",
	help: "如果未看到预期提供方，请检查密码管理器配置以及系统的密码、通行密钥设置。一次失败不能确定设备故障。",
	desktop: "ACP Fixer 使用文档",
	testName: "测试条目",
	stepCreate: "创建",
	stepVerify: "验证",
	stepFinish: "完成",
	errors: {
		cancelled:
			"浏览器未完成请求：可能已取消、超时，或没有找到可用凭据。可以重试。",
		unsupported:
			"当前浏览器或页面环境不支持此测试。请使用更新的浏览器，并避免在嵌入页面中打开。",
		expired:
			"本次测试已过期。请自行清理密码管理器中的旧测试凭据，再开始新测试。",
		verificationFailed:
			"无法验证返回结果，请重新测试。这不能确定是提供方或设备故障。",
		unsupportedOrigin:
			"当前地址不允许进行测试。请打开正式测试网站；本地开发请使用 http://localhost:1430/webauthn/，不能使用 127.0.0.1 等 IP 地址。",
		unsupportedAttestation: "认证器返回了本测试出于隐私考虑不接受的证明格式。",
	},
};
