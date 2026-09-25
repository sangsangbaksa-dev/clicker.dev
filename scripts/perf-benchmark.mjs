/**
 * Measures room API hot paths. Run with dev server on :8080 and a valid session cookie.
 * Usage: node scripts/perf-benchmark.mjs [cookie-value]
 */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8080"
const CODE = "BAN1"
const cookie = process.argv[2] ? `sohaengbang_session=${process.argv[2]}` : ""

async function timed(label, fn) {
  const start = performance.now()
  const result = await fn()
  const ms = performance.now() - start
  return { label, ms, result }
}

async function fetchRoom(revision) {
  const url =
    revision === undefined
      ? `${BASE}/api/rooms/${CODE}`
      : `${BASE}/api/rooms/${CODE}?revision=${revision}`
  const response = await fetch(url, {
    headers: cookie ? { Cookie: cookie } : {},
    cache: "no-store",
  })
  const body = await response.json()
  const bytes = JSON.stringify(body).length
  return { status: response.status, bytes, body }
}

async function heartbeat() {
  const response = await fetch(`${BASE}/api/rooms/${CODE}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ type: "heartbeat" }),
    cache: "no-store",
  })
  const body = await response.json()
  return { status: response.status, bytes: JSON.stringify(body).length, body }
}

async function main() {
  console.log(`Benchmark @ ${BASE} room=${CODE}\n`)

  const full = await timed("GET full room", () => fetchRoom())
  console.log(
    `${full.label}: ${full.ms.toFixed(1)}ms, ${full.result.bytes} bytes, status=${full.result.status}`
  )

  if (full.result.status !== 200) {
    console.log("\nNeed auth cookie. Login in browser and pass session cookie value.")
    console.log("Example: node scripts/perf-benchmark.mjs <token>")
    process.exit(1)
  }

  const revision = full.result.body.room?.revision ?? 0

  const unchanged = await timed("GET unchanged (?revision=)", () => fetchRoom(revision))
  console.log(
    `${unchanged.label}: ${unchanged.ms.toFixed(1)}ms, ${unchanged.result.bytes} bytes, unchanged=${Boolean(unchanged.result.body.unchanged)}`
  )

  const savings =
    full.result.bytes > 0
      ? ((1 - unchanged.result.bytes / full.result.bytes) * 100).toFixed(0)
      : 0
  console.log(`  → payload reduction on steady poll: ~${savings}%\n`)

  const beats = []
  for (let i = 0; i < 5; i += 1) {
    beats.push(await timed(`PATCH heartbeat #${i + 1}`, heartbeat))
  }
  for (const beat of beats) {
    const hasFullRoom = Boolean(beat.result.body.room)
    console.log(
      `${beat.label}: ${beat.ms.toFixed(1)}ms, ${beat.result.bytes} bytes, fullRoom=${hasFullRoom}`
    )
  }

  const cachedReads = []
  for (let i = 0; i < 10; i += 1) {
    cachedReads.push(await timed(`GET full #${i + 1}`, () => fetchRoom()))
  }
  const first = cachedReads[0].ms
  const rest = cachedReads.slice(1).reduce((sum, item) => sum + item.ms, 0) / 9
  console.log(`\nServer read cache: first GET ${first.toFixed(1)}ms, avg next 9 ${rest.toFixed(1)}ms`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
