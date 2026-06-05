import SwiftUI
import WatchKit

// MARK: - Helpers

private func durationText(_ seconds: TimeInterval) -> String {
    let s = max(0, Int(seconds))
    let h = s / 3600, m = (s % 3600) / 60, sec = s % 60
    if h > 0 { return String(format: "%d:%02d:%02d", h, m, sec) }
    return String(format: "%d:%02d", m, sec)
}

struct WorkoutSummary {
    let durationText: String
    let sets: Int
    let volumeText: String
    let kcal: Int
}

// MARK: - Start menu (idle)

struct StartMenuView: View {
    let snapshot: Snapshot
    @ObservedObject var wc: WatchConnectivityManager
    let palette: Palette

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if let next = snapshot.nextWorkoutName, !next.isEmpty, let id = snapshot.nextTemplateId {
                    Button { wc.startTemplate(id) } label: {
                        VStack(spacing: 2) {
                            Text("Next up").font(.caption2).foregroundStyle(.white.opacity(0.8))
                            Text(next).font(.headline).foregroundStyle(.white).lineLimit(1)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(palette.accent)
                }

                Button { wc.startEmpty() } label: {
                    Label("Quick start", systemImage: "plus")
                        .frame(maxWidth: .infinity)
                }
                .tint(palette.surfaceHigh)

                if let templates = snapshot.templates, !templates.isEmpty {
                    Text("TEMPLATES")
                        .font(.caption2).foregroundStyle(palette.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 4)
                    ForEach(templates) { t in
                        Button { wc.startTemplate(t.id) } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(t.name).font(.body).foregroundStyle(palette.text).lineLimit(1)
                                    Text("\(t.exerciseCount) exercises").font(.caption2).foregroundStyle(palette.muted)
                                }
                                Spacer()
                                Image(systemName: "play.fill").font(.caption).foregroundStyle(palette.accent)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .tint(palette.surfaceHigh)
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Hale")
    }
}

// MARK: - Active workout

private enum EntryField { case weight, reps }

struct ActiveWorkoutView: View {
    let snapshot: Snapshot
    @ObservedObject var wc: WatchConnectivityManager
    @ObservedObject var workout: WorkoutManager
    let onFinish: (WorkoutSummary) -> Void

    @State private var field: EntryField = .weight
    @State private var value: Double = 0
    /// The restEndsAtMs the user has already dismissed (so a new rest shows the ring again).
    @State private var dismissedRest: Double = 0
    @State private var confirmingDiscard = false

    private let metricsTimer = Timer.publish(every: 10, on: .main, in: .common).autoconnect()

    private var palette: Palette { Palette(snapshot.theme) }

    private var showRest: Bool {
        guard let ms = snapshot.restEndsAtMs, ms > 0, ms != dismissedRest else { return false }
        return true
    }

    var body: some View {
        NavigationStack {
            // Rest and entry are both screen *content* (not an overlay) so the Finish/Cancel
            // toolbar stays on top in both states.
            Group {
                if showRest, let end = snapshot.restEndsAt {
                    RestRingView(end: end, total: snapshot.restTotal ?? 0, palette: palette) {
                        dismissedRest = snapshot.restEndsAtMs ?? 0
                        wc.skipRest()
                    }
                } else {
                    mainContent
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .destructive) { confirmingDiscard = true } label: {
                        Image(systemName: "xmark")
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { finishNow() } label: {
                        Image(systemName: "checkmark").foregroundStyle(.green)
                    }
                }
            }
            .confirmationDialog("Discard workout?", isPresented: $confirmingDiscard, titleVisibility: .visible) {
                Button("Discard", role: .destructive) { wc.discard() }
                Button("Cancel", role: .cancel) {}
            }
        }
        .onChange(of: snapshot.currentSet?.setId) { _, _ in resetEntry() }
        .onAppear { resetEntry() }
        .onReceive(metricsTimer) { _ in
            if workout.running { wc.liveMetrics(kcal: workout.activeCalories, bpm: workout.heartRate) }
        }
    }

    // Fits one screen: compact stats, the value with +/- steppers (Digital Crown also adjusts
    // it), and a single Next/Done button. Finish/Discard live in the toolbar.
    private var mainContent: some View {
        VStack(spacing: 4) {
            if let cs = snapshot.currentSet {
                compactHeader(cs)
                Spacer(minLength: 0)
                fieldEntry(cs)
                Spacer(minLength: 0)
                nextButton(cs)
            } else {
                Spacer()
                Image(systemName: "checkmark.circle.fill").font(.system(size: 30)).foregroundStyle(.green)
                Text("All sets done").font(.headline).foregroundStyle(palette.text)
                Text("Tap ✓ to finish").font(.caption2).foregroundStyle(palette.muted)
                Spacer()
            }
        }
        .padding(.horizontal, 6)
        .padding(.bottom, 2)
        .focusable(snapshot.currentSet != nil)
        .digitalCrownRotation(
            // Snap every crown change to a clean step (no in-between values).
            Binding(get: { value }, set: { value = snapped($0) }),
            from: 0, through: 999,
            by: stepAmount,
            sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true
        )
    }

    private func compactHeader(_ cs: CurrentSet) -> some View {
        VStack(spacing: 0) {
            Text(snapshot.exerciseName ?? "Exercise")
                .font(.system(size: 14, weight: .semibold)).foregroundStyle(palette.accent)
                .lineLimit(1).minimumScaleFactor(0.6)
            HStack(spacing: 6) {
                Text("Set \(cs.setNumber)\(cs.side)")
                if let start = snapshot.startedAt {
                    Label { Text(start, style: .timer).monospacedDigit() } icon: { Image(systemName: "stopwatch") }
                }
                if workout.activeCalories > 0 {
                    Label("\(Int(workout.activeCalories.rounded()))", systemImage: "flame.fill")
                }
                if workout.heartRate > 0 {
                    Label("\(Int(workout.heartRate.rounded()))", systemImage: "heart.fill").foregroundStyle(.red)
                }
            }
            .font(.system(size: 10)).foregroundStyle(palette.muted).lineLimit(1).minimumScaleFactor(0.6)
        }
    }

    private func fieldEntry(_ cs: CurrentSet) -> some View {
        VStack(spacing: 3) {
            Text(field == .weight ? "WEIGHT (\(snapshot.unitLabel ?? "kg"))" : "REPS")
                .font(.system(size: 11)).foregroundStyle(palette.muted)
            HStack(spacing: 10) {
                stepButton("minus.circle.fill") { step(-1) }
                Text(formatValue(value))
                    .font(.system(size: 42, weight: .bold, design: .rounded))
                    .monospacedDigit().foregroundStyle(palette.text)
                    .frame(minWidth: 64)
                    .lineLimit(1).minimumScaleFactor(0.5)
                stepButton("plus.circle.fill") { step(1) }
            }
            if !cs.prevText.isEmpty {
                Text("Prev \(cs.prevText)").font(.system(size: 10)).foregroundStyle(palette.muted)
            }
        }
    }

    private func stepButton(_ icon: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 34)).foregroundStyle(palette.accent)
        }
        .buttonStyle(.plain)
    }

    private func nextButton(_ cs: CurrentSet) -> some View {
        Button { next(cs) } label: {
            Text(field == .weight ? "Next" : "Done")
                .font(.system(size: 17, weight: .semibold)).frame(maxWidth: .infinity)
        }
        .tint(palette.accent)
        .buttonStyle(.borderedProminent)
    }

    private func finishNow() {
        onFinish(WorkoutSummary(
            durationText: durationText(snapshot.startedAt.map { Date().timeIntervalSince($0) } ?? 0),
            sets: snapshot.setsDone ?? 0,
            volumeText: snapshot.volumeText ?? "",
            kcal: Int(workout.activeCalories.rounded())
        ))
    }

    // MARK: Entry logic

    /// The increment for the current field: weight by 5, reps by 1 (in the displayed unit).
    private var stepAmount: Double { field == .weight ? 5 : 1 }

    /// Snap a value to a clean multiple of the step (no in-between values).
    private func snapped(_ v: Double) -> Double {
        max(0, (v / stepAmount).rounded() * stepAmount)
    }

    private func resetEntry() {
        field = .weight
        value = snapped(Double(snapshot.currentSet?.weight ?? 0))
    }

    private func step(_ dir: Int) {
        value = snapped(value + Double(dir) * stepAmount)
        WKInterfaceDevice.current().play(.click)
    }

    private func next(_ cs: CurrentSet) {
        if field == .weight {
            wc.setValue(cs.exId, cs.setId, field: "weight", value: value)
            field = .reps
            value = snapped(Double(cs.reps))
            WKInterfaceDevice.current().play(.click)
        } else {
            wc.setValue(cs.exId, cs.setId, field: "reps", value: value)
            wc.completeSet(cs.exId, cs.setId)
            WKInterfaceDevice.current().play(.success)
            // The phone advances + (maybe) starts rest, then pushes a new snapshot — onChange
            // of setId resets the entry for the next set.
        }
    }

    /// Whole numbers show without a decimal; half-pound steps show one place (e.g. "137.5").
    private func formatValue(_ v: Double) -> String {
        v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
    }
}

