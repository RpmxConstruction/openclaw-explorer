import { DataSource, FileSystemItem } from '../types'

const BASE_URLS: Record<DataSource, string> = {
  node: '/api',
  gateway: '/api/gateway'
}

export async function fetchTree(source: DataSource, path: string): Promise<FileSystemItem[]> {
  const base = BASE_URLS[source]
  const url = `${base}/tree?path=${encodeURIComponent(path)}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Failed to fetch tree')
  }
  return res.json()
}

export async function readFile(source: DataSource, path: string): Promise<string> {
  const base = BASE_URLS[source]
  const url = `${base}/read?path=${encodeURIComponent(path)}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Failed to read file')
  }
  const data = await res.json()
  return data.content
}

export async function writeFile(source: DataSource, path: string, content: string): Promise<void> {
  const base = BASE_URLS[source]
  const res = await fetch(`${base}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Failed to write file')
  }
}