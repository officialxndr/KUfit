import WidgetKit
import SwiftUI

// MARK: - App Group

private let appGroup = "group.com.zanderhalverson.hale"
private let snapshotKey = "snapshot"

private func grouped(_ n: Int) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.maximumFractionDigits = 0
    return f.string(from: NSNumber(value: n)) ?? "\(n)"
}

// MARK: - Theme (pushed from the app so widgets match in-app appearance)

extension Color {
    /// Parse "#rrggbb" (or "#rrggbbaa", alpha ignored). Returns nil on bad input.
    init?(hexString: String) {
        var s = hexString.trimmingCharacters(in: .whitespaces)
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

struct WidgetTheme {
    var accent: Color
    var bg: Color
    var surfaceHigh: Color
    var text: Color
    var muted: Color
    var track: Color
    var protein: Color
    var carbs: Color
    var fat: Color

    static let fallback = WidgetTheme(
        accent: Color(hexString: "#6366f1")!,
        bg: Color(hexString: "#0a0a0a")!,
        surfaceHigh: Color(hexString: "#1e1e1e")!,
        text: Color(hexString: "#f9f9f9")!,
        muted: Color(hexString: "#6b7280")!,
        track: Color(hexString: "#2a2a2a")!,
        protein: Color(hexString: "#6366f1")!,
        carbs: Color(hexString: "#f59e0b")!,
        fat: Color(hexString: "#ec4899")!
    )

    static func from(_ obj: [String: Any]?) -> WidgetTheme {
        guard let o = obj else { return .fallback }
        let f = WidgetTheme.fallback
        func c(_ k: String, _ fb: Color) -> Color {
            if let s = o[k] as? String, let col = Color(hexString: s) { return col }
            return fb
        }
        return WidgetTheme(
            accent: c("accent", f.accent),
            bg: c("bg", f.bg),
            surfaceHigh: c("surfaceHigh", f.surfaceHigh),
            text: c("text", f.text),
            muted: c("muted", f.muted),
            track: c("track", f.track),
            protein: c("protein", f.protein),
            carbs: c("carbs", f.carbs),
            fat: c("fat", f.fat)
        )
    }
}

// MARK: - Snapshot

struct HaleSnapshot {
    // Nutrition
    var caloriesLeft = 0, calorieTarget = 0, caloriesConsumed = 0
    var proteinConsumed = 0, proteinTarget = 0
    var carbsConsumed = 0, carbsTarget = 0
    var fatConsumed = 0, fatTarget = 0
    // Health
    var weightDisplay = "", bodyFatDisplay = "", weightTrend = "", goalWeightDisplay = ""
    var leanMassDisplay = "", fatMassDisplay = ""
    var bodyFatPct = 0.0
    // Workout
    var nextWorkout = "", nextWorkoutExercises = 0
    var lastWorkout = "", lastWorkoutAgo = ""
    var workoutsThisWeek = 0, weeklySets = 0, weeklyVolumeDisplay = ""
    var volumeSeries: [Double] = []
    var theme = WidgetTheme.fallback

    static let placeholder: HaleSnapshot = {
        var s = HaleSnapshot()
        s.caloriesLeft = 1240; s.calorieTarget = 2200; s.caloriesConsumed = 960
        s.proteinConsumed = 78; s.proteinTarget = 160
        s.carbsConsumed = 140; s.carbsTarget = 220
        s.fatConsumed = 42; s.fatTarget = 70
        s.weightDisplay = "181.4 lb"; s.bodyFatDisplay = "18.4% bf"; s.bodyFatPct = 18.4
        s.weightTrend = "↓ 0.6 lb/wk"; s.goalWeightDisplay = "Goal 175 lb"
        s.leanMassDisplay = "Lean 148 lb"; s.fatMassDisplay = "Fat 33 lb"
        s.nextWorkout = "Push Day"; s.nextWorkoutExercises = 5
        s.lastWorkout = "Leg Day"; s.lastWorkoutAgo = "2d ago"
        s.workoutsThisWeek = 3; s.weeklySets = 38; s.weeklyVolumeDisplay = "12.4k lb"
        s.volumeSeries = [0, 8200, 0, 11000, 0, 9400, 12400]
        return s
    }()

    static func load() -> HaleSnapshot {
        guard let d = UserDefaults(suiteName: appGroup),
              let data = d.data(forKey: snapshotKey),
              let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        else { return HaleSnapshot() }

        func i(_ k: String) -> Int { (o[k] as? NSNumber)?.intValue ?? 0 }
        func s(_ k: String) -> String { (o[k] as? String) ?? "" }
        func dbl(_ k: String) -> Double { (o[k] as? NSNumber)?.doubleValue ?? 0 }
        func arr(_ k: String) -> [Double] { (o[k] as? [Any])?.compactMap { ($0 as? NSNumber)?.doubleValue } ?? [] }

        var snap = HaleSnapshot()
        snap.caloriesLeft = i("caloriesLeft")
        snap.calorieTarget = i("calorieTarget")
        snap.caloriesConsumed = i("caloriesConsumed")
        snap.proteinConsumed = i("proteinConsumed"); snap.proteinTarget = i("proteinTarget")
        snap.carbsConsumed = i("carbsConsumed"); snap.carbsTarget = i("carbsTarget")
        snap.fatConsumed = i("fatConsumed"); snap.fatTarget = i("fatTarget")
        snap.weightDisplay = s("weightDisplay")
        snap.bodyFatDisplay = s("bodyFatDisplay")
        snap.bodyFatPct = dbl("bodyFatPct")
        snap.weightTrend = s("weightTrend")
        snap.goalWeightDisplay = s("goalWeightDisplay")
        snap.leanMassDisplay = s("leanMassDisplay")
        snap.fatMassDisplay = s("fatMassDisplay")
        snap.nextWorkout = s("nextWorkout"); snap.nextWorkoutExercises = i("nextWorkoutExercises")
        snap.lastWorkout = s("lastWorkout"); snap.lastWorkoutAgo = s("lastWorkoutAgo")
        snap.workoutsThisWeek = i("workoutsThisWeek")
        snap.weeklySets = i("weeklySets")
        snap.weeklyVolumeDisplay = s("weeklyVolumeDisplay")
        snap.volumeSeries = arr("volumeSeries")
        snap.theme = WidgetTheme.from(o["theme"] as? [String: Any])
        return snap
    }
}

// MARK: - Timeline

struct SimpleEntry: TimelineEntry {
    let date: Date
    let snapshot: HaleSnapshot
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), snapshot: .placeholder)
    }
    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        completion(SimpleEntry(date: Date(), snapshot: context.isPreview ? .placeholder : HaleSnapshot.load()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let entry = SimpleEntry(date: Date(), snapshot: HaleSnapshot.load())
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Reusable pieces

@ViewBuilder
private func Overline(_ text: String, _ color: Color) -> some View {
    Text(text).font(.system(size: 10, weight: .bold)).tracking(1.4).foregroundStyle(color)
}

private struct RingView: View {
    var fraction: Double
    var color: Color
    var track: Color
    var lineWidth: CGFloat = 9
    var centerTop: String
    var centerBottom: String
    var textColor: Color
    var mutedColor: Color
    var topSize: CGFloat = 20

    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(1, max(0, fraction)))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text(centerTop)
                    .font(.system(size: topSize, weight: .bold, design: .rounded))
                    .foregroundStyle(textColor).minimumScaleFactor(0.5).lineLimit(1)
                if !centerBottom.isEmpty {
                    Text(centerBottom).font(.system(size: 10)).foregroundStyle(mutedColor)
                }
            }
        }
    }
}

