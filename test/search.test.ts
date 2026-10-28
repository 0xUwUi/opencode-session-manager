import { test } from "node:test"
import assert from "node:assert/strict"
import { filterSessions, type SessionLike } from "../src/grouping.ts"

function s(id: string, extra: Partial<SessionLike> = {}): SessionLike {
  return {
    id,
    projectID: "p1",
    title: id,
    time: { created: 0, updated: 0 },
    location: { directory: "/a" },
    ...extra,
  }
}

const text = (session: SessionLike) => `${session.title ?? ""} ${session.location.directory}`
const ids = (list: readonly SessionLike[]) => list.map((session) => session.id)

test("空查询返回全部 session", () => {
  const all = [s("a"), s("b")]
  assert.equal(filterSessions(all, "", text), all)
  assert.equal(filterSessions(all, "   ", text), all)
})

test("忽略大小写，按标题或目录匹配", () => {
  const all = [
    s("a", { title: "Fix Login Bug" }),
    s("b", { title: "other", location: { directory: "/home/me/login-app" } }),
    s("c", { title: "unrelated" }),
  ]
  assert.deepEqual(ids(filterSessions(all, "LOGIN", text)), ["a", "b"])
})

test("多个关键词需要全部命中", () => {
  const all = [
    s("a", { title: "fix login bug" }),
    s("b", { title: "login page" }),
    s("c", { title: "fix typo" }),
  ]
  assert.deepEqual(ids(filterSessions(all, "fix login", text)), ["a"])
})

test("子 session 命中时保留其祖先，未命中的兄弟被过滤", () => {
  const all = [
    s("root", { title: "parent" }),
    s("mid", { title: "middle", parentID: "root" }),
    s("leaf", { title: "needle", parentID: "mid" }),
    s("sibling", { title: "other", parentID: "root" }),
  ]
  assert.deepEqual(ids(filterSessions(all, "needle", text)), ["root", "mid", "leaf"])
})

test("隐藏子 session 时只搜索顶层 session", () => {
  const all = [
    s("root", { title: "parent" }),
    s("leaf", { title: "needle", parentID: "root" }),
    s("orphan", { title: "needle", parentID: "missing" }),
  ]
  assert.deepEqual(ids(filterSessions(all, "needle", text, { children: false })), ["orphan"])
  assert.deepEqual(ids(filterSessions(all, "parent", text, { children: false })), ["root"])
})

test("没有匹配时返回空列表", () => {
  assert.deepEqual(filterSessions([s("a")], "zzz", text), [])
})
