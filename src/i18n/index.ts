import { en } from "./en.ts"
import { zhCN } from "./zh-CN.ts"
import type { Messages } from "./types.ts"

export type { Messages } from "./types.ts"

/**
 * Registered languages, in the order the language switch shows them.
 * `label` is written in the language itself so users can always find their own.
 * To add a language: create `./<code>.ts` exporting a `Messages` object, then add it here.
 */
export const LOCALES = {
  en: { label: "EN", name: "English", messages: en },
  "zh-CN": { label: "中文", name: "简体中文", messages: zhCN },
} as const satisfies Record<string, { label: string; name: string; messages: Messages }>

export type Locale = keyof typeof LOCALES

export const DEFAULT_LOCALE: Locale = "en"

export const LOCALE_CODES = Object.keys(LOCALES) as Locale[]

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(LOCALES, value)
}

export function messages(locale: Locale): Messages {
  return LOCALES[locale].messages
}

export function nextLocale(locale: Locale): Locale {
  return LOCALE_CODES[(LOCALE_CODES.indexOf(locale) + 1) % LOCALE_CODES.length]
}
