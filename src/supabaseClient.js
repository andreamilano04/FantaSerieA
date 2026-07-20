import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Questo log ci dirà se il problema è risolto
console.log("URL Supabase caricato:", supabaseUrl)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("ERRORE GRAVE: Variabili d'ambiente mancanti. Controlla il file .env.local")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)