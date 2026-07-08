import Testing
import Foundation
@testable import ProbeProxy

@Suite struct AiClientEncodingTests {
    @Test func message_encodes_image_then_text_blocks() throws {
        let msg = AiMessage(role: "user", content: [
            .image(mediaType: "image/jpeg", base64: "QUJD"),
            .text("analyze"),
        ])
        let data = try JSONEncoder().encode(msg)
        let json = String(decoding: data, as: UTF8.self)
        #expect(json.contains("\"type\":\"image\""))
        #expect(json.contains("\"media_type\":\"image\\/jpeg\"") || json.contains("\"media_type\":\"image/jpeg\""))
        #expect(json.contains("\"type\":\"text\""))

        // Verify ordering: image block must appear before text block
        let imageIdx = json.range(of: "\"type\":\"image\"")?.lowerBound
        let textIdx = json.range(of: "\"type\":\"text\"")?.lowerBound
        #expect(imageIdx != nil && textIdx != nil)
        if let imgPos = imageIdx, let txtPos = textIdx {
            #expect(imgPos < txtPos, "Image block must serialize before text block")
        }
    }

    @Test func system_block_carries_ephemeral_cache_control() throws {
        let block = AiSystemBlock(text: "rules", cacheControl: .ephemeral)
        let json = String(decoding: try JSONEncoder().encode(block), as: UTF8.self)
        #expect(json.contains("\"cache_control\""))
        #expect(json.contains("\"ephemeral\""))
    }
}
