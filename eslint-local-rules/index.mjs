import { rule as requireUsingDisposable } from "./require-using-disposable.ts";
import { rule as requireDisableActEnvironment } from "./require-disable-act-environment.ts";
import { rule as forbidActInDisabledActEnvironment } from "./forbid-act-in-disabled-act-environment.ts";
import {
  importFromInsideOtherExport,
  importFromExport,
} from "./import-from-export.ts";

export default {
  "require-using-disposable": requireUsingDisposable,
  "require-disable-act-environment": requireDisableActEnvironment,
  "forbid-act-in-disabled-act-environment": forbidActInDisabledActEnvironment,
  "import-from-export": importFromExport,
  "import-from-inside-other-export": importFromInsideOtherExport,
};
