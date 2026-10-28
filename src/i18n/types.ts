import type { GroupMode, TimeBucket } from "../grouping.ts"

/**
 * Every user-visible string in the session manager page.
 * To add a language, create a file in this folder that exports a `Messages`
 * object and register it in `LOCALES` in `./index.ts`.
 */
export interface Messages {
  readonly title: string
  readonly modes: Readonly<Record<GroupMode, string>>
  readonly buckets: Readonly<Record<TimeBucket, string>>
  readonly noProject: string

  readonly age: {
    readonly now: string
    readonly minutes: (count: number) => string
    readonly hours: (count: number) => string
    readonly days: (count: number) => string
  }

  readonly status: {
    readonly children: (shown: boolean) => string
    readonly total: (count: number) => string
    readonly loading: string
    readonly loadFailed: (error: string) => string
    readonly empty: string
  }

  readonly search: {
    readonly placeholder: string
    readonly matches: (count: number) => string
    readonly noMatch: (query: string) => string
  }

  readonly hints: {
    readonly select: string
    readonly open: string
    readonly mode: string
    readonly children: string
    readonly rename: string
    readonly delete: string
    readonly deleteGroup: string
    readonly refresh: string
    readonly search: string
    readonly language: string
    readonly back: string
  }

  readonly keys: {
    readonly group: string
    readonly up: string
    readonly down: string
    readonly pageUp: string
    readonly pageDown: string
    readonly first: string
    readonly last: string
    readonly open: string
    readonly collapse: string
    readonly nextMode: string
    readonly previousMode: string
    readonly children: string
    readonly rename: string
    readonly delete: string
    readonly deleteGroup: string
    readonly refresh: string
    readonly search: string
    readonly finishSearch: string
    readonly clearSearch: string
    readonly language: string
    readonly back: string
  }

  readonly rename: {
    readonly title: string
    readonly done: (title: string) => string
  }

  readonly remove: {
    readonly title: string
    readonly message: (title: string) => string
    readonly children: (count: number) => string
    readonly current: string
    readonly irreversible: string
    readonly confirm: string
    readonly cancel: string
    readonly done: (count: number) => string
  }

  readonly removeGroup: {
    readonly title: (label: string) => string
    readonly message: (mode: string, label: string, count: number) => string
    readonly current: string
    readonly filtered: string
    readonly confirm: (count: number) => string
    readonly failed: (count: number) => string
    readonly done: (label: string, count: number) => string
  }
}
