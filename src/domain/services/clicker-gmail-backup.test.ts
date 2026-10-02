import assert from "node:assert/strict"
import test from "node:test"
import {
  GMAIL_URL_LIMIT,
  MAILTO_URL_LIMIT,
  backupFileName,
  backupSubject,
  buildGmailComposeUrl,
  buildMailtoUrl,
  checkRecipient,
  planBackup,
} from "./clicker-gmail-backup.ts"

const NOW = new Date(2026, 9, 1, 9, 5).getTime()
const summary = { coreEnergy: 1500, totalCoreEnergy: 20000, rebirthCount: 2, savedAt: NOW }

test("recipient: empty is allowed, one plain address is trimmed", () => {
  assert.deepEqual(checkRecipient(""), { ok: true, address: "" })
  assert.deepEqual(checkRecipient("  me@gmail.com "), { ok: true, address: "me@gmail.com" })
})

test("recipient: multiple addresses, headers and junk are refused", () => {
  for (const bad of ["a@b.co,c@d.co", "a@b.co;c@d.co", "a@b.co c@d.co", "a@b.co\nbcc:x@y.zz", "Me <a@b.co>", "nope", "a@b", "@b.co", "a@@b.co"]) {
    assert.equal(checkRecipient(bad).ok, false, bad)
  }
})

test("gmail url has view=cm, fs=1, encoded subject/body and optional to", () => {
  const url = buildGmailComposeUrl({ to: "me@gmail.com", subject: "백업 & 코드", body: "a\nb c" })
  const u = new URL(url)
  assert.equal(u.origin + u.pathname, "https://mail.google.com/mail/")
  assert.equal(u.searchParams.get("view"), "cm")
  assert.equal(u.searchParams.get("fs"), "1")
  assert.equal(u.searchParams.get("to"), "me@gmail.com")
  assert.equal(u.searchParams.get("su"), "백업 & 코드")
  assert.equal(u.searchParams.get("body"), "a\nb c")
  assert.equal(new URL(buildGmailComposeUrl({ to: "", subject: "s", body: "b" })).searchParams.has("to"), false)
})

test("mailto url keeps @ readable and encodes the body", () => {
  const url = buildMailtoUrl({ to: "me@gmail.com", subject: "s p", body: "x\ny&z" })
  assert.ok(url.startsWith("mailto:me@gmail.com?subject=s%20p&body="))
  assert.ok(url.endsWith("x%0Ay%26z"))
  assert.ok(buildMailtoUrl({ to: "", subject: "s", body: "b" }).startsWith("mailto:?subject="))
})

test("short code goes inline in the mail body", () => {
  const code = "AURELIA1." + "A".repeat(200)
  const plan = planBackup({ channel: "gmail", to: "", code, summary, now: NOW })
  assert.equal(plan.mode, "inline")
  assert.ok(new URL(plan.url).searchParams.get("body")?.includes(code))
  assert.ok(plan.url.length <= GMAIL_URL_LIMIT)
})

test("long code falls back to clipboard + file and stays out of the URL", () => {
  const code = "AURELIA1." + "B".repeat(9000)
  const plan = planBackup({ channel: "gmail", to: "me@gmail.com", code, summary, now: NOW })
  assert.equal(plan.mode, "clipboard")
  assert.equal(plan.code, code)
  assert.ok(plan.url.length <= GMAIL_URL_LIMIT)
  assert.ok(!plan.url.includes("BBBBBBBB"))
  assert.ok(new URL(plan.url).searchParams.get("body")?.includes(plan.fileName))
})

test("mailto switches to the fallback much earlier than gmail", () => {
  const code = "AURELIA1." + "C".repeat(2500)
  assert.equal(planBackup({ channel: "gmail", to: "", code, summary, now: NOW }).mode, "inline")
  const m = planBackup({ channel: "mailto", to: "", code, summary, now: NOW })
  assert.equal(m.mode, "clipboard")
  assert.ok(m.url.length <= MAILTO_URL_LIMIT)
})

test("subject and file name carry a local timestamp; summary is in the body", () => {
  assert.equal(backupSubject(NOW), "[Aurelia Core] 세이브 백업 2026-10-01 09:05")
  assert.equal(backupFileName(NOW), "aurelia-core-backup-20261001-0905.txt")
  const plan = planBackup({ channel: "gmail", to: "", code: "AURELIA1.abc", summary, now: NOW })
  const body = new URL(plan.url).searchParams.get("body") ?? ""
  assert.ok(body.includes("환생 2회"))
})
