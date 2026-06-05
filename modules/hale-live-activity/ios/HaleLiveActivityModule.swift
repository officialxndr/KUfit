import ExpoModulesCore
import ActivityKit

/// Starts / updates / ends the workout Live Activity from JS. The SwiftUI for the activity
/// lives in the widget extension (`targets/widget/LiveActivity.swift`); this module owns the
/// ActivityKit lifecycle. All calls no-op gracefully when Live Activities aren't available.
public class HaleLiveActivityModule: Module {
    /// Stored as `Any?` because `Activity<…>` is only available on iOS 16.2+.
    private var activity: Any?

    public func definition() -> ModuleDefinition {
        Name("HaleLiveActivity")

        Function("isSupported") { () -> Bool in
            if #available(iOS 16.2, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        Function("start") { (workoutName: String, state: [String: Any]) in
            guard #available(iOS 16.2, *) else { return }
            self.endNow()
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
            let attributes = WorkoutActivityAttributes(workoutName: workoutName)
            let content = ActivityContent(state: Self.contentState(from: state), staleDate: nil)
            do {
                self.activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
            } catch {
                self.activity = nil
            }
        }

        Function("update") { (state: [String: Any]) in
            guard #available(iOS 16.2, *), let activity = self.activity as? Activity<WorkoutActivityAttributes> else { return }
            let content = ActivityContent(state: Self.contentState(from: state), staleDate: nil)
            Task { await activity.update(content) }
        }

        Function("end") {
            self.endNow()
        }
    }

    private func endNow() {
        guard #available(iOS 16.2, *) else { return }
        self.activity = nil
        // End every workout activity — clears the current one plus any orphaned by a
        // force-quit mid-workout (the stored reference is gone after a relaunch).
        Task {
            for activity in Activity<WorkoutActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }

    @available(iOS 16.2, *)
    private static func contentState(from dict: [String: Any]) -> WorkoutActivityAttributes.ContentState {
        func i(_ k: String) -> Int { (dict[k] as? NSNumber)?.intValue ?? 0 }
        func s(_ k: String) -> String { (dict[k] as? String) ?? "" }
        func date(_ k: String) -> Date? {
            guard let n = dict[k] as? NSNumber, n.doubleValue > 0 else { return nil }
            return Date(timeIntervalSince1970: n.doubleValue / 1000)
        }
        return WorkoutActivityAttributes.ContentState(
            exerciseName: s("exerciseName"),
            setsDone: i("setsDone"),
            totalSets: i("totalSets"),
            exerciseIndex: i("exerciseIndex"),
            totalExercises: i("totalExercises"),
            startedAt: date("startedAtMs") ?? Date(),
            restEndsAt: date("restEndsAtMs"),
            volumeText: s("volumeText"),
            caloriesText: s("caloriesText")
        )
    }
}
