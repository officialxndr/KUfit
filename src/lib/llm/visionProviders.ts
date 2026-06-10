import * as FileSystem from 'expo-file-system/legacy';

import { describeImageJson } from './gemma';
import { getModel } from './models';
import { isModelReady, modelPaths } from './modelManager';
import type { AiProvider, AiEndpoint } from '@/stores/settingsStore';

/**
 * One entry point for "describe this image as JSON", across every AI backend:
 *   • device — on-device llama.rn (Gemma / Qwen3-VL), photo never leaves the phone.
 *   • remote — a saved endpoint, either OpenAI-compatible /chat/completions (Ollama,
 *              LM Studio, OpenWebUI, OpenAI, OpenRouter) or Google Gemini.
 * Remote providers send the (already-resized) photo as base64 — so it leaves the device.
 * Callers build a config with `resolveAiConfig(profile)` and call `describeImageJsonAny`.
 */

/** The resolved active remote endpoint (a slimmer view of settingsStore's AiEndpoint). */
export interface AiEndpointConfig {
  kind: 'openai' | 'gemini';
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiVisionConfig {
  provider: AiProvider;
  /** device: the chosen models.ts id. */
  modelId: string | null;
  /** device: reason before answering (only honored by 'optional'-reasoning models). */
  thinking: boolean;
  /** remote: the active endpoint, or null if none selected. */
  endpoint?: AiEndpointConfig | null;
}

export interface VisionArgs {
  system: string;
  instruction: string;
  /** Local file uri of the already-resized image. */
  imageUri: string;
  /** JSON schema for structured output (device grammar; hint-only for remote). */
  schema?: object;
}

/** Build the vision config (incl. the active remote endpoint) from the user's profile. */
export function resolveAiConfig(p: {
  aiProvider: AiProvider;
  aiModelId: string | null;
  aiThinking: boolean;
  aiEndpoints: AiEndpoint[];
  aiActiveEndpointId: string | null;
}): AiVisionConfig {
  const ep = p.aiProvider === 'remote' ? p.aiEndpoints.find((e) => e.id === p.aiActiveEndpointId) ?? null : null;
  return {
    provider: p.aiProvider,
    modelId: p.aiModelId,
    thinking: p.aiThinking,
    endpoint: ep ? { kind: ep.kind, baseUrl: ep.baseUrl, apiKey: ep.apiKey, model: ep.model } : null,
  };
}

/** Is the selected provider actually usable (model downloaded / endpoint configured)? */
export function isVisionConfigured(cfg: AiVisionConfig): boolean {
  if (cfg.provider === 'device') {
    const d = getModel(cfg.modelId);
    return !!d && isModelReady(d);
  }
  if (cfg.provider === 'remote') {
    const e = cfg.endpoint;
    if (!e || !e.model.trim()) return false;
    return e.kind === 'gemini' ? !!e.apiKey.trim() : !!e.baseUrl.trim();
  }
  return false;
}

const readBase64 = (uri: string) => FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

async function deviceJson(cfg: AiVisionConfig, args: VisionArgs): Promise<string> {
  const def = getModel(cfg.modelId);
  if (!def || !isModelReady(def)) throw new Error('On-device model not downloaded.');
  const paths = modelPaths(def);
  if (!paths) throw new Error('Model files missing.');
  // The model variant decides reasoning: Thinking=always, Instruct=never; only 'optional' honors the toggle.
  const thinking = def.reasoning === 'always' ? true : def.reasoning === 'never' ? false : cfg.thinking;
  return describeImageJson({
    system: args.system, instruction: args.instruction, imageUri: args.imageUri,
    modelPath: paths.model, mmprojPath: paths.mmproj, thinking, schema: args.schema,
  });
}

/** OpenAI-compatible chat/completions with an inline image. No response_format — many
 *  local servers (Ollama) reject it; the prompt asks for JSON and the parser is lenient. */
async function openaiJson(ep: AiEndpointConfig, args: VisionArgs): Promise<string> {
  const base = ep.baseUrl.trim().replace(/\/+$/, '');
  if (!base) throw new Error('Set the endpoint base URL.');
  const b64 = await readBase64(args.imageUri);
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(ep.apiKey.trim() ? { Authorization: `Bearer ${ep.apiKey.trim()}` } : {}) },
    body: JSON.stringify({
      model: ep.model.trim(),
      temperature: 0.1,
      messages: [
        { role: 'system', content: args.system },
        {
          role: 'user',
          content: [
            { type: 'text', text: args.instruction },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : JSON.stringify(content ?? '');
}

/** Google Generative Language API (Gemini) with an inline image; forces JSON output. */
async function geminiJson(ep: AiEndpointConfig, args: VisionArgs): Promise<string> {
  const key = ep.apiKey.trim();
  if (!key) throw new Error('Set the Google API key.');
  const model = ep.model.trim() || 'gemini-2.0-flash';
  const b64 = await readBase64(args.imageUri);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: args.system }] },
      contents: [{ role: 'user', parts: [{ text: args.instruction }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p?.text).filter(Boolean).join('') || '';
}

/** Dispatch a vision-to-JSON request to the configured provider. Throws on any failure. */
export async function describeImageJsonAny(cfg: AiVisionConfig, args: VisionArgs): Promise<string> {
  if (cfg.provider === 'device') return deviceJson(cfg, args);
  if (cfg.provider === 'remote') {
    if (!cfg.endpoint) throw new Error('No AI endpoint selected.');
    return cfg.endpoint.kind === 'gemini' ? geminiJson(cfg.endpoint, args) : openaiJson(cfg.endpoint, args);
  }
  throw new Error('No AI provider is selected.');
}
