import { GET as schoolNotesGet, PUT as schoolNotesPut } from "@/infrastructure/http/routes/school-notes"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const GET = schoolNotesGet
export const PUT = schoolNotesPut
