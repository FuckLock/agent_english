#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftData
import SwiftUI

struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \DailyStatRecord.dayKey, order: .reverse) private var dailyStats: [DailyStatRecord]

    private let accountSessionClient = AccountSessionClient()

    @State private var sourceLanguage = "English"
    @State private var targetLanguage = "简体中文"
    @State private var serviceTier: ModelServiceTier = .free
    @State private var preferredModelID = "free-translate"
    @State private var catalog = ModelCatalogSnapshot.preview(currentTier: .free)
    @State private var quota = ModelCatalogSnapshot.preview(currentTier: .free).quota
    @State private var audioQuota = ModelCatalogSnapshot.previewAudioQuota(for: .free)
    @State private var statusMessage: String?
    @State private var pendingClearAction: SettingsClearAction?
    @State private var showsModelPicker = false
    @State private var isRefreshingCatalog = false
    @State private var accountSession: AuthSession?
    @State private var isAccountActionInFlight = false
    @State private var isDevAuthEnabled = AccountSessionClient.isDevAuthEnabled()

    var body: some View {
        Form {
            if let statusMessage {
                Section {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("账号状态") {
                LabeledContent("当前账号", value: accountDisplayName)
                LabeledContent("当前等级", value: serviceTier.displayName)
                Text(accountHint)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Button {
                    Task {
                        await bootstrapAccountSession(silent: false)
                    }
                } label: {
                    Label("刷新账号状态", systemImage: "arrow.clockwise")
                }
                .disabled(isAccountActionInFlight)

                Button {
                    markPublicLoginPlaceholder(provider: "Apple")
                } label: {
                    Label("Apple 登录", systemImage: "apple.logo")
                }

                Button {
                    markPublicLoginPlaceholder(provider: "Google")
                } label: {
                    Label("Google 登录", systemImage: "person.crop.circle.badge.checkmark")
                }

                if isDevAuthEnabled {
                    Button {
                        Task {
                            await loginDevPro()
                        }
                    } label: {
                        Label("Pro 测试", systemImage: "person.badge.shield.checkmark")
                    }
                    .disabled(isAccountActionInFlight)

                    Button {
                        Task {
                            await loginDevMax()
                        }
                    } label: {
                        Label("Max 测试", systemImage: "sparkles")
                    }
                    .disabled(isAccountActionInFlight)
                } else {
                    Text("生产环境隐藏测试账号入口。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Button {
                    Task {
                        await logoutAccount()
                    }
                } label: {
                    Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right")
                }
                .disabled(isAccountActionInFlight)

                Button(role: .destructive) {
                    statusMessage = "删除账号暂未开放：正式账号删除需要后端确认。"
                } label: {
                    Label("删除账号", systemImage: "person.crop.circle.badge.xmark")
                }
            }

            Section("今日学习") {
                LabeledContent("翻译页数", value: "\(dailySummary.translatedPageCount)")
                LabeledContent("收藏数", value: "\(dailySummary.savedItemCount)")
                LabeledContent("复习完成", value: "\(dailySummary.reviewCompletedCount)")
                LabeledContent("连续使用", value: "\(dailySummary.currentStreakDays) 天")
            }

            Section("服务等级 / Service Tier") {
                LabeledContent("当前等级", value: serviceTier.displayName)
                LabeledContent("可用档位", value: "Free / Pro / Max")
                LabeledContent("额度 / quota", value: quotaSummary)
                LabeledContent("听音额度", value: audioQuotaSummary)
                    .accessibilityIdentifier("audio-quota-summary")
                Text("当前等级由账号服务确认；设置页只展示可用档位和默认模型。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("默认模型") {
                Button {
                    showsModelPicker = true
                } label: {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(selectedModelLabel)
                                    .font(.headline)
                                Text("\(serviceTier.displayName) 等级默认模型")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }

                        HStack(spacing: 10) {
                            Label("额度 \(quota.used)/\(quota.limit)", systemImage: "speedometer")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Label("选择模型", systemImage: "square.stack.3d.up")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)

                if isRefreshingCatalog {
                    ProgressView("正在同步模型目录…")
                        .font(.footnote)
                } else {
                    Button {
                        Task {
                            await refreshCatalog(silent: false)
                        }
                    } label: {
                        Label("同步模型目录", systemImage: "arrow.clockwise")
                    }
                    .font(.footnote)
                }
            }

            Section("目标语言 / targetLanguage") {
                TextField("源语言", text: $sourceLanguage)
                TextField("目标语言", text: $targetLanguage)

                Button {
                    saveLanguages()
                } label: {
                    Label("保存目标语言", systemImage: "character.cursor.ibeam")
                }
            }

            Section("Privacy 与数据") {
                Button(role: .destructive) {
                    pendingClearAction = .translationCache
                } label: {
                    Label("清空翻译缓存", systemImage: "trash")
                }

                Button(role: .destructive) {
                    pendingClearAction = .websiteData
                } label: {
                    Label("清理网站数据", systemImage: "globe.badge.chevron.backward")
                }

                Button(role: .destructive) {
                    pendingClearAction = .learningData
                } label: {
                    Label("清空学习数据", systemImage: "exclamationmark.triangle")
                }
            }

            Section("隐私说明 / Privacy") {
                Text("Free 文本翻译只会在你主动触发时发送到自有翻译代理，再由翻译代理转发到第三方通用翻译服务（如 Google / 微软）。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Text("Pro / Max 文本翻译与解释只会在你主动触发时发送到自有大模型 gateway，由后端按当前等级转发到对应模型服务。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                PrivacyDisclosureView(
                    serviceTierName: serviceTier.displayName,
                    targetLanguage: targetLanguage
                )
                WebsiteDataPromptView()
            }
        }
        .navigationTitle("偏好与隐私")
        .onAppear(perform: syncFormState)
        .task {
            await bootstrapAccountSession(silent: true)
            await refreshCatalog(silent: true)
        }
        .sheet(isPresented: $showsModelPicker) {
            ModelPickerSheet(
                currentTier: serviceTier,
                selectedModelID: preferredModelID,
                catalog: catalog,
                onRefresh: {
                    await refreshCatalog(silent: false)
                },
                onSelect: { option in
                    chooseModel(option)
                }
            )
        }
        .confirmationDialog(
            pendingClearAction?.title ?? "",
            isPresented: Binding(
                get: { pendingClearAction != nil },
                set: { isPresented in
                    if !isPresented {
                        pendingClearAction = nil
                    }
                }
            ),
            titleVisibility: .visible
        ) {
            if let pendingClearAction {
                Button(pendingClearAction.buttonTitle, role: .destructive) {
                    performClear(pendingClearAction)
                }
            }
        } message: {
            Text(pendingClearAction?.message ?? "")
        }
    }

    private var dailySummary: DailyStatsSummary {
        _ = dailyStats
        return (try? StatisticsRepository(modelContext: modelContext).summary())
            ?? DailyStatsSummary(translatedPageCount: 0, savedItemCount: 0, reviewCompletedCount: 0, currentStreakDays: 0)
    }

    private var selectedModelLabel: String {
        catalog.option(id: preferredModelID)?.displayName ?? "Free 服务 · 轻量翻译"
    }

    private var quotaSummary: String {
        "\(quota.used) / \(quota.limit) · 剩余 \(quota.remaining)"
    }

    private var audioQuotaSummary: String {
        "今日 \(audioQuota.limit) 分钟 · 剩余 \(audioQuota.remaining) 分钟"
    }

    private var accountDisplayName: String {
        guard let account = accountSession?.account else {
            return "游客 Free"
        }
        if let email = account.email, !email.isEmpty {
            return "\(account.displayName) · \(email)"
        }
        return account.displayName
    }

    private var accountHint: String {
        guard let account = accountSession?.account else {
            return "游客可使用 Free 服务；Apple / Google 登录入口会并列保留。"
        }
        switch account.kind {
        case .guest:
            return "游客可使用 Free 服务；登录后由后端确认 Pro 或 Max 权益。"
        case .signedIn:
            return "正式账号权益由后端确认，客户端不保存模型供应商密钥。"
        case .devPro:
            return "当前使用 Pro 测试账号，适合验证 Pro 模型和额度状态。"
        case .devMax:
            return "当前使用 Max 测试账号，适合验证 Max 模型和等级不可用状态。"
        }
    }

    private func syncFormState() {
        do {
            applyPreferences(
                try ModelServiceSettingsStore(modelContext: modelContext).loadPreferences()
            )
        } catch {
            statusMessage = "设置加载失败：\(error.localizedDescription)"
        }
    }

    private func bootstrapAccountSession(silent: Bool) async {
        guard !isAccountActionInFlight else {
            return
        }
        isAccountActionInFlight = true
        defer {
            isAccountActionInFlight = false
        }

        do {
            let session = try await accountSessionClient.bootstrapGuestSession()
            applyAccountSession(session)
            if !silent {
                statusMessage = "账号状态已更新：\(session.account.displayName)。"
            }
        } catch {
            if !silent {
                statusMessage = "登录失败：\(error.localizedDescription)"
            }
        }
    }

    private func loginDevPro() async {
        await loginDevAccount(
            email: "test-pro@agentenglish.local",
            envKey: "DEV_AUTH_TEST_PRO_PASSWORD"
        )
    }

    private func loginDevMax() async {
        await loginDevAccount(
            email: "test-max@agentenglish.local",
            envKey: "DEV_AUTH_TEST_MAX_PASSWORD"
        )
    }

    private func loginDevAccount(email: String, envKey: String) async {
        guard !isAccountActionInFlight else {
            return
        }
        guard let passwordValue = devAuthPassword(for: envKey) else {
            statusMessage = "登录失败：未配置 \(envKey)。"
            return
        }

        isAccountActionInFlight = true
        defer {
            isAccountActionInFlight = false
        }

        do {
            let session = try await accountSessionClient.loginDevAccount(
                email: email,
                password: passwordValue
            )
            applyAccountSession(session)
            statusMessage = "\(session.account.displayName) 已登录。"
            await refreshCatalog(silent: true)
        } catch {
            statusMessage = "登录失败：\(error.localizedDescription)"
        }
    }

    private func logoutAccount() async {
        guard !isAccountActionInFlight else {
            return
        }
        isAccountActionInFlight = true
        defer {
            isAccountActionInFlight = false
        }

        do {
            let session = try await accountSessionClient.logout()
            applyAccountSession(session)
            statusMessage = "已退出登录，回到游客 Free。"
            await refreshCatalog(silent: true)
        } catch {
            statusMessage = "退出失败：\(error.localizedDescription)"
        }
    }

    private func markPublicLoginPlaceholder(provider: String) {
        statusMessage = "\(provider) 登录未完成：当前阶段只保留公开登录入口，身份 token 后续由后端验证。"
    }

    private func applyAccountSession(_ session: AuthSession) {
        accountSession = session
        serviceTier = session.entitlement.serviceTier
        catalog = session.entitlement.catalog
        quota = session.entitlement.quota
        audioQuota = session.entitlement.catalog.audioQuota
            ?? ModelCatalogSnapshot.previewAudioQuota(for: session.entitlement.serviceTier)
        preferredModelID = session.entitlement.catalog.defaultModelID
    }

    private func devAuthPassword(for envKey: String) -> String? {
        let value = ProcessInfo.processInfo.environment[envKey]?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let value, !value.isEmpty else {
            return nil
        }
        return value
    }

    private func refreshCatalog(silent: Bool) async {
        guard !isRefreshingCatalog else {
            return
        }

        isRefreshingCatalog = true
        defer {
            isRefreshingCatalog = false
        }

        do {
            let preferences = try await ModelServiceSettingsStore(modelContext: modelContext).refreshCatalog()
            applyPreferences(preferences)
            if !silent {
                statusMessage = "模型目录已同步。"
            }
        } catch {
            if !silent {
                statusMessage = "模型目录同步失败：\(error.localizedDescription)"
            }
        }
    }

    private func applyPreferences(_ preferences: TranslationPreferencesSnapshot) {
        sourceLanguage = preferences.sourceLanguage
        targetLanguage = preferences.targetLanguage
        serviceTier = preferences.serviceTier
        preferredModelID = preferences.preferredModelID
        catalog = preferences.catalog
        quota = preferences.quota
        audioQuota = preferences.catalog.audioQuota
            ?? ModelCatalogSnapshot.previewAudioQuota(for: preferences.serviceTier)
    }

    private func saveLanguages() {
        do {
            try ModelServiceSettingsStore(modelContext: modelContext).updateLanguages(
                sourceLanguage: sourceLanguage,
                targetLanguage: targetLanguage
            )
            statusMessage = "目标语言已保存。"
        } catch {
            statusMessage = "目标语言保存失败：\(error.localizedDescription)"
        }
    }

    private func chooseModel(_ option: ModelCatalogOption) {
        guard option.availability == .available else {
            switch option.requiredTier {
            case .free:
                statusMessage = "当前模型暂不可选。"
            case .pro:
                statusMessage = "需要 Pro 服务等级，先升级后再试。查看 Pro"
            case .max:
                statusMessage = "需要 Max 服务等级，先升级后再试。查看 Max"
            case nil:
                statusMessage = "当前模型暂不可选。"
            }
            return
        }

        do {
            try ModelServiceSettingsStore(modelContext: modelContext).updatePreferredModel(option.id)
            syncFormState()
            showsModelPicker = false
            statusMessage = "\(option.displayName) 已选。"
        } catch {
            statusMessage = "模型选择保存失败：\(error.localizedDescription)"
        }
    }

    private func performClear(_ action: SettingsClearAction) {
        pendingClearAction = nil

        switch action {
        case .learningData: clearLearningData()
        case .translationCache: clearTranslationCache()
        case .websiteData: clearWebsiteData()
        }
    }

    private func clearLearningData() {
        do {
            try PrivacyDataManager(modelContext: modelContext).clearLearningData()
            statusMessage = "学习数据已清空。"
        } catch {
            statusMessage = "学习数据清空失败：\(error.localizedDescription)"
        }
    }

    private func clearTranslationCache() {
        do {
            try PrivacyDataManager(modelContext: modelContext).clearTranslationCache()
            statusMessage = "翻译缓存已清空。"
        } catch {
            statusMessage = "翻译缓存清空失败：\(error.localizedDescription)"
        }
    }

    private func clearWebsiteData() {
        Task { @MainActor in
            await PrivacyDataManager(modelContext: modelContext).clearWebsiteData()
            statusMessage = "网站数据已清理。"
        }
    }
}

private struct ModelPickerSheet: View {
    @Environment(\.dismiss) private var dismiss

    let currentTier: ModelServiceTier
    let selectedModelID: String
    let catalog: ModelCatalogSnapshot
    let onRefresh: () async -> Void
    let onSelect: (ModelCatalogOption) -> Void

    var body: some View {
        NavigationStack {
            List {
                pickerSection(for: .free, title: "Free 服务")
                pickerSection(for: .pro, title: "Pro 模型")
                pickerSection(for: .max, title: "Max 模型")
            }
            .navigationTitle("选择模型")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("刷新") {
                        Task {
                            await onRefresh()
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func pickerSection(for tier: ModelServiceTier, title: String) -> some View {
        Section(title) {
            ForEach(catalog.options.filter { $0.tier == tier }) { option in
                Button {
                    onSelect(option)
                } label: {
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(option.displayName)
                                .font(.headline)
                            Text(option.summary)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        if option.id == selectedModelID && option.availability == .available {
                            Text("已选")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        } else if option.availability != .available {
                            Image(systemName: "lock.fill")
                                .foregroundStyle(.orange)
                            Text(lockMessage(for: option))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.orange)
                        } else {
                            Text(option.tier == currentTier ? "当前可用" : option.tier.displayName)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func lockMessage(for option: ModelCatalogOption) -> String {
        switch option.requiredTier {
        case .pro:
            return "需要 Pro"
        case .max:
            return "需要 Max"
        case .free, nil:
            return "已锁定"
        }
    }
}
