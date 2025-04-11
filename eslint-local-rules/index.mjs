import { rule as forbidActInDisabledActEnvironment } from "./forbid-act-in-disabled-act-environment.ts";
import {
  importFromExport,
  importFromInsideOtherExport,
  noDuplicateExports,
  noInternalImportOfficialExport,
  noRelativeImports,
} from "./import-from-export.ts";
import { rule as requireDisableActEnvironment } from "./require-disable-act-environment.ts";
import { rule as requireUsingDisposable } from "./require-using-disposable.ts";

export default {
  "require-using-disposable": requireUsingDisposable,
  "require-disable-act-environment": requireDisableActEnvironment,
  "forbid-act-in-disabled-act-environment": forbidActInDisabledActEnvironment,
  "import-from-export": importFromExport,
  "import-from-inside-other-export": importFromInsideOtherExport,
  "no-internal-import-official-export": noInternalImportOfficialExport,
  "no-duplicate-exports": noDuplicateExports,
  "no-relative-imports": noRelativeImports,
};
