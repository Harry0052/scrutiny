import { ScrutinyController } from "@/lib/scrutiny/scrutiny-controller";
import type { LiveAnalysisStreamEvent } from "@/lib/scrutiny/statement-types";

export const dynamic = "force-dynamic";

function encode(event: LiveAnalysisStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const politicianQuery = url.searchParams.get("q")?.trim() ?? "";
  const topic = url.searchParams.get("topic")?.trim() ?? "";
  const statement = url.searchParams.get("statement")?.trim() ?? "";

  if (politicianQuery.length < 2) {
    return new Response(JSON.stringify({ error: "q is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const controller = new ScrutinyController();

  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      const write = (event: LiveAnalysisStreamEvent) => streamController.enqueue(encode(event));

      try {
        const report = await controller.analyzeLive({
          politicianQuery,
          topic,
          statementText: statement,
          onModuleUpdate: (module, state, data) => {
            write({ type: "module", module, state, data });
          },
        });

        write({ type: "final", data: report });
      } catch (error) {
        write({
          type: "error",
          message: error instanceof Error ? error.message : "Live analysis failed",
        });
      } finally {
        streamController.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
