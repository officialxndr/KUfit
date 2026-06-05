import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Lock Screen / banner presentation

struct WorkoutLiveActivityView: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        let t = HaleSnapshot.load().theme
        let st = context.state
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Image(systemName: "dumbbell.fill").font(.system(size: 12)).foregroundStyle(t.accent)
                    Text(context.attributes.workoutName.isEmpty ? "Workout" : context.attributes.workoutName)
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(t.muted)
                }
                Text(st.exerciseName.isEmpty ? "—" : st.exerciseName)
                    .font(.system(size: 17, weight: .bold)).foregroundStyle(t.text).lineLimit(1).minimumScaleFactor(0.7)
                Text("\(st.setsDone)/\(st.totalSets) sets"
                     + (st.totalExercises > 0 ? " · exercise \(st.exerciseIndex)/\(st.totalExercises)" : ""))
                    .font(.system(size: 12)).foregroundStyle(t.muted)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 2) {
                if let rest = st.restEndsAt, rest > Date() {
                    Text("REST").font(.system(size: 9, weight: .bold)).foregroundStyle(t.accent)
                    Text(timerInterval: Date()...rest, countsDown: true)
                        .font(.system(size: 22, weight: .bold, design: .rounded)).monospacedDigit()
                        .multilineTextAlignment(.trailing).foregroundStyle(t.text).frame(maxWidth: 82)
                } else {
                    Text(st.startedAt, style: .timer)
                        .font(.system(size: 22, weight: .bold, design: .rounded)).monospacedDigit()
                        .multilineTextAlignment(.trailing).foregroundStyle(t.text).frame(maxWidth: 82)
                    if !st.volumeText.isEmpty {
                        Text(st.volumeText).font(.system(size: 11)).foregroundStyle(t.muted)
                    }
                }
            }
        }
        .padding(16)
        .activityBackgroundTint(t.bg.opacity(0.55))
        .activitySystemActionForegroundColor(t.accent)
    }
}

// MARK: - Activity widget (Lock Screen + Dynamic Island)

struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            WorkoutLiveActivityView(context: context)
        } dynamicIsland: { context in
            let t = HaleSnapshot.load().theme
            let st = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Label(context.attributes.workoutName.isEmpty ? "Workout" : context.attributes.workoutName,
                              systemImage: "dumbbell.fill")
                            .font(.system(size: 12, weight: .semibold)).foregroundStyle(t.accent)
                        Text(st.exerciseName.isEmpty ? "—" : st.exerciseName)
                            .font(.system(size: 14, weight: .bold)).lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let rest = st.restEndsAt, rest > Date() {
                        Text(timerInterval: Date()...rest, countsDown: true)
                            .font(.system(size: 18, weight: .bold, design: .rounded)).monospacedDigit()
                            .multilineTextAlignment(.trailing).frame(maxWidth: 72).foregroundStyle(t.accent)
                    } else {
                        Text(st.startedAt, style: .timer)
                            .font(.system(size: 18, weight: .bold, design: .rounded)).monospacedDigit()
                            .multilineTextAlignment(.trailing).frame(maxWidth: 72)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text("\(st.setsDone)/\(st.totalSets) sets").font(.system(size: 12)).foregroundStyle(t.muted)
                        Spacer()
                        if !st.volumeText.isEmpty {
                            Text(st.volumeText).font(.system(size: 12)).foregroundStyle(t.muted)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "dumbbell.fill").foregroundStyle(t.accent)
            } compactTrailing: {
                if let rest = st.restEndsAt, rest > Date() {
                    Text(timerInterval: Date()...rest, countsDown: true)
                        .monospacedDigit().frame(maxWidth: 44).foregroundStyle(t.accent)
                } else {
                    Text(st.startedAt, style: .timer).monospacedDigit().frame(maxWidth: 44)
                }
            } minimal: {
                Image(systemName: "dumbbell.fill").foregroundStyle(t.accent)
            }
            .keylineTint(t.accent)
        }
    }
}
