import ExpoModulesCore
import WatchConnectivity
import HealthKit

/// Phone-side WatchConnectivity relay for the Hale watchOS app.
///
/// This module owns the iOS `WCSession`. It's deliberately dumb: JS pushes a JSON snapshot
/// of the active workout via `updateState`, which we send to the watch as the latest
/// application context (survives backgrounding) plus a live `sendMessage` when the watch is
/// reachable. Every message the watch sends back (set values, completions, start/finish,
/// live HR/calorie metrics) is forwarded verbatim to JS through the `onMessage` event, where
/// `src/lib/watch.ts` routes it onto the existing `sessionStore` actions. All workout logic
/// stays on the phone — the watch is a remote + display.
///
/// `WCSessionDelegate` requires an `NSObject`, and an Expo `Module` isn't one, so a small
/// `WatchConnector` NSObject owns the delegate and calls back into the module via a closure.
private final class WatchConnector: NSObject, WCSessionDelegate {
  var onMessage: (([String: Any]) -> Void)?

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func send(_ json: String) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    // Coalesced "latest state" — delivered even if the watch app was backgrounded.
    try? session.updateApplicationContext(["state": json])
    // Low-latency live push when the watch app is foreground + in range.
    if session.isReachable {
      session.sendMessage(["state": json], replyHandler: nil, errorHandler: nil)
    }
  }

  // MARK: WCSessionDelegate
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    // Re-activate so a newly paired watch keeps working without an app relaunch.
    WCSession.default.activate()
  }
  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    onMessage?(message)
  }
  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    onMessage?(userInfo)
  }
}

public class HaleWatchModule: Module {
  private let connector = WatchConnector()
  private let healthStore = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("HaleWatch")

    Events("onMessage")

    OnCreate {
      self.connector.onMessage = { [weak self] dict in
        // WCSession delivers on a background queue; hop to main before emitting to JS.
        DispatchQueue.main.async { self?.sendEvent("onMessage", dict) }
      }
      self.connector.activate()
    }

    Function("isSupported") { () -> Bool in
      WCSession.isSupported()
    }

    Function("isReachable") { () -> Bool in
      WCSession.isSupported() ? WCSession.default.isReachable : false
    }

    Function("updateState") { (json: String) in
      self.connector.send(json)
    }

    /// True when a watch is paired AND the Hale watch app is installed on it — so the JS side
    /// only attempts an auto-launch when it can actually succeed.
    Function("isWatchAppInstalled") { () -> Bool in
      guard WCSession.isSupported() else { return false }
      let s = WCSession.default
      return s.isPaired && s.isWatchAppInstalled
    }

    /// Launch the paired Hale watch app into a strength workout (HealthKit `startWatchApp`).
    /// The watch app then starts its own `HKWorkoutSession` when the phone's `active:true`
    /// snapshot arrives (WorkoutManager's `guard !running` prevents a double-start). No-op when
    /// HealthKit is unavailable or no watch app is installed.
    Function("startWatchWorkout") {
      guard HKHealthStore.isHealthDataAvailable(), WCSession.isSupported() else { return }
      let s = WCSession.default
      guard s.isPaired, s.isWatchAppInstalled else { return }
      let config = HKWorkoutConfiguration()
      config.activityType = .traditionalStrengthTraining
      config.locationType = .indoor
      // Requesting workout-share auth is idempotent; on first run it surfaces the prompt the
      // watch session needs, then launches the app. Both calls fail gracefully (no crash).
      self.healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: []) { [weak self] _, _ in
        self?.healthStore.startWatchApp(with: config) { _, _ in }
      }
    }
  }
}
