"use client"

import { useEffect, useState } from "react"
import {
  compareSaveAge,
  formatNumber,
  type BackupChannel,
  type CloudSaveAvailability,
  type ParsedSaveCode,
} from "@/application/clicker-ui"
import { useClickerSaveBackup } from "@/hooks/use-clicker-save-backup"

type Props = {
  onExportCode: () => string | null
  onParseCode: (code: string) => ParsedSaveCode
  onImportJson: (json: string) => boolean
  onImported: () => void
}

type Status = { tone: "ok" | "error"; text: string } | null
type Found = Extract<ParsedSaveCode, { ok: true }>

function when(at: number) {
  if (!at) return "알 수 없음"
  return new Date(at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

/**
 * Settings → 지메일 백업 / 계정 저장.
 * - Mail backup works everywhere (also on the static GitHub Pages preview).
 * - Account save only appears when the server answers /api/clicker/cloud-save; otherwise a notice.
 */
export function ClickerSaveBackup({ onExportCode, onParseCode, onImportJson, onImported }: Props) {
  const { mail, cloud } = useClickerSaveBackup(onParseCode)
  const [recipient, setRecipient] = useState("")
  const [mailStatus, setMailStatus] = useState<Status>(null)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const [mailBusy, setMailBusy] = useState(false)

  const [availability, setAvailability] = useState<CloudSaveAvailability | null>(null)
  const [cloudStatus, setCloudStatus] = useState<Status>(null)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [pulled, setPulled] = useState<{ found: Found; note: string } | null>(null)

  useEffect(() => {
    let alive = true
    void cloud.availability().then((a) => {
      if (alive) setAvailability(a)
    })
    return () => {
      alive = false
    }
  }, [cloud])

  const sendMail = (channel: BackupChannel) => {
    if (mailBusy) return
    setMailBusy(true)
    setFallbackUrl(null)
    const code = onExportCode()
    const parsed = code ? onParseCode(code) : null
    void mail
      .start({ channel, recipient, code, summary: parsed?.ok ? parsed.summary : null })
      .then((out) => {
        if (!out.ok) {
          setMailStatus({ tone: "error", text: out.error })
          return
        }
        if (!out.opened) setFallbackUrl(out.plan.url)
        const parts: string[] = []
        if (out.opened) parts.push(channel === "gmail" ? "Gmail 작성 창을 열었습니다. 내용을 확인하고 직접 '보내기'를 누르세요." : "메일 앱을 열었습니다. 내용을 확인하고 직접 보내세요.")
        else parts.push("작성 창이 차단되었습니다. 아래 링크를 눌러 여세요.")
        if (out.plan.mode === "clipboard") {
          parts.push(
            out.copied
              ? "코드가 길어 클립보드에 복사했습니다 — 본문에 붙여 넣으세요."
              : "코드가 길어 본문에 못 담았습니다.",
          )
          parts.push(out.downloaded ? `파일(${out.plan.fileName})도 내려받았습니다 — 첨부해도 됩니다.` : "파일 저장은 '파일로 저장'을 쓰세요.")
        }
        setMailStatus({ tone: "ok", text: parts.join(" ") })
      })
      .finally(() => setMailBusy(false))
  }

  const pushCloud = () => {
    if (cloudBusy) return
    setCloudBusy(true)
    setPulled(null)
    void cloud
      .push(onExportCode())
      .then((r) => {
        if (r.status === "saved") setCloudStatus({ tone: "ok", text: "계정에 저장했습니다." })
        else if (r.status === "signed-out") setCloudStatus({ tone: "error", text: "로그인이 풀렸습니다. 다시 로그인하세요." })
        else if (r.status === "unavailable") setCloudStatus({ tone: "error", text: "이 배포에서는 계정 저장을 쓸 수 없습니다." })
        else setCloudStatus({ tone: "error", text: r.message })
      })
      .finally(() => setCloudBusy(false))
  }

  const pullCloud = () => {
    if (cloudBusy) return
    setCloudBusy(true)
    setPulled(null)
    void cloud
      .pull()
      .then((r) => {
        if (r.status === "found") {
          const local = onExportCode()
          const localParsed = local ? onParseCode(local) : null
          const age = localParsed?.ok ? compareSaveAge(localParsed.summary.savedAt, r.parsed.summary.savedAt) : "unknown"
          const note =
            age === "local-newer"
              ? "⚠ 이 기기의 진행이 계정 저장본보다 최신입니다."
              : age === "cloud-newer"
                ? "계정 저장본이 더 최신입니다."
                : ""
          setPulled({ found: r.parsed, note })
          setCloudStatus(null)
        } else if (r.status === "empty") setCloudStatus({ tone: "ok", text: "계정에 저장된 진행이 아직 없습니다." })
        else if (r.status === "signed-out") setCloudStatus({ tone: "error", text: "로그인이 풀렸습니다. 다시 로그인하세요." })
        else if (r.status === "unavailable") setCloudStatus({ tone: "error", text: "이 배포에서는 계정 저장을 쓸 수 없습니다." })
        else if (r.status === "error") setCloudStatus({ tone: "error", text: r.message })
      })
      .finally(() => setCloudBusy(false))
  }

  const confirmPull = () => {
    if (!pulled) return
    if (!onImportJson(pulled.found.json)) {
      setCloudStatus({ tone: "error", text: "브라우저 저장소에 쓸 수 없어 불러오지 못했습니다. 현재 진행은 그대로입니다." })
      return
    }
    setPulled(null)
    onImported()
  }

  return (
    <>
      <section className="clicker-save-transfer" aria-labelledby="clicker-mail-backup-title">
        <div className="clicker-settings-copy">
          <strong id="clicker-mail-backup-title">지메일로 백업</strong>
          <p>저장 코드를 담은 메일 작성 창을 엽니다. 내용을 확인하고 직접 보내야 전송됩니다. 받은 메일의 코드는 위 ‘불러오기’ 칸에 메일 본문째 붙여 넣어도 됩니다.</p>
        </div>
        <label className="clicker-save-transfer-label" htmlFor="clicker-mail-backup-to">
          받는 사람 (비워 두면 메일 창에서 입력)
        </label>
        <input
          id="clicker-mail-backup-to"
          className="clicker-save-transfer-input clicker-save-backup-to"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          autoCapitalize="off"
          placeholder="me@gmail.com"
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value)
            setMailStatus(null)
          }}
        />
        <div className="clicker-save-transfer-actions">
          <button type="button" className="clicker-settings-toggle is-on" disabled={mailBusy} onClick={() => sendMail("gmail")}>
            Gmail로 보내기
          </button>
          <button type="button" className="clicker-settings-toggle" disabled={mailBusy} onClick={() => sendMail("mailto")}>
            메일 앱으로
          </button>
        </div>
        {fallbackUrl ? (
          <a className="clicker-save-backup-link" href={fallbackUrl} target="_blank" rel="noopener noreferrer">
            메일 작성 창 열기
          </a>
        ) : null}
        <p
          className={`clicker-save-transfer-status${mailStatus?.tone === "error" ? " is-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {mailStatus?.text ?? ""}
        </p>
      </section>

      <section className="clicker-save-transfer" aria-labelledby="clicker-cloud-save-title">
        <div className="clicker-settings-copy">
          <strong id="clicker-cloud-save-title">구글 계정에 저장</strong>
          {availability === null ? (
            <p>확인 중…</p>
          ) : availability.state === "unavailable" ? (
            <p>이 주소에는 계정 저장 서버가 없어 쓸 수 없습니다(정적 미리보기). 위의 지메일 백업이나 저장 코드를 쓰세요.</p>
          ) : availability.state === "signed-out" ? (
            <p>구글 계정으로 로그인하면 진행을 서버에 저장하고 다른 기기에서 불러올 수 있습니다.</p>
          ) : (
            <p>{availability.email ? `${availability.email} 계정으로 로그인됨.` : "로그인됨."} 저장과 불러오기는 직접 눌러야 실행됩니다.</p>
          )}
        </div>
        {availability?.state === "signed-out" ? (
          <div className="clicker-save-transfer-actions">
            <a className="clicker-settings-toggle clicker-save-backup-link" href={availability.signInUrl}>
              구글로 로그인
            </a>
          </div>
        ) : null}
        {availability?.state === "signed-in" ? (
          <div className="clicker-save-transfer-actions">
            <button type="button" className="clicker-settings-toggle is-on" disabled={cloudBusy} onClick={pushCloud}>
              계정에 저장
            </button>
            <button type="button" className="clicker-settings-toggle" disabled={cloudBusy} onClick={pullCloud}>
              계정에서 불러오기
            </button>
          </div>
        ) : null}
        {pulled ? (
          <div className="clicker-save-transfer-confirm" role="alert">
            <p>
              <strong>계정 저장본으로 바꿀까요?</strong> 보유 CORE {formatNumber(pulled.found.summary.coreEnergy)} · 누적{" "}
              {formatNumber(pulled.found.summary.totalCoreEnergy)} · 환생 {pulled.found.summary.rebirthCount}회 · 저장{" "}
              {when(pulled.found.summary.savedAt)}
            </p>
            {pulled.note ? <p>{pulled.note}</p> : null}
            <p>지금 이 기기의 진행은 덮어써집니다(백업 1개는 브라우저에 남겨 둡니다).</p>
            <div className="clicker-save-transfer-actions">
              <button type="button" className="clicker-settings-toggle is-on" onClick={confirmPull}>
                덮어쓰고 불러오기
              </button>
              <button type="button" className="clicker-settings-toggle" onClick={() => setPulled(null)}>
                취소
              </button>
            </div>
          </div>
        ) : null}
        <p
          className={`clicker-save-transfer-status${cloudStatus?.tone === "error" ? " is-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {cloudStatus?.text ?? ""}
        </p>
      </section>
    </>
  )
}