private struct CalorieRing: View {
    let s: HaleSnapshot
    var size: CGFloat = 90
    var lineWidth: CGFloat = 9
    var topSize: CGFloat = 22
    var body: some View {
        let frac = s.calorieTarget > 0 ? Double(s.caloriesConsumed) / Double(s.calorieTarget) : 0
        return RingView(fraction: frac, color: s.theme.accent, track: s.theme.track, lineWidth: lineWidth,
                        centerTop: grouped(s.caloriesLeft), centerBottom: "left",
                        textColor: s.theme.text, mutedColor: s.theme.muted, topSize: topSize)
            .frame(width: size, height: size)
    }
}

private struct MacroBar: View {
    var label: String
    var value: Int
    var target: Int
    var color: Color
    var t: WidgetTheme
    var body: some View {
        let frac: CGFloat = target > 0 ? min(1, CGFloat(value) / CGFloat(target)) : 0
        return VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(t.text)
                Spacer()
                Text("\(value)/\(target)g").font(.system(size: 10)).foregroundStyle(t.muted)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(t.track)
                    Capsule().fill(color).frame(width: max(3, geo.size.width * frac))
                }
            }
            .frame(height: 5)
        }
    }
}

private struct MiniMacro: View {
    var letter: String
    var value: Int
    var target: Int
    var color: Color
    var t: WidgetTheme
    var body: some View {
        let frac: CGFloat = target > 0 ? min(1, CGFloat(value) / CGFloat(target)) : 0
        return HStack(spacing: 5) {
            Text(letter).font(.system(size: 9, weight: .bold)).foregroundStyle(color).frame(width: 9)
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(t.track)
                    Capsule().fill(color).frame(width: max(3, g.size.width * frac))
                }
            }
            .frame(height: 5)
            Text("\(value)").font(.system(size: 9, weight: .semibold))
                .foregroundStyle(t.text).frame(width: 28, alignment: .trailing)
        }
    }
}

