/** 解析 OpenAI 兼容接口返回的 SSE 内容增量。 */
export async function* parseOpenAICompatibleStream(
  stream: AsyncIterable<unknown>,
): AsyncIterable<string> {
  let buffer = "";

  for await (const chunk of stream) {
    buffer += String(chunk);
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        !trimmed ||
        trimmed === "data: [DONE]" ||
        !trimmed.startsWith("data: ")
      )
        continue;

      try {
        const data = JSON.parse(trimmed.slice(6));
        const content = data.choices[0]?.delta?.content || "";
        if (content) yield content;
      } catch {
        // 单条增量格式异常时忽略，不中断整个流。
      }
    }
  }
}
