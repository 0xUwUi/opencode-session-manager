import type { Messages } from "./types.ts"

export const zhCN: Messages = {
  title: "Session 管理",
  modes: {
    directory: "目录",
    project: "项目",
    created: "创建时间",
    updated: "最后更新",
    viewed: "最后查看",
  },
  buckets: {
    today: "今天",
    yesterday: "昨天",
    week: "最近 7 天",
    month: "最近 30 天",
    earlier: "更早",
  },
  noProject: "无仓库 (global)",

  age: {
    now: "刚刚",
    minutes: (count) => `${count} 分钟前`,
    hours: (count) => `${count} 小时前`,
    days: (count) => `${count} 天前`,
  },

  status: {
    children: (shown) => `子 session: ${shown ? "显示" : "隐藏"}`,
    total: (count) => `共 ${count} 个`,
    loading: "加载中…",
    loadFailed: (error) => `加载失败：${error}`,
    empty: "没有 session",
  },

  search: {
    placeholder: "搜索标题和目录",
    matches: (count) => `${count} 个匹配`,
    noMatch: (query) => `没有匹配“${query}”的 session`,
  },

  hints: {
    select: "选择",
    open: "打开/折叠",
    mode: "切换分类",
    children: "子 session",
    rename: "重命名",
    delete: "删除",
    deleteGroup: "删除分类",
    refresh: "刷新",
    search: "搜索",
    language: "语言",
    back: "返回",
  },

  keys: {
    group: "Session 管理",
    up: "上一项",
    down: "下一项",
    pageUp: "上一页",
    pageDown: "下一页",
    first: "第一项",
    last: "最后一项",
    open: "打开 / 折叠",
    collapse: "折叠分组",
    nextMode: "下一种分类",
    previousMode: "上一种分类",
    children: "显示 / 隐藏子 session",
    rename: "重命名",
    delete: "删除 session",
    deleteGroup: "删除整个分类",
    refresh: "刷新",
    search: "搜索 session",
    finishSearch: "结束输入，保留筛选",
    clearSearch: "清除搜索",
    language: "切换语言",
    back: "返回",
  },

  rename: {
    title: "重命名 session",
    done: (title) => `已重命名为「${title}」`,
  },

  remove: {
    title: "删除 session",
    message: (title) => `删除「${title}」？`,
    children: (count) => `它的 ${count} 个子 session 也会一起删除。`,
    current: "这是当前正在使用的 session。",
    irreversible: "此操作不可恢复。",
    confirm: "删除",
    cancel: "取消",
    done: (count) => `已删除 ${count} 个 session`,
  },

  removeGroup: {
    title: (label) => `删除分类「${label}」`,
    message: (mode, label, count) => `将删除「${mode}」分类「${label}」下的全部 ${count} 个 session（含子 session）。`,
    current: "其中包含当前正在使用的 session。",
    filtered: "只包含符合当前搜索条件的 session。",
    confirm: (count) => `删除 ${count} 个`,
    failed: (count) => `${count} 个 session 删除失败`,
    done: (label, count) => `已删除分类「${label}」下的 ${count} 个 session`,
  },
}
