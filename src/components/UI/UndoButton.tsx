interface UndoButtonProps {
  canUndo: boolean
  onUndo: () => void
}

export default function UndoButton({ canUndo: _canUndo, onUndo: _onUndo }: UndoButtonProps) {
  // Temporarily disabled and hidden
  return null
}
