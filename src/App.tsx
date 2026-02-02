import { useState, useEffect } from 'react'
import { fetchTree } from './services/api'
import { FileSystemItem, DataSource } from './types'
import Header from './components/UI/Header'
import UndoButton from './components/UI/UndoButton'
import TreeView from './components/TreeView'
import Editor from './components/Editor'

export default function App() {
  const [source, setSource] = useState<DataSource>('node')
  const [rootItems, setRootItems] = useState<FileSystemItem[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [childrenMap, setChildrenMap] = useState<Map<string, FileSystemItem[]>>(new Map())
  const [navStack, setNavStack] = useState<string[]>([])
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastExpandedPath, setLastExpandedPath] = useState<string | null>(null)

  useEffect(() => { loadRoot() }, [source])

  async function loadRoot() {
    setLoading(true)
    setError(null)
    setExpandedPaths(new Set())
    setChildrenMap(new Map())
    setNavStack([])
    try {
      const items = await fetchTree(source, '')
      setRootItems(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function handleExpand(path: string) {
    if (expandedPaths.has(path)) {
      const newExpanded = new Set(expandedPaths)
      newExpanded.delete(path)
      setExpandedPaths(newExpanded)
      return
    }
    try {
      const children = await fetchTree(source, path)
      setChildrenMap(new Map(childrenMap).set(path, children))
      setExpandedPaths(new Set(expandedPaths).add(path))
      setNavStack([...navStack, path])
      setLastExpandedPath(path)
    } catch (e) {
      console.error('Failed to expand:', e)
    }
  }

  function handleUndo() {
    if (navStack.length === 0) return
    const newStack = [...navStack]
    const lastPath = newStack.pop()!
    const newExpanded = new Set(expandedPaths)
    newExpanded.delete(lastPath)
    setExpandedPaths(newExpanded)
    setNavStack(newStack)
  }

  function handleFileClick(path: string) { setEditingFile(path) }

  return (
    <div className="h-full flex flex-col">
      <Header source={source} onSourceChange={setSource} />
      <div className="flex-1 overflow-hidden relative">
        {loading && <div className="absolute inset-0 flex items-center justify-center"><div className="text-neon-cyan animate-pulse text-xl">Loading...</div></div>}
        {error && <div className="absolute inset-0 flex items-center justify-center"><div className="text-red-500 text-xl">{error}</div></div>}
        {!loading && !error && <TreeView rootItems={rootItems} expandedPaths={expandedPaths} childrenMap={childrenMap} onExpand={handleExpand} onFileClick={handleFileClick} lastExpandedPath={lastExpandedPath} />}
      </div>
      {editingFile && <Editor source={source} path={editingFile} onClose={() => setEditingFile(null)} />}
      <UndoButton canUndo={navStack.length > 0} onUndo={handleUndo} />
    </div>
  )
}
