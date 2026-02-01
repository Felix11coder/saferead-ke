/*import { createClient } from '@supabase/supabase-js'

// HARDCODED KEYS – your exact ones (temporary, delete later)
const supabaseUrl = 'https://mzvzswudbpzrhcjbkywh.supabase.co'
const supabaseAnonKey = 'sb_publishable_9Dq_U2AS7wO1GwDJz8ZAPw_8mA3VAgS'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)*/

import { createClient } from '@supabase/supabase-js'
import { supabaseConfig } from './config'

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey)