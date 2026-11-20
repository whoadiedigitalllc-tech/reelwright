// Parse what `ffmpeg -i` prints, the same facts ffprobe gives the desktop app.
export function parseProbe(log: string) {
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(log)
  const duration = d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : NaN
  const vline = log.split('\n').find((l) => /Stream #.*: Video:/.test(l) && !/attached pic/.test(l))
  const size = vline && /, (\d{2,5})x(\d{2,5})/.exec(vline)
  return { duration, video: !!vline, width: size ? +size[1] : undefined, height: size ? +size[2] : undefined, audio: /Stream #.*: Audio:/.test(log) }
}
