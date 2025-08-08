import { HKT } from "@apollo/client/utilities";

type CustomMaskImplementation<TData> = {
  [K in keyof TData as K extends `_${string}` ? never : K]: TData[K];
};

interface CustomMaskType extends HKT {
  arg1: unknown; // TData
  return: CustomMaskImplementation<this["arg1"]>;
}

export interface CustomDataMaskingImplementation {
  Mask: CustomMaskType;
}

declare module "@apollo/client" {
  export interface TypeOverrides extends CustomDataMaskingImplementation {}
}

import { Mask } from "@apollo/client";

type TestMasked = Mask<{
  _id: string;
  name: string;
  _description: string;
  age: number;
}>;

const test: TestMasked = {
  age: 30,
  name: "John Doe",
  // _id and _description are omitted
  // @ts-expect-error
  _id: "123",
  _description: "A description",
};

if (test) {
  // just referencing _test to ensure it is "used" to prevent build errors
}
