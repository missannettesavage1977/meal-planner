import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { WeekRequestSchema } from "@/lib/engine/weekRequest";
import { CUISINES, DIETS } from "@/lib/domain/types";

/**
 * Optional AI interpretation of "what do you fancy this week?".
 * Runs only on the server, only when ANTHROPIC_API_KEY is configured; the key
 * never reaches the browser. Without it the route returns 501 and the client
 * uses its built-in rule-based parser.
 */
export const runtime = "nodejs";

const BodySchema = z.object({ text: z.string().trim().min(2).max(500) });

const SYSTEM = `You turn a UK household's short request about this week's meals into structured planning hints.
Only use these cuisines: ${CUISINES.join(", ")}. Only use these diets: ${DIETS.join(", ")}.
"avoid" lists ingredients to leave out; "include" lists ingredients or dishes they want. Keep terms short and in British English (e.g. "courgette").
Set maxWeeknightMins only if they mention time; saveMoney if they want cheaper meals; moreLeftovers if they want batch cooking or leftovers.
If something isn't mentioned, leave it empty, null or false. Never invent allergies.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 501 });
  }
  const parsedBody = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(WeekRequestSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: parsedBody.data.text }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "No usable answer" }, { status: 422 });
    }
    return NextResponse.json({ request: response.parsed_output, source: "ai" });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Busy – try again shortly" }, { status: 429 });
    if (error instanceof Anthropic.APIError) return NextResponse.json({ error: "AI service error" }, { status: 502 });
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
