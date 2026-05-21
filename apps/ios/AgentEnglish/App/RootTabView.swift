import SwiftUI

private enum RootTab: Hashable {
    case browser
    case favorites
    case review
    case settings
}

struct RootTabView: View {
    @State private var selectedTab: RootTab = .browser
    @State private var browserLaunch: BrowserLaunch?

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                BrowserHomeView(launch: $browserLaunch)
            }
            .tabItem {
                Label("浏览", systemImage: "globe")
            }
            .tag(RootTab.browser)

            NavigationStack {
                FavoritesView()
            }
            .environment(\.openURL, OpenURLAction { url in
                selectedTab = .browser
                browserLaunch = BrowserLaunch(url: url)
                return .handled
            })
            .tabItem {
                Label("收藏", systemImage: "bookmark")
            }
            .tag(RootTab.favorites)

            NavigationStack {
                ReviewView()
            }
            .tabItem {
                Label("复习", systemImage: "rectangle.stack")
            }
            .tag(RootTab.review)

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("设置", systemImage: "gearshape")
            }
            .tag(RootTab.settings)
        }
    }
}
