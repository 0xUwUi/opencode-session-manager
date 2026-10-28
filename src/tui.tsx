/** @jsxImportSource @opentui/solid */

import { Plugin } from "@opencode/plugin/tui"
import { SessionManagerPage } from "./panel.tsx"

const ROUTE = "manager"

export default Plugin.define({
  id: "session-manager",
  setup(context) {
    const unregister = context.ui.router.register({
      name: ROUTE,
      render: ({ data }) => (
        <SessionManagerPage context={context} from={typeof data?.from === "string" ? data.from : undefined} />
      ),
    })

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "session-manager.open",
          title: "Session 管理",
          description: "按目录、项目、时间分类管理全部 session",
          group: "Session",
          palette: true,
          slash: { name: "session-manager", aliases: ["sm"] },
          run: () => {
            const route = context.ui.router.current()
            if (route.type === "plugin" && route.name === ROUTE) return
            context.ui.router.navigate({
              type: "plugin",
              name: ROUTE,
              data: { from: route.type === "session" ? route.sessionID : undefined },
            })
          },
        },
      ],
    }))

    return unregister
  },
})
