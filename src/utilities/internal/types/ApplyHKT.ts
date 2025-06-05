import type { HKT } from "@apollo/client/utilities";

/**
 * @internal
 */

export type ApplyHKT<
  fn extends HKT,
  arg1,
  arg2 = never,
  arg3 = never,
  arg4 = never,
> = (fn & {
  arg1: arg1;
  arg2: arg2;
  arg3: arg3;
  arg4: arg4;
})["return"];
