import fs from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { createClient } from '@supabase/supabase-js'

type AnyRecord = Record<string, unknown>
type ImportStats = { inserted: number; updated: number; ignored: number; total: number }

const BACKUP_FILE = 'goatbar-localstorage-backup.json'
const STORAGE_KEY = 'goatbar-functional-store-v11'
const TABLE_ORDER = ['drinks', 'inventory', 'events', 'sales', 'sales_items', 'financial_sessions', 'financial_session_items'] as const

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Defina SUPABASE_URL/SUPABASE_ANON_KEY (ou VITE_*) no ambiente antes de executar.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function asArray<T = AnyRecord>(value: unknown): T[] { return Array.isArray(value) ? (value as T[]) : [] }
function toNumber(value: unknown, fallback = 0): number { const n = Number(value); return Number.isFinite(n) ? n : fallback }

function pickMapped(source: AnyRecord, mapping: Record<string, string[]>, table: string, idx: number) {
  const payload: AnyRecord = {}
  const used = new Set<string>()
  for (const [target, candidates] of Object.entries(mapping)) {
    for (const key of candidates) {
      if (source[key] !== undefined && source[key] !== null) {
        payload[target] = source[key]
        used.add(key)
        break
      }
    }
  }
  const ignored = Object.keys(source).filter((k) => !used.has(k))
  if (ignored.length) console.log(`ℹ️ [${table}#${idx}] Campos ignorados: ${ignored.join(', ')}`)
  return { payload, ignoredCount: ignored.length }
}


function parseMissingColumnFromError(message: string): string | null {
  const m = message.match(/Could not find the ['"]([^'"]+)['"] column/i)
  return m?.[1] ?? null
}

async function upsertWithMissingColumnTolerance(table: string, rows: AnyRecord[]) {
  let sanitizedRows = rows
  let attempt = 0

  while (attempt < 20) {
    const { error } = await supabase.from(table).upsert(sanitizedRows, { onConflict: 'id' })
    if (!error) return sanitizedRows

    const missingColumn = parseMissingColumnFromError(error.message)
    if (!missingColumn) throw new Error(`Erro no upsert em ${table}: ${error.message}`)

    const hadColumn = sanitizedRows.some((row) => Object.prototype.hasOwnProperty.call(row, missingColumn))
    if (!hadColumn) throw new Error(`Erro no upsert em ${table}: ${error.message}`)

    console.log(`⚠️ [${table}] Coluna inexistente ignorada: ${missingColumn}`)
    sanitizedRows = sanitizedRows.map((row) => {
      if (!Object.prototype.hasOwnProperty.call(row, missingColumn)) return row
      const clone = { ...row }
      delete clone[missingColumn]
      return clone
    })
    attempt += 1
  }

  throw new Error(`Erro no upsert em ${table}: não foi possível estabilizar payload após múltiplas tentativas.`)
}

async function validateConnection() {
  const { error } = await supabase.from('drinks').select('id').limit(1)
  if (error) throw new Error(`Falha ao validar conexão Supabase: ${error.message}`)
}

async function fetchExistingIds(table: string, ids: string[]) {
  if (!ids.length) return new Set<string>()
  const { data, error } = await supabase.from(table).select('id').in('id', ids)
  if (error) throw new Error(`Erro ao consultar duplicados em ${table}: ${error.message}`)
  return new Set((data ?? []).map((r: { id: string }) => r.id))
}

async function importByUpsert(table: string, rows: AnyRecord[], ignored: number, dryRun: boolean): Promise<ImportStats> {
  const validRows = rows.filter((r) => typeof r.id === 'string' && (r.id as string).length > 0)
  const ignoredRows = ignored + (rows.length - validRows.length)
  if (!validRows.length) return { inserted: 0, updated: 0, ignored: ignoredRows, total: rows.length }

  const ids = validRows.map((r) => r.id as string)
  const existing = await fetchExistingIds(table, ids)
  const updated = ids.filter((id) => existing.has(id)).length
  const inserted = validRows.length - updated

  if (!dryRun) {
    await upsertWithMissingColumnTolerance(table, validRows)
  }

  return { inserted, updated, ignored: ignoredRows, total: rows.length }
}

