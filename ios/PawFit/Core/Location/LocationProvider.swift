import CoreLocation
import Observation

/// 현재 위치 (앱을 쓰는 동안만). 권한이 없거나 시뮬레이터면 성수동을 기본으로 쓴다.
@MainActor
@Observable
final class LocationProvider: NSObject, CLLocationManagerDelegate {
    static let fallback = CLLocationCoordinate2D(latitude: 37.5446, longitude: 127.0557)   // 성수동

    private(set) var coordinate: CLLocationCoordinate2D?
    private(set) var denied = false
    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    var current: CLLocationCoordinate2D { coordinate ?? Self.fallback }

    func request() {
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse: manager.requestLocation()
        default: denied = true
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            switch status {
            case .authorizedAlways, .authorizedWhenInUse: self.manager.requestLocation()
            case .denied, .restricted: self.denied = true
            default: break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let c = locations.last?.coordinate else { return }
        Task { @MainActor in self.coordinate = c }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
}
