import SwiftUI
import AVFoundation
import PhotosUI
import CoreImage

/// 매장 QR 스캔: 카메라로 읽거나, 사진에서 QR 고르기. 읽은 문자열(qrToken)을 넘긴다.
struct QrScanView: View {
    let onToken: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.appEnvironment) private var env
    @State private var torch = false
    @State private var cameraState: CameraState = .checking
    @State private var photo: PhotosPickerItem?
    @State private var message: String?
    @State private var done = false

    enum CameraState { case checking, ready, unavailable, denied }

    var body: some View {
        ZStack {
            Color(hex: 0x1E1C26).ignoresSafeArea()
            if cameraState == .ready {
                QrCameraView(torch: torch) { found($0) }.ignoresSafeArea()
            }
            // 가운데 네모 밖은 어둡게
            GeometryReader { geo in
                let side: CGFloat = 240
                let rect = CGRect(x: (geo.size.width - side) / 2, y: geo.size.height * 0.30, width: side, height: side)
                Path { p in
                    p.addRect(CGRect(origin: .zero, size: geo.size))
                    p.addRoundedRect(in: rect, cornerSize: CGSize(width: 28, height: 28))
                }
                .fill(Color(hex: 0x100F16, opacity: 0.55), style: FillStyle(eoFill: true))
                RoundedRectangle(cornerRadius: 28).strokeBorder(.white.opacity(0.9), lineWidth: 2)
                    .frame(width: side, height: side).position(x: rect.midX, y: rect.midY)
                if cameraState != .ready {
                    VStack(spacing: 8) {
                        Image(systemName: "qrcode.viewfinder").font(.system(size: 44))
                        Text(cameraState == .denied ? "설정에서 카메라를 허용해 주세요" : cameraState == .checking ? "" : "이 기기에서는 카메라를 쓸 수 없어요")
                            .font(.pawfit(13)).multilineTextAlignment(.center)
                    }
                    .foregroundStyle(.white.opacity(0.6))
                    .frame(width: side - 32).position(x: rect.midX, y: rect.midY)
                }
                VStack(spacing: 8) {
                    Text("매장에 붙은 댕댕로드 QR을\n네모 안에 맞춰 주세요").font(.pawfit(17, .semibold)).multilineTextAlignment(.center)
                    Text("댕댕로드 참여 매장에서만 스탬프가 찍혀요").font(.pawfit(14)).foregroundStyle(Color(hex: 0xB9B6C6))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .position(x: geo.size.width / 2, y: rect.maxY + 62)
                if cameraState == .ready, AVCaptureDevice.default(for: .video)?.hasTorch == true {
                    Button { torch.toggle() } label: {
                        Image(systemName: torch ? "flashlight.on.fill" : "flashlight.off.fill").font(.system(size: 22)).foregroundStyle(.white)
                            .frame(width: 56, height: 56).background(.white.opacity(0.14), in: Circle())
                    }
                    .accessibilityLabel(torch ? "손전등 끄기" : "손전등 켜기")
                    .position(x: geo.size.width / 2, y: rect.maxY + 146)
                }
            }
            .ignoresSafeArea()

            VStack(spacing: 0) {
                ZStack {
                    Text("QR 스캔").font(.pawfit(17, .semibold)).foregroundStyle(.white)
                    HStack {
                        Button { dismiss() } label: {
                            Image(systemName: "xmark").font(.system(size: 20)).foregroundStyle(.white).frame(width: 44, height: 44)
                        }
                        .accessibilityLabel("닫기")
                        Spacer()
                    }
                    .padding(.horizontal, 4)
                }
                .frame(height: 44)
                Spacer()
                VStack(spacing: 6) {
                    PhotosPicker(selection: $photo, matching: .images) {
                        Label("사진에서 QR 고르기", systemImage: "photo").font(.pawfit(16, .semibold)).foregroundStyle(PawFitColor.textPrimary)
                            .frame(maxWidth: .infinity, minHeight: 54).background(.white, in: RoundedRectangle(cornerRadius: 16))
                    }
                    if env.usesMock {
                        Button("시연용 QR로 인증하기") { found("mock-qr-token") }
                            .font(.pawfit(14, .semibold)).foregroundStyle(.white.opacity(0.8)).frame(minHeight: 44)
                    }
                }
                .padding(.horizontal, 16).padding(.bottom, 12)
            }
        }
        .toast($message)
        .onChange(of: photo) { Task { await readPhoto() } }
        .task { await checkCamera() }
    }

    private func found(_ token: String) {
        guard !done else { return }
        done = true
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        onToken(token)
    }

    private func checkCamera() async {
        guard AVCaptureDevice.default(for: .video) != nil else { cameraState = .unavailable; return }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: cameraState = .ready
        case .notDetermined:
            cameraState = await AVCaptureDevice.requestAccess(for: .video) ? .ready : .denied
        default: cameraState = .denied
        }
    }

    private func readPhoto() async {
        guard let photo, let data = try? await photo.loadTransferable(type: Data.self),
              let image = CIImage(data: data) else { return }
        let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])
        let token = (detector?.features(in: image) ?? []).compactMap { ($0 as? CIQRCodeFeature)?.messageString }.first
        self.photo = nil
        if let token { found(token) } else { message = "사진에서 QR을 찾지 못했어요" }
    }
}

/// AVFoundation QR 카메라
struct QrCameraView: UIViewRepresentable {
    let torch: Bool
    let onCode: (String) -> Void

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        context.coordinator.start(in: view)
        return view
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {
        context.coordinator.onCode = onCode
        context.coordinator.setTorch(torch)
    }

    static func dismantleUIView(_ uiView: PreviewView, coordinator: Coordinator) { coordinator.stop() }

    func makeCoordinator() -> Coordinator { Coordinator(onCode: onCode) }

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }

    final class Coordinator: NSObject, AVCaptureMetadataOutputObjectsDelegate, @unchecked Sendable {
        var onCode: (String) -> Void
        private let session = AVCaptureSession()
        private var sent = false

        init(onCode: @escaping (String) -> Void) { self.onCode = onCode }

        func start(in view: PreviewView) {
            guard let device = AVCaptureDevice.default(for: .video),
                  let input = try? AVCaptureDeviceInput(device: device),
                  session.canAddInput(input) else { return }
            session.addInput(input)
            let output = AVCaptureMetadataOutput()
            guard session.canAddOutput(output) else { return }
            session.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: .main)
            output.metadataObjectTypes = [.qr]
            view.previewLayer.session = session
            view.previewLayer.videoGravity = .resizeAspectFill
            let session = self.session
            DispatchQueue.global(qos: .userInitiated).async { session.startRunning() }
        }

        func stop() {
            let session = self.session
            DispatchQueue.global(qos: .userInitiated).async { session.stopRunning() }
        }

        func setTorch(_ on: Bool) {
            guard let device = AVCaptureDevice.default(for: .video), device.hasTorch,
                  (try? device.lockForConfiguration()) != nil else { return }
            device.torchMode = on ? .on : .off
            device.unlockForConfiguration()
        }

        func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
            guard !sent, let code = (metadataObjects.first as? AVMetadataMachineReadableCodeObject)?.stringValue else { return }
            sent = true
            onCode(code)
        }
    }
}