async function run() {
  await validateConnection()
  console.log('✅ Conexão com Supabase validada.')

  const raw = await fs.readFile(path.resolve(process.cwd(), BACKUP_FILE), 'utf-8')
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const storeRaw = parsed[STORAGE_KEY]
  const store = typeof storeRaw === 'string' ? JSON.parse(storeRaw) : (storeRaw as AnyRecord)

  const drinksRaw = asArray(store?.drinks)
  const inventoryRaw = asArray(store?.inventoryItems)
  const eventsRaw = asArray(store?.eventos ?? store?.events)
  const salesRaw = asArray(store?.vendas ?? store?.sales)
  const sessionsRaw = asArray(store?.financialSessions)

  console.log('\n=== Tabelas que serão afetadas ===')
  TABLE_ORDER.forEach((t) => console.log(`- ${t}`))

  console.log('\n=== Resumo pré-importação ===')
  console.log(`drinks: ${drinksRaw.length}`)
  console.log(`inventory: ${inventoryRaw.length}`)
  console.log(`events: ${eventsRaw.length}`)
  console.log(`sales: ${salesRaw.length}`)
  console.log(`financial_sessions: ${sessionsRaw.length}`)

  const drinks: AnyRecord[] = []; let drinksIgnored = 0
  drinksRaw.forEach((row, idx) => { const { payload, ignoredCount } = pickMapped(row, { id: ['id'], name: ['name', 'nome'], cost: ['cost', 'custoUnitario'], price: ['price', 'precoVenda'], created_at: ['created_at', 'createdAt'] }, 'drinks', idx); payload.cost = toNumber(payload.cost); payload.price = toNumber(payload.price); drinks.push(payload); drinksIgnored += ignoredCount })

  const inventory: AnyRecord[] = []; let inventoryIgnored = 0
  inventoryRaw.forEach((row, idx) => { const { payload, ignoredCount } = pickMapped(row, { id: ['id'], name: ['name', 'nome'], category: ['category', 'categoria'], quantity: ['quantity', 'quantidadeTotal'], unit: ['unit', 'unidade'], cost_per_unit: ['cost_per_unit', 'costPerUnit', 'custoUnitario'], updated_at: ['updated_at', 'updatedAt'] }, 'inventory', idx); payload.quantity = toNumber(payload.quantity); payload.cost_per_unit = toNumber(payload.cost_per_unit); inventory.push(payload); inventoryIgnored += ignoredCount })

  const events: AnyRecord[] = []; let eventsIgnored = 0
  eventsRaw.forEach((row, idx) => { const { payload, ignoredCount } = pickMapped(row, { id: ['id'], client_name: ['client_name', 'nome', 'clienteNome'], date: ['date', 'data'], event_type: ['event_type', 'tipo'], guests: ['guests', 'convidados'], phone: ['phone', 'telefone'], email: ['email'], event_time: ['event_time', 'horario'], event_location: ['event_location', 'local'], city: ['city', 'cidade'], notes: ['notes', 'observacoes'], status: ['status'], is_paid_full: ['is_paid_full', 'isPaidFull'], payment_due_date: ['payment_due_date', 'paymentDueDate'], payment_percent_received: ['payment_percent_received', 'paymentPercentReceived'], current_budget_value: ['current_budget_value', 'currentBudgetValue'], current_profit_value: ['current_profit_value', 'currentProfitValue'] }, 'events', idx); payload.guests = toNumber(payload.guests); payload.payment_percent_received = toNumber(payload.payment_percent_received); payload.current_budget_value = toNumber(payload.current_budget_value); payload.current_profit_value = toNumber(payload.current_profit_value); events.push(payload); eventsIgnored += ignoredCount })

  const sales: AnyRecord[] = []; const salesItems: AnyRecord[] = []; let salesIgnored = 0; let salesItemsIgnored = 0
  for (const [idx, saleRow] of salesRaw.entries()) {
    const saleMapped = pickMapped(saleRow, { id: ['id'], date: ['date', 'data'], location: ['location', 'modality', 'modalidade'], total_revenue: ['total_revenue', 'faturamentoTotal', 'totalRevenue'], total_cost: ['total_cost', 'custoTotal', 'totalCost'], total_profit: ['total_profit', 'lucroTotal', 'totalProfit'] }, 'sales', idx)
    saleMapped.payload.total_revenue = toNumber(saleMapped.payload.total_revenue)
    saleMapped.payload.total_cost = toNumber(saleMapped.payload.total_cost)
    saleMapped.payload.total_profit = toNumber(saleMapped.payload.total_profit)
    sales.push(saleMapped.payload); salesIgnored += saleMapped.ignoredCount

    for (const [itemIdx, itemRow] of asArray<AnyRecord>(saleRow.items).entries()) {
      const itemMapped = pickMapped(itemRow, { id: ['id'], sale_id: ['sale_id', 'saleId'], drink_id: ['drink_id', 'drinkId'], quantity: ['quantity', 'quantidade'], price: ['price', 'preco', 'unit_price'], cost: ['cost', 'custo', 'unit_cost'] }, 'sales_items', itemIdx)
      itemMapped.payload.sale_id = itemMapped.payload.sale_id ?? saleMapped.payload.id
      itemMapped.payload.quantity = toNumber(itemMapped.payload.quantity)
      itemMapped.payload.price = toNumber(itemMapped.payload.price)
      itemMapped.payload.cost = toNumber(itemMapped.payload.cost)
      salesItems.push(itemMapped.payload); salesItemsIgnored += itemMapped.ignoredCount
    }
  }

  const sessions: AnyRecord[] = []; const sessionItems: AnyRecord[] = []; let sessionsIgnored = 0; let sessionItemsIgnored = 0
  for (const [idx, sessionRow] of sessionsRaw.entries()) {
    const sessionMapped = pickMapped(sessionRow, { id: ['id'], date: ['date', 'data'], modality: ['modality', 'modalidade'], labor_value: ['labor_value', 'maoDeObraValor'], labor_quantity: ['labor_quantity', 'maoDeObraQtd'], labor_names: ['labor_names', 'maoDeObraNomes'], labor_details: ['labor_details', 'maoDeObraDetalhes'], created_at: ['created_at', 'createdAt'], updated_at: ['updated_at', 'updatedAt'] }, 'financial_sessions', idx)
    sessionMapped.payload.labor_value = toNumber(sessionMapped.payload.labor_value)
    sessionMapped.payload.labor_quantity = toNumber(sessionMapped.payload.labor_quantity)
    sessions.push(sessionMapped.payload); sessionsIgnored += sessionMapped.ignoredCount

    for (const [itemIdx, itemRow] of asArray<AnyRecord>(sessionRow.items).entries()) {
      const itemMapped = pickMapped(itemRow, { id: ['id'], session_id: ['session_id', 'sessionId'], drink_id: ['drink_id', 'drinkId'], drink_name: ['drink_name', 'nome'], quantity: ['quantity', 'quantidade'], unit_price: ['unit_price', 'precoUnitario'], unit_cost: ['unit_cost', 'custoUnitario'], ingredient_cost: ['ingredient_cost', 'custoInsumo'] }, 'financial_session_items', itemIdx)
      itemMapped.payload.session_id = itemMapped.payload.session_id ?? sessionMapped.payload.id
      itemMapped.payload.quantity = toNumber(itemMapped.payload.quantity, 1)
      itemMapped.payload.unit_price = toNumber(itemMapped.payload.unit_price)
      itemMapped.payload.unit_cost = toNumber(itemMapped.payload.unit_cost)
      itemMapped.payload.ingredient_cost = toNumber(itemMapped.payload.ingredient_cost)
      sessionItems.push(itemMapped.payload); sessionItemsIgnored += itemMapped.ignoredCount
    }
  }

  console.log('\n=== DRY-RUN (sem gravação) ===')
  const preview = {
    drinks: await importByUpsert('drinks', drinks, drinksIgnored, true),
    inventory: await importByUpsert('inventory', inventory, inventoryIgnored, true),
    events: await importByUpsert('events', events, eventsIgnored, true),
    sales: await importByUpsert('sales', sales, salesIgnored, true),
    sales_items: await importByUpsert('sales_items', salesItems, salesItemsIgnored, true),
    financial_sessions: await importByUpsert('financial_sessions', sessions, sessionsIgnored, true),
    financial_session_items: await importByUpsert('financial_session_items', sessionItems, sessionItemsIgnored, true),
  }
  Object.entries(preview).forEach(([table, stat]) => console.log(`${table}: inseridos=${stat.inserted}, atualizados=${stat.updated}, ignorados=${stat.ignored}`))

  const rl = readline.createInterface({ input, output })
  const confirmation = (await rl.question('Digite CONFIRMAR_IMPORTACAO para gravar no Supabase: ')).trim()
  rl.close()
  if (confirmation !== 'CONFIRMAR_IMPORTACAO') return console.log('Importação cancelada. Nenhum dado foi gravado.')

  console.log('\n=== Importação REAL ===')
  const finalStats = [
    ['drinks', await importByUpsert('drinks', drinks, drinksIgnored, false)],
    ['inventory', await importByUpsert('inventory', inventory, inventoryIgnored, false)],
    ['events', await importByUpsert('events', events, eventsIgnored, false)],
    ['sales', await importByUpsert('sales', sales, salesIgnored, false)],
    ['sales_items', await importByUpsert('sales_items', salesItems, salesItemsIgnored, false)],
    ['financial_sessions', await importByUpsert('financial_sessions', sessions, sessionsIgnored, false)],
    ['financial_session_items', await importByUpsert('financial_session_items', sessionItems, sessionItemsIgnored, false)],
  ] as const

  for (const [table, stat] of finalStats) {
    console.log(`${table}: inseridos=${stat.inserted}, atualizados=${stat.updated}, ignorados=${stat.ignored}`)
  }
  console.log('LocalStorage NÃO foi alterado por este script.')
}

run().catch((error) => { console.error('❌ Falha:', error); process.exit(1) })