/// Small colored dot + "P 78", for the compact Medium overview.
private struct MacroPip: View {
    var letter: String
    var value: Int
    var color: Color
    var muted: Color
    var body: some View {
        HStack(spacing: 3) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text("\(letter) \(value)").font(.system(size: 11, weight: .medium)).foregroundStyle(muted)
        }
    }
}

/// Bar sparkline (volume per day) for the Large overview.
private struct BarSparkline: View {
    var values: [Double]
    var color: Color
    var track: Color
    var body: some View {
        GeometryReader { geo in
            let maxV = max(values.max() ?? 1, 0.0001)
            HStack(alignment: .bottom, spacing: 3) {
                ForEach(Array(values.enumerated()), id: \.offset) { _, v in
                    Capsule()
                        .fill(v > 0 ? color : track)
                        .frame(height: v > 0 ? max(3, geo.size.height * CGFloat(v / maxV)) : 3)
                        .frame(maxWidth: .infinity)
                }
            }
            .frame(maxHeight: .infinity, alignment: .bottom)
        }
    }
}

private func homeBackground(_ family: WidgetFamily, _ t: WidgetTheme) -> some View {
    Group {
        if family == .systemSmall || family == .systemMedium { t.bg } else { Color.clear }
    }
}

// MARK: - Food widget

private struct SmallFood: View {
    let s: HaleSnapshot
    var t: WidgetTheme { s.theme }
    var body: some View {
        VStack(spacing: 7) {
            CalorieRing(s: s, size: 82, lineWidth: 8, topSize: 20)
            VStack(spacing: 4) {
                MiniMacro(letter: "P", value: s.proteinConsumed, target: s.proteinTarget, color: t.protein, t: t)
                MiniMacro(letter: "C", value: s.carbsConsumed, target: s.carbsTarget, color: t.carbs, t: t)
                MiniMacro(letter: "F", value: s.fatConsumed, target: s.fatTarget, color: t.fat, t: t)
            }
        }
    }
}

private struct MediumFood: View {
    let s: HaleSnapshot
    var t: WidgetTheme { s.theme }
    var body: some View {
        HStack(spacing: 16) {
            CalorieRing(s: s, size: 96, lineWidth: 10, topSize: 24)
            VStack(alignment: .leading, spacing: 7) {
                Overline("TODAY", t.accent)
                MacroBar(label: "Protein", value: s.proteinConsumed, target: s.proteinTarget, color: t.protein, t: t)
                MacroBar(label: "Carbs", value: s.carbsConsumed, target: s.carbsTarget, color: t.carbs, t: t)
                MacroBar(label: "Fat", value: s.fatConsumed, target: s.fatTarget, color: t.fat, t: t)
                if !s.weightDisplay.isEmpty {
                    HStack(spacing: 5) {
                        Image(systemName: "scalemass.fill").font(.system(size: 10)).foregroundStyle(t.muted)
                        Text(s.bodyFatDisplay.isEmpty ? s.weightDisplay : "\(s.weightDisplay) · \(s.bodyFatDisplay)")
                            .font(.system(size: 11, weight: .medium)).foregroundStyle(t.muted).lineLimit(1)
                    }
                }
            }
        }
    }
}

