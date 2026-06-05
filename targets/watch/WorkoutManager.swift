import Foundation
import HealthKit

/// Runs an `HKWorkoutSession` on the watch for the duration of a workout. This gives real
/// heart-rate-based active calories (far better than the phone's MET estimate), keeps the watch
/// app alive during long rests, and — because the session is saved to HealthKit on end — feeds
/// the iPhone's existing post-workout calorie/HR reconciliation (`finishActiveWorkout` →
/// `getActiveEnergyBurned`). The live `activeCalories` / `heartRate` are published for the UI and
/// pushed to the phone (`liveMetrics`) for the Live Activity's calorie readout.
final class WorkoutManager: NSObject, ObservableObject {
    @Published var activeCalories: Double = 0
    @Published var heartRate: Double = 0
    @Published var running = false

    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let share: Set<HKSampleType> = [HKQuantityType.workoutType()]
        let read: Set<HKObjectType> = [
            HKQuantityType(.heartRate),
            HKQuantityType(.activeEnergyBurned),
        ]
        store.requestAuthorization(toShare: share, read: read) { _, _ in }
    }

    func start() {
        guard !running, HKHealthStore.isHealthDataAvailable() else { return }
        let config = HKWorkoutConfiguration()
        config.activityType = .traditionalStrengthTraining
        config.locationType = .indoor
        do {
            let session = try HKWorkoutSession(healthStore: store, configuration: config)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: config)
            session.delegate = self
            builder.delegate = self
            self.session = session
            self.builder = builder

            let start = Date()
            session.startActivity(with: start)
            builder.beginCollection(withStart: start) { _, _ in }
            running = true
        } catch {
            running = false
        }
    }

    func end() {
        guard running, let session, let builder else { return }
        session.end()
        builder.endCollection(withEnd: Date()) { _, _ in
            builder.finishWorkout { _, _ in }
        }
        self.session = nil
        self.builder = nil
        running = false
        activeCalories = 0
        heartRate = 0
    }
}

extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {}
    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {}
}

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType,
                  let stats = workoutBuilder.statistics(for: quantityType) else { continue }
            DispatchQueue.main.async {
                if quantityType == HKQuantityType(.activeEnergyBurned) {
                    self.activeCalories = stats.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? self.activeCalories
                } else if quantityType == HKQuantityType(.heartRate) {
                    let unit = HKUnit.count().unitDivided(by: .minute())
                    self.heartRate = stats.mostRecentQuantity()?.doubleValue(for: unit) ?? self.heartRate
                }
            }
        }
    }
}
