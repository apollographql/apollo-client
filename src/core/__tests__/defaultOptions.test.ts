import { expectTypeOf } from "expect-type";

import type { OptionalIfDefault_HigherOrder } from "../defaultOptions.js";

expectTypeOf<
  OptionalIfDefault_HigherOrder<
    // user declaration
    {},
    // default global value
    { errorPolicy: "none" },
    // hook overload value
    { errorPolicy: "none" }
  >
>().toEqualTypeOf<{ errorPolicy?: "none" }>();

expectTypeOf<
  OptionalIfDefault_HigherOrder<
    { errorPolicy: "none" },
    { errorPolicy: "none" },
    { errorPolicy: "none" }
  >
>().toEqualTypeOf<{ errorPolicy?: "none" }>();

expectTypeOf<
  OptionalIfDefault_HigherOrder<
    { errorPolicy: "none" },
    { errorPolicy: "none" },
    { errorPolicy: "ignore" }
  >
>().toEqualTypeOf<{ errorPolicy: "ignore" }>();

expectTypeOf<
  OptionalIfDefault_HigherOrder<
    { errorPolicy: "ignore" },
    { errorPolicy: "none" },
    { errorPolicy: "none" }
  >
>().toEqualTypeOf<{ errorPolicy: "none" }>();

expectTypeOf<
  OptionalIfDefault_HigherOrder<
    { errorPolicy: "ignore" },
    { errorPolicy: "none" },
    { errorPolicy: "ignore" | "all" }
  >
>().toEqualTypeOf<{ errorPolicy?: "ignore" | "all" }>();

expectTypeOf<
  OptionalIfDefault_HigherOrder<
    { errorPolicy: "none" },
    { errorPolicy: "none" },
    { errorPolicy: "ignore" | "all" }
  >
>().toEqualTypeOf<{ errorPolicy: "ignore" | "all" }>();

expectTypeOf<
  OptionalIfDefault_HigherOrder<
    { errorPolicy: "ignore" },
    { errorPolicy: "none" },
    {}
  >
>().toEqualTypeOf<{}>();

expectTypeOf<
  OptionalIfDefault_HigherOrder<
    {},
    { errorPolicy: "none"; returnPartialData: false },
    { errorPolicy: "none"; returnPartialData: false }
  >
>().toEqualTypeOf<{ errorPolicy?: "none"; returnPartialData?: false }>();

expectTypeOf<
  OptionalIfDefault_HigherOrder<
    {},
    { errorPolicy: "none"; returnPartialData: false },
    { errorPolicy: "none"; returnPartialData: true }
  >
>().toEqualTypeOf<{
  errorPolicy?: "none";
  returnPartialData: true;
}>();

expectTypeOf<
  OptionalIfDefault_HigherOrder<
    { errorPolicy: "ignore" },
    { errorPolicy: "none"; returnPartialData: false },
    { errorPolicy: "none"; returnPartialData: false }
  >
>().toEqualTypeOf<{ errorPolicy: "none"; returnPartialData?: false }>();

expectTypeOf<
  OptionalIfDefault_HigherOrder<
    { returnPartialData: true },
    { errorPolicy: "none"; returnPartialData: false },
    { errorPolicy: "none"; returnPartialData: false }
  >
>().toEqualTypeOf<{ errorPolicy?: "none"; returnPartialData: false }>();

expectTypeOf<
  OptionalIfDefault_HigherOrder<
    { errorPolicy: "ignore"; returnPartialData: true },
    { errorPolicy: "none"; returnPartialData: false },
    { errorPolicy: "none"; returnPartialData: false }
  >
>().toEqualTypeOf<{ errorPolicy: "none"; returnPartialData: false }>();
