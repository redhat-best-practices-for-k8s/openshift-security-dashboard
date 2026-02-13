import { NextRequest, NextResponse } from "next/server";
import { getKubeConfig } from "@/lib/k8s/client";

const OLLAMA_URL = "http://localhost:11434/api/chat";
const MODEL = "qwen3:32b";

export async function POST(request: NextRequest) {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  try {
    const { messages, systemPrompt } = await request.json();

    const ollamaMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const ollamaRes = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: ollamaMessages,
        stream: true,
        options: {
          temperature: 0.7,
          num_predict: 2048,
        },
      }),
    });

    if (!ollamaRes.ok) {
      const text = await ollamaRes.text();
      return NextResponse.json({ error: `Ollama error: ${text}` }, { status: 502 });
    }

    // Stream the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = ollamaRes.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n").filter(Boolean);

            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: json.message.content })}\n\n`)
                  );
                }
                if (json.done) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                }
              } catch {
                // Skip malformed lines
              }
            }
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to chat with AI";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
