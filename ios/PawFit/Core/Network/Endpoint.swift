import Foundation

enum HTTPMethod: String, Sendable {
    case get = "GET", post = "POST", put = "PUT", patch = "PATCH", delete = "DELETE"
}

/// API 한 개의 정의. 응답 타입을 함께 들고 있어서 호출하는 쪽에서 형 변환이 필요 없다.
///
///     let me = try await api.send(Endpoints.me)
struct Endpoint<Response: Decodable & Sendable>: Sendable {
    let method: HTTPMethod
    /// `/api/v1` 뒤의 경로. 예: "/auth/login"
    let path: String
    var query: [URLQueryItem] = []
    var body: (any Encodable & Sendable)? = nil
    /// false = 로그인 불필요 API (이메일 중복 확인, 휴대폰 인증, 가입, 로그인, 토큰 갱신, 약관)
    var requiresAuth: Bool = true
    /// 저장된 토큰 대신 이 액세스 토큰을 쓴다(토큰 갱신 · 재시도 없음).
    /// 로그인 직후 저장하지 않을 토큰으로 로그아웃할 때 쓴다.
    var bearerToken: String? = nil
    /// multipart/form-data로 보낼 파일 (예방접종 서류). 있으면 `body`는 쓰지 않는다.
    var files: [UploadFile] = []
}

/// multipart 업로드 파일 하나. 서버 필드 이름은 BE `@RequestPart("files")`
struct UploadFile: Sendable, Equatable {
    var fieldName: String = "files"
    let fileName: String
    let mimeType: String   // image/jpeg · image/png · image/webp · application/pdf (서버 허용, 10MB 이하)
    let data: Data
}

/// 응답 본문이 없는 API(204 등)용
struct EmptyResponse: Decodable, Sendable {}

enum JSONCoding {
    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601   // 2026-10-27T21:30:00+09:00
        return d
    }()
    static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}
