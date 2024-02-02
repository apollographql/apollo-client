import { expectTypeOf } from "expect-type";
import type { CacheSizes, defaultCacheSizes } from "../sizes";

test.skip("type tests", () => {
  expectTypeOf<keyof CacheSizes>().toMatchTypeOf<
    keyof typeof defaultCacheSizes
  >();
  expectTypeOf<keyof typeof defaultCacheSizes>().toMatchTypeOf<
    keyof CacheSizes
  >();
});
