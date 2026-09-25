/**
 * Class posting rules — unit + HTTP checks.
 * Run: node scripts/test-class-posting.mjs
 * Requires dev server on http://127.0.0.1:8080
 */

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8080"

const WALDO = "waldo"
function isWaldoAccount(loginId) {
  return loginId.trim().toLowerCase() === WALDO
}
function resolveAccessLevel(user) {
  if (isWaldoAccount(user.loginId)) return "admin"
  if (user.accessLevel === "viewer") return "viewer"
  if (user.accessLevel === "admin") return "admin"
  return "author"
}
function isSiteAdmin(user) {
  return user.status === "approved" && resolveAccessLevel(user) === "admin"
}
function canEditBoard(user) {
  if (user.status !== "approved") return false
  const level = resolveAccessLevel(user)
  return level === "author" || level === "admin"
}
function isRoomMember(room, userId) {
  return room.members.some((m) => m.id === userId)
}
function classCodeForNumber(n) {
  if (n >= 1 && n <= 4) return `BAN${n}`
  return null
}
function isWaldoOwner(user) {
  return user.status === "approved" && isWaldoAccount(user.loginId)
}
function canEditRoomContent(user, room) {
  if (!canEditBoard(user)) return false
  if (isSiteAdmin(user)) return true
  const roomCode = (room.code ?? "").trim().toUpperCase()
  if (user.classN) {
    const homeCode = classCodeForNumber(user.classN)
    if (homeCode) return homeCode === roomCode
  }
  return isRoomMember(room, user.id)
}

function log(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} | ${label}${detail ? " | " + detail : ""}`)
  return ok
}

function parseSetCookie(setCookie) {
  if (!setCookie) return ""
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie]
  return parts.map((c) => c.split(";")[0]).join("; ")
}

async function login(loginId, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, password }),
  })
  const body = await res.json().catch(() => ({}))
  const cookie = parseSetCookie(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie"))
  return { ok: res.ok, status: res.status, body, cookie }
}

async function signup(loginId, name, password, classN, englishLevel = "a", mathLevel = "b") {
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      loginId,
      name,
      password,
      passwordConfirm: password,
      classN,
      englishLevel,
      mathLevel,
    }),
  })
  const body = await res.json().catch(() => ({}))
  const cookie = parseSetCookie(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie"))
  return { ok: res.ok, status: res.status, body, cookie }
}

async function approveUser(waldoCookie, userId) {
  const res = await fetch(`${BASE}/api/auth/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: waldoCookie },
    body: JSON.stringify({ userId }),
  })
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) }
}

