import { rule as requireUsingDisposable } from "./require-using-disposable.ts";
import { rule as requireDisableActEnvironment } from "./require-disable-act-environment.ts";
import { rule as forbidActInDisabledActEnvironment } from "./forbid-act-in-disabled-act-environment.ts";

export default {
  "require-using-disposable": requireUsingDisposable,
  "require-disable-act-environment": requireDisableActEnvironment,
  "forbid-act-in-disabled-act-environment": forbidActInDisabledActEnvironment,
};
