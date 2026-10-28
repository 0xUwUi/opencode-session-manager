# @0xuwui/opencode-session-manager

[English](./README.md) | 简体中文

OpenCode v2 TUI 插件：在一个全屏页面里分类浏览全部 session，支持重命名、删除单个 session、删除整个分类。界面支持英文和简体中文，默认英文。

## 环境要求

- OpenCode v2.2.0 或更高版本（终端 TUI）

## 安装

这是一个只在终端运行的 TUI 插件，配置写在 `cli.json`（Linux/macOS 默认位置 `~/.config/opencode/cli.json`）。

### 方式一：从插件仓库安装（推荐）

> npm：https://www.npmjs.com/package/@0xuwui/opencode-session-manager

在 `cli.json` 的 `plugins` 里加入包名：

```json
{
  "plugins": ["@0xuwui/opencode-session-manager"]
}
```

固定版本：

```json
{
  "plugins": ["@0xuwui/opencode-session-manager@0.1.1"]
}
```

保存后重启 OpenCode TUI。

### 方式二：从源码安装

```sh
git clone <REPO_URL> ~/opencode-plugins/session-manager
cd ~/opencode-plugins/session-manager
npm install
npm run build
```

然后在 `cli.json` 里写插件目录的绝对路径：

```json
{
  "plugins": ["/home/<你的用户名>/opencode-plugins/session-manager"]
}
```

保存后重启 OpenCode TUI。

### 验证安装

在输入框输入 `/sm`，补全列表里能看到 `/sm` 和 `/session-manager` 即安装成功。

### 停用与卸载

- 临时停用：在 `plugins` 里该插件条目之后加上 `"-session-manager"`（条目按顺序处理）。
- 卸载：从 `plugins` 里删掉对应条目并重启。插件设置保存在 OpenCode 的 TUI 状态目录（`~/.local/state/opencode/.../tui/plugin.session-manager.settings.json`），可一并删除。

## 使用

输入 `/session-manager`（别名 `/sm`），或在命令面板（Ctrl+P）里选择「Session Manager」。

### 分类方式

| 分类 | 依据 |
| --- | --- |
| 目录 | session 的工作目录 |
| 项目 | `projectID`，同一个 git 仓库（含子目录和 worktree）归为一类；非仓库目录归入「无仓库 (global)」 |
| 创建时间 | 今天 / 昨天 / 最近 7 天 / 最近 30 天 / 更早 |
| 最后更新 | 同上，按 session 内容最后变化的时间 |
| 最后查看 | 同上，按最后一次打开查看的时间，没有记录时用最后更新时间 |

分类方式、子 session 开关和界面语言都会保存，下次打开沿用。

### 快捷键

| 按键 | 作用 |
| --- | --- |
| ↑ ↓ / j k | 选择 |
| PgUp PgDn / g G | 翻页 / 跳到首尾 |
| Enter | 打开 session；在分组标题上折叠/展开 |
| Space | 折叠/展开当前分组 |
| Tab / Shift+Tab | 切换分类方式 |
| c | 显示/隐藏子 session（显示时以树状结构挂在父 session 下） |
| r | 重命名 |
| d | 删除选中的 session（连同它的子 session） |
| D | 删除选中项所在分类下的全部 session |
| l | 切换界面语言 |
| F5 / R | 刷新 |
| Esc / q | 返回打开前的页面 |

鼠标单击选中，再次单击打开；点击顶部分类名可直接切换分类，点击右上角的 `EN | 中文` 切换语言。

删除前都会确认，并显示会删除的数量（含子 session）。当前正在使用的 session 也可以删除，删除后它的标签页会被关闭。删除不可恢复。

## 添加新语言

界面文字全部在 `src/i18n/` 中：

1. 复制 `src/i18n/en.ts` 为新文件，例如 `src/i18n/ja.ts`，导出一个 `Messages` 对象并翻译全部文字。漏掉的字段会在类型检查时报错。
2. 在 `src/i18n/index.ts` 的 `LOCALES` 里注册：`ja: { label: "日本語", name: "日本語", messages: ja }`。`label` 会显示在右上角的语言切换里。
3. 运行 `npm run typecheck` 和 `npm test`。

斜杠命令和命令面板（Ctrl+P）里的命令名称与说明固定为英文。

## 开发

```sh
npm install
npm test           # 单元测试
npm run typecheck  # 类型检查
npm run build      # 把 src/ 编译到 dist/，插件实际加载的是 dist/
```

目录结构：

- `src/tui.tsx`：插件入口，注册命令和页面
- `src/panel.tsx`：管理页面
- `src/grouping.ts`：分组与树结构逻辑（无 UI 依赖）
- `src/i18n/`：语言包

## 许可证

MIT
