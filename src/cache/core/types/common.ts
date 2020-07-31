import { FieldNode } from 'graphql';

import {
  Reference,
  StoreObject,
  StoreValue,
  isReference,
} from '../../../utilities';

// The Readonly<T> type only really works for object types, since it marks
// all of the object's properties as readonly, but there are many cases when
// a generic type parameter like TExisting might be a string or some other
// primitive type, in which case we need to avoid wrapping it with Readonly.
// SafeReadonly<string> collapses to just string, which makes string
// assignable to SafeReadonly<any>, whereas string is not assignable to
// Readonly<any>, somewhat surprisingly.
export type SafeReadonly<T> = T extends object ? Readonly<T> : T;

export class MissingFieldError {
  constructor(
    public readonly message: string,
    public readonly path: (string | number)[],
    public readonly query: import('graphql').DocumentNode,
    public readonly variables?: Record<string, any>,
  ) {}
}

export interface FieldSpecifier {
  typename?: string;
  fieldName: string;
  field?: FieldNode;
  args?: Record<string, any>;
  variables?: Record<string, any>;
}

export interface ReadFieldOptions extends FieldSpecifier {
  from?: StoreObject | Reference;
}

export interface ReadFieldFunction {
  <V = StoreValue>(options: ReadFieldOptions): SafeReadonly<V> | undefined;
  <V = StoreValue>(
    fieldName: string,
    from?: StoreObject | Reference,
  ): SafeReadonly<V> | undefined;
}

export type ToReferenceFunction = (
  objOrIdOrRef: StoreObject | string | Reference,
  mergeIntoStore?: boolean,
) => Reference | undefined;

export type CanReadFunction = (value: StoreValue) => boolean;

export type Modifier<T> = (value: T, details: {
  DELETE: any;
  fieldName: string;
  storeFieldName: string;
  readField: ReadFieldFunction;
  canRead: CanReadFunction;
  isReference: typeof isReference;
  toReference: ToReferenceFunction;
}) => T;

export type Modifiers = {
  [fieldName: string]: Modifier<any>;
};
