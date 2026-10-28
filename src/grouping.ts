export type GroupMode = "directory" | "project" | "created" | "updated" | "viewed"

export const GROUP_MODES: readonly GroupMode[] = ["directory", "project", "created", "updated", "viewed"]

export type TimeBucket = "today" | "yesterday" | "week" | "month" | "earlier"

export const TIME_BUCKETS: readonly TimeBucket[] = ["today", "yesterday", "week", "month", "earlier"]

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
  readonly bucketLabel?: (bucket: TimeBucket) => string
}

const DAY = 24 * 60 * 60 * 1000

export interface AgeLabels {
  readonly now: string
  readonly minutes: (count: number) => string
  readonly hours: (count: number) => string
  readonly days: (count: number) => string
}

export function formatAge(time: number, now: number, labels: AgeLabels): string {
  const diff = Math.max(0, now - time)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return labels.now
  if (minutes < 60) return labels.minutes(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return labels.hours(hours)
  const days = Math.floor(hours / 24)
  if (days < 30) return labels.days(days)
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
      return options.bucketLabel?.(key as TimeBucket) ?? key
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
  return groups.sort((a, b) => TIME_BUCKETS.indexOf(a.key as TimeBucket) - TIME_BUCKETS.indexOf(b.key as TimeBucket))
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

/**
 * Sessions matching every whitespace-separated term of `query` (case-insensitive).
 * With `children` (the default) a matching subsession keeps its ancestors so the tree stays intact;
 * without it only top-level sessions are searched, because subsessions are not displayed.
 */
export function filterSessions<S extends SessionLike>(
  sessions: readonly S[],
  query: string,
  text: (session: S) => string,
  options: { readonly children?: boolean } = {},
): readonly S[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return sessions
  const byID = new Map(sessions.map((session) => [session.id, session]))
  const isRoot = (session: S) => !session.parentID || !byID.has(session.parentID)
  const matches = (session: S) => {
    const haystack = text(session).toLowerCase()
    return terms.every((term) => haystack.includes(term))
  }
  const keep = new Set<string>()
  for (const session of sessions) {
    if (options.children === false && !isRoot(session)) continue
    if (!matches(session)) continue
    let cursor: S | undefined = session
    while (cursor && !keep.has(cursor.id)) {
      keep.add(cursor.id)
      cursor = cursor.parentID ? byID.get(cursor.parentID) : undefined
    }
  }
  return sessions.filter((session) => keep.has(session.id))
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
