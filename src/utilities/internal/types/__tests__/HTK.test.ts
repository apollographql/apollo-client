import { expectTypeOf } from "expect-type";

import type { CustomHKT } from "@apollo/client";
import type { HKT } from "@apollo/client/utilities";
import type {
  ApplyHKT,
  ApplyHKTImplementationWithDefault,
} from "@apollo/client/utilities/internal";

declare module "@apollo/client" {
  export interface CustomHKT {
    Masked: CustomMaskedType;
  }
}

interface CustomMaskedType extends HKT {
  arg1: unknown; // TData
  return: CustomMaskedImplementation<this["arg1"]>;
}

type CustomMaskedImplementation<TData> = {
  [K in keyof TData as K extends `_${string}` ? never : K]: TData[K];
};

it.skip("type tests", () => {
  type BaseType = {
    _id: string;
    name: string;
    _description: string;
    age: number;
  };

  type ExpectedResult = {
    name: string;
    age: number;
  };

  {
    // base type does what we want
    type Result = CustomMaskedImplementation<BaseType>;
    expectTypeOf<Result>().toEqualTypeOf<ExpectedResult>();
  }

  {
    // HKT/ApplyHKT type do what we want
    type Result = ApplyHKT<CustomMaskedType, BaseType>;
    expectTypeOf<Result>().toEqualTypeOf<ExpectedResult>();
  }

  {
    // ApplyHKTImplementationWithDefault with a globally augmented interface
    type Result = ApplyHKTImplementationWithDefault<
      CustomHKT,
      "Masked",
      {
        // this default implementation would return `unknown`
        Masked: HKT;
      },
      BaseType
    >;
    expectTypeOf<Result>().toEqualTypeOf<ExpectedResult>();
  }

  {
    interface Concat extends HKT {
      arg1: string;
      arg2: string;
      return: `${this["arg1"]}${this["arg2"]}`;
    }

    type Result = ApplyHKT<Concat, "Hello, ", "world!">;

    expectTypeOf<Result>().toEqualTypeOf<"Hello, world!">();
  }
});
