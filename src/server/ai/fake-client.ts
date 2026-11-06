// Local design work only (AI_FAKE=true, never on Vercel): stands in for the OpenAI client so the rescue's live
// view can be built and screenshotted without paying for model calls. It walks the same tools a real run uses,
// with pauses, and the run is stored with model "fake-local".
import type OpenAI from "openai";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function fakeRescueClient(first: string): OpenAI {
  let turn = 0;
  const call = (name: string, args: object = {}) => ({ type: "function_call", name, call_id: `${name}-${Math.random()}`, arguments: JSON.stringify(args) });
  const usage = { input_tokens: 0, output_tokens: 0, input_tokens_details: { cached_tokens: 0 } };
  const parse = async () => {
    const t = turn++;
    await wait(t === 0 ? 1800 : 1500);
    if (t === 0) return { id: "fake-0", usage, output: [call("write_plan", { steps: [`Read what PayPal reported for ${first}`, `Check ${first}'s giving history`, "Look for earlier failures", "Pick the gentlest fix and draft a note"] })] };
    if (t === 1) return { id: "fake-1", usage, output: [call("get_subscription"), call("get_failed_payment"), call("list_gifts")] };
    if (t === 2) return { id: "fake-2", usage, output: [call("list_past_rescues")] };
    return {
      id: "fake-3",
      usage,
      output: [{ type: "message", content: [] }],
      output_parsed: {
        cause: "payment_problem",
        summary: `Local stand-in for the AI: PayPal declined ${first}'s gift and there were no earlier failures, so this reads as a payment problem.`,
        confidence: "medium",
        fixes: ["note", "retry", "pause", "lower"],
        recommended: "note",
        note_subject: "Your regular gift didn't go through",
        note_body: `Hi ${first},\n\nPayPal couldn't take your regular gift. Updating your payment in PayPal will keep it going.\n\nThank you,\nSam, Larkhaven Food Bank`,
      },
    };
  };
  return { responses: { parse } } as unknown as OpenAI;
}

/** Local stand-in for "Ask Lifeline": plans, reads the numbers and open rescues, then answers from a template. */
export function fakeAskClient(): OpenAI {
  let turn = 0;
  const call = (name: string, args: object = {}) => ({ type: "function_call", name, call_id: `${name}-${Math.random()}`, arguments: JSON.stringify(args) });
  const usage = { input_tokens: 0, output_tokens: 0, input_tokens_details: { cached_tokens: 0 } };
  const parse = async () => {
    const t = turn++;
    await wait(1200);
    if (t === 0) return { id: "fa-0", usage, output: [call("write_plan", { steps: ["Read this month's numbers", "Check the open rescues"] })] };
    if (t === 1) return { id: "fa-1", usage, output: [call("get_kpis"), call("list_rescues", { status: "open" })] };
    return { id: "fa-2", usage, output: [{ type: "message", content: [] }], output_parsed: { answer: "Local stand-in for the AI: I read the headline numbers and the open rescues. Ask again with AI on for a real answer.", links: [] } };
  };
  return { responses: { parse } } as unknown as OpenAI;
}
