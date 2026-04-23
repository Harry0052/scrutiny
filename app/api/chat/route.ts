import { NextRequest, NextResponse } from "next/server";

interface ChatRequestBody {
  question?: string;
  context?: unknown;
}

function serializeContext(input: unknown): string {
  try {
    return JSON.stringify(input ?? {}, null, 0).slice(0, 14_000);
  } catch {
    return "{}";
  }
}

function extractOutputText(payload: {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
}): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const fromBlocks =
    payload.output
      ?.flatMap((entry) => entry.content ?? [])
      .find((content) => content.type === "output_text" && typeof content.text === "string")?.text ?? "";

  return fromBlocks.trim();
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
  const question = body.question?.trim() ?? "";

  if (question.length < 2) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("replace-with")) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 503 }
    );
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const contextJson = serializeContext(body.context);

  const systemPrompt = [
    "You are the CivicWatch assistant.",
    "Answer with neutral, evidence-first language.",
    "Use provided context first, then web search if needed.",
    "If uncertain, say what is missing.",
    "Do not use partisan or emotional labels.",
  ].join(" ");

  const userPrompt = [
    `User question: ${question}`,
    "CivicWatch context JSON:",
    contextJson,
    "Return a concise answer and include source links when available.",
  ].join("\n\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        tools: [{ type: "web_search_preview" }],
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }],
          },
        ],
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      return NextResponse.json(
        { error: `OpenAI request failed: ${response.status}`, detail: message.slice(0, 220) },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };

    const answer = extractOutputText(payload);
    if (!answer) {
      return NextResponse.json(
        { error: "OpenAI returned an empty answer." },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer, model });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat request failed" },
      { status: 500 }
    );
  }
}
