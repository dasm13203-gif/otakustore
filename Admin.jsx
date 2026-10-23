import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, money } from './supabase.js'

const STATUS = { new: 'جديد', shipped: 'اتشحن', done: 'اتسلّم', cancelled: 'ملغي' }

export default function Admin() {
  const [session, setSession] = useState(undefined)
  const [isAdmin, setIsAdmin] = useState(null)

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (session) sb.rpc('is_admin').then(({ data }) => setIsAdmin(!!data))
  }, [session])

  if (session === undefined) return <p className="muted pad">جاري التحميل…</p>
  if (!session) return <Login />
  if (isAdmin === null) return <p className="muted pad">جاري التحقق…</p>
  if (!isAdmin) return <p className="err pad">الحساب ده مش مضاف كأدمن. ضيفه في جدول admins.</p>
  return <Dashboard />
}

function Login() {
  const [e, setE] = useState(''), [p, setP] = useState(''), [err, setErr] = useState('')
  const go = async () => {
    const { error } = await sb.auth.signInWithPassword({ email: e, password: p })
    if (error) setErr('الإيميل أو كلمة السر غلط.')
  }
  return (
    <div className="login">
      <h2>دخول لوحة التحكم</h2>
      <input placeholder="الإيميل" value={e} onChange={(x) => setE(x.target.value)} />
      <input placeholder="كلمة السر" type="password" value={p} onChange={(x) => setP(x.target.value)} />
      {err && <p className="err">{err}</p>}
      <button className="btn" onClick={go}>دخول</button>
      <Link to="/" className="muted">رجوع للمتجر</Link>
    </div>
  )
}

function Dashboard() {
  const [tab, setTab] = useState('home')
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      sb.from('products').select('*, variants(*)').order('created_at', { ascending: false }),
      sb.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(300),
    ])
    setProducts(a.data || []); setOrders(b.data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const tabs = { home: 'نظرة عامة', stock: 'المخزون', orders: 'الطلبات', sale: 'بيع من المحل' }
  return (
    <div className="admin">
      <header className="top">
        <div className="brand">أوتاكو<small>لوحة التحكم</small></div>
        <button className="btn ghost" onClick={() => sb.auth.signOut()}>خروج</button>
      </header>
      <nav className="tabs">
        {Object.entries(tabs).map(([k, v]) => (
          <button key={k} className={tab === k ? 'chip on' : 'chip'} onClick={() => setTab(k)}>{v}</button>
        ))}
      </nav>
      <div className="wrap">
        {tab === 'home' && <Home products={products} orders={orders} />}
        {tab === 'stock' && <Stock products={products} reload={load} />}
        {tab === 'orders' && <Orders orders={orders} reload={load} />}
        {tab === 'sale' && <Sale products={products} reload={load} />}
      </div>
    </div>
  )
}

function Home({ products, orders }) {
  const live = orders.filter((o) => o.status !== 'cancelled')
  const sum = (arr) => arr.reduce((s, o) => s + Number(o.total), 0)
  const day = new Date().toDateString(), mon = new Date().getMonth()
  const today = live.filter((o) => new Date(o.created_at).toDateString() === day)
  const month = live.filter((o) => new Date(o.created_at).getMonth() === mon)
  const low = products.flatMap((p) => p.variants.filter((v) => v.stock <= 2).map((v) => ({ ...v, name: p.name })))
  const top = {}
  live.forEach((o) => o.order_items.forEach((i) => (top[i.name] = (top[i.name] || 0) + i.qty)))
  const best = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return (
    <>
      <div className="stats">
        <div><b>{money(sum(today))}</b>مبيعات النهارده ({today.length} طلب)</div>
        <div><b>{money(sum(month))}</b>مبيعات الشهر ({month.length} طلب)</div>
        <div><b>{orders.filter((o) => o.status === 'new').length}</b>طلبات جديدة محتاجة تجهيز</div>
      </div>
      <h3>مخزون قليل (٢ أو أقل)</h3>
      {!low.length && <p className="muted">كل المقاسات متوفرة بكميات كويسة.</p>}
      {low.map((v) => <p key={v.id} className="row">{v.name} - مقاس {v.size}<b>{v.stock}</b></p>)}
      <h3>الأكتر مبيعًا</h3>
      {!best.length && <p className="muted">لسه مفيش مبيعات.</p>}
      {best.map(([n, q]) => <p key={n} className="row">{n}<b>{q} قطعة</b></p>)}
    </>
  )
}

