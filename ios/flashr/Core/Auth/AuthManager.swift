import Foundation
import Combine

// MARK: - Models

struct LoginRequest: Encodable {
    let email, password: String
}

struct SignupRequest: Encodable {
    let email, password, name: String
}

struct AuthResponse: Decodable {
    let token: String
    let user: User
}

// MARK: - AuthStore

@MainActor
final class AuthStore: ObservableObject {
    @Published var currentUser: User?
    @Published var isBootstrapping = true

    var isAuthenticated: Bool { currentUser != nil }

    private let api = APIClient.shared
    private let keychain = KeychainHelper.shared

    // Called once at app launch — validates the stored JWT and restores session.
    func bootstrap() async {
        defer { isBootstrapping = false }
        guard keychain.read(key: .jwt) != nil else { return }
        do {
            currentUser = try await api.request("GET", path: Endpoint.me)
        } catch APIError.unauthorized {
            keychain.delete(key: .jwt)
        } catch {
            // Network unavailable — keep the cached user for optimistic display.
        }
    }

    func login(email: String, password: String) async throws {
        let response: AuthResponse = try await api.request(
            "POST", path: Endpoint.login,
            body: LoginRequest(email: email, password: password)
        )
        keychain.save(response.token, key: .jwt)
        currentUser = response.user
    }

    func signup(name: String, email: String, password: String) async throws {
        let response: AuthResponse = try await api.request(
            "POST", path: Endpoint.signup,
            body: SignupRequest(email: email, password: password, name: name)
        )
        keychain.save(response.token, key: .jwt)
        currentUser = response.user
    }

    func logout() async {
        try? await api.requestNoBody("POST", path: Endpoint.logout)
        keychain.delete(key: .jwt)
        currentUser = nil
    }

    func refreshUser() async {
        guard isAuthenticated else { return }
        if let user: User = try? await api.request("GET", path: Endpoint.me) {
            currentUser = user
        }
    }
}
