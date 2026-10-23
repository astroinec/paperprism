import type { z } from "zod";
import { generateLLM, LLMError, type LLMRequest } from "./index";
import type { ResolvedTarget } from "./types";

/** Extract the first JSON object/array from an LLM response (handles fences, prose, trailing commas). */
export function extractJson(text: string): unknown {
  let t = text.trim();
  t = t.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const startObj = t.indexOf("{");
  const startArr = t.indexOf("[");
  let start = -1;
  if (startObj >= 0 && (startArr < 0 || startObj < startArr)) start = startObj;
  else start = startArr;
  if (start < 0) throw new Error("No JSON found in response");
  const open = t[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const slice = end > 0 ? t.slice(start, end + 1) : t.slice(start);
  try {
    return JSON.parse(slice);
  } catch {
    return JSON.parse(slice.replace(/,\s*([}\]])/g, "$1"));
  }
}

export async function generateJson<T>(target: ResolvedTarget, req: LLMRequest, schema: z.ZodType<T>): Promise<T> {
  const first = await generateLLM(target, req);
  let lastErr = "";
  try {
    return schema.parse(extractJson(first));
  } catch (e) {
    lastErr = (e as Error).message.slice(0, 400);
  }
  const retry = await generateLLM(target, {
    ...req,
    messages: [
      ...req.messages,
      { role: "assistant", content: first },
      {
        role: "user",
        content: `Your previous reply was not valid JSON for the required schema. Error: ${lastErr}\nReturn ONLY the corrected JSON, no prose, no code fences.`,
      },
    ],
  });
  try {
    return schema.parse(extractJson(retry));
  } catch (e) {
    throw new LLMError(`模型返回的 JSON 无法解析：${(e as Error).message.slice(0, 200)}`, 502);
  }
}
