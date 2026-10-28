/** @jsxImportSource @opentui/solid */

import type { Plugin } from "@opencode/plugin/tui"
import type { ScrollBoxRenderable } from "@opentui/core"
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import {
  GROUP_MODES,
  GROUP_MODE_LABELS,
  buildGroups,
  countWithDescendants,
  flattenRows,
  formatAge,
  groupDeleteTargets,
  sortTime,
  type GroupMode,
  type Row,
} from "./grouping.ts"

type Context = Plugin.Context
export type Session = Awaited<ReturnType<Context["client"]["session"]["list"]>>["data"][number]

export interface Settings {
  mode: GroupMode
  showChildren: boolean
}

export const SETTINGS_KEY = "settings"
export const DEFAULT_SETTINGS: Settings = { mode: "directory", showChildren: false }

const PAGE_SIZE = 200
const ROW_ID_PREFIX = "session-manager-row-"

const rowKey = (row: Row<Session>) => (row.type === "group" ? `g:${row.group.key}` : `s:${row.session.id}`)
const titleOf = (session: Session) => session.title?.trim() || session.id

async function fetchAllSessions(context: Context): Promise<Session[]> {
  const all: Session[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await context.client.session.list({ limit: PAGE_SIZE, order: "desc", cursor })
    all.push(...page.data)
    const next = page.cursor.next
    if (!next || page.data.length === 0) return all
    cursor = next
  }
}

function isNotFound(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : JSON.stringify(error ?? "")
  return /NotFound|not found|404/i.test(text)
}

