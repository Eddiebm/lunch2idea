import Stripe from 'stripe'
import { Redis } from '@upstash/redis'

export const runtime = 'edge'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      selectedStyle: string
      selectedHtml: string
      calculatedPrice: number
      priceBreakdown: Array<{ label: string; amount: number }>
      productName: string
      briefId?: string
      contact: { email: string; whatsapp?: string }
    }

    const { selectedStyle, selectedHtml, calculatedPrice, priceBreakdown, productName, contact } = body
    if (!selectedHtml || !contact?.email || !calculatedPrice) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://idea2lunch.com'
    const priceCents = Math.max(50, Math.round(calculatedPrice * 100))

    // subscription mode — monthly recurring is the primary line, one-time build fee added to first invoice.
    const sessionParams: any = {
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: contact.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Domain + Hosting + Maintenance' },
            unit_amount: 9700,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: { productName: productName.slice(0, 80), selectedStyle },
      },
      add_invoice_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `${productName} — one-time build (${selectedStyle})` },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/app?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/app`,
      metadata: {
        productName: productName.slice(0, 80),
        selectedStyle,
        whatsapp: contact.whatsapp || '',
        oneTimeFeeCents: String(priceCents),
      },
    }
    const session = await stripe.checkout.sessions.create(sessionParams)

    const redis = getRedis()
    if (redis) {
      await redis.set(`order:${session.id}`, JSON.stringify({
        sessionId: session.id,
        productName,
        selectedStyle,
        selectedHtml,
        calculatedPrice,
        priceBreakdown,
        contact,
        createdAt: Date.now(),
        status: 'pending',
      }), { ex: 60 * 60 * 24 * 14 })
    }

    return Response.json({ url: session.url, sessionId: session.id })
  } catch (err: any) {
    console.error('order error', err)
    return Response.json({ error: err.message || 'order failed' }, { status: 500 })
  }
}
