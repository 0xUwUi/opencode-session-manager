# opencode-session-manager

OpenCode v2 TUI 插件：在一个全屏页面里分类浏览全部 session，支持重命名、删除单个 session、删除整个分类。

## 安装

把插件目录加到 `~/.config/opencode/cli.json`：

```json
{
  "plugins": ["/home/user/codes/opencode/session-manager"]
}
```

重启 TUI 后输入 `/session-manager`（别名 `/sm`），或在命令面板（Ctrl+P）里选择「Session 管理」。

## 分类方式

| 分类 | 依据 |
| --- | --- |
| 目录 | session 的工作目录 |
| 项目 | `projectID`，同一个 git 仓库（含子目录和 worktree）归为一类；非仓库目录归入「无仓库 (global)」 |
| 创建时间 | 今天 / 昨天 / 最近 7 天 / 最近 30 天 / 更早 |
| 最后更新 | 同上，按 session 内容最后变化的时间 |
| 最后查看 | 同上，按最后一次打开查看的时间，没有记录时用最后更新时间 |

分类方式和子 session 开关会保存，下次打开沿用。

## 快捷键

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
| F5 / R | 刷新 |
| Esc / q | 返回打开前的页面 |

鼠标单击选中，再次单击打开；点击顶部分类名可直接切换。

删除前都会确认，并显示会删除的数量（含子 session）。当前正在使用的 session 也可以删除，删除后它的标签页会被关闭。删除不可恢复。

## 开发

```sh
npm install
npm test        # 分组逻辑单元测试
npm run typecheck
```
