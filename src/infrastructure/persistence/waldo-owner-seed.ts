import type { StoredUser } from "@/domain/entities/user"

/** Bundled owner account so empty deploys still have Waldo. */
export const WALDO_OWNER_SEED: StoredUser = {
  id: "usr_c9168093-eb65-454d-9777-791c081b9cf2",
  loginId: "Waldo",
  name: "이찬형",
  passwordHash:
    "$2b$10$TRhh95nmsj4Nc7d1HoLHFuk9GR1YiKS/fZXPeB14PThEbY30Oq2W6",
  status: "approved",
  createdAt: "2026-09-09T10:25:31.346Z",
  approvedBy: "usr_c9168093-eb65-454d-9777-791c081b9cf2",
  approvedAt: "2026-09-09T10:25:31.541Z",
  accessLevel: "admin",
  classN: 1,
  englishLevel: "a",
  mathLevel: "s",
}

export function withWaldoOwnerIndex(index: Record<string, string>): Record<string, string> {
  if (index.waldo) return index
  return { ...index, waldo: WALDO_OWNER_SEED.id }
}
