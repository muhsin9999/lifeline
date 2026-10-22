// Shared OpenAI client and model choice for Lifeline's AI jobs.
import "server-only";
import "@/lib/net";
import OpenAI from "openai";

let client: OpenAI | undefined;
export const openai = () => (client ??= new OpenAI({ timeout: 25_000, maxRetries: 1 }));
export const modelFor = (job: "rescue" | "studio") => process.env[`AI_MODEL_${job.toUpperCase()}`] || process.env.AI_MODEL || "gpt-5.4-mini";

/** Local design work only (AI_FAKE=true, never on Vercel): a scripted stand-in so no model call is paid for. */
export const fakeAiEnabled = () => process.env.AI_FAKE === "true" && !process.env.VERCEL;
