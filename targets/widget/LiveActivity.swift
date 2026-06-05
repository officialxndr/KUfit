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
                    // Rest: a real countdown — `timerInterval` ticks natively even on the Lock
                    // Screen / Always-On Display (the system updates it without app pushes).
                    Text("REST").font(.system(size: 9, weight: .bold)).foregroundStyle(t.accent)
                    Text(timerInterval: Date()...rest, countsDown: true)
                        .font(.system(size: 22, weight: .bold, design: .rounded)).monospacedDigit()
                        .multilineTextAlignment(.trailing).foregroundStyle(t.text).lineLimit(1).minimumScaleFactor(0.7)
                } else {
                    // Elapsed: a self-updating relative duration ("3 min", "1 hr 5 min"). `.relative`
                    // both shows units AND ticks on the Lock Screen / AOD (system-updated ~once a min),
                    // so it doesn't freeze when locked the way a pushed string does.
                    Text(st.startedAt, style: .relative)
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .multilineTextAlignment(.trailing).foregroundStyle(t.text).lineLimit(1).minimumScaleFactor(0.5)
                }
                let sub = [st.caloriesText, st.volumeText].filter { !$0.isEmpty }.joined(separator: " · ")
                if !sub.isEmpty {
                    Text(sub).font(.system(size: 11)).foregroundStyle(t.muted).lineLimit(1)
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
                        Text(st.startedAt, style: .relative)
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .multilineTextAlignment(.trailing).frame(maxWidth: 96).lineLimit(1).minimumScaleFactor(0.5)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text("\(st.setsDone)/\(st.totalSets) sets").font(.system(size: 12)).foregroundStyle(t.muted)
                        Spacer()
                        let sub = [st.caloriesText, st.volumeText].filter { !$0.isEmpty }.joined(separator: " · ")
                        if !sub.isEmpty {
                            Text(sub).font(.system(size: 12)).foregroundStyle(t.muted)
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
                    Text(timerInterval: st.startedAt...st.startedAt.addingTimeInterval(86400), countsDown: false).monospacedDigit().frame(maxWidth: 44)
                }
            } minimal: {
                Image(systemName: "dumbbell.fill").foregroundStyle(t.accent)
            }
            .keylineTint(t.accent)
        }
    }
}
