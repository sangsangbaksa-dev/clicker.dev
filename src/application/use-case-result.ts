/** Framework-free use case result (no next/server import so it stays unit-testable). */
export type UseCaseResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string; conflict?: boolean; payload?: unknown }

export const ok = <T>(value: T): UseCaseResult<T> => ({ ok: true, value })

export const fail = <T>(
  status: number,
  error: string,
  extra?: { conflict?: boolean; payload?: unknown }
): UseCaseResult<T> => ({ ok: false, status, error, ...extra })
