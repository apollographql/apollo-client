import type { API, FileInfo, Options } from "jscodeshift";

import imports from "./imports.js";

export default async function transform(
  file: FileInfo,
  api: API,
  options: Options
): Promise<void> {
  await imports(file, api, options);
}
