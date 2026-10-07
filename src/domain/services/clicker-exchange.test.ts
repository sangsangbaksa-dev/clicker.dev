import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { CLICKER_EXCHANGE_OFFERS as offers } from "../../data/clicker/exchange.ts"
import { createInitialSave, sanitizeSave } from "./clicker-engine.ts"
import { EXCHANGE_WEEK_MS, buyExchangeOffer, exchangeOffers, exchangeWeekStart } from "./clicker-exchange.ts"

const NOW = Date.UTC(2026, 9, 7, 10)
const potion = offers.find((o) => o.reward.kind === "POTION")!
const capsule = offers.find((o) => o.reward.kind === "FREE_CAPSULE")!
const rich = () => {
  const s = createInitialSave(NOW, config)
  return {
    run: { ...s.runState, lifetimeCoreEnergy: 1e40, regionCurrency: { [potion.regionId]: potion.cost * 10 } },
    meta: { ...s.metaState, gachaFreeAt: NOW },
  }
}

test("offers reference real regions and potions", () => {
  for (const o of offers) {
    assert.ok(config.regions.find((r) => r.id === o.regionId)?.currency, o.id)
    if (o.reward.kind === "POTION") {
      const id = o.reward.potionId
      assert.ok(config.potions.some((p) => p.id === id), o.id)
    }
  }
})

test("locked world or empty wallet cannot trade", () => {
  const s = createInitialSave(NOW, config)
  assert.ok(buyExchangeOffer(s.runState, s.metaState, config, offers, potion.id, NOW).error)
  const { run, meta } = rich()
  assert.ok(buyExchangeOffer({ ...run, regionCurrency: {} }, meta, config, offers, potion.id, NOW).error)
})

test("potion trade pays currency and adds a potion", () => {
  const { run, meta } = rich()
  const r = buyExchangeOffer(run, meta, config, offers, potion.id, NOW)
  assert.equal(r.error, undefined)
  assert.equal(r.run.regionCurrency![potion.regionId], potion.cost * 9)
  const id = potion.reward.kind === "POTION" ? potion.reward.potionId : ""
  assert.equal(r.run.potions[id], (run.potions[id] ?? 0) + 1)
  assert.equal(r.meta.exchange!.bought[potion.id], 1)
})

test("weekly limit holds, then refills next week", () => {
  let { run, meta } = rich()
  for (let i = 0; i < potion.weeklyLimit; i++) ({ run, meta } = buyExchangeOffer(run, meta, config, offers, potion.id, NOW))
  assert.ok(buyExchangeOffer(run, meta, config, offers, potion.id, NOW).error)
  assert.equal(exchangeOffers(run, meta, config, offers, NOW).find((o) => o.id === potion.id)!.remaining, 0)
  const later = NOW + EXCHANGE_WEEK_MS
  assert.equal(buyExchangeOffer(run, meta, config, offers, potion.id, later).error, undefined)
})

test("free capsule trade re-arms the daily capsule, refused when it is already ready", () => {
  const { run, meta } = rich()
  const r = buyExchangeOffer(run, meta, config, offers, capsule.id, NOW)
  assert.equal(r.error, undefined)
  assert.equal(r.meta.gachaFreeAt, 0)
  assert.ok(buyExchangeOffer(r.run, { ...r.meta, exchange: undefined }, config, offers, capsule.id, NOW).error)
})

test("week starts Monday 00:00 KST", () => {
  const start = exchangeWeekStart(NOW)
  const kst = new Date(start + 9 * 3600_000)
  assert.equal(kst.getUTCDay(), 1)
  assert.equal(kst.getUTCHours(), 0)
  assert.ok(start <= NOW && NOW < start + EXCHANGE_WEEK_MS)
})

test("old saves load with no exchange state; bad data is dropped", () => {
  const s = createInitialSave(NOW, config)
  assert.equal(sanitizeSave(JSON.parse(JSON.stringify(s)), config, NOW).metaState.exchange, undefined)
  const bad = { ...s, metaState: { ...s.metaState, exchange: { weekStart: 5, bought: { a: -1, b: 2 } } } }
  assert.deepEqual(sanitizeSave(bad, config, NOW).metaState.exchange, { weekStart: 5, bought: { b: 2 } })
})
