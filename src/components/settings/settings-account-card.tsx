"use client"

import { UserHandle } from "@/components/user/user-handle"
import { SettingsProfileForm } from "@/components/settings/settings-profile-form"
import { SettingsLogoutButton } from "@/components/settings/settings-logout-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { displayAccessLabel } from "@/domain/services/access-level"
import { classFromNumber } from "@/shared/classes"
import { formatUserSchoolLevels } from "@/domain/services/school-note-kinds"
import type { AuthUser } from "@/domain/entities/board"

export function SettingsAccountCard({ initialUser }: { initialUser: AuthUser }) {
  const { user: sessionUser } = useAuth()
  const user = sessionUser ?? initialUser
  const classLabel = user.classN ? classFromNumber(user.classN)?.label : null
  const schoolLevels = formatUserSchoolLevels(user)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
        <CardDescription>
          <UserHandle loginId={user.loginId} />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid gap-3">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">등급</dt>
            <dd className="font-medium">{displayAccessLabel(user)}</dd>
          </div>
          {classLabel ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">반</dt>
              <dd className="font-medium">{classLabel}</dd>
            </div>
          ) : null}
          {schoolLevels ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">영어·수학</dt>
              <dd className="text-right font-medium">{schoolLevels}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">상태</dt>
            <dd className="font-medium">승인됨</dd>
          </div>
        </dl>

        <SettingsProfileForm user={user} />

        <SettingsLogoutButton />
      </CardContent>
    </Card>
  )
}
