import SwiftUI

// MARK: - Snapshot decoded from the phone
//
// Mirrors the JSON `src/lib/watch.ts` builds and pushes over WatchConnectivity. Every field is
// optional except `active` so the same struct decodes both the active-workout snapshot and the
// idle start-menu snapshot. Keep these keys in sync with `buildSnapshot()` on the JS side.

struct CurrentSet: Decodable, Equatable {
    let exId: String
    let setId: String
    let setNumber: Int
    let side: String
    let weight: Int
    let reps: Int
    let prevText: String
}

struct TemplateItem: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let exerciseCount: Int
}

struct WatchTheme: Decodable, Equatable {
    let accent: String?
    let bg: String?
    let surface: String?
    let surfaceHigh: String?
    let text: String?
    let muted: String?
    let border: String?
}

struct Snapshot: Decodable, Equatable {
    let active: Bool

    // Active workout
    let workoutName: String?
    let startedAtMs: Double?
    let exerciseName: String?
    let exerciseIndex: Int?
    let totalExercises: Int?
    let setsDone: Int?
    let totalSets: Int?
    let volumeText: String?
    let restEndsAtMs: Double?
    let restTotal: Double?
    let unitLabel: String?
    let currentSet: CurrentSet?

    // Idle start menu
    let templates: [TemplateItem]?
    let nextTemplateId: String?
    let nextWorkoutName: String?

    let theme: WatchTheme?

    /// When the current rest ends, or nil if not resting.
    var restEndsAt: Date? {
        guard let ms = restEndsAtMs, ms > 0 else { return nil }
        return Date(timeIntervalSince1970: ms / 1000)
    }
    var startedAt: Date? {
        guard let ms = startedAtMs else { return nil }
        return Date(timeIntervalSince1970: ms / 1000)
    }
}

// MARK: - Theme → Colors

extension Color {
    /// Parse "#rrggbb" (alpha ignored). Returns nil on bad input.
    init?(hexString: String?) {
        guard var s = hexString?.trimmingCharacters(in: .whitespaces) else { return nil }
        if s.hasPrefix("#") { s.removeFirst() }
        if s.count == 8 { s = String(s.prefix(6)) }
        guard s.count == 6, let v = UInt64(s, radix: 16) else { return nil }
        self = Color(
            red: Double((v >> 16) & 0xff) / 255,
            green: Double((v >> 8) & 0xff) / 255,
            blue: Double(v & 0xff) / 255
        )
    }
}

/// Resolved theme colors with sensible dark-first fallbacks (used until the first snapshot lands).
struct Palette {
    var accent = Color(hexString: "#6366f1")!
    var bg = Color.black
    var surface = Color(hexString: "#141414")!
    var surfaceHigh = Color(hexString: "#1f1f1f")!
    var text = Color.white
    var muted = Color(hexString: "#8a8a8a")!
    var border = Color(hexString: "#2a2a2a")!

    init() {}
    init(_ t: WatchTheme?) {
        guard let t else { return }
        accent = Color(hexString: t.accent) ?? accent
        bg = Color(hexString: t.bg) ?? bg
        surface = Color(hexString: t.surface) ?? surface
        surfaceHigh = Color(hexString: t.surfaceHigh) ?? surfaceHigh
        text = Color(hexString: t.text) ?? text
        muted = Color(hexString: t.muted) ?? muted
        border = Color(hexString: t.border) ?? border
    }
}
