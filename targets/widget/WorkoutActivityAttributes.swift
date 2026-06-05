import ActivityKit
import Foundation

/// Shared Live Activity type for an in-progress workout.
///
/// ⚠️ Duplicated **verbatim** from `modules/hale-live-activity/ios/WorkoutActivityAttributes.swift`
/// (compiled into the app's native module). ActivityKit matches the app's `Activity` to this
/// widget's `ActivityConfiguration` by the type's **name** + `ContentState` shape, so the two
/// copies MUST stay identical. Edit both together.
struct WorkoutActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var exerciseName: String
        var setsDone: Int
        var totalSets: Int
        var exerciseIndex: Int
        var totalExercises: Int
        var startedAt: Date
        var restEndsAt: Date?
        var volumeText: String
        var caloriesText: String
    }

    var workoutName: String
}
