# Session Manager TUI 插件设计

## 目的

OpenCode v2 内置的 `/sessions` 只能按目录浏览、逐个操作。这个插件提供一个全屏管理页面，
按多种方式给全部 session 分类，并支持重命名、删除单个 session、删除整个分类。

## 目标

- 四种分类方式：按目录（`location.directory`）、按项目（`projectID`，同一仓库）、
  按创建时间（`time.created`）、按最后使用时间。最后使用时间分两种：
  最后更新（`time.updated`）和最后查看（`time.viewed`，缺失时回退到 `time.updated`）。
  所以分类方式共五种。
- 时间分类按时间段分组：今天、昨天、最近 7 天、最近 30 天、更早。
- 子 session 开关：关闭时只显示根 session；打开时子 session 以树状缩进显示在父 session 下面。
- 操作：回车打开 session，`r` 重命名，`d` 删除单个（连同其子 session），
  `D` 删除当前选中项所在分类下的全部 session。删除都需要确认，批量删除显示数量。
- 当前正在使用的 session 也允许删除。
- 分类方式和子 session 开关持久化保存。

## 非目标

- 不处理已归档 session。
- 不做搜索、多选、桌面 GUI 版本。

## 约束（已验证）

- `DELETE /api/session/{id}` 会连同子 session 一起删除（用临时 session 实测）。
- `GET /api/session` 不带过滤时返回所有目录的 session，用 `cursor.next` 分页。
- `PATCH /api/session/{id}` 的 `title` 字段用于重命名。
- 内置命令已占用 `/sessions`、`session.list`、`session.delete`、`session.rename`。
  插件使用 `/session-manager`（别名 `/sm`），命令 ID 前缀为 `session-manager.`。

## 方案

1. **自定义全屏插件页面（已选）**：用 `ui.router.register` 注册页面，自绘列表和树状结构，
   页面内快捷键用 `keymap.layer`。功能完整，代码量最大。
2. 内置 `dialog.select`：代码少、外观与原版一致，但没有真正的树状结构，切换分类要重开对话框。
3. `session.panel`：只能在会话内打开，不适合全局管理，排除。

选 1，因为树状显示、开关和按分类删除只有它能完整实现。

## 结构

- `src/tui.tsx`：插件入口，注册页面和命令。
- `src/grouping.ts`：纯函数，负责分组、建树、时间段划分、拉平成可渲染的行，有单元测试。
- `src/panel.tsx`：页面组件，负责加载数据、渲染、快捷键、调用 API。

## 留给实现者决定

- 具体配色和布局细节。
- 列表刷新：监听 `session.created`、`session.renamed`、`session.deleted` 事件，防抖后重新拉取。