async function getRoom(code, cookie) {
  const res = await fetch(`${BASE}/api/rooms/${code}`, {
    headers: { Cookie: cookie },
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

async function putRoom(code, cookie, room, revision) {
  const res = await fetch(`${BASE}/api/rooms/${code}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ room, revision }),
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

async function patchJoin(code, cookie) {
  const res = await fetch(`${BASE}/api/rooms/${code}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ type: "join" }),
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

function runUnitTests() {
  let failed = 0
  const room = {
    code: "BAN1",
    members: [{ id: "u1", name: "A", role: "", color: "", joinedAt: "", lastSeenAt: "" }],
  }
  const member = {
    id: "u1",
    loginId: "a",
    name: "A",
    status: "approved",
    accessLevel: "author",
    classN: 1,
  }
  const outsider = {
    id: "u2",
    loginId: "b",
    name: "B",
    status: "approved",
    accessLevel: "author",
    classN: 2,
  }
  const waldo = { id: "w", loginId: "Waldo", name: "W", status: "approved", accessLevel: "admin" }
  const delegatedAdmin = {
    id: "adm",
    loginId: "admin1",
    name: "Admin",
    status: "approved",
    accessLevel: "admin",
    classN: 2,
  }
  const viewer = {
    id: "u1",
    loginId: "a",
    name: "A",
    status: "approved",
    accessLevel: "viewer",
    classN: 1,
  }
  const viewerOtherClass = {
    id: "u3",
    loginId: "c",
    name: "C",
    status: "approved",
    accessLevel: "viewer",
    classN: 2,
  }

  if (!log("unit isRoomMember", isRoomMember(room, "u1"))) failed++
  if (!log("unit not member", !isRoomMember(room, "u2"))) failed++
  if (!log("unit own class author can edit", canEditRoomContent(member, room))) failed++
  if (!log("unit other class author blocked", !canEditRoomContent(outsider, room))) failed++
  if (!log("unit waldo bypass", canEditRoomContent(waldo, room))) failed++
  if (!log("unit delegated admin other class", canEditRoomContent(delegatedAdmin, room))) failed++
  if (!log("unit own class viewer blocked", !canEditRoomContent(viewer, room))) failed++
  if (!log("unit other class viewer blocked", !canEditRoomContent(viewerOtherClass, room))) failed++
  if (!log("unit isWaldoOwner", isWaldoOwner(waldo))) failed++
  return failed
}

async function runHttpTests() {
  let failed = 0
  const waldoPass = process.env.WALDO_PASSWORD ?? "960398"
  const stamp = Date.now()
  const testId = `post${stamp}`.slice(0, 16)
  const testPass = "pass1111"

  const health = await fetch(BASE).catch(() => null)
  if (!health?.ok) {
    console.log("SKIP | HTTP tests (server not reachable at " + BASE + ")")
    return 0
  }

  const waldo = await login("Waldo", waldoPass)
  if (!waldo.ok) {
    console.log("SKIP | HTTP tests (Waldo login failed — set WALDO_PASSWORD)")
    return 0
  }

  const ban3 = await getRoom("BAN3", waldo.cookie)
  if (ban3.status !== 200 || !ban3.body.room) {
    console.log("FAIL | fetch BAN3 for Waldo test")
    return 1
  }

  const waldoRoom = {
    ...ban3.body.room,
    notes: `${ban3.body.room.notes}\n<!-- waldo-test-${stamp} -->`.trim(),
  }
  const waldoPut = await putRoom("BAN3", waldo.cookie, waldoRoom, ban3.body.room.revision)
  if (!log("API Waldo PUT any class", waldoPut.status === 200, `status ${waldoPut.status}`)) failed++

  const signupRes = await signup(testId, "포스트테스트", testPass, 1)
  if (!signupRes.ok || !signupRes.body.user?.id) {
    console.log("FAIL | signup test user", JSON.stringify(signupRes.body))
    return failed + 1
  }
  if (!log("API signup stores classN", signupRes.body.user.classN === 1)) failed++

  const testUserId = signupRes.body.user.id
  let testCookie = signupRes.cookie

  if (signupRes.body.pending) {
    const approved = await approveUser(waldo.cookie, testUserId)
    if (!approved.ok) {
      console.log("FAIL | approve test user", approved.status)
      return failed + 1
    }
    const relogin = await login(testId, testPass)
    testCookie = relogin.cookie
  }

  const ban1Before = await getRoom("BAN1", testCookie)
  if (ban1Before.status !== 200) {
    console.log("FAIL | fetch BAN1 as test user", ban1Before.status)
    return failed + 1
  }

  const ownClassPut = await putRoom(
    "BAN1",
    testCookie,
    { ...ban1Before.body.room, notes: `own-class-${stamp}` },
    ban1Before.body.room.revision
  )
  if (
    !log(
      "API class-1 author PUT own class BAN1 (no join required)",
      ownClassPut.status === 200,
      `status ${ownClassPut.status}`
    )
  ) {
    failed++
  }

  const joinBan1 = await patchJoin("BAN1", testCookie)
  const joinedRoom = joinBan1.body.room ?? ownClassPut.body.room ?? ban1Before.body.room
  const memberCountAfterJoin =
    joinBan1.body.room?.members?.filter((m) => m.id === testUserId).length ?? 0
  if (!log("API join own class BAN1", memberCountAfterJoin === 1, `members ${memberCountAfterJoin}`)) {
    failed++
  }

  const ban2 = await getRoom("BAN2", testCookie)
  const crossPut = await putRoom(
    "BAN2",
    testCookie,
    { ...ban2.body.room, notes: `cross-${stamp}` },
    ban2.body.room.revision
  )
  if (!log("API class-1 author PUT other class BAN2 → 403", crossPut.status === 403, `status ${crossPut.status}`)) {
    failed++
  }

  const crossJoin = await patchJoin("BAN2", testCookie)
  const crossMembers = crossJoin.body.room?.members ?? crossJoin.body.members ?? []
  const joinedBan2 = crossMembers.some((m) => m.id === testUserId)
  if (!log("API cross-class join blocked", !joinedBan2)) failed++

  const signupNoClass = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      loginId: `nocls${stamp}`.slice(0, 16),
      name: "반없음",
      password: testPass,
      passwordConfirm: testPass,
    }),
  })
  if (!log("API signup without classN → 400", signupNoClass.status === 400, `status ${signupNoClass.status}`)) {
    failed++
  }

  return failed
}

let failed = runUnitTests()
failed += await runHttpTests()
process.exit(failed ? 1 : 0)