private struct FoodCircular: View {
    let s: HaleSnapshot
    var body: some View {
        Gauge(value: Double(min(s.caloriesConsumed, max(s.calorieTarget, 1))), in: 0...Double(max(s.calorieTarget, 1))) {
            Text("kcal")
        } currentValueLabel: {
            Text(grouped(s.caloriesLeft)).minimumScaleFactor(0.5)
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .widgetAccentable()
    }
}

private struct FoodRectangular: View {
    let s: HaleSnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Label("\(grouped(s.caloriesLeft)) kcal left", systemImage: "flame.fill")
                .font(.system(size: 14, weight: .semibold)).widgetAccentable()
            Text("P \(s.proteinConsumed)/\(s.proteinTarget) · C \(s.carbsConsumed) · F \(s.fatConsumed)")
                .font(.system(size: 12))
            if !s.weightDisplay.isEmpty {
                Text(s.bodyFatDisplay.isEmpty ? s.weightDisplay : "\(s.weightDisplay) · \(s.bodyFatDisplay)")
                    .font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
            }
        }
    }
}

private struct FoodInline: View {
    let s: HaleSnapshot
    var body: some View {
        Label("\(grouped(s.caloriesLeft)) kcal left", systemImage: "flame.fill")
    }
}

struct FoodWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Provider.Entry
    var s: HaleSnapshot { entry.snapshot }
    var body: some View {
        content.containerBackground(for: .widget) { homeBackground(family, s.theme) }
    }
    @ViewBuilder private var content: some View {
        switch family {
        case .systemSmall: SmallFood(s: s)
        case .systemMedium: MediumFood(s: s)
        case .accessoryCircular: FoodCircular(s: s)
        case .accessoryRectangular: FoodRectangular(s: s)
        case .accessoryInline: FoodInline(s: s)
        default: SmallFood(s: s)
        }
    }
}

// MARK: - Workout widget