export function SessionManagerPage(props: { context: Context; from?: string }) {
  const context = props.context
  const theme = context.theme
  const [settings, updateSettings] = context.storage.store<Settings>(SETTINGS_KEY, { initial: { ...DEFAULT_SETTINGS } })

  // Store writes are async, so keep the live values locally to make rapid key presses consistent.
  const [mode, setModeSignal] = createSignal<GroupMode>(
    GROUP_MODES.includes(settings.mode) ? settings.mode : DEFAULT_SETTINGS.mode,
  )
  const [showChildren, setShowChildren] = createSignal(settings.showChildren === true)
  // Overlapping store updates can drop writes, so run them one at a time with the latest values.
  let saving: Promise<void> = Promise.resolve()
  const persist = () => {
    saving = saving
      .then(() =>
        updateSettings((draft) => {
          draft.mode = mode()
          draft.showChildren = showChildren()
        }),
      )
      .catch(() => undefined)
  }
  const [sessions, setSessions] = createSignal<Session[]>([])
  const [projectNames, setProjectNames] = createSignal<Map<string, string>>(new Map())
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string>()
  const [busy, setBusy] = createSignal(false)
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(new Set())
  const [selectedKey, setSelectedKey] = createSignal<string>()
  const [now, setNow] = createSignal(Date.now())
  let from = props.from
  let lastIndex = 0
  let scroll: ScrollBoxRenderable | undefined

  const refresh = async () => {
    try {
      const [list] = await Promise.all([
        fetchAllSessions(context),
        context.data.project.sync().catch(() => undefined),
      ])
      const names = new Map<string, string>()
      for (const project of context.data.project.list()) {
        names.set(project.id, project.name?.trim() || context.ui.format.path(project.canonical))
      }
      setProjectNames(names)
      setSessions(list)
      if (selectedKey() === undefined && from) setSelectedKey(`s:${from}`)
      setNow(Date.now())
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }

  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  const scheduleRefresh = () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => void refresh(), 300)
  }

  onMount(() => {
    void refresh()
    const stops = [
      context.data.on("session.created", scheduleRefresh),
      context.data.on("session.deleted", scheduleRefresh),
      context.data.on("session.renamed", scheduleRefresh),
      context.data.on("session.archived", scheduleRefresh),
    ]
    onCleanup(() => {
      clearTimeout(refreshTimer)
      for (const stop of stops) stop()
    })
  })

  const projectLabel = (id: string) => {
    if (id === "global") return "无仓库 (global)"
    return projectNames().get(id) ?? id
  }

  const groups = createMemo(() =>
    buildGroups(sessions(), {
      mode: mode(),
      showChildren: showChildren(),
      now: now(),
      projectLabel,
      directoryLabel: (directory) => context.ui.format.path(directory),
    }),
  )
  const rows = createMemo(() => flattenRows(groups(), collapsed()))
  const visibleCount = createMemo(() => groups().reduce((total, group) => total + group.count, 0))

  const index = createMemo(() => {
    const list = rows()
    if (list.length === 0) return -1
    const found = list.findIndex((row) => rowKey(row) === selectedKey())
    return found >= 0 ? found : Math.min(lastIndex, list.length - 1)
  })
  const selected = () => rows()[index()]

  createEffect(() => {
    const current = index()
    if (current < 0) return
    lastIndex = current
    scroll?.scrollChildIntoView(`${ROW_ID_PREFIX}${current}`)
  })

  const select = (target: number) => {
    const list = rows()
    if (list.length === 0) return
    const clamped = Math.max(0, Math.min(list.length - 1, target))
    lastIndex = clamped
    setSelectedKey(rowKey(list[clamped]))
  }
  const move = (delta: number) => select(index() + delta)
  const pageSize = () => Math.max(1, (scroll?.height ?? 10) - 1)

  const guarded = (action: () => Promise<void> | void) => async () => {
    if (busy()) return
    setBusy(true)
    try {
      await action()
    } catch (cause) {
      context.ui.toast.show({ message: cause instanceof Error ? cause.message : String(cause), variant: "error" })
    } finally {
      setBusy(false)
    }
  }

  const toggleCollapse = (key: string) => {
    const next = new Set(collapsed())
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setCollapsed(next)
  }

  const activate = () => {
    const row = selected()
    if (!row) return
    if (row.type === "group") return toggleCollapse(row.group.key)
    context.ui.router.navigate({ type: "session", sessionID: row.session.id })
  }

  const back = () => {
    if (from && sessions().some((session) => session.id === from)) {
      context.ui.router.navigate({ type: "session", sessionID: from })
      return
    }
    context.ui.router.navigate({ type: "home" })
  }

  const setMode = (next: GroupMode) => {
    setCollapsed(new Set<string>())
    setModeSignal(next)
    persist()
  }
  const cycleMode = (delta: number) =>
    setMode(GROUP_MODES[(GROUP_MODES.indexOf(mode()) + delta + GROUP_MODES.length) % GROUP_MODES.length])

  const toggleChildren = () => {
    const next = !showChildren()
    setShowChildren(next)
    persist()
  }

  const forgetDeleted = (ids: readonly string[]) => {
    const removed = new Set<string>()
    const children = new Map<string, string[]>()
    for (const session of sessions()) {
      if (!session.parentID) continue
      children.set(session.parentID, [...(children.get(session.parentID) ?? []), session.id])
    }
    const mark = (id: string) => {
      removed.add(id)
      for (const child of children.get(id) ?? []) mark(child)
    }
    ids.forEach(mark)
    if (from && removed.has(from)) from = undefined
    if (context.ui.tabs.enabled()) for (const id of removed) context.ui.tabs.close(id)
    setSessions(sessions().filter((session) => !removed.has(session.id)))
  }

  const rename = guarded(async () => {
    const row = selected()
    if (row?.type !== "session") return
    const value = await context.ui.dialog.prompt({
      title: "重命名 session",
      description: context.ui.format.path(row.session.location.directory),
      value: row.session.title ?? "",
    })
    const title = value?.trim()
    if (!title || title === row.session.title) return
    await context.client.session.update({ sessionID: row.session.id, title })
    setSessions(sessions().map((session) => (session.id === row.session.id ? { ...session, title } : session)))
    context.ui.toast.show({ message: `已重命名为「${title}」`, variant: "success" })
  })

  const removeOne = guarded(async () => {
    const row = selected()
    if (row?.type !== "session") return
    const total = countWithDescendants([row.session.id], sessions())
    const extra = total > 1 ? `\n它的 ${total - 1} 个子 session 也会一起删除。` : ""
    const current = row.session.id === from ? "\n这是当前正在使用的 session。" : ""
    const confirmed = await context.ui.dialog.confirm({
      title: "删除 session",
      message: `删除「${titleOf(row.session)}」？${extra}${current}\n此操作不可恢复。`,
      label: { confirm: "删除", cancel: "取消" },
    })
    if (!confirmed) return
    try {
      await context.client.session.remove({ sessionID: row.session.id })
    } catch (cause) {
      if (!isNotFound(cause)) throw cause
    }
    forgetDeleted([row.session.id])
    context.ui.toast.show({ message: `已删除 ${total} 个 session`, variant: "success" })
  })

  const removeGroup = guarded(async () => {
    const row = selected()
    if (!row) return
    const group = row.group
    const { ids, total } = groupDeleteTargets(group, sessions())
    if (ids.length === 0) return
    const hasCurrent = from !== undefined && containsSession(ids, from)
    const confirmed = await context.ui.dialog.confirm({
      title: `删除分类「${group.label}」`,
      message:
        `将删除「${GROUP_MODE_LABELS[mode()]}」分类「${group.label}」下的全部 ${total} 个 session（含子 session）。` +
        (hasCurrent ? "\n其中包含当前正在使用的 session。" : "") +
        "\n此操作不可恢复。",
      label: { confirm: `删除 ${total} 个`, cancel: "取消" },
    })
    if (!confirmed) return
    const done: string[] = []
    const failed: string[] = []
    for (const id of ids) {
      try {
        await context.client.session.remove({ sessionID: id })
        done.push(id)
      } catch (cause) {
        if (isNotFound(cause)) done.push(id)
        else failed.push(id)
      }
    }
    forgetDeleted(done)
    if (failed.length > 0) {
      context.ui.toast.show({ message: `${failed.length} 个 session 删除失败`, variant: "error" })
    } else {
      context.ui.toast.show({ message: `已删除分类「${group.label}」下的 ${total} 个 session`, variant: "success" })
    }
    scheduleRefresh()
  })

  const containsSession = (rootIDs: readonly string[], target: string) => {
    const byID = new Map(sessions().map((session) => [session.id, session]))
    let cursor = byID.get(target)
    while (cursor) {
      if (rootIDs.includes(cursor.id)) return true
      cursor = cursor.parentID ? byID.get(cursor.parentID) : undefined
    }
    return false
  }

  context.keymap.layer(() => ({
    priority: 100,
    enabled: () => !busy(),
    commands: [
      { title: "上一项", group: "Session 管理", bind: "up,k", run: () => move(-1) },
      { title: "下一项", group: "Session 管理", bind: "down,j", run: () => move(1) },
      { title: "上一页", group: "Session 管理", bind: "pageup", run: () => move(-pageSize()) },
      { title: "下一页", group: "Session 管理", bind: "pagedown", run: () => move(pageSize()) },
      { title: "第一项", group: "Session 管理", bind: "home,g", run: () => select(0) },
      { title: "最后一项", group: "Session 管理", bind: "end,shift+g", run: () => select(rows().length - 1) },
      { title: "打开 / 折叠", group: "Session 管理", bind: "return", run: activate },
      {
        title: "折叠分组",
        group: "Session 管理",
        bind: "space",
        run: () => {
          const row = selected()
          if (row) toggleCollapse(row.group.key)
        },
      },
      { title: "下一种分类", group: "Session 管理", bind: "tab", run: () => cycleMode(1) },
      { title: "上一种分类", group: "Session 管理", bind: "shift+tab", run: () => cycleMode(-1) },
      { title: "显示 / 隐藏子 session", group: "Session 管理", bind: "c", run: toggleChildren },
      { title: "重命名", group: "Session 管理", bind: "r", run: () => void rename() },
      { title: "删除 session", group: "Session 管理", bind: "d", run: () => void removeOne() },
      { title: "删除整个分类", group: "Session 管理", bind: "shift+d", run: () => void removeGroup() },
      { title: "刷新", group: "Session 管理", bind: "f5,shift+r", run: () => void refresh() },
      { title: "返回", group: "Session 管理", bind: "escape,q", run: back },
    ],
  }))

  const hint = (key: string, label: string) => (
    <text wrapMode="none" flexShrink={0}>
      <span style={{ fg: theme.text.base }}>{key}</span>
      <span style={{ fg: theme.text.muted }}> {label}</span>
    </text>
  )

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} gap={1}>
      <box flexDirection="row" gap={2} flexShrink={0}>
        <text fg={theme.text.base} wrapMode="none" flexShrink={0}>
          <b>Session 管理</b>
        </text>
        <box flexDirection="row" gap={1} flexShrink={1} minWidth={0}>
          <For each={GROUP_MODES}>
            {(item) => (
              <text
                wrapMode="none"
                flexShrink={0}
                fg={item === mode() ? theme.text.action.primary.base : theme.text.muted}
                onMouseUp={() => setMode(item)}
              >
                {item === mode() ? `[${GROUP_MODE_LABELS[item]}]` : ` ${GROUP_MODE_LABELS[item]} `}
              </text>
            )}
          </For>
        </box>
        <box flexGrow={1} />
        <text wrapMode="none" flexShrink={0} fg={theme.text.muted} onMouseUp={toggleChildren}>
          子 session: {showChildren() ? "显示" : "隐藏"} · 共 {visibleCount()} 个
        </text>
      </box>

      <Show when={!loading()} fallback={<text fg={theme.text.muted}>加载中…</text>}>
        <Show when={!error()} fallback={<text fg={theme.text.feedback.error.base}>加载失败：{error()}</text>}>
          <Show when={rows().length > 0} fallback={<text fg={theme.text.muted}>没有 session</text>}>
            <scrollbox
              ref={(element: ScrollBoxRenderable) => {
                scroll = element
              }}
              flexGrow={1}
              scrollY
            >
              <For each={rows()}>
                {(row, rowIndex) => {
                  const isSelected = () => rowIndex() === index()
                  const onClick = () => {
                    if (isSelected()) activate()
                    else select(rowIndex())
                  }
                  if (row.type === "group") {
                    return (
                      <box id={`${ROW_ID_PREFIX}${rowIndex()}`} paddingTop={rowIndex() === 0 ? 0 : 1}>
                        <box
                          flexDirection="row"
                          gap={1}
                          backgroundColor={isSelected() ? theme.background.raised.high : undefined}
                          onMouseUp={onClick}
                        >
                          <text wrapMode="none" flexShrink={0} fg={theme.text.action.primary.base}>
                            {row.collapsed ? "▶" : "▼"}
                          </text>
                          <text wrapMode="none" truncate flexGrow={1} flexShrink={1} minWidth={0} fg={theme.text.base}>
                            <b>{row.group.label}</b>
                            <span style={{ fg: theme.text.muted }}> ({row.group.count})</span>
                          </text>
                        </box>
                      </box>
                    )
                  }
                  const session = row.session
                  const isFrom = () => session.id === from
                  const running = () => context.data.session.status(session.id) === "running"
                  const age = () => formatAge(sortTime(session, mode() === "directory" || mode() === "project" ? "updated" : mode()), now())
                  return (
                    <box
                      id={`${ROW_ID_PREFIX}${rowIndex()}`}
                      flexDirection="row"
                      gap={1}
                      paddingLeft={2}
                      backgroundColor={isSelected() ? theme.background.raised.high : undefined}
                      onMouseUp={onClick}
                    >
                      <text
                        wrapMode="none"
                        truncate
                        flexGrow={1}
                        flexShrink={1}
                        minWidth={0}
                        fg={row.depth > 0 ? theme.text.muted : theme.text.base}
                      >
                        <span style={{ fg: theme.text.faint }}>{row.prefix}</span>
                        <span
                          style={{
                            fg: running()
                              ? theme.text.feedback.info.base
                              : isFrom()
                                ? theme.text.feedback.success.base
                                : theme.text.faint,
                          }}
                        >
                          {running() ? "◆ " : isFrom() ? "● " : "· "}
                        </span>
                        {titleOf(session)}
                      </text>
                      <Show when={mode() !== "directory" && row.depth === 0}>
                        <text wrapMode="none" truncate flexShrink={2} maxWidth={40} fg={theme.text.faint}>
                          {context.ui.format.path(session.location.directory)}
                        </text>
                      </Show>
                      <text wrapMode="none" flexShrink={0} fg={theme.text.muted}>
                        {age()}
                      </text>
                    </box>
                  )
                }}
              </For>
            </scrollbox>
          </Show>
        </Show>
      </Show>

      <box flexDirection="row" gap={2} flexShrink={0} flexWrap="wrap">
        {hint("↑↓", "选择")}
        {hint("Enter", "打开/折叠")}
        {hint("Tab", "切换分类")}
        {hint("c", "子 session")}
        {hint("r", "重命名")}
        {hint("d", "删除")}
        {hint("D", "删除分类")}
        {hint("F5", "刷新")}
        {hint("Esc", "返回")}
      </box>
    </box>
  )
}
