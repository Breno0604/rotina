/* ==========================================================================
   AI service — the ONLY place that calls the Groq API.

   Responsibilities: reading the key (IndexedDB), calling the API, timeout,
   error mapping (typed), JSON-mode requests, response parsing + validation.
   The key never appears in logs, errors, or Convex.
   ========================================================================== */

import {
  GROQ_API_BASE,
  AI_ERROR_MESSAGES,
  type AiErrorCode,
  type AiAssessmentPayload,
  type AiChatResult,
} from "../../types/domain";
import { keyStore } from "../keyStore";
import {
  parseJson,
  validateAssessmentPayload,
  validateChatResult,
  InvalidResponseError,
} from "./validators";

export { AI_ERROR_MESSAGES };

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AiErrorCode; detail?: string };

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Reasoning models (gpt-oss family) spend tokens on a hidden `reasoning`
 * phase before emitting content. `max_tokens` is SHARED between reasoning
 * and content, so a long reasoning chain can exhaust the budget and the
 * model returns empty/truncated content (finish_reason "length").
 * `reasoning_effort: "low"` cuts the reasoning phase ~10x (verified live:
 * 650 → 68 tokens) — faster, cheaper, and makes token exhaustion rare.
 */
const isReasoningModel = (model: string) => /^openai\/gpt-oss/i.test(model);

async function requestCompletion(opts: {
  model: string;
  messages: ChatMessage[];
  json: boolean;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ ok: true; data: { text: string } } | { ok: false; code: AiErrorCode; detail?: string }> {
  const key = await keyStore.get();
  if (!key) return { ok: false, code: "no-key" };

  async function attempt(
    maxTokens: number,
    temperature: number,
  ): Promise<
    | { ok: true; data: { text: string } }
    | { ok: false; code: AiErrorCode; detail?: string; retryable?: boolean }
  > {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          temperature,
          max_tokens: maxTokens,
          ...(isReasoningModel(opts.model) ? { reasoning_effort: "low" } : {}),
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail: string | undefined;
        try {
          const body = (await response.json()) as { error?: { message?: string } };
          detail = body.error?.message;
        } catch {
          // ignore body parse errors
        }
        const code: AiErrorCode =
          response.status === 401 || response.status === 403
            ? "invalid-key"
            : response.status === 429
              ? "rate-limited"
              : response.status === 408 || response.status === 504
                ? "timeout"
                : "unknown";
        return { ok: false, code, detail };
      }

      const body = (await response.json()) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
      };
      const message = body.choices?.[0]?.message;
      const content = message?.content;
      const finish = body.choices?.[0]?.finish_reason;
      if (typeof content !== "string" || content.length === 0) {
        // Empty content usually means the token budget ran out mid-reasoning.
        return {
          ok: false,
          code: "invalid-response",
          detail: finish === "length" ? "token-budget-exhausted" : "empty-content",
          retryable: true,
        };
      }
      return { ok: true, data: { text: content } };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { ok: false, code: "timeout" };
      }
      return { ok: false, code: "network" };
    } finally {
      window.clearTimeout(timer);
    }
  }

  const baseTokens = opts.maxTokens ?? 1200;
  const first = await attempt(baseTokens, opts.temperature ?? 0.4);
  // If the reasoning phase ate the whole budget, retry once with a doubled
  // budget and zero temperature — cheap and rarely needed now that
  // reasoning_effort is "low".
  if (first.ok || !first.retryable) return first;
  return attempt(Math.min(baseTokens * 2, 16_384), 0);
}

function guard<T>(fn: () => T): AiResult<T> {
  try {
    return { ok: true, data: fn() };
  } catch (err) {
    if (err instanceof InvalidResponseError) return { ok: false, code: "invalid-response" };
    return { ok: false, code: "unknown" };
  }
}

/** Full structured assessment for a day/week/month/custom period. */
export async function runAssessment(input: {
  model: string;
  system: string;
  user: string;
}): Promise<AiResult<AiAssessmentPayload>> {
  // Reasoning models (e.g. gpt-oss-120b) spend tokens on the `reasoning` phase
  // before emitting content — the budget must cover both, or content comes
  // back empty/truncated and the response fails validation.
  const res = await requestCompletion({
    model: input.model,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    json: true,
    temperature: 0.3,
    maxTokens: 3200,
  });
  if (!res.ok) return res;
  return guard(() => validateAssessmentPayload(parseJson(res.data.text)));
}

/** Chat turn with history. The model replies in JSON so memory capture is
    structured — the user always approves before anything is saved. */
export async function runChat(input: {
  model: string;
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
}): Promise<AiResult<AiChatResult>> {
  const messages: ChatMessage[] = [
    { role: "system", content: input.system },
    ...input.history.slice(-12).map((m) => ({ role: m.role as ChatMessage["role"], content: m.content })),
    { role: "user", content: input.userMessage },
  ];
  const res = await requestCompletion({
    model: input.model,
    messages,
    json: true,
    temperature: 0.6,
    maxTokens: 2400,
  });
  if (!res.ok) return res;
  return guard(() => validateChatResult(parseJson(res.data.text)));
}

/** Validates the key with a tiny request. Returns server detail on failure. */
export async function testKey(model: string): Promise<
  { ok: true; data: string } | { ok: false; code: AiErrorCode; detail?: string }
> {
  const res = await requestCompletion({
    model,
    messages: [
      { role: "system", content: "Você é um assistente de teste." },
      { role: "user", content: "Responda apenas com: OK" },
    ],
    json: false,
    maxTokens: 256,
    temperature: 0,
  });
  if (!res.ok) return res;
  return { ok: true, data: res.data.text.trim().slice(0, 40) };
}
