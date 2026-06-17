import SwiftUI

#if os(macOS)
/// macOS: 3-column NavigationSplitView — folders / collections / detail.
/// Minimum window size 900×600, resizable.
struct AppShell_macOS: View {
    @EnvironmentObject var authStore: AuthStore

    var body: some View {
        NavigationSplitView {
            // Sidebar — collections list
            CollectionsView()
                .navigationSplitViewColumnWidth(min: 220, ideal: 260)
        } detail: {
            Text("Select a collection")
                .foregroundStyle(Color.flashrMuted)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.flashrBg)
        }
        .frame(minWidth: 900, minHeight: 600)
    }
}
#endif
