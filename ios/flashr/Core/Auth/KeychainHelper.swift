import Foundation
import Security

// MARK: - Keys

extension KeychainHelper {
    enum Key: String {
        case jwt = "io.flashr.app.jwt"
    }
}

// MARK: - KeychainHelper

final class KeychainHelper {
    static let shared = KeychainHelper()
    private init() {}

    func save(_ value: String, key: Key) {
        let data = Data(value.utf8)
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrAccount: key.rawValue,
            kSecValueData:   data,
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    func read(key: Key) -> String? {
        let query: [CFString: Any] = [
            kSecClass:            kSecClassGenericPassword,
            kSecAttrAccount:      key.rawValue,
            kSecReturnData:       true,
            kSecMatchLimit:       kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func delete(key: Key) {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrAccount: key.rawValue,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