function Stock({ products, reload }) {
  const [f, setF] = useState({ name: '', brand: '', price: '', image_url: '', color: '', sizes: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const addProduct = async () => {
    const { data: p, error } = await sb.from('products')
      .insert({ name: f.name, brand: f.brand, price: Number(f.price), image_url: f.image_url }).select().single()
    if (error) return alert('مقدرتش أضيف المنتج: ' + error.message)
    const rows = f.sizes.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const [size, stock] = s.split(':')
      return { product_id: p.id, size: size.trim(), color: f.color, stock: Number(stock) || 0 }
    })
    if (rows.length) await sb.from('variants').insert(rows)
    setF({ name: '', brand: '', price: '', image_url: '', color: '', sizes: '' }); reload()
  }
  const setStock = async (id, v) => { await sb.from('variants').update({ stock: Math.max(0, Number(v)) }).eq('id', id); reload() }
  const toggle = async (p) => { await sb.from('products').update({ active: !p.active }).eq('id', p.id); reload() }

  return (
    <>
      <div className="form">
        <h3>إضافة منتج</h3>
        <input placeholder="اسم الكوتشي" value={f.name} onChange={set('name')} />
        <input placeholder="الماركة" value={f.brand} onChange={set('brand')} />
        <input placeholder="السعر" inputMode="numeric" value={f.price} onChange={set('price')} />
        <input placeholder="رابط الصورة" value={f.image_url} onChange={set('image_url')} />
        <input placeholder="اللون" value={f.color} onChange={set('color')} />
        <input placeholder="المقاسات والكميات: 40:3, 41:5, 42:2" value={f.sizes} onChange={set('sizes')} />
        <button className="btn" disabled={!f.name || !f.price} onClick={addProduct}>حفظ المنتج</button>
      </div>
      {products.map((p) => (
        <div className="prod" key={p.id}>
          <div className="row"><b>{p.name}</b><span>{money(p.price)}</span>
            <button className="x" onClick={() => toggle(p)}>{p.active ? 'إخفاء من المتجر' : 'إظهار في المتجر'}</button></div>
          <div className="sizes">
            {p.variants.sort((a, b) => a.size - b.size).map((v) => (
              <label key={v.id}>{v.size}
                <input type="number" min="0" defaultValue={v.stock} onBlur={(e) => Number(e.target.value) !== v.stock && setStock(v.id, e.target.value)} />
              </label>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function Orders({ orders, reload }) {
  const change = async (id, status) => { await sb.from('orders').update({ status }).eq('id', id); reload() }
  if (!orders.length) return <p className="muted">لسه مفيش طلبات.</p>
  return orders.map((o) => (
    <div className="prod" key={o.id}>
      <div className="row">
        <b>{o.customer_name || 'بيع من المحل'}</b><span>{money(o.total)}</span>
        <select value={o.status} onChange={(e) => change(o.id, e.target.value)}>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <p className="muted">{o.source === 'store' ? 'المحل' : `${o.phone} - ${o.city} - ${o.address}`} - {new Date(o.created_at).toLocaleString('ar-EG')}</p>
      <p>{o.order_items.map((i) => `${i.name} (${i.size}) × ${i.qty}`).join('، ')}</p>
    </div>
  ))
}

function Sale({ products, reload }) {
  const [vid, setVid] = useState(''), [qty, setQty] = useState(1), [msg, setMsg] = useState('')
  const opts = products.flatMap((p) => p.variants.filter((v) => v.stock > 0).map((v) => ({ id: v.id, label: `${p.name} - مقاس ${v.size} (متاح ${v.stock})` })))
  const sell = async () => {
    const { error } = await sb.rpc('place_order', { p_name: '', p_phone: '', p_address: '', p_city: '', p_source: 'store', p_items: [{ variant_id: vid, qty: Number(qty) }] })
    setMsg(error ? 'الكمية المطلوبة أكبر من المتاح.' : 'تم تسجيل البيع وخصم المخزون.')
    if (!error) { setVid(''); setQty(1); reload() }
  }
  return (
    <div className="form">
      <h3>تسجيل بيع من المحل</h3>
      <select value={vid} onChange={(e) => setVid(e.target.value)}>
        <option value="">اختار الكوتشي والمقاس</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
      <button className="btn" disabled={!vid} onClick={sell}>سجّل البيع</button>
      {msg && <p className="ok">{msg}</p>}
    </div>
  )
}
