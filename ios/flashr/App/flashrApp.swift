import SwiftUI

@main
struct flashrApp: App {
    @StateObject private var authStore = AuthStore()

    var body: some Scene {
        WindowGroup {
            ContentRootView()
                .environmentObject(authStore)
                .preferredColorScheme(.dark)
        }
    }
}

// MARK: - Content root

private struct ContentRootView: View {
    @EnvironmentObject var authStore: AuthStore

    var body: some View {
        Group {
            if authStore.isAuthenticated {
                #if os(iOS)
                AppShell_iOS()
                #elseif os(macOS)
                AppShell_macOS()
                #endif
            } else {
                LoginView()
            }
        }
        .task { await authStore.bootstrap() }
    }
}
