import Foundation
import WatchConnectivity

/// The watch's side of the phone↔watch bridge. Receives the workout snapshot the iPhone pushes
/// (`["state": json]` via application context + live messages) and sends commands back
/// (start / set values / complete / skip rest / finish / discard) plus live HR/calorie metrics.
/// The phone applies every command to its existing `sessionStore` — all workout logic stays
/// there; this is a remote + display.
final class WatchConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
    @Published var snapshot: Snapshot?

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    // MARK: Sending commands → phone
    func send(_ message: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        if session.isReachable {
            session.sendMessage(message, replyHandler: nil, errorHandler: { _ in
                // If the live send fails, fall back to the reliable background queue.
                session.transferUserInfo(message)
            })
        } else {
            session.transferUserInfo(message)
        }
    }

    func requestSync() { send(["type": "requestSync"]) }
    func startEmpty() { send(["type": "startEmpty"]) }
    func startTemplate(_ id: String) { send(["type": "startTemplate", "templateId": id]) }
    func setValue(_ exId: String, _ setId: String, field: String, value: Double) {
        send(["type": "setValue", "exId": exId, "setId": setId, "field": field, "value": value])
    }
    func completeSet(_ exId: String, _ setId: String) {
        send(["type": "completeSet", "exId": exId, "setId": setId])
    }
    func skipRest() { send(["type": "skipRest"]) }
    func finish() { send(["type": "finish"]) }
    func discard() { send(["type": "discard"]) }
    func liveMetrics(kcal: Double, bpm: Double) {
        send(["type": "liveMetrics", "kcal": Int(kcal.rounded()), "bpm": Int(bpm.rounded())])
    }

    // MARK: Receiving snapshots ← phone
    private func ingest(_ dict: [String: Any]) {
        guard let json = dict["state"] as? String, let data = json.data(using: .utf8) else { return }
        guard let decoded = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        DispatchQueue.main.async { self.snapshot = decoded }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { ingest(message) }
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) { ingest(applicationContext) }
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        // Pull the freshest state (incl. templates) once we're connected.
        if activationState == .activated { requestSync() }
    }
}
