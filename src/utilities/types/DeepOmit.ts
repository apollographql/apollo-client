import { Primitive } from './Primitive';

export type DeepOmitArray<T extends any[], K> = {
  [P in keyof T]: DeepOmit<T[P], K>;
};

export type DeepOmit<T, K> = T extends Primitive
  ? T
  : {
      [P in Exclude<keyof T, K>]: T[P] extends infer TP
        ? TP extends Primitive
          ? TP
          : TP extends any[]
          ? DeepOmitArray<TP, K>
          : DeepOmit<TP, K>
        : never;
    };
