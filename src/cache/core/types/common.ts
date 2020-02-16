import { SelectionSetNode } from 'graphql';

import {
  isReference,
  StoreValue,
  StoreObject,
  Reference
} from '../../../utilities/graphql/storeUtils';
import { FragmentMap } from '../../../utilities/graphql/fragments';

// The Readonly<T> type only really works for object types, since it marks
// all of the object's properties as readonly, but there are many cases when
// a generic type parameter like TExisting might be a string or some other
// primitive type, in which case we need to avoid wrapping it with Readonly.
// SafeReadonly<string> collapses to just string, which makes string
// assignable to SafeReadonly<any>, whereas string is not assignable to
// Readonly<any>, somewhat surprisingly.
export type SafeReadonly<T> = T extends object ? Readonly<T> : T;

export type Modifier<T> = (value: T, details: {
  DELETE: any;
  fieldName: string;
  storeFieldName: string;
  isReference: typeof isReference;
  toReference(
    object: StoreObject,
    selectionSet?: SelectionSetNode,
    fragmentMap?: FragmentMap,
  ): Reference;
  readField<V = StoreValue>(
    fieldName: string,
    objOrRef?: StoreObject | Reference,
  ): SafeReadonly<V>;
}) => T;

export type Modifiers = {
  [fieldName: string]: Modifier<any>;
}
