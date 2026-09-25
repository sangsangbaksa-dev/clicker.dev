import { classFromCode } from "@/shared/classes"
import { redirect } from "next/navigation"

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const cls = classFromCode(code)
  if (cls) redirect(`/ban/${cls.n}`)
  redirect("/")
}
