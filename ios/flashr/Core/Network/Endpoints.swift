import Foundation

// All API path constants. Use these rather than inline strings in handlers.
enum Endpoint {
    static let login         = "/api/auth/login"
    static let signup        = "/api/auth/signup"
    static let me            = "/api/auth/me"
    static let googleOAuth   = "/api/auth/google"
    static let logout        = "/api/auth/logout"

    static let collections   = "/api/collections"
    static func collection(_ id: String) -> String { "/api/collections/\(id)" }
    static func cards(_ collectionID: String) -> String { "/api/collections/\(collectionID)/cards" }
    static func card(_ collectionID: String, _ cardID: String) -> String {
        "/api/collections/\(collectionID)/cards/\(cardID)"
    }

    static let aiGenerate    = "/api/ai/generate/stream"
    static let aiUpload      = "/api/ai/upload/stream"

    static let pushToken     = "/api/users/push-token"

    static let iosFulfill    = "/api/billing/ios-fulfill"
    static let billingFulfill = "/api/billing/fulfill"
    static let billingSync   = "/api/billing/sync"
}
