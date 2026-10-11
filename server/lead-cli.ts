import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LeadStore, LeadStoreError } from './leads.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = existsSync(path.join(here, '..', 'team.example.json')) ? path.join(here, '..') : path.join(here, '..', '..')
const dataDir = process.env.OPENGROKBOT_DATA ? path.resolve(process.env.OPENGROKBOT_DATA) : path.join(root, 'data')
const store = new LeadStore(dataDir)

function usage(): never {
  console.error('Usage: node dist/server/lead-cli.js import <json-file> [--limit <count>] | export [csv-file] | list')
  process.exit(2)
}

const command = process.argv[2]

try {
  if (command === 'import') {
    const file = process.argv[3]
    if (!file) usage()
    const args = process.argv.slice(4)
    const limitIndex = args.indexOf('--limit')
    if (args.length !== 0 && (limitIndex !== 0 || args.length !== 2)) usage()
    const limit = limitIndex === -1 ? undefined : Number(args[1])
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new LeadStoreError('--limit must be a positive whole number')
    const full = path.resolve(file)
    if (!existsSync(full)) throw new LeadStoreError(`Input file not found: ${full}`)
    const result = store.import(JSON.parse(readFileSync(full, 'utf8')) as unknown, limit)
    console.log(JSON.stringify({ ...result, database: store.file }, null, 2))
  } else if (command === 'export') {
    const target = process.argv[3] ? path.resolve(process.argv[3] as string) : undefined
    console.log(store.exportCsv(target))
  } else if (command === 'list') {
    console.log(JSON.stringify({ summary: store.summary(), leads: store.list() }, null, 2))
  } else {
    usage()
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
