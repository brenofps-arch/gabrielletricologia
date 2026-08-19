// Camada de serviço do Gemini — EXCLUSIVAMENTE server-side.
// A GEMINI_API_KEY é lida do ambiente da Edge Function e nunca sai do backend.

export interface GeminiContent {
  role: "user" | "model";
  parts: any[];
}

export interface GeminiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: any) => Promise<unknown>;
}

export interface GenerateOptions {
  systemPrompt: string;
  history: GeminiContent[];
  userMessage: string;
  tools?: GeminiTool[];
  model?: string;
  temperature?: number;
  maxToolRounds?: number;
}

export interface GenerateResult {
  text: string;
  toolCalls: { name: string; args: unknown; result: unknown }[];
  error?: string;
}

const DEFAULT_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash";

export function createGeminiService(apiKey?: string) {
  const key = apiKey ?? Deno.env.get("GEMINI_API_KEY") ?? "";

  const isConfigured = () => key.length > 0;

  async function callGemini(model: string, payload: unknown) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
    }
    return data;
  }

  async function generateReply(opts: GenerateOptions): Promise<GenerateResult> {
    if (!isConfigured()) {
      return { text: "", toolCalls: [], error: "GEMINI_API_KEY não configurada" };
    }

    const model = opts.model ?? DEFAULT_MODEL;
    const tools = opts.tools ?? [];
    const maxRounds = opts.maxToolRounds ?? 4;

    const contents: GeminiContent[] = [
      ...opts.history,
      { role: "user", parts: [{ text: opts.userMessage }] },
    ];

    const toolConfig = tools.length
      ? [{
        function_declarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      }]
      : undefined;

    const executed: GenerateResult["toolCalls"] = [];

    for (let round = 0; round <= maxRounds; round++) {
      const data = await callGemini(model, {
        system_instruction: { parts: [{ text: opts.systemPrompt }] },
        contents,
        ...(toolConfig ? { tools: toolConfig } : {}),
        generationConfig: {
          temperature: opts.temperature ?? 0.4,
          maxOutputTokens: 1024,
        },
      });

      const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
      const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

      if (calls.length === 0 || round === maxRounds) {
        const text = parts.map((p) => p.text).filter(Boolean).join("\n").trim();
        return { text, toolCalls: executed };
      }

      contents.push({ role: "model", parts });

      const responseParts: any[] = [];
      for (const call of calls) {
        const tool = tools.find((t) => t.name === call.name);
        let result: unknown;
        try {
          result = tool
            ? await tool.execute(call.args ?? {})
            : { error: `Ferramenta desconhecida: ${call.name}` };
        } catch (e) {
          result = { error: e instanceof Error ? e.message : String(e) };
        }
        executed.push({ name: call.name, args: call.args, result });
        responseParts.push({
          functionResponse: { name: call.name, response: { result } },
        });
      }
      contents.push({ role: "user", parts: responseParts });
    }

    return { text: "", toolCalls: executed };
  }

  return { isConfigured, generateReply };
}
