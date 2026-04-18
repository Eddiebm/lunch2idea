import OpenAI from 'openai'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  })
  try {
    const { systemPrompt, userMessage } = await req.json()
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'user', content: userMessage }
    ]
    if (systemPrompt) messages.unshift({ role: 'system', content: systemPrompt })

    const stream = await openai.chat.completions.create({
      model: 'google/gemini-2.5-flash', messages, stream: true, max_tokens: 1200,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text } })}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally { controller.close() }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  } catch (err: unknown) {
    return Response.json({ error: { message: err instanceof Error ? err.message : 'Unknown error' } }, { status: 500 })
  }
}

