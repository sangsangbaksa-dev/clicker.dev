"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  ENGLISH_SCHOOL_NOTE_KINDS,
  MATH_SCHOOL_NOTE_KINDS,
  SCHOOL_NOTE_LABELS,
} from "@/domain/services/school-note-kinds"
import {
  notesPanelPermissionHint,
  type BoardNotesScope,
  type SchoolNotesFocus,
  type SchoolNotesSubject,
} from "@/domain/services/notes-scope"
import {
  SUBJECT_NOTE_KINDS,
  SUBJECT_NOTE_LABELS,
} from "@/domain/services/subject-notes"
import type {
  SchoolNoteKind,
  SchoolNotes,
  SubjectNoteKind,
  SubjectNotes,
} from "@/domain/entities/board"
import { memo, useState } from "react"

function ClassSubjectNoteEditor({
  subjectNotes,
  canEdit,
  onChange,
}: {
  subjectNotes: SubjectNotes
  canEdit: boolean
  onChange: (kind: SubjectNoteKind, notes: string) => void
}) {
  const [activeKind, setActiveKind] = useState<SubjectNoteKind>("general")

  return (
    <Tabs
      value={activeKind}
      onValueChange={(value) => setActiveKind(value as SubjectNoteKind)}
    >
      <ScrollArea className="w-full">
        <TabsList className="h-auto w-max min-w-full flex-wrap justify-start gap-1 p-1">
          {SUBJECT_NOTE_KINDS.map((kind) => (
            <TabsTrigger key={kind} value={kind} className="shrink-0 px-2.5">
              {SUBJECT_NOTE_LABELS[kind]}
            </TabsTrigger>
          ))}
        </TabsList>
      </ScrollArea>

      {SUBJECT_NOTE_KINDS.map((kind) => (
        <TabsContent key={kind} value={kind} className="mt-3 space-y-2">
          <NoteTextarea
            label={SUBJECT_NOTE_LABELS[kind]}
            value={subjectNotes[kind]}
            canEdit={canEdit}
            onChange={(value) => onChange(kind, value)}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function SchoolSubjectNoteEditor({
  schoolNotes,
  canEditKind,
  onChange,
  initialFocus,
}: {
  schoolNotes: SchoolNotes
  canEditKind: (kind: SchoolNoteKind) => boolean
  onChange: (kind: SchoolNoteKind, notes: string) => void
  initialFocus?: SchoolNotesFocus | null
}) {
  const initialSubject: SchoolNotesSubject = initialFocus?.subject ?? "english"
  const initialKinds =
    initialSubject === "english" ? ENGLISH_SCHOOL_NOTE_KINDS : MATH_SCHOOL_NOTE_KINDS
  const [subject, setSubject] = useState<SchoolNotesSubject>(initialSubject)
  const kinds = subject === "english" ? ENGLISH_SCHOOL_NOTE_KINDS : MATH_SCHOOL_NOTE_KINDS
  const [activeKind, setActiveKind] = useState<SchoolNoteKind>(
    initialFocus?.kind && initialKinds.includes(initialFocus.kind)
      ? initialFocus.kind
      : initialKinds[0]
  )

  const handleSubjectChange = (next: SchoolNotesSubject) => {
    setSubject(next)
    setActiveKind(next === "english" ? ENGLISH_SCHOOL_NOTE_KINDS[0] : MATH_SCHOOL_NOTE_KINDS[0])
  }

  return (
    <div className="space-y-3">
      <Tabs value={subject} onValueChange={(value) => handleSubjectChange(value as SchoolNotesSubject)}>
        <TabsList>
          <TabsTrigger value="english">영어</TabsTrigger>
          <TabsTrigger value="math">수학</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs
        value={activeKind}
        onValueChange={(value) => setActiveKind(value as SchoolNoteKind)}
      >
        <ScrollArea className="w-full">
          <TabsList className="h-auto w-max min-w-full flex-wrap justify-start gap-1 p-1">
            {kinds.map((kind) => (
              <TabsTrigger key={kind} value={kind} className="shrink-0 px-2.5">
                {SCHOOL_NOTE_LABELS[kind]}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        {kinds.map((kind) => (
          <TabsContent key={kind} value={kind} className="mt-3 space-y-2">
            <NoteTextarea
              label={SCHOOL_NOTE_LABELS[kind]}
              value={schoolNotes[kind]}
              canEdit={canEditKind(kind)}
              onChange={(value) => onChange(kind, value)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function NoteTextarea({
  label,
  value,
  canEdit,
  onChange,
}: {
  label: string
  value: string
  canEdit: boolean
  onChange: (value: string) => void
}) {
  return (
    <>
      <Textarea
        value={value}
        readOnly={!canEdit}
        tabIndex={canEdit ? 0 : -1}
        onFocus={(event) => {
          if (!canEdit) event.currentTarget.blur()
        }}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={
          canEdit ? `${label} 내용` : "수정 권한 없음"
        }
        className={
          canEdit
            ? "min-h-[320px] bg-background text-base leading-7 md:text-base"
            : "min-h-[320px] cursor-default bg-muted/30 text-base leading-7 caret-transparent md:text-base"
        }
      />
      {value.trim().length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {label} 내용 없음
        </p>
      ) : null}
    </>
  )
}

export const NotesPanel = memo(function NotesPanel({
  scope,
  heading,
  hint,
  schoolFocus,
  classNotes,
  schoolNotes,
  canEditClass,
  canEditAnySchoolNote,
  canEditSchoolNote,
  onClassChange,
  onSchoolChange,
}: {
  scope: BoardNotesScope
  heading: string
  hint: string | null
  schoolFocus?: SchoolNotesFocus | null
  classNotes: SubjectNotes
  schoolNotes: SchoolNotes | null
  canEditClass: boolean
  canEditAnySchoolNote: boolean
  canEditSchoolNote: (kind: SchoolNoteKind) => boolean
  onClassChange: (kind: SubjectNoteKind, notes: string) => void
  onSchoolChange: (kind: SchoolNoteKind, notes: string) => void
}) {
  const activeCanEdit = scope === "class" ? canEditClass : canEditAnySchoolNote
  const permissionHint = notesPanelPermissionHint(scope, activeCanEdit)

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-medium">{heading}</h2>
        {hint ? (
          <p className="text-sm leading-6 text-muted-foreground">{hint}</p>
        ) : null}
      </div>

      {scope === "class" ? (
        <ClassSubjectNoteEditor
          subjectNotes={classNotes}
          canEdit={canEditClass}
          onChange={onClassChange}
        />
      ) : schoolNotes ? (
        <SchoolSubjectNoteEditor
          key={`${schoolFocus?.subject ?? "english"}-${schoolFocus?.kind ?? "default"}`}
          schoolNotes={schoolNotes}
          canEditKind={canEditSchoolNote}
          onChange={onSchoolChange}
          initialFocus={schoolFocus}
        />
      ) : (
        <p className="text-sm text-muted-foreground">영어·수학 노트 불러오는 중</p>
      )}

      {permissionHint ? (
        <p className="text-xs text-muted-foreground">{permissionHint}</p>
      ) : null}
    </div>
  )
})
