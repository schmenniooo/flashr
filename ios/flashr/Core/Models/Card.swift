import Foundation

struct Card: Codable, Identifiable {
    let id: String
    let collectionID: String
    let front: String
    let back: String
    let mastery: Int           // 0–100
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, front, back, mastery
        case collectionID = "collection_id"
        case createdAt    = "created_at"
        case updatedAt    = "updated_at"
    }
}
