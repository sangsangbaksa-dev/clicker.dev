/**
 * Class 조 + member-only documents. Run: node scripts/test-class-groups.mjs
 * Needs the local app on http://127.0.0.1:8080
 */

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8080"
const waldoPass = process.env.WALDO_PASSWORD ?? "960398"

function parseSetCookie(setCookie) {
  if (!setCookie) return ""
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie]
  return parts.map((item) => item.split(";")[0]).join("; ")
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId: "Waldo", password: waldoPass }),
  })
  const body = await res.json().catch(() => ({}))
  const cookie = parseSetCookie(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie"))
  return { ok: res.ok, status: res.status, body, cookie }
}

function log(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} | ${label}${detail ? " | " + detail : ""}`)
  return ok
}

async function main() {
  let failed = 0
  const session = await login()
  if (!session.ok) {
    log("login", false, `status ${session.status}`)
    process.exit(1)
  }
  const waldoId = session.body.user?.id ?? ""

  const rosterRes = await fetch(`${BASE}/api/classes/roster?code=BAN1`, {
    headers: { Cookie: session.cookie },
    cache: "no-store",
  })
  const rosterBody = await rosterRes.json().catch(() => ({}))
  if (!log("roster", rosterRes.status === 200 && Array.isArray(rosterBody.roster))) failed += 1

  const getRes = await fetch(`${BASE}/api/rooms/BAN1`, {
    headers: { Cookie: session.cookie },
    cache: "no-store",
  })
  const got = await getRes.json().catch(() => ({}))
  const room = got.room
  if (!room) {
    log("get BAN1", false)
    process.exit(1)
  }
  const previousGroups = room.groups ?? []
  const stamp = `grp_test_${Date.now()}`
  const outsiderId = (rosterBody.roster ?? []).find((person) => person.id && person.id !== waldoId)?.id
  const nextRoom = {
    ...room,
    groups: [
      {
        id: stamp,
        n: 1,
        name: "시험",
        memberIds: outsiderId ? [outsiderId] : waldoId ? [waldoId] : [],
        createdAt: new Date().toISOString(),
      },
    ],
  }
  const putRes = await fetch(`${BASE}/api/rooms/BAN1`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: session.cookie },
    body: JSON.stringify({ room: nextRoom, revision: room.revision }),
  })
  const putBody = await putRes.json().catch(() => ({}))
  const saved = putBody.room?.groups?.[0]
  if (
    !log(
      "save 조",
      putRes.status === 200 && saved?.name === "시험" && saved?.n === 1 && !("leaderId" in (saved ?? {})),
      `status ${putRes.status}`
    )
  ) {
    failed += 1
  }
  if (
    !log(
      "board hides papers and chat",
      (!saved?.documents || saved.documents.length === 0) &&
        (!saved?.messages || saved.messages.length === 0)
    )
  ) {
    failed += 1
  }

  const listed = await fetch(`${BASE}/api/rooms/BAN1/groups/${stamp}/documents`, {
    headers: { Cookie: session.cookie },
    cache: "no-store",
  })
  const listedBody = await listed.json().catch(() => ({}))
  const paper = listedBody.documents?.[0]
  if (
    !log(
      "admin can open 조 문서",
      listed.status === 200 && Boolean(paper?.id),
      `status ${listed.status}`
    )
  ) {
    failed += 1
  }

  const savedDoc = await fetch(
    `${BASE}/api/rooms/BAN1/groups/${stamp}/documents/${encodeURIComponent(paper?.id ?? "missing")}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: session.cookie },
      body: JSON.stringify({
        title: "실험 계획",
        body: "가설을 적는다",
        revision: paper?.revision ?? 1,
      }),
    }
  )
  const savedDocBody = await savedDoc.json().catch(() => ({}))
  if (
    !log(
      "save 조 문서",
      savedDoc.status === 200 &&
        savedDocBody.documents?.some((item) => item.title === "실험 계획" && item.body === "가설을 적는다"),
      `status ${savedDoc.status}`
    )
  ) {
    failed += 1
  }

  const clobberGet = await fetch(`${BASE}/api/rooms/BAN1`, {
    headers: { Cookie: session.cookie },
    cache: "no-store",
  })
  const clobberGot = await clobberGet.json().catch(() => ({}))
  const latest = clobberGot.room
  if (!latest) {
    log("reload BAN1 after 문서", false)
    failed += 1
  }
  const clobber = await fetch(`${BASE}/api/rooms/BAN1`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: session.cookie },
    body: JSON.stringify({
      room: {
        ...latest,
        groups: [
          {
            id: stamp,
            n: 1,
            name: "시험",
            memberIds: waldoId ? [waldoId] : saved?.memberIds ?? [],
            createdAt: saved?.createdAt,
            documents: [],
          },
        ],
      },
      revision: latest?.revision,
    }),
  })
  const clobberBody = await clobber.json().catch(() => ({}))
  if (!log("membership save after 문서", clobber.status === 200, `status ${clobber.status}`)) {
    failed += 1
  }

  const after = await fetch(`${BASE}/api/rooms/BAN1/groups/${stamp}/documents`, {
    headers: { Cookie: session.cookie },
    cache: "no-store",
  })
  const afterBody = await after.json().catch(() => ({}))
  if (
    !log(
      "명단 PUT does not wipe 문서",
      after.status === 200 &&
        afterBody.documents?.some((item) => item.title === "실험 계획" && item.body === "가설을 적는다")
    )
  ) {
    failed += 1
  }

  const posted = await fetch(`${BASE}/api/rooms/BAN1/groups/${stamp}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: session.cookie },
    body: JSON.stringify({ body: "숙제 확인" }),
  })
  const postedBody = await posted.json().catch(() => ({}))
  if (
    !log(
      "send 조 대화",
      posted.status === 200 && postedBody.messages?.some((item) => item.body === "숙제 확인"),
      `status ${posted.status}`
    )
  ) {
    failed += 1
  }

  const live = await fetch(`${BASE}/api/rooms/BAN1/groups/${stamp}/live`, {
    headers: { Cookie: session.cookie },
    cache: "no-store",
  })
  const liveBody = await live.json().catch(() => ({}))
  if (
    !log(
      "live has 문서 and 대화",
      live.status === 200 &&
        liveBody.documents?.some((item) => item.title === "실험 계획") &&
        liveBody.chat?.messages?.some((item) => item.body === "숙제 확인")
    )
  ) {
    failed += 1
  }

  const liveAgain = await fetch(
    `${BASE}/api/rooms/BAN1/groups/${stamp}/live?docs=${encodeURIComponent(liveBody.docsStamp ?? "")}&chat=${encodeURIComponent(liveBody.chatStamp ?? "")}`,
    { headers: { Cookie: session.cookie }, cache: "no-store" }
  )
  const liveAgainBody = await liveAgain.json().catch(() => ({}))
  if (!log("live unchanged is cheap", liveAgain.status === 200 && liveAgainBody.unchanged === true)) {
    failed += 1
  }

  const restoreGet = await fetch(`${BASE}/api/rooms/BAN1`, {
    headers: { Cookie: session.cookie },
    cache: "no-store",
  })
  const restoreGot = await restoreGet.json().catch(() => ({}))
  const restoreRoom = restoreGot.room ?? clobberBody.room ?? putBody.room
  const restore = await fetch(`${BASE}/api/rooms/BAN1`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: session.cookie },
    body: JSON.stringify({
      room: { ...restoreRoom, groups: previousGroups },
      revision: restoreRoom?.revision,
    }),
  })
  if (!log("restore 조", restore.status === 200, `status ${restore.status}`)) failed += 1

  if (failed) process.exit(1)
  console.log("all passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
