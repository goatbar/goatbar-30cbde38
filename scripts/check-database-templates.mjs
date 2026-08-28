import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load .env
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const [k, v] = line.split('=');
    if (k && v) process.env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://odcqduewqjljdfaewxqk.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('proposal_templates').select('*');
  console.log('Error:', error);
  console.log(`Templates in database (${data?.length || 0}):`);
  for (const t of data || []) {
    console.log(` -> ID: ${t.id} | Name: "${t.name}" | EventType: ${t.event_type} | Provider: ${t.provider} | Active: ${t.is_active} | Default: ${t.is_default} | CanvaId: ${t.canva_brand_template_id}`);
  }
}

main().catch(console.error);
