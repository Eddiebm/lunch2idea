export const runtime = 'edge'

// Public diagnostic — returns boolean presence of secrets and a live status
// check for SerpAPI + Resend. Does NOT return any secret values. Safe to
// leave public; the only "leak" is the list of sending domains verified in
// Resend, which is already visible on the From: header of any sent email.

type SerpStatus = { configured: boolean; working?: boolean; plan?: string; searchesLeft?: number; error?: string }
type ResendStatus = { configured: boolean; domains?: { name: string; status: string; region?: string }[]; error?: string }

async function checkSerpApi(): Promise<SerpStatus> {
  const key = process.env.SERPAPI_KEY
  if (!key) return { configured: false }
  try {
    const res = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { configured: true, working: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    return {
      configured: true,
      working: true,
      plan: data.plan_name || data.plan_id,
      searchesLeft: data.searches_left ?? data.this_month_usage,
    }
  } catch (err: any) {
    return { configured: true, working: false, error: err?.message || 'fetch failed' }
  }
}

async function checkResend(): Promise<ResendStatus> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { configured: false }
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const body = await res.text()
      return { configured: true, error: `HTTP ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json()
    const list = Array.isArray(data?.data) ? data.data : []
    return {
      configured: true,
      domains: list.map((d: any) => ({ name: d.name, status: d.status, region: d.region })),
    }
  } catch (err: any) {
    return { configured: true, error: err?.message || 'fetch failed' }
  }
}

export async function GET() {
  const [serpapi, resend] = await Promise.all([checkSerpApi(), checkResend()])
  return Response.json({
    serpapi,
    resend,
    hunter: { configured: !!process.env.HUNTER_API_KEY },
    twilio: { configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) },
    upstash: { configured: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) },
    openai: { configured: !!process.env.OPENAI_API_KEY },
  })
}
