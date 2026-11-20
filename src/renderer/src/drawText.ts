import type { TextClip } from '../../shared/schema'

// One text clip onto a canvas of the project's size. Used by the preview and by the web export
// (which renders it to a PNG), so exported text is pixel-for-pixel what the preview shows.
export function drawText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  c: TextClip,
  W: number,
  H: number,
  alpha: number
) {
  const size = c.size * c.transform.scale
  const lines = c.text.split('\n')
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `${size}px "${c.font}"`
  ctx.fillStyle = c.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lh = size * 1.2
  lines.forEach((line, i) => ctx.fillText(line, W / 2 + c.transform.x, H / 2 + c.transform.y + (i - (lines.length - 1) / 2) * lh))
  ctx.restore()
}
