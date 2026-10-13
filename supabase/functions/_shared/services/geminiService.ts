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

  async function callGemini(model: string, payload: unknown, timeoutMs = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );
    } catch (e) {
      // Demorou demais ou a rede falhou: trata como indisponível para trocar de modelo.
      throw new Error(`Gemini 504: sem resposta em ${Math.round(timeoutMs / 1000)}s (${model})`);
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
    }
    return data;
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // Erros em que vale passar para outro modelo: sobrecarga (503/500/502/504), cota esgotada (429)
  // e modelo inexistente/indisponível para a chave (404).
  const isSkippable = (e: unknown) =>
    /Gemini (404|429|500|502|503|504)\b/.test(e instanceof Error ? e.message : String(e));

  /** Ordem de tentativa: o modelo principal e depois os reservas (cada um tem a sua própria cota gratuita). */
  function modelChain(primary: string): string[] {
    const extra = (Deno.env.get("GEMINI_FALLBACK_MODELS") || Deno.env.get("GEMINI_FALLBACK_MODEL") ||
      "gemini-3.1-flash-lite,gemini-3.7-flash,gemini-3.8-flash,gemini-3.6-flash")
      .split(",").map((m) => m.trim()).filter(Boolean);
    return [primary, ...extra].filter((m, i, all) => all.indexOf(m) === i);
  }

  /**
   * Percorre os modelos em sequência, trocando na hora quando um falha.
   * Só espera (poucos segundos) depois de tentar todos, e repete o circuito uma vez.
   */
  async function callWithResilience(primary: string, payload: unknown, deadline: number) {
    const chain = modelChain(primary);
    let lastErr: unknown;
    for (let lap = 0; lap < 2; lap++) {
      if (lap > 0) await sleep(2500);
      for (const model of chain) {
        // Orçamento de tempo total: não deixa a função passar do limite do servidor.
        const left = deadline - Date.now();
        if (left < 4000) throw lastErr ?? new Error("Gemini 504: tempo total esgotado");
        try {
          return await callGemini(model, payload, Math.min(30000, left - 1000));
        } catch (e) {
          lastErr = e;
          if (!isSkippable(e)) throw e; // erro real (chave inválida, pedido malformado): não adianta trocar
          console.error(`Gemini: ${model} indisponível (${String(e).slice(0, 80)}); tentando o próximo`);
        }
      }
    }
    throw lastErr;
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
    // Tempo total para toda a resposta (todas as voltas de ferramentas incluídas).
    const deadline = Date.now() + 120000;

    for (let round = 0; round <= maxRounds; round++) {
      const data = await callWithResilience(model, {
        system_instruction: { parts: [{ text: opts.systemPrompt }] },
        contents,
        ...(toolConfig ? { tools: toolConfig } : {}),
        generationConfig: {
          temperature: opts.temperature ?? 0.4,
          maxOutputTokens: 1024,
        },
      }, deadline);

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
