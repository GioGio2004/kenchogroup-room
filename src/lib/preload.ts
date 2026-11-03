/*
 * Fetches every asset the opening needs, reporting real byte progress, and
 * hands back blob URLs so nothing loads (or stutters) mid-scene. Images are
 * decoded up front too. A failed fetch falls back to the original URL.
 */
export async function preload(
  srcs: string[],
  onProgress: (progress: number) => void,
  onAsset?: (src: string, url: string) => void,
): Promise<Record<string, string>> {
  const totals = new Map<string, number>()
  const loaded = new Map<string, number>()
  const report = () => {
    let total = 0
    let done = 0
    for (const src of srcs) {
      total += totals.get(src) ?? 300_000
      done += loaded.get(src) ?? 0
    }
    onProgress(Math.min(1, done / total))
  }

  const urls: Record<string, string> = {}

  await Promise.all(
    srcs.map(async (src) => {
      try {
        const res = await fetch(src)
        if (!res.ok || !res.body) throw new Error(`${res.status} ${src}`)
        const length = Number(res.headers.get('content-length'))
        if (length) totals.set(src, length)

        const reader = res.body.getReader()
        const chunks: Uint8Array[] = []
        let got = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          got += value.length
          loaded.set(src, got)
          report()
        }
        totals.set(src, got)

        const type = res.headers.get('content-type') ?? ''
        const url = URL.createObjectURL(new Blob(chunks as BlobPart[], { type }))
        if (type.startsWith('image/')) {
          const img = new Image()
          img.src = url
          await img.decode().catch(() => {})
        }
        urls[src] = url
      } catch {
        urls[src] = src
        totals.set(src, 1)
        loaded.set(src, 1)
      }
      onAsset?.(src, urls[src])
      report()
    }),
  )

  return urls
}
