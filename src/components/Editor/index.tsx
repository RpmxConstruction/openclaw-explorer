import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { DataSource } from '../../types'
import { readFile, writeFile } from '../../services/api'

interface EditorProps {
  source: DataSource
  path: string
  onClose: () => void
}

function getLanguageExtension(path: string) {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: ext?.includes('t') })
    case 'json':
      return json()
    case 'md':
      return markdown()
    default:
      return []
  }
}

export default function Editor({ source, path, onClose }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<EditorView | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  
  useEffect(() => {
    loadFile()
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [path])
  
  useEffect(() => {
    if (!containerRef.current || loading) return
    
    if (editorRef.current) editorRef.current.destroy()
    
    const state = EditorState.create({
      doc: content,
      extensions: [
        oneDark,
        getLanguageExtension(path),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': { fontFamily: "'JetBrains Mono', monospace" }
        })
      ]
    })
    
    editorRef.current = new EditorView({ state, parent: containerRef.current })
    
    return () => { if (editorRef.current) editorRef.current.destroy() }
  }, [content, loading])
  
  async function loadFile() {
    setLoading(true)
    setError(null)
    try {
      const text = await readFile(source, path)
      setContent(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }
  
  async function handleSave() {
    if (!editorRef.current) return
    setSaving(true)
    setError(null)
    try {
      const newContent = editorRef.current.state.doc.toString()
      await writeFile(source, path, newContent)
      setContent(newContent)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }
  
  const filename = path.split('/').pop() || path
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[90vw] h-[85vh] max-w-6xl bg-dark-bg border-2 border-neon-purple rounded-lg flex flex-col overflow-hidden shadow-neon-purple">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-neon-purple">f</span>
            <span className="text-gray-200 font-medium">{filename}</span>
            <span className="text-gray-500 text-sm">{path}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={saving || loading} className="px-4 py-1.5 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan rounded hover:bg-neon-cyan/30 transition-all duration-300 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            <button onClick={onClose} className="px-4 py-1.5 border border-gray-600 text-gray-400 rounded hover:border-gray-400 hover:text-white transition-all duration-300">Close</button>
          </div>
        </div>
        {error && <div className="px-4 py-2 bg-red-900/30 border-b border-red-800 text-red-400 text-sm">{error}</div>}
        <div className="flex-1 overflow-hidden">
          {loading ? <div className="h-full flex items-center justify-center"><div className="text-neon-purple animate-pulse">Loading...</div></div> : <div ref={containerRef} className="h-full" />}
        </div>
      </div>
    </div>
  )
}