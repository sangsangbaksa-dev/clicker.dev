"use client"

import { createContext, useContext } from "react"
import type { AuthUser } from "@/domain/entities/board"

export const AuthInitialContext = createContext<AuthUser | null>(null)

export function useAuthInitialUser() {
  return useContext(AuthInitialContext)
}
