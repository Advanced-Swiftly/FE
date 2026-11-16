import SwiftUI
import UIKit

/// 키보드 내리기
/// - 입력창(UITextField · UITextView) 밖을 누르면 앱 어디서든 키보드를 내린다.
///   창(UIWindow)에 탭 인식기를 하나 붙이고, 누른 곳의 버튼 · 스크롤 동작은 그대로 둔다(cancelsTouchesInView = false).
/// - 탭을 바꾸거나 챗봇에서 지도로 넘어갈 때는 `UIApplication.shared.endEditing()`을 부른다.
@MainActor
final class KeyboardDismissTap: NSObject, UIGestureRecognizerDelegate {
    static let shared = KeyboardDismissTap()
    private weak var installedWindow: UIWindow?

    /// 화면이 처음 뜰 때 한 번 부르면 된다 (여러 번 불러도 창마다 한 번만 붙는다)
    func install() {
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
        guard let window = windows.first(where: \.isKeyWindow) ?? windows.first,
              window !== installedWindow else { return }
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        tap.cancelsTouchesInView = false
        tap.delegate = self
        window.addGestureRecognizer(tap)
        installedWindow = window
    }

    @objc private func handleTap(_ recognizer: UITapGestureRecognizer) {
        recognizer.view?.endEditing(true)
    }

    /// 입력창을 누른 것이면 받지 않는다 (다른 입력창으로 옮겨 갈 때 키보드가 깜빡이지 않게)
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        var view = touch.view
        while let current = view {
            if current is UITextField || current is UITextView { return false }
            view = current.superview
        }
        return true
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                           shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        true
    }
}

extension UIApplication {
    /// 지금 떠 있는 키보드를 내린다
    func endEditing() {
        sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}
