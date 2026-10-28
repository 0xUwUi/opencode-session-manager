// OpenCode only applies the Solid JSX transform to plugin files outside node_modules,
// so the published package ships source that is already compiled for @opentui/solid.
import { transformAsync } from "@babel/core"
import presetSolid from "babel-preset-solid"
import presetTypescript from "@babel/preset-typescript"
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const srcDir = join(root, "src")
const outDir = join(root, "dist")

async function sources(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return sources(path)
      return /\.tsx?$/.test(entry.name) ? [path] : []
    }),
  )
  return files.flat()
}

const rewriteImports = (code) =>
  code.replace(/(from\s+["']|import\s*\(\s*["'])(\.{1,2}\/[^"']+)\.tsx?(["'])/g, "$1$2.js$3")

await rm(outDir, { recursive: true, force: true })
for (const file of await sources(srcDir)) {
  const input = await readFile(file, "utf8")
  const presets = [[presetTypescript, { isTSX: file.endsWith(".tsx"), allExtensions: true, onlyRemoveTypeImports: false }]]
  if (file.endsWith(".tsx")) presets.unshift([presetSolid, { moduleName: "@opentui/solid", generate: "universal" }])
  const result = await transformAsync(input, { filename: file, configFile: false, babelrc: false, presets })
  if (!result?.code) throw new Error(`Failed to compile ${file}`)
  const target = join(outDir, relative(srcDir, file)).replace(/\.tsx?$/, ".js")
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, rewriteImports(result.code) + "\n")
}
console.log(`Built ${relative(root, outDir)}`)
