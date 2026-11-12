import SwiftUI

/// 반려견 바꾸기 메뉴 (캔버스 '반려견 바꾸기 메뉴')
struct DogBasisMenu: View {
    let onClose: () -> Void
    let onManage: () -> Void
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("누구 기준으로 볼까요?")
                .font(.pawfit(13, .semibold)).foregroundStyle(PawFitColor.textSecondary)
                .padding(.horizontal, 12).padding(.vertical, 8)

            ForEach(store.dogs) { dog in
                let selected = store.basis == .dog(dog.dogId) || (store.basis == nil && dog.dogId == store.defaultDog?.dogId)
                Button { store.basis = .dog(dog.dogId); onClose() } label: {
                    HStack(spacing: 12) {
                        DogAvatar(name: dog.name, size: 40, illustrated: dog.isDefault)
                        Text(dog.name).font(.pawfit(16, selected ? .bold : .semibold)).foregroundStyle(PawFitColor.textPrimary)
                        Spacer()
                        if selected {
                            Image(systemName: "checkmark.circle.fill").font(.system(size: 22)).foregroundStyle(PawFitColor.brand)
                        }
                    }
                    .padding(.horizontal, 12).frame(height: 62)
                    .background(selected ? PawFitColor.surfaceNeutral : .clear, in: RoundedRectangle(cornerRadius: 14))
                }
                .accessibilityAddTraits(selected ? .isSelected : [])
            }

            if store.dogs.count > 1 {
                Divider().padding(.horizontal, 12).padding(.vertical, 6)
                let selected = store.basis == .together
                Button { store.basis = .together; onClose() } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "pawprint.fill").font(.system(size: 20)).foregroundStyle(PawFitColor.brand)
                            .frame(width: 40, height: 40).background(PawFitColor.brandTint, in: Circle())
                        Text("함께 가요").font(.pawfit(16, .semibold)).foregroundStyle(PawFitColor.brand)
                        Text("\(store.dogs.count)마리").font(.pawfit(11, .semibold)).foregroundStyle(PawFitColor.brand)
                            .padding(.horizontal, 7).frame(height: 18).background(PawFitColor.brandTint, in: Capsule())
                        Spacer()
                        if selected {
                            Image(systemName: "checkmark.circle.fill").font(.system(size: 22)).foregroundStyle(PawFitColor.brand)
                        }
                    }
                    .padding(.horizontal, 12).frame(height: 66)
                    .background(selected ? PawFitColor.surfaceNeutral : .clear, in: RoundedRectangle(cornerRadius: 14))
                }
            }

            Divider().padding(.horizontal, 12).padding(.vertical, 6)
            Button(action: onManage) {
                HStack {
                    Text(store.dogs.isEmpty ? "반려견 등록하기" : "반려견 관리").font(.pawfit(14, .semibold)).foregroundStyle(PawFitColor.iconGray)
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(PawFitColor.textTertiary)
                }
                .padding(.horizontal, 12).frame(height: 46)
            }
        }
        .padding(8)
        .frame(width: 276)
        .background(PawFitColor.background, in: RoundedRectangle(cornerRadius: 20))
        .shadow(color: PawFitColor.textPrimary.opacity(0.16), radius: 24, y: 16)
    }
}

/// B4 판정 기준 (캔버스 '판정 기준')
struct CriteriaSheet: View {
    @Environment(\.dismiss) private var dismiss

    private let items: [(Verdict, String)] = [
        (.noEntry, "체중·견종·크기·최대 입장 마릿수 등 필수 조건 미충족. 함께 가요에서는 한 마리라도 못 들어가면 빨강"),
        (.unknown, "동반 가능 여부만 공개되고 세부 조건이 없을 때. AI가 임의로 판단하지 않아요"),
        (.prepare, "유모차·이동장·입마개·매너벨트/기저귀·접종 확인서 지참이 필요할 때"),
        (.entryOK, "선택한 모든 반려견이 필수 조건을 충족하고 추가 준비도 없을 때"),
    ]

    var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "판정 기준", titleColor: PawFitColor.brand, leading: .close)
                .padding(.top, 8)
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("이렇게 판정해요").font(.pawfit(22, .semibold)).foregroundStyle(PawFitColor.brand)
                    Text("여러 조건이 겹치면 아래 순서로 확인하고, 가장 먼저 해당하는 결과를 보여줘요.")
                        .font(.pawfit(14)).lineSpacing(3).foregroundStyle(PawFitColor.textSecondary).padding(.top, 8)
                    VStack(spacing: 0) {
                        ForEach(items, id: \.0) { verdict, text in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(spacing: 10) {
                                    VerdictDot(verdict: verdict, size: 22)
                                    Text(verdict.title).font(.pawfit(16, .semibold)).foregroundStyle(PawFitColor.brand)
                                }
                                Text(text).font(.pawfit(13.5)).lineSpacing(3).foregroundStyle(PawFitColor.iconGray).padding(.leading, 32)
                            }
                            .padding(.vertical, 16).padding(.horizontal, 4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .overlay(alignment: .bottom) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
                        }
                    }
                    .padding(.top, 12)
                }
                .padding(.horizontal, 20).padding(.top, 24)
            }
            BottomBar { Button("닫기") { dismiss() }.buttonStyle(SecondaryButtonStyle()) }
        }
        .screenBackground()
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(28)
    }
}

/// 정보 확인 안내 (ⓘ에서 열림)
struct InfoGuideSheet: View {
    @Environment(\.dismiss) private var dismiss
    private let items = [
        ("업체 조건 확인", "PawFit이 업체에 입장 조건을 마지막으로 확인한 날이에요. 조건이 바뀌면 운영자가 근거를 확인한 뒤 고치고 날짜도 새로 바꿔요."),
        ("최근 PawFit 방문", "다른 보호자가 QR로 방문 인증을 남긴 가장 최근 날이에요. 실제로 다녀간 사람이 있다는 뜻이고, 조건이 그대로라는 뜻은 아니에요."),
        ("정보 출처", "조건을 어디서 가져왔는지예요. 업체 공식 SNS, 홈페이지, 업체에 직접 확인한 내용 등이 있어요."),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("정보는 이렇게 확인해요").font(.pawfit(22, .semibold)).foregroundStyle(PawFitColor.brand)
                .padding(.top, 28)
            ForEach(items, id: \.0) { title, text in
                VStack(alignment: .leading, spacing: 6) {
                    Text(title).font(.pawfit(16, .semibold))
                    Text(text).font(.pawfit(14)).lineSpacing(3).foregroundStyle(PawFitColor.iconGray)
                }
                .padding(.vertical, 14)
                .overlay(alignment: .bottom) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
            }
            Spacer(minLength: 16)
            Button("닫기") { dismiss() }.buttonStyle(SecondaryButtonStyle())
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
        .screenBackground()
        .presentationDetents([.medium, .large])
        .presentationCornerRadius(28)
        .presentationDragIndicator(.visible)
    }
}
