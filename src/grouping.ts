export type GroupMode = "directory" | "project" | "created" | "updated" | "viewed"

export const GROUP_MODES: readonly GroupMode[] = ["directory", "project", "created", "updated", "viewed"]

export const GROUP_MODE_LABELS: Record<GroupMode, string> = {
  directory: "目录",
  project: "项目",
  created: "创建时间",
  updated: "最后更新",
  viewed: "最后查看",
}

export type TimeBucket = "today" | "yesterday" | "week" | "month" | "earlier"

const BUCKETS: readonly TimeBucket[] = ["today", "yesterday", "week", "month", "earlier"]

const BUCKET_LABELS: Record<TimeBucket, string> = {
  today: "今天",
  yesterday: "昨天",
  week: "最近 7 天",
  month: "最近 30 天",
  earlier: "更早",
}

export interface SessionLike {
  readonly id: string
  readonly parentID?: string
  readonly projectID: string
  readonly title?: string
  readonly time: { readonly created: number; readonly updated: number; readonly viewed?: number }
  readonly location: { readonly directory: string }
}

export interface TreeNode<S extends SessionLike = SessionLike> {
  readonly session: S
  readonly children: TreeNode<S>[]
}

export interface Group<S extends SessionLike = SessionLike> {
  readonly key: string
  readonly label: string
  readonly roots: TreeNode<S>[]
  /** Number of sessions displayed in this group, including shown children. */
  readonly count: number
}

export type Row<S extends SessionLike = SessionLike> =
  | { readonly type: "group"; readonly group: Group<S>; readonly collapsed: boolean }
  | {
      readonly type: "session"
      readonly session: S
      readonly group: Group<S>
      readonly depth: number
      readonly prefix: string
    }

export interface GroupOptions {
  readonly mode: GroupMode
  readonly showChildren: boolean
  readonly now: number
  readonly projectLabel?: (projectID: string) => string
  readonly directoryLabel?: (directory: string) => string
}

const DAY = 24 * 60 * 60 * 1000

export function formatAge(time: number, now: number): string {
  const diff = Math.max(0, now - time)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  const date = new Date(time)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function timeBucket(time: number, now: number): TimeBucket {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const today = start.getTime()
  if (time >= today) return "today"
  if (time >= today - DAY) return "yesterday"
  if (time >= today - 6 * DAY) return "week"
  if (time >= today - 29 * DAY) return "month"
  return "earlier"
}

export function sortTime(session: SessionLike, mode: GroupMode): number {
  if (mode === "created") return session.time.created
  if (mode === "viewed") return session.time.viewed ?? session.time.updated
  return session.time.updated
}

function groupKey(session: SessionLike, options: GroupOptions): string {
  switch (options.mode) {
    case "directory":
      return session.location.directory
    case "project":
      return session.projectID
    default:
      return timeBucket(sortTime(session, options.mode), options.now)
  }
}

function groupLabel(key: string, options: GroupOptions): string {
  switch (options.mode) {
    case "directory":
      return options.directoryLabel?.(key) ?? key
    case "project":
      return options.projectLabel?.(key) ?? key
    default:
      return BUCKET_LABELS[key as TimeBucket]
  }
}

function countNodes(nodes: readonly TreeNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0)
}

export function buildGroups<S extends SessionLike>(sessions: readonly S[], options: GroupOptions): Group<S>[] {
  const ids = new Set(sessions.map((session) => session.id))
  const isRoot = (session: S) => !session.parentID || !ids.has(session.parentID)
  const byTime = (a: TreeNode<S>, b: TreeNode<S>) => sortTime(b.session, options.mode) - sortTime(a.session, options.mode)

  const nodes = new Map<string, TreeNode<S>>()
  for (const session of sessions) nodes.set(session.id, { session, children: [] })
  if (options.showChildren) {
    for (const session of sessions) {
      if (isRoot(session)) continue
      nodes.get(session.parentID!)!.children.push(nodes.get(session.id)!)
    }
    for (const node of nodes.values()) node.children.sort(byTime)
  }

  const buckets = new Map<string, TreeNode<S>[]>()
  for (const session of sessions) {
    if (!isRoot(session)) continue
    const key = groupKey(session, options)
    const list = buckets.get(key) ?? []
    list.push(nodes.get(session.id)!)
    buckets.set(key, list)
  }

  const groups = [...buckets.entries()].map(([key, roots]) => {
    roots.sort(byTime)
    return { key, label: groupLabel(key, options), roots, count: countNodes(roots) }
  })

  if (options.mode === "directory" || options.mode === "project") {
    const latest = (group: Group<S>) => Math.max(...group.roots.map((node) => node.session.time.updated))
    return groups.sort((a, b) => latest(b) - latest(a))
  }
  return groups.sort((a, b) => BUCKETS.indexOf(a.key as TimeBucket) - BUCKETS.indexOf(b.key as TimeBucket))
}

export function flattenRows<S extends SessionLike>(groups: readonly Group<S>[], collapsed: ReadonlySet<string>): Row<S>[] {
  const rows: Row<S>[] = []
  const walk = (group: Group<S>, node: TreeNode<S>, depth: number, indent: string, last: boolean) => {
    const prefix = depth === 0 ? "" : indent + (last ? "└─ " : "├─ ")
    rows.push({ type: "session", session: node.session, group, depth, prefix })
    const childIndent = depth === 0 ? "" : indent + (last ? "   " : "│  ")
    node.children.forEach((child, index) => walk(group, child, depth + 1, childIndent, index === node.children.length - 1))
  }
  for (const group of groups) {
    const isCollapsed = collapsed.has(group.key)
    rows.push({ type: "group", group, collapsed: isCollapsed })
    if (isCollapsed) continue
    for (const root of group.roots) walk(group, root, 0, "", true)
  }
  return rows
}

/** Sessions to delete for a group: only roots, because the server deletes child sessions with their parent. */
export function groupDeleteTargets(group: Group, all: readonly SessionLike[]): { ids: string[]; total: number } {
  const ids = group.roots.map((node) => node.session.id)
  return { ids, total: countWithDescendants(ids, all) }
}

/** Number of sessions removed when deleting these sessions, including their descendants. */
export function countWithDescendants(ids: readonly string[], all: readonly SessionLike[]): number {
  const children = new Map<string, string[]>()
  for (const session of all) {
    if (!session.parentID) continue
    const list = children.get(session.parentID) ?? []
    list.push(session.id)
    children.set(session.parentID, list)
  }
  const descendants = (id: string): number =>
    (children.get(id) ?? []).reduce((total, child) => total + 1 + descendants(child), 0)
  return ids.reduce((total, id) => total + 1 + descendants(id), 0)
}
