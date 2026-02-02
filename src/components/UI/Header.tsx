import { DataSource } from '../../types'

interface HeaderProps {
  source: DataSource
  onSourceChange: (source: DataSource) => void
}

export default function Header({ source, onSourceChange }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
      <h1 className="text-2xl font-bold">
        <span className="text-neon-cyan">Open</span>
        <span className="text-neon-purple">Claw</span>
        <span className="text-gray-400 ml-2">Explorer</span>
      </h1>
      
      <div className="flex items-center gap-4">
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          <button
            onClick={() => onSourceChange('node')}
            className={`px-4 py-2 text-sm transition-all duration-300 ${
              source === 'node'
                ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            NODE
          </button>
          <button
            onClick={() => onSourceChange('gateway')}
            className={`px-4 py-2 text-sm transition-all duration-300 ${
              source === 'gateway'
                ? 'bg-neon-purple/20 text-neon-purple border-neon-purple'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            GATEWAY
          </button>
        </div>
      </div>
    </header>
  )
}
