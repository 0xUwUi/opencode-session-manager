# @0xuwui/opencode-session-manager

English | [简体中文](./README.zh-CN.md)

A TUI plugin for OpenCode v2. It opens a full-screen page that lists all of your sessions grouped by directory, project or time, and lets you rename a session, delete a session, or delete every session in a group. The interface is available in English and Simplified Chinese. English is the default.

## Requirements

- OpenCode v2.2.0 or later (terminal TUI)

## Installation

This plugin runs only in the terminal TUI, so it is configured in `cli.json`. The default location on Linux and macOS is `~/.config/opencode/cli.json`.

### Option 1: install from the plugin registry (recommended)

> npm: https://www.npmjs.com/package/@0xuwui/opencode-session-manager

Add the package name to `plugins` in `cli.json`:

```json
{
  "plugins": ["@0xuwui/opencode-session-manager"]
}
```

To pin a version:

```json
{
  "plugins": ["@0xuwui/opencode-session-manager@0.1.2"]
}
```

Save the file and restart the OpenCode TUI.

### Option 2: install from source

```sh
git clone <REPO_URL> ~/opencode-plugins/session-manager
cd ~/opencode-plugins/session-manager
npm install
npm run build
```

Then add the absolute path of the plugin directory to `plugins` in `cli.json`:

```json
{
  "plugins": ["/home/<your-user>/opencode-plugins/session-manager"]
}
```

Save the file and restart the OpenCode TUI.

### Check the installation

Type `/sm` in the prompt. If `/sm` and `/session-manager` appear in the completion list, the plugin is loaded.

### Disable or uninstall

- To disable it temporarily, add `"-session-manager"` to `plugins` after the plugin's entry (entries are processed in order).
- To uninstall, remove its entry from `plugins` and restart. The plugin's settings are stored in OpenCode's TUI state directory (`~/.local/state/opencode/.../tui/plugin.session-manager.settings.json`); you can delete that file too.

## Usage

Run `/session-manager` (alias `/sm`), or pick **Session Manager** in the command palette (Ctrl+P).

### Grouping

| Group by | Based on |
| --- | --- |
| Directory | The session's working directory |
| Project | `projectID`. Sessions in the same git repository, including its subdirectories and worktrees, share a group. Sessions outside a repository go to "No repository (global)". |
| Created | Today / Yesterday / Last 7 days / Last 30 days / Earlier |
| Updated | Same buckets, by the last time the session's content changed |
| Viewed | Same buckets, by the last time the session was opened. Sessions never opened use their update time. |

The grouping, the subsession switch and the interface language are saved and reused next time.

### Keys

| Key | Action |
| --- | --- |
| ↑ ↓ / j k | Move selection |
| PgUp PgDn / g G | Page up and down / jump to first or last |
| Enter | Open the session; on a group header, fold or unfold it |
| Space | Fold or unfold the current group |
| Tab / Shift+Tab | Change grouping |
| c | Show or hide subsessions (shown as a tree under their parent) |
| r | Rename |
| d | Delete the selected session and its subsessions |
| D | Delete every session in the selected group (while searching, only the matching ones) |
| l | Switch interface language |
| / or Ctrl+F | Search titles and directories. While typing, ↑↓ still move the selection; Enter keeps the filter, Esc clears it |
| F5 / R | Refresh |
| Esc / q | Clear the search if one is active, otherwise go back to the page you came from |

With the mouse, click a row to select it and click again to open it. Click a grouping name at the top to switch to it, and click `EN | 中文` in the top-right corner to switch language.

Every delete asks for confirmation and shows how many sessions will be removed, including subsessions. You can delete the session you are currently using; its tab is closed afterwards. Deleted sessions cannot be recovered.

## Adding a language

All interface text lives in `src/i18n/`:

1. Copy `src/i18n/en.ts` to a new file, for example `src/i18n/ja.ts`. Export a `Messages` object and translate every string. The type checker reports any missing field.
2. Register it in `LOCALES` in `src/i18n/index.ts`: `ja: { label: "日本語", name: "日本語", messages: ja }`. `label` is what the language switch in the top-right corner shows.
3. Run `npm run typecheck` and `npm test`.

The slash command and the command palette (Ctrl+P) entry always use English.

## Development

```sh
npm install
npm test           # unit tests
npm run typecheck  # type check
npm run build      # compile src/ into dist/, which the plugin loads
```

Layout:

- `src/tui.tsx`: plugin entry; registers the command and the page
- `src/panel.tsx`: the manager page
- `src/grouping.ts`: grouping and tree logic, no UI dependencies
- `src/i18n/`: language packs

## License

MIT
