import type { Transform } from "jscodeshift";

import { entryPointAliases } from "./util/entryPointAliases.js";
import { handleModuleRename } from "./util/handleModuleRename.js";

const legacyEntrypointTransform: Transform = function transform(file, api) {
  const j = api.jscodeshift;
  const source = j(file.source);
  const context = { j, source };

  let modified = false;
  for (const [to, legacy] of Object.entries(entryPointAliases)) {
    for (const from of legacy) {
      handleModuleRename({
        rename: { to: { module: to }, from: { module: from } },
        context,
        onModify() {
          modified = true;
        },
      });
    }
  }
  return modified ? source.toSource() : undefined;
};
export default legacyEntrypointTransform;
