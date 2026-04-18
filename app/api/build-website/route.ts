import OpenAI from 'openai'

export const runtime = 'edge'

const WEBSITE_SYSTEM = `You are a world-class frontend developer and designer at a Madison Avenue agency.

Given a product brief and photography URLs, generate a COMPLETE, BEAUTIFUL, PRODUCTION-READY single-page HTML website.

DESIGN STANDARDS — MANDATORY:
- Typography: Use Google Fonts. Pick editorial fonts (Playfair Display, Cormorant, Libre Baskerville) for headings. Refined body fonts (Lora, Crimson Pro, EB Garamond). Mono for labels (DM Mono, JetBrains Mono).
- Colors: Derive from the brand and industry. Never use generic blue/white. Make deliberate, beautiful choices.
- Photography: ALWAYS embed the provided photo URLs as full-bleed hero backgrounds, section backgrounds, and image cards. Use CSS object-fit:cover. Add subtle overlays for text legibility.
- Layout: Asymmetric, editorial. Think Kinfolk magazine. Generous white space.
- Never use stock-looking design patterns. Make it feel bespoke.

REQUIRED SECTIONS:
1. Navigation — fixed, semi-transparent, logo + links + CTA
2. Hero — full-viewport height, hero photo as background, large editorial headline, tagline, CTA button
3. How it works — 3-4 steps with icons
4. Features — with feature photo embedded
5. Testimonials or social proof — if testimonials provided
6. Pricing — 3 tiers if provided
7. CTA section — with atmosphere photo as background
8. Footer

PHOTO USAGE:
- heroPhoto → Full-viewport hero section background (use CSS background-image with overlay)
- featurePhoto → Feature section (use as <img> with object-fit:cover in a split layout)  
- atmospherePhoto → CTA section background (dark overlay for text)
- If a photo URL is null, use a beautiful CSS gradient instead

OUTPUT: A single complete HTML file. Include all CSS inline in <style>. Include all JS inline in <script>. 
Import Google Fonts via @import in CSS.
The HTML must work when opened directly in a browser.
Start directly with <!DOCTYPE html>. No explanation text before or after.`

export async function POST(req: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  })
  try {
    const { brief, productName, tagline, vision, photos, pricing } = await req.json()

    const userMessage = `
PRODUCT: ${productName}
TAGLINE: ${tagline || ''}
VISION: ${vision || ''}

BRIEF EXCERPT:
${(brief || '').slice(0, 2000)}

PHOTOGRAPHY URLS:
heroPhoto: ${photos?.hero || 'null'}
featurePhoto: ${photos?.feature || 'null'}
teamPhoto: ${photos?.team || 'null'}
atmospherePhoto: ${photos?.atmosphere || 'null'}

PRICING (if provided):
${pricing ? JSON.stringify(pricing) : 'Use standard $299/$699/$1499 tiers'}

Build a complete, beautiful, photo-rich website for this product now.
`

    const stream = await openai.chat.completions.create({
      model: 'google/gemini-2.5-flash',
      max_tokens: 4000,
      stream: true,
      messages: [
        { role: 'system', content: WEBSITE_SYSTEM },
        { role: 'user', content: userMessage }
      ]
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text } })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally {
          controller.close()
        }
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
