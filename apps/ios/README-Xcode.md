# Xcode 调试说明

## 打开工程

```bash
open apps/ios/AgentEnglish.xcodeproj
```

## 模拟器运行

1. 在 Xcode 顶部 scheme 选择 `AgentEnglish`。
2. 设备选择任意 iPhone Simulator。
3. 点击 Run。

命令行验证：

```bash
xcodebuild -project apps/ios/AgentEnglish.xcodeproj -scheme AgentEnglish -destination 'generic/platform=iOS Simulator' build
```

## 真机运行

1. 用 USB 连接 iPhone，并在手机上信任这台 Mac。
2. Xcode 打开 `AgentEnglish.xcodeproj`。
3. 选中 project navigator 里的 `AgentEnglish` target。
4. 在 `Signing & Capabilities` 里选择你的 Apple Developer Team。
5. 如果 bundle id 被占用，把 `com.agentenglish.mobile` 改成你自己的唯一 id。
6. 设备选择你的 iPhone，点击 Run。

当前工程是 Phase 3 前置调试壳，只负责让 Phase 2 原生 Tab 和本地学习底座能在 Xcode 里运行。`WKWebView`、bridge 和隐私提示仍按 Phase 3 正式 criteria 开发。
