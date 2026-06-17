import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authStore: AuthStore
    @State private var email = ""
    @State private var password = ""
    @State private var isSignup = false
    @State private var name = ""
    @State private var error: String?
    @State private var isLoading = false

    var body: some View {
        ZStack {
            Color.flashrBg.ignoresSafeArea()

            VStack(spacing: 32) {
                // Wordmark
                VStack(spacing: 4) {
                    Text("flash")
                        .font(.flashrDisplay)
                        .foregroundStyle(Color.flashrText)
                    + Text("r")
                        .font(.flashrDisplay)
                        .foregroundStyle(Color.flashrAccent)
                }
                .accentGlow()

                // Form card
                VStack(spacing: 16) {
                    if isSignup {
                        flashrTextField("Name", text: $name)
                    }
                    flashrTextField("Email", text: $email)
                        #if os(iOS)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .autocapitalization(.none)
                        #endif
                    flashrTextField("Password", text: $password, isSecure: true)
                        #if os(iOS)
                        .textContentType(isSignup ? .newPassword : .password)
                        #endif

                    if let error {
                        Text(error)
                            .font(.flashrBody)
                            .foregroundStyle(.red)
                    }

                    Button(action: submit) {
                        if isLoading {
                            ProgressView().tint(Color.flashrBg)
                        } else {
                            Text(isSignup ? "Create account" : "Sign in")
                                .font(.flashrH2)
                                .foregroundStyle(Color.flashrBg)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.flashrAccent)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                    .shadow(color: Color.flashrAccent.opacity(0.35), radius: 16, x: 0, y: 4)
                    .disabled(isLoading)
                }
                .padding(24)
                .background(Color.flashrSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.lg)
                        .stroke(Color.flashrBorder, lineWidth: 1)
                )
                .cardShadow()

                Button(isSignup ? "Already have an account? Sign in" : "No account yet? Sign up") {
                    withAnimation { isSignup.toggle(); error = nil }
                }
                .font(.flashrBody)
                .foregroundStyle(Color.flashrMuted)
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: 400)
        }
    }

    private func submit() {
        error = nil
        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                if isSignup {
                    try await authStore.signup(name: name, email: email, password: password)
                } else {
                    try await authStore.login(email: email, password: password)
                }
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

// MARK: - Text field helper

private func flashrTextField(_ placeholder: String, text: Binding<String>, isSecure: Bool = false) -> some View {
    Group {
        if isSecure {
            SecureField(placeholder, text: text)
        } else {
            TextField(placeholder, text: text)
        }
    }
    .font(.flashrBody)
    .foregroundStyle(Color.flashrText)
    .padding(12)
    .background(Color.flashrCard)
    .clipShape(RoundedRectangle(cornerRadius: Radius.md))
    .overlay(
        RoundedRectangle(cornerRadius: Radius.md)
            .stroke(Color.flashrBorder, lineWidth: 1)
    )
}
