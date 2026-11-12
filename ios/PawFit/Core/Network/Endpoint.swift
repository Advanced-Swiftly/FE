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
