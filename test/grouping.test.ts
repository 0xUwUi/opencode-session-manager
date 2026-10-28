import { test } from "node:test"
import assert from "node:assert/strict"
import { buildGroups, flattenRows, groupDeleteTargets, timeBucket, type SessionLike } from "../src/grouping.ts"

const DAY = 24 * 60 * 60 * 1000
// 2026-10-28 15:00 本地时间
const NOW = new Date(2026, 9, 28, 15, 0, 0).getTime()

function s(id: string, extra: Partial<SessionLike> = {}): SessionLike {
  return {
    id,
    projectID: "p1",
    title: id,
    time: { created: NOW, updated: NOW },
    location: { directory: "/a" },
    ...extra,
  }
}

test("timeBucket 按本地日期划分", () => {
  assert.equal(timeBucket(NOW, NOW), "today")
  assert.equal(timeBucket(new Date(2026, 9, 28, 0, 0, 1).getTime(), NOW), "today")
  assert.equal(timeBucket(new Date(2026, 9, 27, 23, 59).getTime(), NOW), "yesterday")
  assert.equal(timeBucket(NOW - 5 * DAY, NOW), "week")
  assert.equal(timeBucket(NOW - 20 * DAY, NOW), "month")
  assert.equal(timeBucket(NOW - 90 * DAY, NOW), "earlier")
})

test("按目录分组，组按最近更新排序", () => {
  const groups = buildGroups(
    [
      s("a1", { location: { directory: "/a" }, time: { created: 0, updated: NOW - 3 * DAY } }),
      s("b1", { location: { directory: "/b" }, time: { created: 0, updated: NOW - DAY } }),
      s("a2", { location: { directory: "/a" }, time: { created: 0, updated: NOW } }),
    ],
    { mode: "directory", showChildren: false, now: NOW },
  )
  assert.deepEqual(
    groups.map((g) => [g.key, g.roots.map((n) => n.session.id)]),
    [
      ["/a", ["a2", "a1"]],
      ["/b", ["b1"]],
    ],
  )
})

test("按项目分组使用 projectLabel", () => {
  const groups = buildGroups([s("x", { projectID: "p9" })], {
    mode: "project",
    showChildren: false,
    now: NOW,
    projectLabel: (id) => `name-${id}`,
  })
  assert.equal(groups[0].key, "p9")
  assert.equal(groups[0].label, "name-p9")
})

test("按创建时间分组，桶顺序固定", () => {
  const groups = buildGroups(
    [
      s("old", { time: { created: NOW - 90 * DAY, updated: NOW } }),
      s("new", { time: { created: NOW, updated: NOW } }),
    ],
    { mode: "created", showChildren: false, now: NOW },
  )
  assert.deepEqual(
    groups.map((g) => g.key),
    ["today", "earlier"],
  )
})

test("按最后查看分组，缺少 viewed 时回退到 updated", () => {
  const groups = buildGroups(
    [
      s("v", { time: { created: 0, updated: NOW, viewed: NOW - 90 * DAY } }),
      s("u", { time: { created: 0, updated: NOW } }),
    ],
    { mode: "viewed", showChildren: false, now: NOW },
  )
  assert.deepEqual(
    groups.map((g) => [g.key, g.roots.map((n) => n.session.id)]),
    [
      ["today", ["u"]],
      ["earlier", ["v"]],
    ],
  )
})

test("关闭子 session 时隐藏子节点，父节点不存在的子 session 当作根", () => {
  const list = [s("root"), s("child", { parentID: "root" }), s("orphan", { parentID: "gone" })]
  const groups = buildGroups(list, { mode: "directory", showChildren: false, now: NOW })
  assert.deepEqual(
    groups[0].roots.map((n) => [n.session.id, n.children.length]),
    [
      ["root", 0],
      ["orphan", 0],
    ],
  )
})

test("打开子 session 时构建树并按父节点归组", () => {
  const list = [
    s("root", { location: { directory: "/a" } }),
    // 子 session 在别的目录，仍然跟着父节点
    s("child", { parentID: "root", location: { directory: "/b" } }),
    s("grand", { parentID: "child", location: { directory: "/b" } }),
  ]
  const groups = buildGroups(list, { mode: "directory", showChildren: true, now: NOW })
  assert.equal(groups.length, 1)
  assert.equal(groups[0].roots[0].children[0].session.id, "child")
  assert.equal(groups[0].roots[0].children[0].children[0].session.id, "grand")
  assert.equal(groups[0].count, 3)
})

test("flattenRows 输出分组行和带树前缀的会话行", () => {
  const list = [s("r"), s("c1", { parentID: "r" }), s("c2", { parentID: "r" }), s("g", { parentID: "c1" })]
  const groups = buildGroups(list, { mode: "directory", showChildren: true, now: NOW })
  const rows = flattenRows(groups, new Set())
  assert.deepEqual(
    rows.map((r) => (r.type === "group" ? `#${r.group.key}` : `${r.prefix}${r.session.id}`)),
    ["#/a", "r", "├─ c1", "│  └─ g", "└─ c2"],
  )
})

test("flattenRows 跳过折叠分组的会话", () => {
  const groups = buildGroups([s("r")], { mode: "directory", showChildren: false, now: NOW })
  const rows = flattenRows(groups, new Set(["/a"]))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].type, "group")
})

test("groupDeleteTargets 只返回根节点，计数包含后代", () => {
  const list = [s("r"), s("c", { parentID: "r" }), s("x")]
  const hidden = buildGroups(list, { mode: "directory", showChildren: false, now: NOW })
  const shown = buildGroups(list, { mode: "directory", showChildren: true, now: NOW })
  // 隐藏子 session 时，计数仍然要把会被级联删除的子 session 算进去
  assert.deepEqual(groupDeleteTargets(hidden[0], list), { ids: ["r", "x"], total: 3 })
  assert.deepEqual(groupDeleteTargets(shown[0], list), { ids: ["r", "x"], total: 3 })
})
