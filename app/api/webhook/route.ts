import Stripe from 'stripe'
import { headers } from 'next/headers'
import { Resend } from 'resend'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const body = await req.text()
  const sig = (await headers()).get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { plan, brief } = session.metadata || {}
    const customerEmail = session.customer_details?.email
    const customerName = session.customer_details?.name || 'Founder'
    const amountPaid = (session.amount_total || 0) / 100

    if (customerEmail && brief) {
      // 1. Confirmation email to customer
      await resend.emails.send({
        from: `idea2Lunch <${process.env.RESEND_FROM || 'hello@idea2lunch.com'}>`,
        to: customerEmail,
        subject: '✦ Your product is in the kitchen — idea2Lunch',
        html: buildConfirmationEmail(customerName, plan || 'launch', amountPaid),
      })

      // 2. Internal order notification
      await resend.emails.send({
        from: `idea2Lunch Orders <${process.env.RESEND_FROM || 'hello@idea2lunch.com'}>`,
        to: process.env.RESEND_FROM || 'hello@idea2lunch.com',
        subject: `🚀 New order: ${plan} — ${customerEmail}`,
        html: buildOrderEmail(customerEmail, customerName, plan || 'launch', brief, amountPaid, session.id),
      })
    }
  }

  return new Response('OK', { status: 200 })
}

function buildConfirmationEmail(name: string, plan: string, amount: number) {
  const planNames: Record<string, string> = {
    launch: 'Launch', design: 'Launch + Design', full: 'Full Product'
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:0;background:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}
    .wrap{max-width:560px;margin:0 auto;padding:48px 32px}
    .card{background:#FFFFFF;border-radius:20px;padding:32px;margin-bottom:16px}
    .label{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#6E6E73;margin-bottom:8px}
    h1{font-size:28px;font-weight:700;color:#1D1D1F;letter-spacing:-.5px;margin:0 0 8px}
    p{font-size:17px;color:#3C3C43;line-height:1.6;margin:0 0 16px}
    .detail{background:#F2F2F7;border-radius:12px;padding:16px 20px;margin:20px 0}
    .footer{font-size:13px;color:#6E6E73;text-align:center;margin-top:24px}
  </style></head><body><div class="wrap">
    <div class="card">
      <div class="label">idea2Lunch</div>
      <h1>Your idea is in the kitchen.</h1>
      <p>Hi ${name}, your order is confirmed. We're building your product now and you'll receive a live URL within 48 hours.</p>
      <div class="detail">
        <div class="label">Order summary</div>
        <p style="margin:0;font-size:15px;color:#1D1D1F">Plan: <strong>${planNames[plan] || plan}</strong><br/>Amount: <strong>$${amount.toFixed(2)}</strong><br/>Delivery: within 48 hours</p>
      </div>
      <p style="font-size:15px">What happens next: we take your brief, build your product using Claude Code, design and deploy it to Vercel, then send you the live URL, GitHub repo, and credentials.</p>
    </div>
    <div class="footer">Questions? Reply to this email. · idea2Lunch · idea2lunch.com</div>
  </div></body></html>`
}

function buildOrderEmail(email: string, name: string, plan: string, brief: string, amount: number, sessionId: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:0;background:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}
    .wrap{max-width:700px;margin:0 auto;padding:40px 32px}
    .card{background:#FFFFFF;border-radius:16px;padding:24px;margin-bottom:12px}
    .label{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6E6E73;margin-bottom:6px}
    .val{font-size:15px;color:#1D1D1F;line-height:1.5}
    h2{font-size:22px;font-weight:700;color:#1D1D1F;margin:0 0 20px;letter-spacing:-.3px}
    pre{font-size:12px;color:#3C3C43;white-space:pre-wrap;max-height:300px;overflow:auto;margin:0}
  </style></head><body><div class="wrap">
    <h2>🚀 New idea2Lunch order</h2>
    <div class="card"><div class="label">Customer</div><div class="val">${name} — ${email}</div></div>
    <div class="card"><div class="label">Plan</div><div class="val">${plan} — $${amount.toFixed(2)}</div></div>
    <div class="card"><div class="label">Stripe Session</div><div class="val">${sessionId}</div></div>
    <div class="card"><div class="label">Brief (first 500 chars)</div><pre>${brief}</pre></div>
  </div></body></html>`
}
