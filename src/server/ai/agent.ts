// The agent loop every Lifeline job shares: the first turn is always a plan, then the model picks its own tools
// until it returns the final answer in a fixed schema. Each step is reported as it happens, so the UI can show
// the plan and the live tool calls. No database access here; callers load the facts and store the result.
import "@/lib/net";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

export type AgentTool = {
  name: string;
  description: string;
  parameters?: Record<string, { type: "string" | "number"; description?: string }>;
  /** Runs the tool. Throwing is fine: the model gets an error object back and carries on. */
  run: (args: Record<string, string>) => unknown | Promise<unknown>;
  /** The plain line shown in the step list ("Read the failed payment"). */
  label: (args: Record<string, string>) => string;
  /** A one-line summary of what it found, shown under the label. */
  detail?: (output: unknown, args: Record<string, string>) => string | undefined;
};

export type AgentStep = { tool: string; label: string; turn: number; detail?: string; plan?: string[] };

export type AgentRun<T> = { output: T; tools: string[]; usage: { input: number; output: number; cached: number }; ms: number; model: string };

const PLAN_TOOL: OpenAI.Responses.FunctionTool = {
  type: "function",
  name: "write_plan",
  description: "Write your plan: 3 to 5 short steps, shown to the user as you work.",
  strict: true,
  parameters: { type: "object", properties: { steps: { type: "array", items: { type: "string" } } }, required: ["steps"], additionalProperties: false },
};

function schemaFor(tool: AgentTool): OpenAI.Responses.FunctionTool {
  const props = tool.parameters ?? {};
  return { type: "function", name: tool.name, description: tool.description, strict: true, parameters: { type: "object", properties: props, required: Object.keys(props), additionalProperties: false } };
}

/** The plan's steps, trimmed and capped, so a long or odd plan can't flood the step list. */
export function planSteps(args: unknown) {
  const steps = (args as { steps?: unknown }).steps;
  return (Array.isArray(steps) ? steps : []).filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 5).map((x) => (x.length > 80 ? `${x.slice(0, 78).trim()}…` : x.trim()));
}

export async function runAgent<T>(opts: {
  client: OpenAI;
  model: string;
  instructions: string;
  input: string;
  /** Images the model should look at with the first message (base64). */
  images?: { type: string; data: string }[];
  tools: AgentTool[];
  output: z.ZodType<T>;
  outputName: string;
  onStep?: (step: AgentStep) => unknown;
  effort?: "low" | "medium" | "high";
  maxTurns?: number;
}): Promise<AgentRun<T>> {
  const started = Date.now();
  const usage = { input: 0, output: 0, cached: 0 };
  const used: string[] = [];
  const byName = new Map(opts.tools.map((t) => [t.name, t]));
  const toolSchemas = [PLAN_TOOL, ...opts.tools.map(schemaFor)];
  let input: OpenAI.Responses.ResponseInput = opts.images?.length
    ? [{ role: "user", content: [{ type: "input_text", text: opts.input }, ...opts.images.map((im) => ({ type: "input_image" as const, image_url: `data:${im.type};base64,${im.data}`, detail: "auto" as const }))] }]
    : [{ role: "user", content: opts.input }];
  let previous: string | undefined;

  for (let turn = 0; turn < (opts.maxTurns ?? 8); turn++) {
    const res = await opts.client.responses.parse({
      model: opts.model,
      instructions: opts.instructions,
      input,
      previous_response_id: previous,
      tools: toolSchemas,
      // Turn one is always the plan; after that the agent chooses its own tools.
      ...(turn === 0 && { tool_choice: { type: "function" as const, name: "write_plan" } }),
      reasoning: { effort: opts.effort ?? "low" },
      text: { format: zodTextFormat(opts.output, opts.outputName) },
    });
    usage.input += res.usage?.input_tokens ?? 0;
    usage.output += res.usage?.output_tokens ?? 0;
    usage.cached += res.usage?.input_tokens_details?.cached_tokens ?? 0;
    previous = res.id;
    const calls = res.output.flatMap((o) => (o.type === "function_call" ? [o] : []));
    if (!calls.length) {
      if (res.output.some((o) => o.type === "message" && o.content.some((x) => x.type === "refusal"))) throw new Error("The model declined this task");
      if (!res.output_parsed) throw new Error("The model returned no answer");
      return { output: res.output_parsed as T, tools: used, usage, ms: Date.now() - started, model: opts.model };
    }
    input = [];
    for (const call of calls) {
      let args: Record<string, string> = {};
      let output: unknown;
      const tool = byName.get(call.name);
      try {
        args = JSON.parse(call.arguments || "{}");
        output = call.name === "write_plan" ? { ok: true } : tool ? await tool.run(args) : { error: "unknown_tool", message: `Unknown tool ${call.name}` };
      } catch (e) {
        // Internals (SQL, stack traces) stay in the server log; the model and the officer see a plain message.
        console.error(`tool ${call.name} failed`, e);
        output = { error: "tool_failed", message: "Couldn't read this just now" };
      }
      used.push(call.name);
      if (call.name === "write_plan") {
        const plan = planSteps(args);
        await opts.onStep?.({ tool: "write_plan", label: "Wrote a plan", turn, plan, detail: `${plan.length} steps` });
      } else {
        const failed = output && typeof output === "object" && "error" in output ? String((output as { message?: unknown }).message ?? "Unavailable") : undefined;
        await opts.onStep?.({ tool: call.name, label: tool ? tool.label(args) : call.name, turn, detail: failed ?? tool?.detail?.(output, args) });
      }
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) });
    }
  }
  throw new Error("The agent didn’t finish within the step limit");
}
