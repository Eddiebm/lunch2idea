'use client'
import { useMemo, useState, useEffect, useRef } from 'react'

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
  const [step, setStep] = useState<'cta'|'calc'|'generating'|'previews'|'contact'|'paying'>('cta')
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [pages, setPages] = useState(1)
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({})
  const [previews, setPreviews] = useState<Preview[] | null>(null)
  const [loadingPreviews, setLoadingPreviews] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [country, setCountry] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
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
    setElapsed(0)
    setStep('generating')
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
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
      setStep('calc')
    } finally {
      setLoadingPreviews(false)
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
  }

  async function payNow() {
    if (!selectedKey || !previews) return
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) { setError('Valid email required'); return }
    if (!agreedToTerms) { setError('Please agree to the Terms of Service'); return }
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
          contact: { email, whatsapp, country },
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
            onClick={generatePreviews}
            style={{ width: '100%', background: '#1D1D1F', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
            Generate 3 design previews →
          </button>
          {error && <div style={{ color: '#D93025', fontSize: 13, marginTop: 10 }}>{error}</div>}
        </div>
      )}

      {step === 'generating' && (
        <div style={{ ...cardStyle, background: '#1D1D1F', color: '#fff', padding: '40px 28px' }}>
          <style>{`
            @keyframes pulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }
            @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
            @keyframes fadeSlide { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
          `}</style>

          {/* Emoji + title */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 52, marginBottom: 16, animation: 'pulse 2s ease-in-out infinite' }}>🍳</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.5px', marginBottom: 6 }}>Your designs are cooking…</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,.5)', lineHeight: 1.55 }}>
              Gemini is generating 3 distinct design directions for <span style={{ color: '#fff', fontWeight: 600 }}>{productName}</span>.
            </div>
          </div>

          {/* Elapsed timer */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums', color: '#0A84FF' }}>
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,.4)' }}>elapsed</span>
            </div>
          </div>

          {/* Stage indicators */}
          {[
            { label: 'Editorial', icon: '📰', startAt: 0 },
            { label: 'Modern Minimal', icon: '◻️', startAt: 5 },
            { label: 'Bold & Vibrant', icon: '🎨', startAt: 10 },
          ].map(({ label, icon, startAt }) => {
            const active = elapsed >= startAt
            const done = elapsed >= startAt + 35
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, opacity: active ? 1 : 0.35, transition: 'opacity .6s', animation: active && !done ? 'fadeSlide .4s ease' : undefined }}>
                <div style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{label}</div>
                  <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,.1)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: 4,
                      background: done ? '#30D158' : 'linear-gradient(90deg,#0A84FF,#5E5CE6)',
                      width: done ? '100%' : active ? `${Math.min(95, ((elapsed - startAt) / 40) * 100)}%` : '0%',
                      transition: 'width 1s linear, background .3s',
                    }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: done ? '#30D158' : active ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.2)', width: 40, textAlign: 'right' }}>
                  {done ? '✓ done' : active ? 'cooking' : 'queued'}
                </div>
              </div>
            )
          })}

          {/* Fun rotating tip */}
          <div style={{ marginTop: 28, background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '14px 18px', fontSize: 13, color: 'rgba(255,255,255,.5)', textAlign: 'center', lineHeight: 1.55 }}>
            {[
              '💡 Each design uses a different font family, color palette, and layout system.',
              '📸 Fetching real photos from Unsplash to make your previews look authentic.',
              '⚡ All 3 designs generate in parallel — usually ready in 30–60 seconds.',
              '🎯 You\'ll see the full site in an iframe — scroll, inspect, pick your favourite.',
            ][Math.floor(elapsed / 12) % 4]}
          </div>

          {error && (
            <div style={{ marginTop: 16, color: '#FF453A', fontSize: 13, textAlign: 'center' }}>{error}</div>
          )}
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
            style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,.12)', fontSize: 15, marginBottom: 10 }} />
          <select value={country} onChange={e => setCountry(e.target.value)}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,.12)', fontSize: 15, marginBottom: 14, background: '#fff', color: country ? '#1D1D1F' : '#AEAEB2', appearance: 'auto' }}>
            <option value="">Select your country</option>
            <optgroup label="🌍 Africa">
              {[['GH','Ghana'],['NG','Nigeria'],['KE','Kenya'],['ZA','South Africa'],['TZ','Tanzania'],['UG','Uganda'],['RW','Rwanda'],['ET','Ethiopia'],['EG','Egypt'],['MA','Morocco'],['CI','Ivory Coast'],['CM','Cameroon'],['SN','Senegal'],['AO','Angola'],['ZM','Zambia'],['MZ','Mozambique'],['GN','Guinea'],['BJ','Benin'],['TG','Togo'],['ML','Mali'],['BF','Burkina Faso'],['MR','Mauritania'],['MG','Madagascar'],['CD','DR Congo'],['LY','Libya'],['DZ','Algeria'],['SD','Sudan'],['TN','Tunisia']].map(([code,name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </optgroup>
            <optgroup label="🌎 Americas">
              {[['US','United States'],['CA','Canada'],['BR','Brazil'],['MX','Mexico'],['AR','Argentina'],['CO','Colombia'],['CL','Chile'],['PE','Peru']].map(([code,name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </optgroup>
            <optgroup label="🌍 Europe">
              {[['GB','United Kingdom'],['DE','Germany'],['FR','France'],['NL','Netherlands'],['SE','Sweden'],['NO','Norway'],['DK','Denmark'],['FI','Finland'],['ES','Spain'],['IT','Italy'],['PT','Portugal'],['PL','Poland'],['CH','Switzerland'],['BE','Belgium'],['AT','Austria'],['IE','Ireland']].map(([code,name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </optgroup>
            <optgroup label="🌏 Asia / Pacific">
              {[['AU','Australia'],['NZ','New Zealand'],['IN','India'],['SG','Singapore'],['JP','Japan'],['AE','UAE'],['SA','Saudi Arabia']].map(([code,name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </optgroup>
          </select>
          <div style={{ background: '#F2F2F7', borderRadius: 12, padding: '14px 18px', marginBottom: 14, fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Build ({selectedKey})</span><span>${total}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6E6E73' }}><span>Monthly (domain + hosting + maintenance)</span><span>$97/mo</span></div>
          </div>
          {(() => {
            const african = new Set(['GH','NG','KE','ZA','TZ','UG','RW','CI','SN','ET','EG','MA','CM','TN','AO','MZ','ZM','MW','BW','NA','ZW','MU','CV','GM','SL','LR','GN','BJ','TG','BF','ML','NE','TD','SD','SO','DJ','MG','CD','CG','GA','GQ','BI','MR','LY','DZ'])
            const isAfrica = african.has(country)
            return (
              <>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#6E6E73', lineHeight: 1.55 }}>
                    I have read and agree to the{' '}
                    <a href="/terms" target="_blank" style={{ color: '#0066CC' }}>Terms of Service</a>
                    {' '}— including what is included, the delivery timeline, and the refund policy.
                  </span>
                </label>
                <button onClick={payNow} style={{ width: '100%', background: agreedToTerms ? '#0066CC' : '#AEAEB2', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 16, fontWeight: 600, cursor: agreedToTerms ? 'pointer' : 'not-allowed', transition: 'background .2s' }}>
                  Pay ${total} + $97/mo →
                </button>
                <div style={{ textAlign: 'center', fontSize: 12, color: '#AEAEB2', marginTop: 8 }}>
                  {isAfrica ? '🌍 Processed by Paystack · USD' : '🔒 Processed by Stripe · USD'}
                </div>
              </>
            )
          })()}
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
