/**
 *  used via e.g.
```sh
node --experimental-transform-types --no-warnings --conditions 'react-server' config/listImports.ts @apollo/client/react
```
from `src/__tests__/exports.ts
*/
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.endsWith(".js")) {
        for (const ext of [".ts", ".tsx"]) {
          return nextResolve(specifier.slice(0, -3) + ext, context);
        }
      }
      throw e;
    }
  },
});

Object.keys(await import(process.argv[2]))
  .sort()
  .forEach((i) => console.log(i));
