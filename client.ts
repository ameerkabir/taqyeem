import { run } from 'remix/component'

// Matches the `app/**/public/**` convention used for browser-reachable modules.
const clientModules = import.meta.glob(['/app/**/public/**/*.{ts,tsx}'])

run({
  async loadModule(moduleUrl, exportName) {
    let load = clientModules[moduleUrl]

    if (!load) {
      throw new Error(`Unknown client entry module: ${moduleUrl}`)
    }

    let mod = await load()

    if (!mod || typeof mod !== 'object') {
      throw new Error(`Invalid client entry module: ${moduleUrl}`)
    }

    let entry = Reflect.get(mod, exportName)

    if (typeof entry !== 'function') {
      throw new Error(`Missing client entry export ${exportName} in ${moduleUrl}`)
    }

    return entry
  },
})
