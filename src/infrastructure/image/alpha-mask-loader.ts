import { buildAlphaMask, type AlphaMask } from "@/domain/services/clicker-ore-hit"

const cache = new Map<string, Promise<AlphaMask>>()

/** Decode an image once into an alpha mask (offscreen canvas). Cached per URL. */
export function loadAlphaMask(src: string): Promise<AlphaMask> {
  const hit = cache.get(src)
  if (hit) return hit
  const promise = new Promise<AlphaMask>((resolve, reject) => {
    const img = new Image()
    img.decoding = "async"
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) throw new Error("no 2d context")
        ctx.drawImage(img, 0, 0)
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        resolve(buildAlphaMask(data, canvas.width, canvas.height))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error(`mask image failed: ${src}`))
    img.src = src
  })
  promise.catch(() => cache.delete(src))
  cache.set(src, promise)
  return promise
}