private struct SmallWorkout: View {
    let s: HaleSnapshot
    var t: WidgetTheme { s.theme }
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Overline("NEXT WORKOUT", t.accent)
            if s.nextWorkout.isEmpty {
                Text(s.lastWorkout.isEmpty ? "Start a workout" : "No routine set")
                    .font(.system(size: 16, weight: .bold)).foregroundStyle(t.text).lineLimit(2)
            } else {
                Text(s.nextWorkout).font(.system(size: 18, weight: .bold))
                    .foregroundStyle(t.text).lineLimit(2).minimumScaleFactor(0.8)
                if s.nextWorkoutExercises > 0 {
                    Text("\(s.nextWorkoutExercises) exercises").font(.system(size: 11)).foregroundStyle(t.muted)
                }
            }
            Spacer(minLength: 0)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(s.workoutsThisWeek)").font(.system(size: 22, weight: .bold, design: .rounded)).foregroundStyle(t.accent)
                Text("workout\(s.workoutsThisWeek == 1 ? "" : "s")\n· \(s.weeklySets) sets").font(.system(size: 10)).foregroundStyle(t.muted)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct MediumWorkout: View {
    let s: HaleSnapshot
    var t: WidgetTheme { s.theme }
    var body: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Overline("NEXT WORKOUT", t.accent)
                Text(s.nextWorkout.isEmpty ? "—" : s.nextWorkout)
                    .font(.system(size: 19, weight: .bold)).foregroundStyle(t.text).lineLimit(2).minimumScaleFactor(0.8)
                if s.nextWorkoutExercises > 0 {
                    Text("\(s.nextWorkoutExercises) exercises").font(.system(size: 11)).foregroundStyle(t.muted)
                }
                Spacer(minLength: 0)
                if !s.lastWorkout.isEmpty {
                    Text("Last: \(s.lastWorkout) · \(s.lastWorkoutAgo)").font(.system(size: 11)).foregroundStyle(t.muted).lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .leading, spacing: 4) {
                Overline("THIS WEEK", t.muted)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(s.workoutsThisWeek)").font(.system(size: 24, weight: .bold, design: .rounded)).foregroundStyle(t.accent)
                    Text("workout\(s.workoutsThisWeek == 1 ? "" : "s")").font(.system(size: 10)).foregroundStyle(t.muted)
                }
                Text("\(s.weeklySets) sets").font(.system(size: 12, weight: .medium)).foregroundStyle(t.text)
                if !s.weeklyVolumeDisplay.isEmpty {
                    Text("\(s.weeklyVolumeDisplay) vol").font(.system(size: 12, weight: .medium)).foregroundStyle(t.text)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

private struct WorkoutCircular: View {
    let s: HaleSnapshot
    var body: some View {
        Gauge(value: Double(min(s.workoutsThisWeek, 7)), in: 0...7) {
            Text("wk")
        } currentValueLabel: {
            Text("\(s.workoutsThisWeek)")
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .widgetAccentable()
    }
}

private struct WorkoutRectangular: View {
    let s: HaleSnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Label(s.nextWorkout.isEmpty ? "No workout set" : s.nextWorkout, systemImage: "dumbbell.fill")
                .font(.system(size: 14, weight: .semibold)).widgetAccentable().lineLimit(1)
            if s.nextWorkoutExercises > 0 {
                Text("\(s.nextWorkoutExercises) exercises · \(s.workoutsThisWeek) this week").font(.system(size: 12))
            } else {
                Text("\(s.workoutsThisWeek) workouts · \(s.weeklySets) sets").font(.system(size: 12))
            }
            if !s.lastWorkout.isEmpty {
                Text("Last: \(s.lastWorkout) · \(s.lastWorkoutAgo)").font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
            }
        }
    }
}

private struct WorkoutInline: View {
    let s: HaleSnapshot
    var body: some View {
        Label(s.nextWorkout.isEmpty ? "\(s.workoutsThisWeek) workouts this week" : "Next: \(s.nextWorkout)",
              systemImage: "dumbbell.fill")
    }
}

struct WorkoutWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Provider.Entry
    var s: HaleSnapshot { entry.snapshot }
    var body: some View {
        content.containerBackground(for: .widget) { homeBackground(family, s.theme) }
    }
    @ViewBuilder private var content: some View {
        switch family {
        case .systemSmall: SmallWorkout(s: s)
        case .systemMedium: MediumWorkout(s: s)
        case .accessoryCircular: WorkoutCircular(s: s)
        case .accessoryRectangular: WorkoutRectangular(s: s)
        case .accessoryInline: WorkoutInline(s: s)
        default: SmallWorkout(s: s)
        }
    }
}

// MARK: - Health widget

private struct SmallHealth: View {
    let s: HaleSnapshot
    var t: WidgetTheme { s.theme }
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Overline("WEIGHT", t.accent)
            Text(s.weightDisplay.isEmpty ? "—" : s.weightDisplay)
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .foregroundStyle(t.text).minimumScaleFactor(0.6).lineLimit(1)
            if !s.bodyFatDisplay.isEmpty {
                Text(s.bodyFatDisplay).font(.system(size: 12, weight: .medium)).foregroundStyle(t.muted)
            }
            Spacer(minLength: 0)
            if !s.weightTrend.isEmpty {
                Text(s.weightTrend).font(.system(size: 12, weight: .semibold)).foregroundStyle(t.accent)
            } else if !s.goalWeightDisplay.isEmpty {
                Text(s.goalWeightDisplay).font(.system(size: 11)).foregroundStyle(t.muted)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct MediumHealth: View {
    let s: HaleSnapshot
    var t: WidgetTheme { s.theme }
    var body: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 3) {
                Overline("WEIGHT", t.accent)
                Text(s.weightDisplay.isEmpty ? "—" : s.weightDisplay)
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundStyle(t.text).minimumScaleFactor(0.6).lineLimit(1)
                if !s.weightTrend.isEmpty {
                    Text(s.weightTrend).font(.system(size: 12, weight: .semibold)).foregroundStyle(t.accent)
                }
                Spacer(minLength: 0)
                if !s.leanMassDisplay.isEmpty {
                    Text(s.leanMassDisplay).font(.system(size: 11)).foregroundStyle(t.muted)
                    Text(s.fatMassDisplay).font(.system(size: 11)).foregroundStyle(t.muted)
                } else if !s.goalWeightDisplay.isEmpty {
                    Text(s.goalWeightDisplay).font(.system(size: 11)).foregroundStyle(t.muted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if s.bodyFatPct > 0 {
                RingView(fraction: min(1, s.bodyFatPct / 40.0), color: t.accent, track: t.track, lineWidth: 9,
                         centerTop: "\(Int(s.bodyFatPct.rounded()))%", centerBottom: "fat",
                         textColor: t.text, mutedColor: t.muted, topSize: 20)
                    .frame(width: 82, height: 82)
            }
        }
    }
}

private struct HealthCircular: View {
    let s: HaleSnapshot
    @ViewBuilder var body: some View {
        if s.bodyFatPct > 0 {
            Gauge(value: min(s.bodyFatPct, 40), in: 0...40) {
                Text("fat")
            } currentValueLabel: {
                Text("\(Int(s.bodyFatPct.rounded()))").minimumScaleFactor(0.5)
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .widgetAccentable()
        } else {
            VStack(spacing: 1) {
                Image(systemName: "scalemass.fill").font(.system(size: 13))
                Text(s.weightDisplay).font(.system(size: 11)).minimumScaleFactor(0.4).lineLimit(1)
            }
        }
    }
}

private struct HealthRectangular: View {
    let s: HaleSnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Label(s.weightDisplay.isEmpty ? "No weight yet" : s.weightDisplay, systemImage: "scalemass.fill")
                .font(.system(size: 14, weight: .semibold)).widgetAccentable()
            if !s.bodyFatDisplay.isEmpty { Text(s.bodyFatDisplay).font(.system(size: 12)) }
            if !s.weightTrend.isEmpty {
                Text(s.weightTrend).font(.system(size: 12)).foregroundStyle(.secondary)
            } else if !s.goalWeightDisplay.isEmpty {
                Text(s.goalWeightDisplay).font(.system(size: 12)).foregroundStyle(.secondary)
            }
        }
    }
}

private struct HealthInline: View {
    let s: HaleSnapshot
    var body: some View {
        Label(s.bodyFatDisplay.isEmpty ? s.weightDisplay : "\(s.weightDisplay) · \(s.bodyFatDisplay)",
              systemImage: "scalemass.fill")
    }
}

struct HealthWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Provider.Entry
    var s: HaleSnapshot { entry.snapshot }
    var body: some View {
        content.containerBackground(for: .widget) { homeBackground(family, s.theme) }
    }
    @ViewBuilder private var content: some View {
        switch family {
        case .systemSmall: SmallHealth(s: s)
        case .systemMedium: MediumHealth(s: s)
        case .accessoryCircular: HealthCircular(s: s)
        case .accessoryRectangular: HealthRectangular(s: s)
        case .accessoryInline: HealthInline(s: s)
        default: SmallHealth(s: s)
        }
    }
}

// MARK: - Overview widget (all three sections)

private struct MediumOverview: View {
    let s: HaleSnapshot
    var t: WidgetTheme { s.theme }
    var body: some View {
        HStack(spacing: 14) {
            CalorieRing(s: s, size: 84, lineWidth: 8, topSize: 20)
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 10) {
                    MacroPip(letter: "P", value: s.proteinConsumed, color: t.protein, muted: t.muted)
                    MacroPip(letter: "C", value: s.carbsConsumed, color: t.carbs, muted: t.muted)
                    MacroPip(letter: "F", value: s.fatConsumed, color: t.fat, muted: t.muted)
                }
                Divider().overlay(t.track)
                HStack(spacing: 6) {
                    Image(systemName: "dumbbell.fill").font(.system(size: 11)).foregroundStyle(t.accent)
                    Text(s.nextWorkout.isEmpty ? "No workout" : s.nextWorkout)
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(t.text).lineLimit(1)
                    if s.nextWorkoutExercises > 0 {
                        Text("· \(s.nextWorkoutExercises) ex").font(.system(size: 11)).foregroundStyle(t.muted)
                    }
                }
                HStack(spacing: 6) {
                    Image(systemName: "scalemass.fill").font(.system(size: 11)).foregroundStyle(t.accent)
                    Text(s.weightDisplay.isEmpty ? "—" : s.weightDisplay)
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(t.text)
                    if !s.bodyFatDisplay.isEmpty {
                        Text("· \(s.bodyFatDisplay)").font(.system(size: 11)).foregroundStyle(t.muted)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct LargeOverview: View {
    let s: HaleSnapshot
    var t: WidgetTheme { s.theme }
    var body: some View {
        VStack(spacing: 10) {
            // Food
            HStack(spacing: 14) {
                CalorieRing(s: s, size: 78, lineWidth: 8, topSize: 19)
                VStack(alignment: .leading, spacing: 6) {
                    MacroBar(label: "Protein", value: s.proteinConsumed, target: s.proteinTarget, color: t.protein, t: t)
                    MacroBar(label: "Carbs", value: s.carbsConsumed, target: s.carbsTarget, color: t.carbs, t: t)
                    MacroBar(label: "Fat", value: s.fatConsumed, target: s.fatTarget, color: t.fat, t: t)
                }
            }
            Divider().overlay(t.track)
            // Workout
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 1) {
                        Overline("NEXT WORKOUT", t.accent)
                        Text(s.nextWorkout.isEmpty ? "—" : s.nextWorkout)
                            .font(.system(size: 16, weight: .bold)).foregroundStyle(t.text).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    VStack(alignment: .trailing, spacing: 1) {
                        Text("\(s.workoutsThisWeek) workout\(s.workoutsThisWeek == 1 ? "" : "s")")
                            .font(.system(size: 13, weight: .semibold)).foregroundStyle(t.text)
                        Text("\(s.weeklySets) sets\(s.weeklyVolumeDisplay.isEmpty ? "" : " · \(s.weeklyVolumeDisplay)")")
                            .font(.system(size: 10)).foregroundStyle(t.muted)
                    }
                }
                if !s.volumeSeries.isEmpty {
                    BarSparkline(values: s.volumeSeries, color: t.accent, track: t.track).frame(height: 26)
                }
            }
            Divider().overlay(t.track)
            // Health
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 1) {
                    Overline("WEIGHT", t.accent)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(s.weightDisplay.isEmpty ? "—" : s.weightDisplay)
                            .font(.system(size: 18, weight: .bold, design: .rounded)).foregroundStyle(t.text)
                        if !s.bodyFatDisplay.isEmpty {
                            Text(s.bodyFatDisplay).font(.system(size: 12)).foregroundStyle(t.muted)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !s.weightTrend.isEmpty {
                    Text(s.weightTrend).font(.system(size: 12, weight: .semibold)).foregroundStyle(t.accent)
                } else if !s.goalWeightDisplay.isEmpty {
                    Text(s.goalWeightDisplay).font(.system(size: 11)).foregroundStyle(t.muted)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

struct OverviewWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Provider.Entry
    var s: HaleSnapshot { entry.snapshot }
    var body: some View {
        Group {
            if family == .systemMedium { MediumOverview(s: s) } else { LargeOverview(s: s) }
        }
        .containerBackground(for: .widget) { s.theme.bg }
    }
}

// MARK: - Widgets

private let sectionFamilies: [WidgetFamily] = [
    .systemSmall, .systemMedium,
    .accessoryCircular, .accessoryRectangular, .accessoryInline,
]

struct FoodWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HaleFoodWidget", provider: Provider()) { entry in
            FoodWidgetView(entry: entry)
        }
        .configurationDisplayName("Hale · Food")
        .description("Calories left, macros, and weight.")
        .supportedFamilies(sectionFamilies)
    }
}

struct WorkoutWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HaleWorkoutWidget", provider: Provider()) { entry in
            WorkoutWidgetView(entry: entry)
        }
        .configurationDisplayName("Hale · Workout")
        .description("Your next workout and this week's training.")
        .supportedFamilies(sectionFamilies)
    }
}

struct HealthWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HaleHealthWidget", provider: Provider()) { entry in
            HealthWidgetView(entry: entry)
        }
        .configurationDisplayName("Hale · Health")
        .description("Weight, body fat, and your trend.")
        .supportedFamilies(sectionFamilies)
    }
}

struct OverviewWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HaleOverviewWidget", provider: Provider()) { entry in
            OverviewWidgetView(entry: entry)
        }
        .configurationDisplayName("Hale · Overview")
        .description("Food, workout, and health together at a glance.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

@main
struct HaleWidgetBundle: WidgetBundle {
    var body: some Widget {
        FoodWidget()
        WorkoutWidget()
        HealthWidget()
        OverviewWidget()
        WorkoutLiveActivity()
    }
}
