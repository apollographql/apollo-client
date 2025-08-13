import type { Transform } from "jscodeshift";

import { renames } from "./renames.js";
import type { ImportKind } from "./types.js";
import { handleIdentiferRename } from "./util/handleIdentiferRename.js";
import { handleModuleRename } from "./util/handleModuleRename.js";
import { monkeyPatchAstTypes } from "./util/monkeyPatchAstTypes.js";

declare module "ast-types" {
  export namespace namedTypes {
    interface ImportSpecifier {
      importKind?: ImportKind;
    }
  }
}

const importTransform: Transform = function transform(file, api) {
  const j = api.jscodeshift;
  const source = j(file.source);
  const context = { j, source };

  monkeyPatchAstTypes(j);

  let modified = false;
  for (const rename of renames) {
    if (!("importType" in rename)) {
      handleModuleRename({
        rename,
        context,
        onModify() {
          modified = true;
        },
      });
    } else {
      handleIdentiferRename({
        rename,
        context,
        onModify() {
          modified = true;
        },
      });
    }
  }
  return modified ? source.toSource() : undefined;
};

export default importTransform;
