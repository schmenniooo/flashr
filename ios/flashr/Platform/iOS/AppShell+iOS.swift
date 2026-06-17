import SwiftUI

#if os(iOS)
/// iPhone: tab bar navigation.
/// iPad: NavigationSplitView with persistent sidebar.
struct AppShell_iOS: View {
    @EnvironmentObject var authStore: AuthStore

    var body: some View {
        if UIDevice.current.userInterfaceIdiom == .pad {
            iPadLayout()
        } else {
            iPhoneLayout()
        }
    }

    private func iPhoneLayout() -> some View {
        TabView {
            CollectionsView()
                .tabItem { Label("Collections", systemImage: "square.stack") }
            StudyView()
                .tabItem { Label("Study", systemImage: "brain") }
            UploadView()
                .tabItem { Label("Upload", systemImage: "square.and.arrow.up") }
            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.circle") }
        }
        .tint(Color.flashrAccent)
    }

    private func iPadLayout() -> some View {
        NavigationSplitView {
            CollectionsView()
        } detail: {
            Text("Select a collection")
                .foregroundStyle(Color.flashrMuted)
        }
    }
}
#endif
