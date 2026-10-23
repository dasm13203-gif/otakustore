import { createClient } from '@supabase/supabase-js'
export const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
export const money = (n) => `${Number(n || 0).toLocaleString('ar-EG')} ج.م`
