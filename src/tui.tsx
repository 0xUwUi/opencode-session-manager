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
          title: "Session Manager",
          description: "Browse, rename and delete sessions grouped by directory, project or time",
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
