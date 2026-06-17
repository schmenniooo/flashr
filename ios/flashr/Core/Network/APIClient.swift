import Foundation

// MARK: - Errors

enum APIError: Error, LocalizedError {
    case httpError(statusCode: Int, message: String)
    case decodingError(Error)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .httpError(_, let msg): return msg
        case .decodingError(let e): return e.localizedDescription
        case .unauthorized:         return "Session expired. Please sign in again."
        }
    }
}

// MARK: - APIClient

@MainActor
final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    // Reads API_BASE_URL from the active Config.xcconfig → Info.plist.
    private let baseURL: String = {
        Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String ?? "http://localhost:8080"
    }()

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest  = 30
        config.timeoutIntervalForResource = 60
        session = URLSession(configuration: config)
    }

    // MARK: - Core request

    func request<T: Decodable>(
        _ method: String,
        path: String,
        body: Encodable? = nil
    ) async throws -> T {
        let data = try await rawRequest(method, path: path, body: body)
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    func requestNoBody(_ method: String, path: String, body: Encodable? = nil) async throws {
        _ = try await rawRequest(method, path: path, body: body)
    }

    // MARK: - Helpers

    private func rawRequest(_ method: String, path: String, body: Encodable?) async throws -> Data {
        guard let url = URL(string: baseURL + path) else {
            throw URLError(.badURL)
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = KeychainHelper.shared.read(key: .jwt) {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }

        if http.statusCode == 401 { throw APIError.unauthorized }

        if !(200..<300).contains(http.statusCode) {
            let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
                   ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            throw APIError.httpError(statusCode: http.statusCode, message: msg)
        }
        return data
    }

    // MARK: - iOS-specific endpoints

    func registerPushToken(_ token: String, platform: String) async {
        struct Body: Encodable { let token, platform: String }
        try? await requestNoBody("POST", path: Endpoint.pushToken, body: Body(token: token, platform: platform))
    }
}
