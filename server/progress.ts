import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Progress lives in data/ next to the project (gitignored), one JSON file per store name. */
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')
const KEEP_BACKUPS = 14

const safe = (name: string) => name.replace(/[^a-z0-9_-]/gi, '_')
const fileOf = (name: string) => join(DIR, `${safe(name)}.json`)

export async function loadProgress(name: string): Promise<string | null> {
  try {
    return await readFile(fileOf(name), 'utf8')
  } catch {
    return null
  }
}

/** Atomic write (tmp + rename) plus one backup per day, last KEEP_BACKUPS days kept. */
export async function saveProgress(name: string, body: string): Promise<void> {
  JSON.parse(body) // refuse garbage instead of overwriting good progress
  await mkdir(join(DIR, 'backups'), { recursive: true })
  const file = fileOf(name)
  const tmp = `${file}.tmp`
  await writeFile(tmp, body)
  await rename(tmp, file)
  const day = new Date().toISOString().slice(0, 10)
  const backup = join(DIR, 'backups', `${safe(name)}-${day}.json`)
  await writeFile(backup, body)
  const old = (await readdir(join(DIR, 'backups'))).filter((f) => f.startsWith(`${safe(name)}-`)).sort()
  for (const f of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) await rm(join(DIR, 'backups', f))
}
