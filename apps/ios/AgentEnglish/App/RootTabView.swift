import SwiftUI

struct RootTabView: View {
    var body: some View {
        TabView {
            NavigationStack {
                BrowserHomeView()
            }
            .tabItem {
                Label("浏览", systemImage: "globe")
            }

            NavigationStack {
                FavoritesView()
            }
            .tabItem {
                Label("收藏", systemImage: "bookmark")
            }

            NavigationStack {
                ReviewView()
            }
            .tabItem {
                Label("复习", systemImage: "rectangle.stack")
            }

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("设置", systemImage: "gearshape")
            }
        }
    }
}
