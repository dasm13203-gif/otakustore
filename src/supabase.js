import { createClient } from '@supabase/supabase-js'

// مفاتيح عامة (publishable/anon) وآمنة للظهور في الموقع، وبتحميها صلاحيات الجداول
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://nkabcktebothydunuaht.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_CZDICResK7Yia6PmrIpVOg_yOxv8_T7'

export const sb = createClient(URL, KEY)
export const money = (n) => `${Number(n || 0).toLocaleString('ar-EG')} ج.م`
