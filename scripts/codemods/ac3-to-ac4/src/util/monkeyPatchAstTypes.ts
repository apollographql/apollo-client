import type { JSCodeshift } from "jscodeshift";

const patched = new WeakSet();

// https://github.com/benjamn/ast-types/pull/954
export function monkeyPatchAstTypes(j: JSCodeshift) {
  if (patched.has(j.types.Type)) {
    return;
  }
  patched.add(j.types.Type);

  const ce = j.types.Type.def("CallExpression");
  ce.finalized = false;
  ce.bases("TSHasOptionalTypeParameterInstantiation");
  ce.finalize();
  const ne = j.types.Type.def("NewExpression");
  ne.finalized = false;
  ne.bases("TSHasOptionalTypeParameterInstantiation");
  ne.finalize();
}
