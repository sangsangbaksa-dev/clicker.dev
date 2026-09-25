export type LayerStatus = "hit" | "miss" | "error" | "skip"

export type LayerRead<T> = {
  status: LayerStatus
  value: T | null
}

export type SharedBlobInfo = {
  pathname: string
  url: string
  uploadedAt: string
  size: number
}
