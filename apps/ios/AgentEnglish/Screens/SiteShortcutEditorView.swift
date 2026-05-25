#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftData
import SwiftUI

#if os(iOS)
struct SiteShortcutEditorView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \SiteShortcutRecord.orderIndex, order: .forward) private var shortcuts: [SiteShortcutRecord]

    @State private var name = ""
    @State private var urlText = ""
    @State private var note = ""
    @State private var symbol = "globe"
    @State private var statusMessage: String?

    var body: some View {
        List {
            if let statusMessage {
                Section {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section {
                TextField("名称", text: $name)
                TextField("网址", text: $urlText)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                TextField("说明", text: $note)
                TextField("SF Symbol", text: $symbol)
                    .autocorrectionDisabled()

                Button {
                    addShortcut()
                } label: {
                    Label("添加或更新", systemImage: "plus.circle")
                }
            } header: {
                Text("添加入口")
            }

            Section {
                ForEach(shortcuts) { shortcut in
                    shortcutRow(shortcut)
                }
                .onDelete(perform: deleteShortcuts)
                .onMove(perform: moveShortcuts)
            } header: {
                Text("当前入口")
            }
        }
        .navigationTitle("快捷入口")
        .toolbar {
            #if os(iOS)
            EditButton()
            #endif
        }
        .onAppear(perform: seedDefaults)
    }

    @ViewBuilder
    private func shortcutRow(_ shortcut: SiteShortcutRecord) -> some View {
        HStack(spacing: 12) {
            Image(systemName: shortcut.symbol)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                Text(shortcut.name)
                    .font(.headline)
                Text(shortcut.url)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if !shortcut.note.isEmpty {
                    Text(shortcut.note)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    private func seedDefaults() {
        do {
            _ = try SiteShortcutRepository(modelContext: modelContext).seedDefaultsIfNeeded()
        } catch {
            statusMessage = "默认入口创建失败：\(error.localizedDescription)"
        }
    }

    private func addShortcut() {
        guard let url = normalizedURL(from: urlText) else {
            statusMessage = "请输入可打开的网址。"
            return
        }

        do {
            _ = try SiteShortcutRepository(modelContext: modelContext).addOrUpdate(
                name: name,
                symbol: symbol,
                note: note,
                url: url
            )
            name = ""
            urlText = ""
            note = ""
            symbol = "globe"
            statusMessage = "快捷入口已保存。"
        } catch {
            statusMessage = "快捷入口保存失败：\(error.localizedDescription)"
        }
    }

    private func deleteShortcuts(at offsets: IndexSet) {
        do {
            let repository = SiteShortcutRepository(modelContext: modelContext)
            for offset in offsets {
                try repository.delete(shortcuts[offset])
            }
            statusMessage = "快捷入口已删除。"
        } catch {
            statusMessage = "快捷入口删除失败：\(error.localizedDescription)"
        }
    }

    private func moveShortcuts(from source: IndexSet, to destination: Int) {
        do {
            try SiteShortcutRepository(modelContext: modelContext).move(
                records: shortcuts,
                from: source,
                to: destination
            )
        } catch {
            statusMessage = "快捷入口排序失败：\(error.localizedDescription)"
        }
    }

    private func normalizedURL(from input: String) -> URL? {
        let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedInput.isEmpty else {
            return nil
        }

        if let url = URL(string: trimmedInput), ["https", "http"].contains(url.scheme?.lowercased()) {
            return url
        }

        if trimmedInput.contains("."), !trimmedInput.contains(" ") {
            return URL(string: "https://\(trimmedInput)")
        }

        return nil
    }
}
#else
struct SiteShortcutEditorView: View {
    var body: some View {
        Text("快捷入口")
    }
}
#endif
