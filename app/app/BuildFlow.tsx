'use client'
import { useMemo, useState } from 'react'

interface Photos { hero: string | null; feature: string | null; team: string | null; atmosphere: string | null; cta: string | null }
interface Preview { key: string; name: string; html: string }

interface Props {
  brief: string
  productName: string
  tagline?: string
  vision?: string
  isDone: boolean
}

const FEATURES = [
  { key: 'contact', label: 'Contact form', price: 40 },
  { key: 'booking', label: 'Booking / appointments', price: 120 },
  { key: 'blog', label: 'Blog / content section', price: 80 },
  { key: 'ecommerce', label: 'E-commerce (cart + checkout)', price: 300 },
  { key: 'gallery', label: 'Photo gallery', price: 40 },
  { key: 'multilang', label: 'Multi-language', price: 100 },
] as const
const INTEGRATIONS = [
  { key: 'stripe', label: 'Stripe payments', price: 90 },
  { key: 'calendly', label: 'Calendly embed', price: 30 },
  { key: 'mailchimp', label: 'Mailchimp / newsletter', price: 40 },
] as const
const BASE = 299
const EXTRA_PAGE = 50

export default function BuildFlow({ brief, productName, tagline, vision, isDone }: Props) {
  const [step, setStep] = useState<'cta'|'calc'|'previews'|'contact'|'paying'>('cta')
  const [pages, setPages] = useState(1)
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({})
  const [previews, setPreviews] = useState<Preview[] | null>(null)
  const [loadingPreviews, setLoadingPreviews] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [error, setError] = useState('')

  const { total, breakdown } = useMemo(() => {
    const items: Array<{ label: string; amount: number }> = [{ label: 'Base build', amount: BASE }]
    const extraPages = Math.max(0, pages - 1)
    if (extraPages > 0) items.push({ label: `${extraPages} extra page${extraPages > 1 ? 's' : ''} ($${EXTRA_PAGE} each)`, amount: extraPages * EXTRA_PAGE })
    for (const f of FEATURES) if (features[f.key]) items.push({ label: f.label, amount: f.price })
    for (const i of INTEGRATIONS) if (integrations[i.key]) items.push({ label: i.label, amount: i.price })
    return { total: items.reduce((s, i) => s + i.amount, 0), breakdown: items }
  }, [pages, features, integrations])

  async function generatePreviews() {
    setLoadingPreviews(true)
    setError('')
    try {
      // Fetch photos first for richer previews
      const imgRes = await fetch('/api/imagery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, productName, tagline, vision }),
      })
      const photos: Photos | null = imgRes.ok ? (await imgRes.json()).photos : null

      const res = await fetch('/api/previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, productName, tagline, vision, photos }),
      })
      if (!res.ok) throw new Error('Preview generation failed')
      const data = await res.json()
      setPreviews(data.previews)
      setStep('previews')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingPreviews(false)
    }
  }

  async function payNow() {
    if (!selectedKey || !previews) return
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) { setError('Valid email required'); return }
    const selected = previews.find(p => p.key === selectedKey)!
    setStep('paying')
    setError('')
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedStyle: selected.key,
          selectedHtml: selected.html,
          calculatedPrice: total,
          priceBreakdown: breakdown,
          productName,
          contact: { email, whatsapp },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Checkout failed')
      window.location.href = data.url
    } catch (e: any) {
      setError(e.message)
      setStep('contact')
    }
  }

  if (!isDone) return null

  const cardStyle = { background: '#FFFFFF', borderRadius: 20, padding: 28, marginTop: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04), 0 0 0 0.5px rgba(0,0,0,.06)' }
  const labelStyle = { fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' as const, color: '#6E6E73', marginBottom: 8 }

  return (
    <div>
      {step === 'cta' && (
        <div style={{ ...cardStyle, background: '#0066CC', color: '#fff', padding: '28px 28px 24px' }}>
          <div style={{ ...labelStyle, color: 'rgba(255,255,255,.6)' }}>Build this for real</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.5px', marginBottom: 6 }}>Ready to go live?</div>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.85)', margin: '0 0 18px', lineHeight: 1.55 }}>
            Price it, pick a design, pay. We deploy it automatically.
          </p>
          <button onClick={() => setStep('calc')} style={{ background: '#fff', color: '#0066CC', border: 'none', borderRadius: 12, padding: '13px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
            Build this →
          </button>
        </div>
      )}

      {step === 'calc' && (
        <div style={cardStyle}>
          <div style={labelStyle}>Price calculator</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-.5px', marginBottom: 20 }}>Shape your build</div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#1D1D1F', marginBottom: 8 }}>Pages: {pages}</div>
            <input type="range" min={1} max={10} value={pages} onChange={e => setPages(Number(e.target.value))} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#1D1D1F', marginBottom: 10 }}>Features</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {FEATURES.map(f => (
                <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: features[f.key] ? '#E3F2FD' : '#F2F2F7', borderRadius: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={!!features[f.key]} onChange={e => setFeatures({ ...features, [f.key]: e.target.checked })} />
                  <span style={{ flex: 1 }}>{f.label}</span>
                  <span style={{ color: '#6E6E73', fontSize: 12 }}>+${f.price}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#1D1D1F', marginBottom: 10 }}>Integrations</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {INTEGRATIONS.map(i => (
                <label key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: integrations[i.key] ? '#E3F2FD' : '#F2F2F7', borderRadius: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={!!integrations[i.key]} onChange={e => setIntegrations({ ...integrations, [i.key]: e.target.checked })} />
                  <span style={{ flex: 1 }}>{i.label}</span>
                  <span style={{ color: '#6E6E73', fontSize: 12 }}>+${i.price}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ background: '#F2F2F7', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ ...labelStyle, marginBottom: 10 }}>Breakdown</div>
            {breakdown.map(b => (
              <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#1D1D1F', padding: '4px 0' }}>
                <span>{b.label}</span><span>${b.amount}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
              <span>One-time build</span><span>${total}</span>
            </div>
            <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 6 }}>+ $97/mo (domain + hosting + maintenance)</div>
          </div>

          <button
            disabled={loadingPreviews}
            onClick={generatePreviews}
            style={{ width: '100%', background: '#1D1D1F', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 16, fontWeight: 600, cursor: loadingPreviews ? 'wait' : 'pointer', opacity: loadingPreviews ? 0.6 : 1 }}>
            {loadingPreviews ? 'Generating 3 designs…' : 'Generate 3 design previews →'}
          </button>
          {error && <div style={{ color: '#D93025', fontSize: 13, marginTop: 10 }}>{error}</div>}
        </div>
      )}

      {step === 'previews' && previews && (
        <div style={cardStyle}>
          <div style={labelStyle}>Pick your design</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-.5px', marginBottom: 6 }}>Three directions</div>
          <p style={{ fontSize: 14, color: '#6E6E73', margin: '0 0 18px' }}>Pick one. We deploy it the second you pay.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {previews.map(p => (
              <div key={p.key} style={{ border: selectedKey === p.key ? '2px solid #0066CC' : '1px solid rgba(0,0,0,.08)', borderRadius: 14, overflow: 'hidden', background: '#fff', transition: 'all .15s' }}>
                <div style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#1D1D1F', borderBottom: '1px solid rgba(0,0,0,.06)' }}>{p.name}</div>
                <div style={{ height: 360, overflow: 'hidden', background: '#fafafa' }}>
                  <iframe
                    srcDoc={p.html}
                    sandbox="allow-same-origin"
                    style={{ width: '200%', height: 720, border: 'none', display: 'block', transform: 'scale(0.5)', transformOrigin: 'top left' }}
                    title={p.name}
                  />
                </div>
                <div style={{ padding: 10 }}>
                  <button
                    onClick={() => { setSelectedKey(p.key); setStep('contact') }}
                    style={{ width: '100%', background: selectedKey === p.key ? '#0066CC' : '#1D1D1F', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Pick this →
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setStep('calc')} style={{ marginTop: 14, background: 'transparent', border: 'none', color: '#0066CC', fontSize: 14, cursor: 'pointer' }}>← Adjust calculator</button>
        </div>
      )}

      {step === 'contact' && selectedKey && (
        <div style={cardStyle}>
          <div style={labelStyle}>Almost there</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-.5px', marginBottom: 14 }}>Where should we send your live URL?</div>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email"
            style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,.12)', fontSize: 15, marginBottom: 10 }} />
          <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="WhatsApp (optional, e.g. +233...)"
            style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,.12)', fontSize: 15, marginBottom: 14 }} />
          <div style={{ background: '#F2F2F7', borderRadius: 12, padding: '14px 18px', marginBottom: 14, fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Build ({selectedKey})</span><span>${total}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6E6E73' }}><span>Monthly (domain + hosting + maintenance)</span><span>$97/mo</span></div>
          </div>
          <button onClick={payNow} style={{ width: '100%', background: '#0066CC', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
            Pay ${total} + $97/mo →
          </button>
          <button onClick={() => setStep('previews')} style={{ marginTop: 10, background: 'transparent', border: 'none', color: '#0066CC', fontSize: 14, cursor: 'pointer' }}>← Back to designs</button>
          {error && <div style={{ color: '#D93025', fontSize: 13, marginTop: 10 }}>{error}</div>}
        </div>
      )}

      {step === 'paying' && (
        <div style={cardStyle}>
          <div style={{ fontSize: 17, color: '#1D1D1F' }}>Redirecting to Stripe…</div>
        </div>
      )}
    </div>
  )
}
