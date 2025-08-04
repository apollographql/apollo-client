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
