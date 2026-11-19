import SwiftUI
import MapKit

/// 지도 그림 한 장. Google 지도로 바꿀 때는 이 파일만 교체하면 된다.
/// (입력: 업체 핀 · 내 위치 · 기준 반려견 / 출력: 핀 선택 · 지도 가운데 이동)
struct PlaceMapLayer: View {
    let places: [PlaceCard]
    let myLocation: CLLocationCoordinate2D?
    let basisDog: DogDetail?
    let isTogether: Bool
    @Binding var camera: MapCameraPosition
    let onSelect: (PlaceCard) -> Void
    let onCenterChange: (CLLocationCoordinate2D, CLLocationDistance) -> Void

    var body: some View {
        Map(position: $camera) {
            ForEach(places) { place in
                Annotation(place.name, coordinate: place.coordinate, anchor: .bottom) {
                    Button { onSelect(place) } label: { PlacePin(place: place) }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(place.name), \(place.verdict.title)")
                }
                .annotationTitles(.hidden)
            }
            if let myLocation {
                Annotation("내 위치", coordinate: myLocation, anchor: .center) {
                    MyLocationMarker(dog: basisDog, together: isTogether)
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll, showsTraffic: false))
        .mapControls { }
        .onMapCameraChange(frequency: .onEnd) { context in
            let region = context.region
            // 화면 세로 절반쯤을 반경으로 (위도 1도 ≈ 111km)
            let radius = max(300, min(region.span.latitudeDelta * 111_000 / 2, 50_000))
            onCenterChange(region.center, radius)
        }
    }
}

/// 캔버스 핀: 흰 알약(판정 색 원 + 업체 이름)
struct PlacePin: View {
    let place: PlaceCard
    var body: some View {
        HStack(spacing: 7) {
            VerdictDot(verdict: place.verdict, size: 24)
            Text(place.name)
                .font(.pawfit(12, .semibold))
                .foregroundStyle(PawFitColor.textPrimary)
                .lineLimit(1)
        }
        .padding(.leading, 4).padding(.trailing, 12)
        .frame(height: 32)
        .background(Color.white, in: Capsule())
        .overlay(Capsule().strokeBorder(PawFitColor.separator, lineWidth: 0.5))
        .shadow(color: PawFitColor.textPrimary.opacity(0.12), radius: 7, y: 4)
    }
}

/// 내 위치 = 기준 반려견 사진 마커 (네이비-퍼플 테두리 + "내 위치")
struct MyLocationMarker: View {
    let dog: DogDetail?
    let together: Bool
    var body: some View {
        VStack(spacing: -2) {
            ZStack {
                Circle().fill(PawFitColor.brand.opacity(0.14)).frame(width: 60, height: 60)
                Group {
                    if together {
                        Image(systemName: "pawprint.fill").font(.system(size: 18)).foregroundStyle(PawFitColor.brand)
                            .frame(width: 40, height: 40).background(PawFitColor.brandTint, in: Circle())
                    } else {
                        DogAvatar(name: dog?.name ?? "", size: 40, illustrated: dog?.isDefault ?? true)
                    }
                }
                .overlay(Circle().strokeBorder(.white, lineWidth: 2))
                .padding(3)
                .background(PawFitColor.brand, in: Circle())
                .shadow(color: PawFitColor.brand.opacity(0.35), radius: 8, y: 6)
            }
            Text("내 위치")
                .font(.pawfit(11, .semibold)).foregroundStyle(.white)
                .padding(.horizontal, 8).frame(height: 20)
                .background(PawFitColor.brand, in: Capsule())
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("내 위치")
    }
}
