import Foundation
import Observation

/// 여러 화면이 함께 쓰는 데이터: 내 반려견 목록과 지도 · 상세의 기준 반려견.
@MainActor
@Observable
final class AppStore {
    /// 지도 기준: 한 마리 또는 함께 가요(등록한 반려견 모두)
    enum Basis: Hashable {
        case dog(Int64)
        case together
    }

    private(set) var dogs: [DogDetail] = []
    private(set) var isLoadingDogs = false
    var basis: Basis?
    /// 이 값이 바뀌면 지도 · 마이가 다시 불러온다 (반려견 · 증빙을 바꾼 뒤)
    private(set) var revision = 0
    /// 탭바를 숨기는 화면(상세 · 등록 등)이 몇 개 열려 있는지
    var tabBarHiders = 0

    let api: PawFitAPI

    init(api: PawFitAPI) { self.api = api }

    var defaultDog: DogDetail? { dogs.first(where: \.isDefault) ?? dogs.first }

    /// 지금 기준에 해당하는 반려견들
    var basisDogs: [DogDetail] {
        switch basis {
        case .dog(let id)?: dogs.filter { $0.dogId == id }
        case .together?: dogs
        case nil: defaultDog.map { [$0] } ?? []
        }
    }

    var basisDogIds: [Int64] { basisDogs.map(\.dogId) }

    /// "몽이" · "몽이와 콩이"
    var basisTitle: String { Josa.and(basisDogs.map(\.name)) }

    func dog(_ id: Int64) -> DogDetail? { dogs.first { $0.dogId == id } }

    func reloadDogs() async {
        isLoadingDogs = true
        defer { isLoadingDogs = false }
        guard let list = try? await api.dogs() else { return }
        var details: [DogDetail] = []
        for item in list {
            if let d = try? await api.dog(item.dogId) { details.append(d) }
        }
        dogs = details.sorted { ($0.isDefault ? 0 : 1, $0.dogId) < ($1.isDefault ? 0 : 1, $1.dogId) }
        // 기준 반려견이 지워졌으면 기본 반려견으로
        switch basis {
        case .dog(let id)? where !dogs.contains(where: { $0.dogId == id }): basis = nil
        case .together? where dogs.count < 2: basis = nil
        default: break
        }
        revision += 1
    }

    func basisInfo() -> [DogBasisInfo] {
        basisDogs.map {
            DogBasisInfo(dogId: $0.dogId, name: $0.name, weightKg: $0.weightKg, equipment: $0.equipment,
                         vaccinationVerified: VaccinationBadge(dog: $0.vaccinationStatus) == .verified)
        }
    }

    func bumpRevision() { revision += 1 }

    func clear() {
        dogs = []
        basis = nil
    }
}
