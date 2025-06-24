import type { API, FileInfo, Options, Transform } from "jscodeshift";

import imports from "./imports.js";

export const codemods = { imports } satisfies Record<string, Transform>;

export default async function transform(
  file: FileInfo,
  api: API,
  options: Options
): Promise<string | undefined> {
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
