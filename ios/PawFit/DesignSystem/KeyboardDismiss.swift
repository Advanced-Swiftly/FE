import SwiftUI
import UIKit

/// 키보드 내리기
/// - 입력창(UITextField · UITextView) 밖을 누르면 앱 어디서든 키보드를 내린다.
///   창(UIWindow)에 탭 인식기를 하나 붙이고, 누른 곳의 버튼 · 스크롤 동작은 그대로 둔다(cancelsTouchesInView = false).
///   이 탭으로 입력창에 포커스가 들어갔거나, 지금 입력창의 둘레를 누른 경우에는 내리지 않는다.
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

    /// 누르기 시작할 때 키보드를 갖고 있던 입력창
    private weak var responderAtTouch: UIResponder?
    /// 지금 키보드를 갖고 있는 입력창을 찾을 때 잠깐 쓴다 (`UIResponder.pawfitCaptureFirstResponder`)
    fileprivate static weak var foundResponder: UIResponder?

    @objc private func handleTap(_ recognizer: UITapGestureRecognizer) {
        guard let window = recognizer.view else { return }
        let location = recognizer.location(in: window)
        let before = responderAtTouch
        // 로그인 칸처럼 여백을 눌러도 SwiftUI가 포커스를 주는 입력칸(.onTapGesture { focus = … })이 있다.
        // 그 포커스는 이 탭보다 조금 늦게 들어오므로, 한 박자 기다린 뒤 판단한다.
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(80))
            guard let current = Self.currentFirstResponder() as? UIView,
                  current is UITextField || current is UITextView else { return }   // 키보드가 없다
            if current !== before { return }                                       // 이 탭으로 입력창에 들어갔다
            // 입력창 둘레(칸의 여백)를 누른 것이면 그대로 둔다
            let field = current.convert(current.bounds, to: window).insetBy(dx: -28, dy: -18)
            if field.contains(location) { return }
            window.endEditing(true)
        }
    }

    /// 입력창 글자 부분을 누른 것이면 받지 않는다 (다른 입력창으로 옮겨 갈 때 키보드가 깜빡이지 않게)
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        var view = touch.view
        while let current = view {
            if current is UITextField || current is UITextView { return false }
            view = current.superview
        }
        responderAtTouch = Self.currentFirstResponder()
        return true
    }

    private static func currentFirstResponder() -> UIResponder? {
        foundResponder = nil
        UIApplication.shared.sendAction(#selector(UIResponder.pawfitCaptureFirstResponder), to: nil, from: nil, for: nil)
        return foundResponder
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                           shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        true
    }
}

extension UIResponder {
    /// `sendAction(to: nil)`은 지금 키보드를 가진(first responder) 객체에 도착한다
    @objc fileprivate func pawfitCaptureFirstResponder() {
        KeyboardDismissTap.foundResponder = self
    }
}

extension UIApplication {
    /// 지금 떠 있는 키보드를 내린다
    func endEditing() {
        sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}
