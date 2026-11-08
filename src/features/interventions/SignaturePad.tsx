import { useRef, useState, type PointerEvent } from 'react'
import { Button } from '@/components/ui'

export function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const rect = canvas.getBoundingClientRect()
    return { context, x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }
  }

  function begin(event: PointerEvent<HTMLCanvasElement>) {
    const position = point(event)
    if (!position) return
    event.currentTarget.setPointerCapture(event.pointerId)
    position.context.beginPath()
    position.context.moveTo(position.x, position.y)
    setDrawing(true)
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return
    const position = point(event)
    if (!position) return
    position.context.lineWidth = 2
    position.context.lineCap = 'round'
    position.context.strokeStyle = '#0B1F3A'
    position.context.lineTo(position.x, position.y)
    position.context.stroke()
  }

  function finish() {
    setDrawing(false)
    const canvas = canvasRef.current
    if (canvas) onChange(canvas.toDataURL('image/jpeg', 0.7))
  }

  function clear() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return <div className="space-y-2">
    <canvas
      ref={canvasRef}
      width={900}
      height={280}
      aria-label="Zone de signature du client"
      className="h-36 w-full touch-none rounded-xl border border-dashed border-slate-300 bg-white"
      onPointerDown={begin}
      onPointerMove={draw}
      onPointerUp={finish}
      onPointerCancel={finish}
    />
    <Button type="button" size="sm" variant="outline" onClick={clear}>Effacer la signature</Button>
  </div>
}
