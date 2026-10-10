import type { LLMChatOptions, LLMMessage, LLMProvider } from "../types";

export class OllamaProvider implements LLMProvider {
  readonly id = "ollama";
  constructor(private readonly model?: string, private readonly maxPower = true) {}

  async chat(messages: LLMMessage[], _opts?: LLMChatOptions): Promise<string> {
    const { commands } = await import("@/ipc/commands");
    const reply = await commands.ollamaChat(
      messages.map((m) => ({ role: m.role, content: m.content })),
      { model: this.model, maxPower: this.maxPower },
    );
    return reply.content;
  }
}

export class OpenAICompatProvider implements LLMProvider {
  readonly id: string;
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly defaultModel: string,
    id = "openai-compat",
  ) { this.id = id; }

  async chat(messages: LLMMessage[], opts?: LLMChatOptions): Promise<string> {
    const model = opts?.model ?? this.defaultModel;
    const body = {
      model, messages,
      temperature: opts?.temperature ?? 0.2,
      max_tokens: opts?.maxTokens ?? 4096,
      stream: false,
    };
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts?.signal,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`LLM HTTP ${res.status}: ${err.slice(0, 400)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM không trả về nội dung.");
    return content;
  }
}
