import SwiftUI

// MARK: - Color tokens
// Mirror the web design system (web/src/styles/tokens.css).
// Never hardcode hex values outside this file.

extension Color {
    static let flashrBg          = Color(hex: "#0D0F14")
    static let flashrSurface     = Color(hex: "#161923")
    static let flashrCard        = Color(hex: "#1E2332")
    static let flashrAccent      = Color(hex: "#6C63FF")
    static let flashrAccentLight = Color(hex: "#8B85FF")
    static let flashrAccentSoft  = Color(hex: "#A09BFF")
    static let flashrText        = Color(hex: "#F0F2FF")
    static let flashrMuted       = Color(hex: "#8890A4")
    static let flashrBorder      = Color(hex: "#2A2F45")

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let value = UInt64(hex, radix: 16) ?? 0
        self.init(
            red:   Double((value >> 16) & 0xFF) / 255,
            green: Double((value >>  8) & 0xFF) / 255,
            blue:  Double( value        & 0xFF) / 255
        )
    }
}

// MARK: - Typography
// DM Sans TTF files must be listed under UIAppFonts (iOS) and
// NSFontFileName (macOS) in Info.plist before these resolve correctly.

extension Font {
    static let flashrDisplay = Font.custom("DMSans-Bold",     size: 40)
    static let flashrH1      = Font.custom("DMSans-Bold",     size: 28)
    static let flashrH2      = Font.custom("DMSans-SemiBold", size: 20)
    static let flashrBody    = Font.custom("DMSans-Regular",  size: 14)
    static let flashrMeta    = Font.custom("DMSans-SemiBold", size: 11)
}

// MARK: - Border radius tokens

enum Radius {
    static let sm: CGFloat =  8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
}

// MARK: - Shadow / glow helpers

extension View {
    /// Violet glow — use sparingly on accent elements only.
    func accentGlow() -> some View {
        self.shadow(color: Color.flashrAccent.opacity(0.3), radius: 10, x: 0, y: 4)
    }

    /// Card drop shadow.
    func cardShadow() -> some View {
        self.shadow(color: .black.opacity(0.4), radius: 24, x: 0, y: 4)
    }
}
