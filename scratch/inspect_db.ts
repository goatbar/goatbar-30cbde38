import { createClient } from '@supabase/supabase-client'
import * as dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function inspect() {
  const { data, error } = await supabase
    .from('event_contract_client_data')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error(error)
  } else {
    console.log('Columns:', Object.keys(data[0] || {}))
  }
}

inspect()
