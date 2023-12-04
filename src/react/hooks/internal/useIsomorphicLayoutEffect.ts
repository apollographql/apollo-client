import * as React from "rehackt";
import { canUseDOM } from "../../../utilities/index.js";

// use canUseDOM here instead of canUseLayoutEffect because we want to be able
// to use useLayoutEffect in our jest tests. useLayoutEffect seems to work fine
// in useSuspenseQuery tests, but to honor the original comment about the
// warnings for useSyncExternalStore implementation, canUseLayoutEffect is left
// alone.
export const useIsomorphicLayoutEffect =
  canUseDOM ? React.useLayoutEffect : React.useEffect;
