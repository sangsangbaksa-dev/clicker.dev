import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../data/clicker/catalog.ts"
import { createInitialSave } from "../domain/services/clicker-engine.ts"
import { encodeClickerSave } from "../domain/services/clicker-save-codec.ts"
import { encodeSaveCode, parseSaveCode } from "../domain/services/clicker-save-transfer.ts"
import type { SaveRepository } from "./clicker-backup-ports.ts"
import { CloudSaveService, MailBackupService, parseSavePaste } from "./clicker-gmail-backup.ts"

const NOW = 1_700_000_000_000
const parse = (c: string) => parseSaveCode(c, clickerConfig, NOW)
const makeCode = (core = 321) => {
  const s = createInitialSave(NOW, clickerConfig)
  s.runState.coreEnergy = core
  return encodeSaveCode(encodeClickerSave(s).json)
}

function mailDeps(opts: { opened?: boolean; copied?: boolean } = {}) {
  const calls: string[] = []
  const deps = {
    mail: { open: (url: string, ch: string) => (calls.push(`open:${ch}:${url.length}`), opts.opened ?? true) },
    clipboard: { writeText: async (t: string) => (calls.push(`copy:${t.length}`), opts.copied ?? true) },
    files: { download: (n: string) => (calls.push(`file:${n}`), true) },
    now: () => NOW,
  }
  return { deps, calls }
}

test("parseSavePaste accepts a bare code and a whole mail body", () => {
  const code = makeCode(55)
  const bare = parseSavePaste(code, parse)
  assert.ok(bare.ok && bare.summary.coreEnergy === 55)
  const mail = `안녕\n\n복원: ...\n\n${code.slice(0, 40)}\n${code.slice(40)}\n\n※ 코드에는 게임 진행 데이터만`
  const found = parseSavePaste(mail, parse)
  assert.ok(found.ok && found.summary.coreEnergy === 55)
})

test("parseSavePaste keeps the original error when nothing is readable", () => {
  const r = parseSavePaste("hello", parse)
  assert.equal(r.ok, false)
  const bad = parseSavePaste("mail text AURELIA1.!!!", parse)
  assert.equal(bad.ok, false)
})

test("mail backup: short code opens the window only", async () => {
  const { deps, calls } = mailDeps()
  const out = await new MailBackupService(deps).start({ channel: "gmail", recipient: "me@gmail.com", code: makeCode(), summary: null })
  assert.ok(out.ok && out.plan.mode === "inline" && out.opened && !out.copied && !out.downloaded)
  assert.equal(calls.length, 1)
  assert.ok(calls[0].startsWith("open:gmail:"))
})

test("mail backup: long code copies, downloads and opens (open runs before the clipboard await)", async () => {
  const { deps, calls } = mailDeps()
  const out = await new MailBackupService(deps).start({ channel: "gmail", recipient: "", code: "AURELIA1." + "Z".repeat(9000), summary: null })
  assert.ok(out.ok && out.plan.mode === "clipboard" && out.copied && out.downloaded)
  assert.deepEqual(calls.map((c) => c.split(":")[0]), ["copy", "file", "open"])
})

test("mail backup: bad recipient or missing code is refused without side effects", async () => {
  const { deps, calls } = mailDeps()
  const svc = new MailBackupService(deps)
  assert.equal((await svc.start({ channel: "gmail", recipient: "a@b.co,c@d.co", code: makeCode(), summary: null })).ok, false)
  assert.equal((await svc.start({ channel: "gmail", recipient: "", code: null, summary: null })).ok, false)
  assert.equal(calls.length, 0)
})

test("mail backup: blocked popup is reported", async () => {
  const { deps } = mailDeps({ opened: false })
  const out = await new MailBackupService(deps).start({ channel: "gmail", recipient: "", code: makeCode(), summary: null })
  assert.ok(out.ok && !out.opened)
})

function repo(over: Partial<SaveRepository> = {}): SaveRepository {
  return {
    availability: async () => ({ state: "signed-in", email: "me@gmail.com" }),
    load: async () => ({ status: "empty" }),
    save: async () => ({ status: "saved", updatedAt: 9 }),
    ...over,
  }
}

test("cloud: push validates the code before calling the repository", async () => {
  let saved = 0
  const svc = new CloudSaveService(repo({ save: async () => (saved++, { status: "saved", updatedAt: 1 }) }), parse)
  assert.equal((await svc.push(null)).status, "error")
  assert.equal((await svc.push("garbage")).status, "error")
  assert.equal(saved, 0)
  assert.equal((await svc.push(makeCode())).status, "saved")
  assert.equal(saved, 1)
})

test("cloud: pull parses the stored code; unreadable data is an error, not an import", async () => {
  const good = new CloudSaveService(repo({ load: async () => ({ status: "found", record: { code: makeCode(88), savedAt: 1, updatedAt: 2 } }) }), parse)
  const r = await good.pull()
  assert.ok(r.status === "found" && r.parsed.summary.coreEnergy === 88)
  const bad = new CloudSaveService(repo({ load: async () => ({ status: "found", record: { code: "nope", savedAt: 1, updatedAt: 2 } }) }), parse)
  assert.equal((await bad.pull()).status, "error")
  const throwing = new CloudSaveService(repo({ load: async () => { throw new Error("x") }, availability: async () => { throw new Error("x") } }), parse)
  assert.equal((await throwing.pull()).status, "error")
  assert.deepEqual(await throwing.availability(), { state: "unavailable" })
})
