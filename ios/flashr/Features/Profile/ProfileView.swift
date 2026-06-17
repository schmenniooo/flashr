import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authStore: AuthStore

    var body: some View {
        ZStack {
            Color.flashrBg.ignoresSafeArea()
            VStack(spacing: 16) {
                Text(authStore.currentUser?.name ?? "")
                    .font(.flashrH1)
                    .foregroundStyle(Color.flashrText)
                Text(authStore.currentUser?.email ?? "")
                    .font(.flashrBody)
                    .foregroundStyle(Color.flashrMuted)
                Button("Sign out") {
                    Task { await authStore.logout() }
                }
                .font(.flashrBody)
                .foregroundStyle(Color.flashrAccent)
            }
        }
        .navigationTitle("Profile")
    }
}
