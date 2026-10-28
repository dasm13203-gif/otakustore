import { useEffect, useMemo, useState } from 'react'
import { sb, money } from './supabase.js'

export default function Store() {
  const [products, setProducts] = useState(null)
  const [brand, setBrand] = useState('الكل')
  const [q, setQ] = useState('')
  const [pick, setPick] = useState(null)
  const [cart, setCart] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    sb.from('products').select('*, variants(*)').eq('active', true).order('created_at', { ascending: false })
      .then(({ data }) => setProducts(data || []))
  }, [])

  const brands = useMemo(() => ['الكل', ...new Set((products || []).map((p) => p.brand).filter(Boolean))], [products])
  const list = (products || []).filter((p) => (brand === 'الكل' || p.brand === brand) && p.name.includes(q))
  const count = cart.reduce((s, i) => s + i.qty, 0)

  const add = (p, v) => {
    setCart((c) => {
      const f = c.find((i) => i.variant.id === v.id)
      if (f) return c.map((i) => (i === f ? { ...i, qty: Math.min(i.qty + 1, v.stock) } : i))
      return [...c, { product: p, variant: v, qty: 1 }]
    })
    setPick(null); setOpen(true)
  }

  return (
    <>
      <header className="top">
        <div className="brand">أوتاكو<small>متجر أحذية</small></div>
        <button className="btn ghost" onClick={() => setOpen(true)}>السلة ({count})</button>
      </header>

      <section className="hero">
        <div className="string"><i /></div>
        <h1>كوتشيات تتعلّق<br />بيها من أول لبسة</h1>
        <p>اختار مقاسك، اطلب، وادفع كاش عند الاستلام.</p>
      </section>

      <main className="wrap">
        <div className="bar">
          <input placeholder="دوّر على كوتشي" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">
            {brands.map((b) => (
              <button key={b} className={b === brand ? 'chip on' : 'chip'} onClick={() => setBrand(b)}>{b}</button>
            ))}
          </div>
        </div>

        {products === null && <p className="muted">جاري تحميل المنتجات…</p>}
        {products && !list.length && <p className="muted">مفيش منتجات مطابقة. جرّب بحث تاني.</p>}

        <div className="grid">
          {list.map((p) => {
            const stock = p.variants.reduce((s, v) => s + v.stock, 0)
            return (
              <article key={p.id} className="card" onClick={() => stock && setPick(p)}>
                <div className="img">{p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" /> : null}{!stock && <span className="sold">خلصت</span>}</div>
                <h3>{p.name}</h3>
                <p className="price">{money(p.price)}</p>
              </article>
            )
          })}
        </div>
      </main>

      {pick && <Picker p={pick} onClose={() => setPick(null)} onAdd={add} />}
      {open && <Cart cart={cart} setCart={setCart} onClose={() => setOpen(false)} />}
    </>
  )
}

function Picker({ p, onClose, onAdd }) {
  const vs = p.variants.filter((v) => v.stock > 0).sort((a, b) => a.size - b.size)
  const [v, setV] = useState(null)
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {p.image_url && <img src={p.image_url} alt={p.name} />}
        <h2>{p.name}</h2>
        <p className="price">{money(p.price)}</p>
        <p className="muted">اختار المقاس</p>
        <div className="chips">
          {vs.map((x) => (
            <button key={x.id} className={v?.id === x.id ? 'chip on' : 'chip'} onClick={() => setV(x)}>
              {x.size}{x.color ? ` - ${x.color}` : ''}
            </button>
          ))}
        </div>
        <button className="btn" disabled={!v} onClick={() => onAdd(p, v)}>ضيف للسلة</button>
      </div>
    </div>
  )
}

function Cart({ cart, setCart, onClose }) {
  const [f, setF] = useState({ name: '', phone: '', address: '', city: '' })
  const [state, setState] = useState({ busy: false, err: '', done: false })
  const total = cart.reduce((s, i) => s + i.qty * i.product.price, 0)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = cart.length && f.name && f.phone.length >= 10 && f.address && f.city

  const send = async () => {
    setState({ busy: true, err: '', done: false })
    const items = cart.map((i) => ({ variant_id: i.variant.id, qty: i.qty }))
    const { error } = await sb.rpc('place_order', { p_name: f.name, p_phone: f.phone, p_address: f.address, p_city: f.city, p_items: items })
    if (error) {
      const msg = error.message.includes('out_of_stock') ? 'مقاس من اللي اخترتهم خلص. شيله من السلة وجرّب تاني.' : 'حصلت مشكلة في إرسال الطلب. جرّب تاني.'
      return setState({ busy: false, err: msg, done: false })
    }
    setCart([]); setState({ busy: false, err: '', done: true })
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>السلة</h2>
        {state.done ? (
          <p className="ok">تم استلام طلبك. هنكلمك على رقمك لتأكيد الشحن.</p>
        ) : !cart.length ? (
          <p className="muted">السلة فاضية. اختار كوتشي من المتجر.</p>
        ) : (
          <>
            {cart.map((i) => (
              <div className="line" key={i.variant.id}>
                <span>{i.product.name} - مقاس {i.variant.size}</span>
                <span className="qty">
                  <button onClick={() => setCart(cart.map((x) => (x === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>−</button>
                  {i.qty}
                  <button onClick={() => setCart(cart.map((x) => (x === i ? { ...x, qty: Math.min(x.variant.stock, x.qty + 1) } : x)))}>+</button>
                </span>
                <button className="x" onClick={() => setCart(cart.filter((x) => x !== i))}>حذف</button>
              </div>
            ))}
            <p className="total">الإجمالي: {money(total)} (+ الشحن)</p>
            <input placeholder="الاسم" value={f.name} onChange={set('name')} />
            <input placeholder="رقم الموبايل" inputMode="tel" value={f.phone} onChange={set('phone')} />
            <input placeholder="المحافظة" value={f.city} onChange={set('city')} />
            <input placeholder="العنوان بالتفصيل" value={f.address} onChange={set('address')} />
            {state.err && <p className="err">{state.err}</p>}
            <button className="btn" disabled={!ok || state.busy} onClick={send}>{state.busy ? 'جاري الإرسال…' : 'اطلب - الدفع عند الاستلام'}</button>
          </>
        )}
        <button className="btn ghost" onClick={onClose}>إغلاق</button>
      </div>
    </div>
  )
}
