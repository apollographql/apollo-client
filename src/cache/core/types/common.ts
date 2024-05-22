import type { DocumentNode, FieldNode } from "graphql";

import type {
  Reference,
  StoreObject,
  StoreValue,
  isReference,
  AsStoreObject,
} from "../../../utilities/index.js";

import type { StorageType } from "../../inmemory/policies.js";

// The Readonly<T> type only really works for object types, since it marks
// all of the object's properties as readonly, but there are many cases when
// a generic type parameter like TExisting might be a string or some other
// primitive type, in which case we need to avoid wrapping it with Readonly.
// SafeReadonly<string> collapses to just string, which makes string
// assignable to SafeReadonly<any>, whereas string is not assignable to
// Readonly<any>, somewhat surprisingly.
export type SafeReadonly<T> = T extends object ? Readonly<T> : T;

export type MissingTree =
  | string
  | {
      readonly [key: string]: MissingTree;
    };

export class MissingFieldError extends Error {
  constructor(
    public readonly message: string,
    public readonly path: MissingTree | Array<string | number>,
    public readonly query: DocumentNode,
    public readonly variables?: Record<string, any>
  ) {
    // 'Error' breaks prototype chain here
    super(message);

    if (Array.isArray(this.path)) {
      this.missing = this.message;
      for (let i = this.path.length - 1; i >= 0; --i) {
        this.missing = { [this.path[i]]: this.missing };
      }
    } else {
      this.missing = this.path;
    }

    // We're not using `Object.setPrototypeOf` here as it isn't fully supported
    // on Android (see issue #3236).
    (this as any).__proto__ = MissingFieldError.prototype;
  }

  public readonly missing: MissingTree;
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
    from?: StoreObject | Reference
  ): SafeReadonly<V> | undefined;
}

export type ToReferenceFunction = (
  objOrIdOrRef: StoreObject | string | Reference,
  mergeIntoStore?: boolean
) => Reference | undefined;

export type CanReadFunction = (value: StoreValue) => boolean;

declare const _deleteModifier: unique symbol;
export interface DeleteModifier {
  [_deleteModifier]: true;
}
declare const _invalidateModifier: unique symbol;
export interface InvalidateModifier {
  [_invalidateModifier]: true;
}
declare const _ignoreModifier: unique symbol;
export interface IgnoreModifier {
  [_ignoreModifier]: true;
}

export type ModifierDetails = {
  DELETE: DeleteModifier;
  INVALIDATE: InvalidateModifier;
  fieldName: string;
  storeFieldName: string;
  readField: ReadFieldFunction;
  canRead: CanReadFunction;
  isReference: typeof isReference;
  toReference: ToReferenceFunction;
  storage: StorageType;
};

export type Modifier<T> = (
  value: T,
  details: ModifierDetails
) => T | DeleteModifier | InvalidateModifier;

type StoreObjectValueMaybeReference<StoreVal> =
  StoreVal extends Array<Record<string, any>> ?
    StoreVal extends Array<infer Item> ?
      Item extends Record<string, any> ?
        ReadonlyArray<AsStoreObject<Item> | Reference>
      : never
    : never
  : StoreVal extends Record<string, any> ? AsStoreObject<StoreVal> | Reference
  : StoreVal;

export type AllFieldsModifier<Entity extends Record<string, any>> = Modifier<
  Entity[keyof Entity] extends infer Value ?
    StoreObjectValueMaybeReference<Exclude<Value, undefined>>
  : never
>;

export type Modifiers<T extends Record<string, any> = Record<string, unknown>> =
  Partial<{
    [FieldName in keyof T]: Modifier<
      StoreObjectValueMaybeReference<Exclude<T[FieldName], undefined>>
    >;
  }>;
