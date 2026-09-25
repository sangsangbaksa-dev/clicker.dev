/**
 * GET a same-origin JSON API without caching. A non-2xx reply throws the API's
 * `error` message, or `fallbackError` when it gave none.
 */
export async function getJson<T>(url: string, fallbackError: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" })
  const payload = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? fallbackError)
  return payload
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
