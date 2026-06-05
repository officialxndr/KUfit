import SwiftUI

/// Hale watchOS app entry. Routes between the start menu (idle), the active workout, and a local
/// post-finish summary, driven by the snapshot the iPhone pushes over WatchConnectivity. All
/// workout state lives on the phone — the watch sends commands and renders what comes back.
@main
struct HaleWatchApp: App {
    @StateObject private var wc = WatchConnectivityManager()
    @StateObject private var workout = WorkoutManager()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView(wc: wc, workout: workout)
                .onAppear { workout.requestAuthorization() }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { wc.requestSync() }
                }
        }
    }
}

struct RootView: View {
    @ObservedObject var wc: WatchConnectivityManager
    @ObservedObject var workout: WorkoutManager
    /// Non-nil while showing the local post-finish summary (overrides incoming snapshots).
    @State private var summary: WorkoutSummary?

    var body: some View {
        let palette = Palette(wc.snapshot?.theme)
        Group {
            if let summary {
                SummaryView(summary: summary, palette: palette) { self.summary = nil }
            } else if let snap = wc.snapshot {
                if snap.active {
                    ActiveWorkoutView(snapshot: snap, wc: wc, workout: workout) { done in
                        workout.end()
                        wc.finish()
                        summary = done
                    }
                } else {
                    StartMenuView(snapshot: snap, wc: wc, palette: palette)
                }
            } else {
                ConnectingView(palette: palette)
            }
        }
        .tint(palette.accent)
        // Start / end the HKWorkoutSession as the workout begins / ends on either device.
        .onChange(of: wc.snapshot?.active ?? false) { _, isActive in
            if isActive { workout.start() } else { workout.end() }
        }
    }
}

struct ConnectingView: View {
    let palette: Palette
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "applewatch.radiowaves.left.and.right")
                .font(.system(size: 26)).foregroundStyle(palette.accent)
            Text("Open Hale on your iPhone to get started.")
                .font(.footnote).foregroundStyle(palette.muted)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}
