import type { Messages } from "./types.ts"

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

export const en: Messages = {
  title: "Session Manager",
  modes: {
    directory: "Directory",
    project: "Project",
    created: "Created",
    updated: "Updated",
    viewed: "Viewed",
  },
  buckets: {
    today: "Today",
    yesterday: "Yesterday",
    week: "Last 7 days",
    month: "Last 30 days",
    earlier: "Earlier",
  },
  noProject: "No repository (global)",

  age: {
    now: "just now",
    minutes: (count) => `${count}m ago`,
    hours: (count) => `${count}h ago`,
    days: (count) => `${count}d ago`,
  },

  status: {
    children: (shown) => `Subsessions: ${shown ? "shown" : "hidden"}`,
    total: (count) => plural(count, "session"),
    loading: "Loading…",
    loadFailed: (error) => `Failed to load sessions: ${error}`,
    empty: "No sessions",
  },

  hints: {
    select: "select",
    open: "open/fold",
    mode: "group by",
    children: "subsessions",
    rename: "rename",
    delete: "delete",
    deleteGroup: "delete group",
    refresh: "refresh",
    language: "language",
    back: "back",
  },

  keys: {
    group: "Session Manager",
    up: "Previous item",
    down: "Next item",
    pageUp: "Page up",
    pageDown: "Page down",
    first: "First item",
    last: "Last item",
    open: "Open session / fold group",
    collapse: "Fold group",
    nextMode: "Next grouping",
    previousMode: "Previous grouping",
    children: "Show / hide subsessions",
    rename: "Rename session",
    delete: "Delete session",
    deleteGroup: "Delete whole group",
    refresh: "Refresh",
    language: "Switch language",
    back: "Back",
  },

  rename: {
    title: "Rename session",
    done: (title) => `Renamed to "${title}"`,
  },

  remove: {
    title: "Delete session",
    message: (title) => `Delete "${title}"?`,
    children: (count) => `Its ${plural(count, "subsession")} will be deleted too.`,
    current: "This is the session you are currently using.",
    irreversible: "This cannot be undone.",
    confirm: "Delete",
    cancel: "Cancel",
    done: (count) => `Deleted ${plural(count, "session")}`,
  },

  removeGroup: {
    title: (label) => `Delete group "${label}"`,
    message: (mode, label, count) =>
      `All ${plural(count, "session")} in the ${mode} group "${label}" will be deleted, including subsessions.`,
    current: "This includes the session you are currently using.",
    confirm: (count) => `Delete ${count}`,
    failed: (count) => `Failed to delete ${plural(count, "session")}`,
    done: (label, count) => `Deleted ${plural(count, "session")} in "${label}"`,
  },
}
