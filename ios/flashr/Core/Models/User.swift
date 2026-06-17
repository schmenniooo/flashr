import Foundation

struct User: Codable, Identifiable {
    let id: String
    let name: String
    let email: String
    let plan: String          // "free" | "pro"
    let avatarURL: String?
    let createdAt: String?

    var isPro: Bool { plan == "pro" }

    enum CodingKeys: String, CodingKey {
        case id, name, email, plan
        case avatarURL  = "avatar_url"
        case createdAt  = "created_at"
    }
}
