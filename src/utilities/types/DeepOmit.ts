import type { Primitive } from "./Primitive.js";

// DeepOmit primitives include functions since these are unmodified.
type DeepOmitPrimitive = Primitive | Function;

export type DeepOmitArray<T extends any[], K> = {
  [P in keyof T]: DeepOmit<T[P], K>;
};

// Unfortunately there is one major flaw in this type: This will omit properties
// from class instances in the return type even though our omitDeep helper
// ignores class instances, therefore resulting in a type mismatch between
// the return value and the runtime value.
//
// It is not currently possible with TypeScript to distinguish between plain
// objects and class instances.
// https://github.com/microsoft/TypeScript/issues/29063
//
// This should be fine as of the time of this writing until omitDeep gets
// broader use since this utility is only used to strip __typename from
// `variables`; a case in which class instances are invalid anyways.
export type DeepOmit<T, K> =
  T extends DeepOmitPrimitive ? T
  : {
      [P in Exclude<keyof T, K>]: T[P] extends infer TP ?
        TP extends DeepOmitPrimitive ? TP
        : TP extends any[] ? DeepOmitArray<TP, K>
        : DeepOmit<TP, K>
      : never;
    };
