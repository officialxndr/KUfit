import ActivityKit
import Foundation

/// Shared Live Activity type for an in-progress workout.
///
/// ⚠️ This file is duplicated **verbatim** in `targets/widget/WorkoutActivityAttributes.swift`
/// (compiled into the widget extension). ActivityKit matches the app's `Activity` to the
/// widget's `ActivityConfiguration` by this type's **name** + `ContentState` shape, so the two
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
        var elapsedText: String
        var restText: String
        var volumeText: String
        var caloriesText: String
    }

    var workoutName: String
}