// MARK: - Rest ring (fullscreen countdown)

struct RestRingView: View {
    let end: Date
    let total: Double
    let palette: Palette
    let onDismiss: () -> Void

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let remaining = max(0, end.timeIntervalSince(context.date))
            let progress = total > 0 ? remaining / total : 0
            VStack(spacing: 8) {
                ZStack {
                    Circle().stroke(palette.surfaceHigh, lineWidth: 8)
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(palette.accent, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 1), value: progress)
                    VStack(spacing: 0) {
                        Text("REST").font(.system(size: 10, weight: .semibold)).foregroundStyle(palette.accent)
                        Text(timerInterval: context.date...max(end, context.date), countsDown: true)
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .monospacedDigit().foregroundStyle(palette.text)
                            .lineLimit(1).minimumScaleFactor(0.6)
                    }
                    .padding(18)
                }
                Button("Next set", action: onDismiss)
                    .tint(palette.accent)
                    .buttonStyle(.borderedProminent)
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 4)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.black)
            .onChange(of: remaining <= 0) { _, done in if done { onDismiss() } }
        }
    }
}

// MARK: - Summary (after finishing on the watch)

struct SummaryView: View {
    let summary: WorkoutSummary
    let palette: Palette
    let onDone: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 34)).foregroundStyle(.green)
                Text("Workout complete").font(.headline).foregroundStyle(palette.text)

                VStack(spacing: 4) {
                    summaryRow("Time", summary.durationText, "stopwatch")
                    summaryRow("Sets", "\(summary.sets)", "checklist")
                    if !summary.volumeText.isEmpty { summaryRow("Volume", summary.volumeText, "scalemass") }
                    if summary.kcal > 0 { summaryRow("Calories", "\(summary.kcal)", "flame.fill") }
                }
                .padding(.vertical, 4)

                Button("Done", action: onDone)
                    .tint(palette.accent)
            }
            .padding(.horizontal, 6)
        }
    }

    private func summaryRow(_ label: String, _ value: String, _ icon: String) -> some View {
        HStack {
            Label(label, systemImage: icon).font(.caption).foregroundStyle(palette.muted)
            Spacer()
            Text(value).font(.body).foregroundStyle(palette.text).monospacedDigit()
        }
    }
}
