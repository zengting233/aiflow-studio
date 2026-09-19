import { parseOpenAICompatibleStream } from "../providers/openai-compatible-stream.util";

describe("parseOpenAICompatibleStream", () => {
  it("parses content when an SSE event is split across chunks", async () => {
    async function* chunks() {
      yield Buffer.from('data: {"choices":[{"delta":{"content":"你');
      yield Buffer.from('好"}}]}\n\ndata: [DONE]\n\n');
    }

    const content: string[] = [];
    for await (const part of parseOpenAICompatibleStream(chunks())) {
      content.push(part);
    }

    expect(content).toEqual(["你好"]);
  });
});
