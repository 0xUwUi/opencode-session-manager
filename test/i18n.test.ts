import { test } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_LOCALE, LOCALE_CODES, isLocale, messages, nextLocale } from "../src/i18n/index.ts"
import { buildGroups, formatAge } from "../src/grouping.ts"

const NOW = new Date(2026, 9, 28, 15, 0, 0).getTime()

test("默认语言是英文", () => {
  assert.equal(DEFAULT_LOCALE, "en")
})

test("isLocale 只接受已注册的语言", () => {
  assert.ok(isLocale("en"))
  assert.ok(isLocale("zh-CN"))
  assert.ok(!isLocale("fr"))
  assert.ok(!isLocale(undefined))
  assert.ok(!isLocale("toString"))
})

test("nextLocale 依次循环全部语言", () => {
  let locale = LOCALE_CODES[0]
  const seen = [locale]
  for (let i = 1; i < LOCALE_CODES.length; i++) {
    locale = nextLocale(locale)
    seen.push(locale)
  }
  assert.deepEqual(seen, LOCALE_CODES)
  assert.equal(nextLocale(locale), LOCALE_CODES[0])
})

test("formatAge 使用语言包", () => {
  assert.equal(formatAge(NOW - 5 * 60_000, NOW, messages("en").age), "5m ago")
  assert.equal(formatAge(NOW - 5 * 60_000, NOW, messages("zh-CN").age), "5 分钟前")
})

test("时间分组使用 bucketLabel", () => {
  const groups = buildGroups(
    [{ id: "a", projectID: "p", time: { created: NOW, updated: NOW }, location: { directory: "/a" } }],
    { mode: "created", showChildren: false, now: NOW, bucketLabel: (bucket) => messages("en").buckets[bucket] },
  )
  assert.equal(groups[0].label, "Today")
})
