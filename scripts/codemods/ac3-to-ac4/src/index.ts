import type { API, FileInfo, Options, Transform } from "jscodeshift";

import clientSetup from "./apolloClientInitialization.js";
import imports from "./imports.js";
import legacyEntrypoints from "./legacyEntrypoints.js";
import links from "./links.js";
import removals from "./removals.js";
import { monkeyPatchAstTypes } from "./util/monkeyPatchAstTypes.js";

export const codemods = {
  legacyEntrypoints,
  imports,
  links,
  removals,
  clientSetup,
} satisfies Record<string, Transform>;

export default async function transform(
  file: FileInfo,
  api: API,
  options: Options
): Promise<string | undefined> {
  monkeyPatchAstTypes(api.jscodeshift);

  const run =
    "codemod" in options ?
      Array.isArray(options.codemod) ?
        options.codemod
      : [options.codemod]
    : Object.keys(codemods);

  let all_skipped = true;

  for (const codemod of run) {
    if (codemod in codemods) {
      const ret = await codemods[codemod as keyof typeof codemods](
        file,
        api,
        options
      );

      if (typeof ret === "string" && ret !== file.source) {
        file.source = ret;
        all_skipped = false;
      }
    } else {
      console.warn(`Codemod "${codemod}" not found, skipping.`);
      process.exitCode = 1;
    }
  }

  return all_skipped ? undefined : file.source;
}
