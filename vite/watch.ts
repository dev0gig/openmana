/*
 * What the dev server watches for changes. Below engine/ lie Forge's sources
 * (submodule), the engine build tree (~37 000 resource files) and the JVM
 * bridge: watching them exhausts the system's file watchers (ENOSPC) and
 * crashes the dev server. The app only imports engine/protocol and
 * engine/client, so only those stay watched; dist/, reports/ and the card
 * catalog build (cards/build: Scryfall downloads, the catalog) are output.
 */
import path from "node:path"

export function unwatchedPaths(root: string): (file: string) => boolean {
  const inside = (file: string, dir: string) => file === dir || file.startsWith(dir + path.sep)
  const engine = path.join(root, "engine")
  const watchedEngineParts = [path.join(engine, "protocol"), path.join(engine, "client")]
  const output = [path.join(root, "dist"), path.join(root, "reports"), path.join(root, "cards", "build")]
  return (file) => {
    const absolute = path.resolve(root, file)
    if (output.some((dir) => inside(absolute, dir))) return true
    return absolute !== engine && inside(absolute, engine) && !watchedEngineParts.some((dir) => inside(absolute, dir))
  }
}
