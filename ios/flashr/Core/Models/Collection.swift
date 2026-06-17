import Foundation

struct Collection: Codable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let emoji: String?
    let cardCount: Int?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description, emoji
        case cardCount  = "card_count"
        case createdAt  = "created_at"
        case updatedAt  = "updated_at"
    }
}
