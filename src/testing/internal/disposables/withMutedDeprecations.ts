import { withCleanup } from "./withCleanup.js";
import { global as untypedGlobal } from "../../../utilities/globals/index.js";

const muteAllDeprecations = Symbol.for("apollo.deprecations");
const global = untypedGlobal as { [muteAllDeprecations]?: boolean };

export function withMutedDeprecations() {
  const prev = { prevMuted: global[muteAllDeprecations] };
  global[muteAllDeprecations] = true;

  return withCleanup(prev, ({ prevMuted }) => {
    global[muteAllDeprecations] = prevMuted;
  });
}
