#if canImport(AgentEnglishCore)
import AgentEnglishCore
#endif
import SwiftData
import SwiftUI

@main
struct AgentEnglishApp: App {
    private let modelContainer: ModelContainer

    init() {
        do {
            modelContainer = try AppModelContainer.makeDefaultContainer()
        } catch {
            fatalError("Failed to create model container: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            RootTabView()
        }
        .modelContainer(modelContainer)
    }
}
