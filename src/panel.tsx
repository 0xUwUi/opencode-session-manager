/** @jsxImportSource @opentui/solid */

import type { Plugin } from "@opencode/plugin/tui"
import type { ScrollBoxRenderable } from "@opentui/core"
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import {
  GROUP_MODES,
  buildGroups,
  countWithDescendants,
  flattenRows,
  formatAge,
  groupDeleteTargets,
  sortTime,
  type GroupMode,
  type Row,
} from "./grouping.ts"
import { DEFAULT_LOCALE, LOCALES, LOCALE_CODES, isLocale, messages, nextLocale, type Locale } from "./i18n/index.ts"

type Context = Plugin.Context
export type Session = Awaited<ReturnType<Context["client"]["session"]["list"]>>["data"][number]

export interface Settings {
  mode: GroupMode
  showChildren: boolean
  locale: Locale
}

export const SETTINGS_KEY = "settings"
export const DEFAULT_SETTINGS: Settings = { mode: "directory", showChildren: false, locale: DEFAULT_LOCALE }

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
  const [locale, setLocaleSignal] = createSignal<Locale>(isLocale(settings.locale) ? settings.locale : DEFAULT_LOCALE)
  const t = () => messages(locale())
  // Overlapping store updates can drop writes, so run them one at a time with the latest values.
  let saving: Promise<void> = Promise.resolve()
  const persist = () => {
    saving = saving
      .then(() =>
        updateSettings((draft) => {
          draft.mode = mode()
          draft.showChildren = showChildren()
          draft.locale = locale()
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
    if (id === "global") return t().noProject
    return projectNames().get(id) ?? id
  }

  const groups = createMemo(() =>
    buildGroups(sessions(), {
      mode: mode(),
      showChildren: showChildren(),
      now: now(),
      projectLabel,
      directoryLabel: (directory) => context.ui.format.path(directory),
      bucketLabel: (bucket) => t().buckets[bucket],
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

  const setLocale = (next: Locale) => {
    setLocaleSignal(next)
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
      title: t().rename.title,
      description: context.ui.format.path(row.session.location.directory),
      value: row.session.title ?? "",
    })
    const title = value?.trim()
    if (!title || title === row.session.title) return
    await context.client.session.update({ sessionID: row.session.id, title })
    setSessions(sessions().map((session) => (session.id === row.session.id ? { ...session, title } : session)))
    context.ui.toast.show({ message: t().rename.done(title), variant: "success" })
  })

  const removeOne = guarded(async () => {
    const row = selected()
    if (row?.type !== "session") return
    const total = countWithDescendants([row.session.id], sessions())
    const text = t().remove
    const confirmed = await context.ui.dialog.confirm({
      title: text.title,
      message: [
        text.message(titleOf(row.session)),
        total > 1 ? text.children(total - 1) : undefined,
        row.session.id === from ? text.current : undefined,
        text.irreversible,
      ]
        .filter(Boolean)
        .join("\n"),
      label: { confirm: text.confirm, cancel: text.cancel },
    })
    if (!confirmed) return
    try {
      await context.client.session.remove({ sessionID: row.session.id })
    } catch (cause) {
      if (!isNotFound(cause)) throw cause
    }
    forgetDeleted([row.session.id])
    context.ui.toast.show({ message: t().remove.done(total), variant: "success" })
  })

  const removeGroup = guarded(async () => {
    const row = selected()
    if (!row) return
    const group = row.group
    const { ids, total } = groupDeleteTargets(group, sessions())
    if (ids.length === 0) return
    const hasCurrent = from !== undefined && containsSession(ids, from)
    const text = t().removeGroup
    const confirmed = await context.ui.dialog.confirm({
      title: text.title(group.label),
      message: [
        text.message(t().modes[mode()], group.label, total),
        hasCurrent ? text.current : undefined,
        t().remove.irreversible,
      ]
        .filter(Boolean)
        .join("\n"),
      label: { confirm: text.confirm(total), cancel: t().remove.cancel },
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
      context.ui.toast.show({ message: t().removeGroup.failed(failed.length), variant: "error" })
    } else {
      context.ui.toast.show({ message: t().removeGroup.done(group.label, total), variant: "success" })
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

  context.keymap.layer(() => {
    const keys = t().keys
    const group = keys.group
    return {
      priority: 100,
      enabled: () => !busy(),
      commands: [
        { title: keys.up, group, bind: "up,k", run: () => move(-1) },
        { title: keys.down, group, bind: "down,j", run: () => move(1) },
        { title: keys.pageUp, group, bind: "pageup", run: () => move(-pageSize()) },
        { title: keys.pageDown, group, bind: "pagedown", run: () => move(pageSize()) },
        { title: keys.first, group, bind: "home,g", run: () => select(0) },
        { title: keys.last, group, bind: "end,shift+g", run: () => select(rows().length - 1) },
        { title: keys.open, group, bind: "return", run: activate },
        {
          title: keys.collapse,
          group,
          bind: "space",
          run: () => {
            const row = selected()
            if (row) toggleCollapse(row.group.key)
          },
        },
        { title: keys.nextMode, group, bind: "tab", run: () => cycleMode(1) },
        { title: keys.previousMode, group, bind: "shift+tab", run: () => cycleMode(-1) },
        { title: keys.children, group, bind: "c", run: toggleChildren },
        { title: keys.rename, group, bind: "r", run: () => void rename() },
        { title: keys.delete, group, bind: "d", run: () => void removeOne() },
        { title: keys.deleteGroup, group, bind: "shift+d", run: () => void removeGroup() },
        { title: keys.refresh, group, bind: "f5,shift+r", run: () => void refresh() },
        { title: keys.language, group, bind: "l", run: () => setLocale(nextLocale(locale())) },
        { title: keys.back, group, bind: "escape,q", run: back },
      ],
    }
  })

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
          <b>{t().title}</b>
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
                {item === mode() ? `[${t().modes[item]}]` : ` ${t().modes[item]} `}
              </text>
            )}
          </For>
        </box>
        <box flexGrow={1} />
        <text wrapMode="none" flexShrink={0} fg={theme.text.muted} onMouseUp={toggleChildren}>
          {t().status.children(showChildren())} · {t().status.total(visibleCount())}
        </text>
        <box flexDirection="row" flexShrink={0}>
          <For each={LOCALE_CODES}>
            {(code, position) => (
              <text
                wrapMode="none"
                flexShrink={0}
                fg={code === locale() ? theme.text.action.primary.base : theme.text.muted}
                onMouseUp={() => setLocale(code)}
              >
                <Show when={position() > 0}>
                  <span style={{ fg: theme.text.faint }}> | </span>
                </Show>
                {code === locale() ? <b>{LOCALES[code].label}</b> : LOCALES[code].label}
              </text>
            )}
          </For>
        </box>
      </box>

      <Show when={!loading()} fallback={<text fg={theme.text.muted}>{t().status.loading}</text>}>
        <Show when={!error()} fallback={<text fg={theme.text.feedback.error.base}>{t().status.loadFailed(error() ?? "")}</text>}>
          <Show when={rows().length > 0} fallback={<text fg={theme.text.muted}>{t().status.empty}</text>}>
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
                  const age = () => formatAge(sortTime(session, mode() === "directory" || mode() === "project" ? "updated" : mode()), now(), t().age)
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
        {hint("↑↓", t().hints.select)}
        {hint("Enter", t().hints.open)}
        {hint("Tab", t().hints.mode)}
        {hint("c", t().hints.children)}
        {hint("r", t().hints.rename)}
        {hint("d", t().hints.delete)}
        {hint("D", t().hints.deleteGroup)}
        {hint("F5", t().hints.refresh)}
        {hint("l", t().hints.language)}
        {hint("Esc", t().hints.back)}
      </box>
    </box>
  )
}
