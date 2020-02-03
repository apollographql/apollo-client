import {
  InlineFragmentNode,
  FragmentDefinitionNode,
  SelectionSetNode,
  FieldNode,
} from "graphql";

import { KeyTrie } from 'optimism';
import { invariant, InvariantError } from 'ts-invariant';

import {
  FragmentMap,
  getFragmentFromSelection,
} from '../../utilities/graphql/fragments';

import {
  isField,
  getTypenameFromResult,
  valueToObjectRepresentation,
  storeKeyNameFromField,
  StoreValue,
  argumentsObjectFromField,
  Reference,
  makeReference,
  isReference,
} from '../../utilities/graphql/storeUtils';

import { maybeDeepFreeze } from '../../utilities/common/maybeDeepFreeze';
import { canUseWeakMap } from '../../utilities/common/canUse';

import {
  IdGetter,
  StoreObject,
  NormalizedCache,
} from "./types";

import {
  fieldNameFromStoreName,
  FieldValueToBeMerged,
  isFieldValueToBeMerged,
} from './helpers';

const hasOwn = Object.prototype.hasOwnProperty;

export type TypePolicies = {
  [__typename: string]: TypePolicy;
}

// TypeScript 3.7 will allow recursive type aliases, so this should work:
// type KeySpecifier = (string | KeySpecifier)[]
type KeySpecifier = (string | any[])[];

type KeyFieldsFunction = (
  object: Readonly<StoreObject>,
  context: {
    typename: string;
    selectionSet?: SelectionSetNode;
    fragmentMap?: FragmentMap;
    policies: Policies;
  },
) => ReturnType<IdGetter>;

export type TypePolicy = {
  // Allows defining the primary key fields for this type, either using an
  // array of field names or a function that returns an arbitrary string.
  keyFields?: KeySpecifier | KeyFieldsFunction | false;

  // In the rare event that your schema happens to use a different
  // __typename for the root Query, Mutation, and/or Schema types, you can
  // express your deviant preferences by enabling one of these options.
  queryType?: true,
  mutationType?: true,
  subscriptionType?: true,

  fields?: {
    [fieldName: string]:
      | FieldPolicy<any>
      | FieldReadFunction<any>;
  }
};

type KeyArgsFunction = (
  field: FieldNode,
  context: {
    typename: string;
    variables: Record<string, any>;
    policies: Policies;
  },
) => ReturnType<IdGetter>;

// The Readonly<T> type only really works for object types, since it marks
// all of the object's properties as readonly, but there are many cases when
// a generic type parameter like TExisting might be a string or some other
// primitive type, in which case we need to avoid wrapping it with Readonly.
// SafeReadonly<string> collapses to just string, which makes string
// assignable to SafeReadonly<any>, whereas string is not assignable to
// Readonly<any>, somewhat surprisingly.
type SafeReadonly<T> = T extends object ? Readonly<T> : T;

export type FieldPolicy<
  TExisting = any,
  TIncoming = TExisting,
  TReadResult = TExisting,
> = {
  keyArgs?: KeySpecifier | KeyArgsFunction | false;
  read?: FieldReadFunction<TExisting, TReadResult>;
  merge?: FieldMergeFunction<TExisting, TIncoming>;
};

export type FieldValueGetter =
  ReturnType<Policies["makeFieldValueGetter"]>;

type StorageType = Record<string, any>;

export interface FieldFunctionOptions<
  TArgs = Record<string, any>,
  TVars = Record<string, any>,
> {
  args: TArgs | null;

  // The name of the field, equal to options.field.name.value when
  // options.field is available. Useful if you reuse the same function for
  // multiple fields, and you need to know which field you're currently
  // processing. Always a string, even when options.field is null.
  fieldName: string;

  // The FieldNode object used to read this field. Useful if you need to
  // know about other attributes of the field, such as its directives. This
  // option will be null when a string was passed to options.readField.
  field: FieldNode | null;

  variables?: TVars;

  // In rare advanced use cases, a read or merge function may wish to
  // consult the current Policies object, for example to call
  // getStoreFieldName manually.
  policies: Policies;

  // Utilities for dealing with { __ref } objects.
  isReference: typeof isReference;
  toReference: Policies["toReference"];

  // Helper function for reading other fields within the current object.
  // If a foreign object or reference is provided, the field will be read
  // from that object instead of the current object, so this function can
  // be used (together with isReference) to examine the cache outside the
  // current object. If a FieldNode is passed instead of a string, and
  // that FieldNode has arguments, the same options.variables will be used
  // to compute the argument values. Note that this function will invoke
  // custom read functions for other fields, if defined. Always returns
  // immutable data (enforced with Object.freeze in development).
  readField<T = StoreValue>(
    nameOrField: string | FieldNode,
    foreignObjOrRef?: StoreObject | Reference,
  ): SafeReadonly<T>;

  // A handy place to put field-specific data that you want to survive
  // across multiple read function calls. Useful for field-level caching,
  // if your read function does any expensive work.
  storage: StorageType;

  // Instead of just merging objects with { ...existing, ...incoming }, this
  // helper function can be used to merge objects in a way that respects any
  // custom merge functions defined for their fields.
  mergeObjects<T extends StoreObject | Reference>(
    existing: T,
    incoming: T,
  ): T;
}

export type FieldReadFunction<TExisting = any, TReadResult = TExisting> = (
  // When reading a field, one often needs to know about any existing
  // value stored for that field. If the field is read before any value
  // has been written to the cache, this existing parameter will be
  // undefined, which makes it easy to use a default parameter expression
  // to supply the initial value. This parameter is positional (rather
  // than one of the named options) because that makes it possible for the
  // developer to annotate it with a type, without also having to provide
  // a whole new type for the options object.
  existing: SafeReadonly<TExisting> | undefined,
  options: FieldFunctionOptions,
) => TReadResult;

export type FieldMergeFunction<TExisting = any, TIncoming = TExisting> = (
  existing: SafeReadonly<TExisting> | undefined,
  // The incoming parameter needs to be positional as well, for the same
  // reasons discussed in FieldReadFunction above.
  incoming: SafeReadonly<TIncoming>,
  options: FieldFunctionOptions,
) => TExisting;

export function defaultDataIdFromObject(object: StoreObject) {
  const { __typename, id, _id } = object;
  if (typeof __typename === "string") {
    if (typeof id !== "undefined") return `${__typename}:${id}`;
    if (typeof _id !== "undefined") return `${__typename}:${_id}`;
  }
  return null;
}

const nullKeyFieldsFn: KeyFieldsFunction = () => null;
const simpleKeyArgsFn: KeyArgsFunction = field => field.name.value;

export type PossibleTypesMap = {
  [supertype: string]: string[];
};

export class Policies {
  private typePolicies: {
    [__typename: string]: {
      keyFn?: KeyFieldsFunction;
      subtypes?: Set<string>;
      fields?: {
        [fieldName: string]: {
          keyFn?: KeyArgsFunction;
          read?: FieldReadFunction<any>;
          merge?: FieldMergeFunction<any>;
        };
      };
    };
  } = Object.create(null);

  public readonly rootTypenamesById: Readonly<Record<string, string>> = {
    __proto__: null, // Equivalent to Object.create(null)
    ROOT_QUERY: "Query",
    ROOT_MUTATION: "Mutation",
    ROOT_SUBSCRIPTION: "Subscription",
  };

  public readonly usingPossibleTypes = false;

  constructor(private config: {
    dataIdFromObject?: KeyFieldsFunction;
    possibleTypes?: PossibleTypesMap;
    typePolicies?: TypePolicies;
  } = {}) {
    this.config = {
      dataIdFromObject: defaultDataIdFromObject,
      ...config,
    };

    if (config.possibleTypes) {
      this.addPossibleTypes(config.possibleTypes);
    }

    if (config.typePolicies) {
      this.addTypePolicies(config.typePolicies);
    }
  }

  // Bound function that returns a Reference using this.identify.
  // Provided to read/merge functions as part of their options.
  public toReference = (
    object: StoreObject,
    selectionSet?: SelectionSetNode,
    fragmentMap?: FragmentMap,
  ) => {
    const id = this.identify(object, selectionSet, fragmentMap);
    return id && makeReference(id);
  }

  public identify(
    object: StoreObject,
    selectionSet?: SelectionSetNode,
    fragmentMap?: FragmentMap,
  ): string | null {
    // TODO Consider subtypes?
    // TODO Use an AliasMap here?
    const typename = selectionSet && fragmentMap
      ? getTypenameFromResult(object, selectionSet, fragmentMap)
      : object.__typename;

    const context = {
      typename,
      selectionSet,
      fragmentMap,
      policies: this,
    };

    let id: string | null;

    const policy = this.getTypePolicy(typename, false);
    const keyFn = policy && policy.keyFn;
    if (keyFn) {
      id = keyFn(object, context);
    } else {
      id = this.config.dataIdFromObject
        ? this.config.dataIdFromObject(object, context)
        : null;
    }

    return id && String(id);
  }

  public addTypePolicies(typePolicies: TypePolicies) {
    Object.keys(typePolicies).forEach(typename => {
      const existing = this.getTypePolicy(typename, true);
      const incoming = typePolicies[typename];
      const { keyFields, fields } = incoming;

      if (incoming.queryType) this.setRootTypename("Query", typename);
      if (incoming.mutationType) this.setRootTypename("Mutation", typename);
      if (incoming.subscriptionType) this.setRootTypename("Subscription", typename);

      existing.keyFn =
        // Pass false to disable normalization for this typename.
        keyFields === false ? nullKeyFieldsFn :
        // Pass an array of strings to use those fields to compute a
        // composite ID for objects of this typename.
        Array.isArray(keyFields) ? keyFieldsFnFromSpecifier(keyFields) :
        // Pass a function to take full control over identification.
        typeof keyFields === "function" ? keyFields : void 0;

      if (fields) {
        Object.keys(fields).forEach(fieldName => {
          const existing = this.getFieldPolicy(typename, fieldName, true);
          const incoming = fields[fieldName];

          if (typeof incoming === "function") {
            existing.read = incoming;
          } else {
            const { keyArgs, read, merge } = incoming;

            existing.keyFn =
              // Pass false to disable argument-based differentiation of
              // field identities.
              keyArgs === false ? simpleKeyArgsFn :
              // Pass an array of strings to use named arguments to
              // compute a composite identity for the field.
              Array.isArray(keyArgs) ? keyArgsFnFromSpecifier(keyArgs) :
              // Pass a function to take full control over field identity.
              typeof keyArgs === "function" ? keyArgs :
              // Leave existing.keyFn unchanged if all above cases fail.
              existing.keyFn;

            if (typeof read === "function") existing.read = read;
            if (typeof merge === "function") existing.merge = merge;
          }

          if (existing.read && existing.merge) {
            // If we have both a read and a merge function, assume
            // keyArgs:false, because read and merge together can take
            // responsibility for interpreting arguments in and out. This
            // default assumption can always be overridden by specifying
            // keyArgs explicitly in the FieldPolicy.
            existing.keyFn = existing.keyFn || simpleKeyArgsFn;
          }
        });
      }
    });
  }

  private setRootTypename(
    which: "Query" | "Mutation" | "Subscription",
    typename: string,
  ) {
    const rootId = "ROOT_" + which.toUpperCase();
    const old = this.rootTypenamesById[rootId];
    if (typename !== old) {
      invariant(old === which, `Cannot change root ${which} __typename more than once`);
      (this.rootTypenamesById as any)[rootId] = typename;
    }
  }

  public addPossibleTypes(possibleTypes: PossibleTypesMap) {
    (this.usingPossibleTypes as boolean) = true;
    Object.keys(possibleTypes).forEach(supertype => {
      const subtypeSet = this.getSubtypeSet(supertype, true);
      possibleTypes[supertype].forEach(subtypeSet.add, subtypeSet);
    });
  }

  private getTypePolicy(
    typename: string,
    createIfMissing: boolean,
  ): Policies["typePolicies"][string] {
    if (typename) {
      return this.typePolicies[typename] || (
        createIfMissing && (this.typePolicies[typename] = Object.create(null)));
    }
  }

  private getSubtypeSet(
    supertype: string,
    createIfMissing: boolean,
  ): Set<string> {
    const policy = this.getTypePolicy(supertype, createIfMissing);
    if (policy) {
      return policy.subtypes || (
        createIfMissing && (policy.subtypes = new Set<string>()));
    }
  }

  private getFieldPolicy(
    typename: string,
    fieldName: string,
    createIfMissing: boolean,
  ): Policies["typePolicies"][string]["fields"][string] {
    const typePolicy = this.getTypePolicy(typename, createIfMissing);
    if (typePolicy) {
      const fieldPolicies = typePolicy.fields || (
        createIfMissing && (typePolicy.fields = Object.create(null)));
      if (fieldPolicies) {
        return fieldPolicies[fieldName] || (
          createIfMissing && (fieldPolicies[fieldName] = Object.create(null)));
      }
    }
  }

  public fragmentMatches(
    fragment: InlineFragmentNode | FragmentDefinitionNode,
    typename: string,
  ): boolean {
    if (!fragment.typeCondition) return true;

    // If the fragment has a type condition but the object we're matching
    // against does not have a __typename, the fragment cannot match.
    if (!typename) return false;

    const supertype = fragment.typeCondition.name.value;
    if (typename === supertype) return true;

    if (this.usingPossibleTypes) {
      const workQueue = [this.getSubtypeSet(supertype, false)];
      // It's important to keep evaluating workQueue.length each time through
      // the loop, because the queue can grow while we're iterating over it.
      for (let i = 0; i < workQueue.length; ++i) {
        const subtypes = workQueue[i];
        if (subtypes) {
          if (subtypes.has(typename)) return true;
          subtypes.forEach(subtype => {
            const subsubtypes = this.getSubtypeSet(subtype, false);
            if (subsubtypes && workQueue.indexOf(subsubtypes) < 0) {
              workQueue.push(subsubtypes);
            }
          });
        }
      }
    }

    return false;
  }

  public makeFieldValueGetter(store: NormalizedCache) {
    const policies = this;

    // Provides a uniform interface for reading field values, whether or not
    // objectOrReference is a normalized entity.
    return function getFieldValue<T = StoreValue>(
      objectOrReference: StoreObject | Reference,
      storeFieldName: string,
    ): SafeReadonly<T> {
      let fieldValue: StoreValue;
      if (isReference(objectOrReference)) {
        const dataId = objectOrReference.__ref;
        fieldValue = store.get(dataId, storeFieldName);
        if (fieldValue === void 0 && storeFieldName === "__typename") {
          // We can infer the __typename of singleton root objects like
          // ROOT_QUERY ("Query") and ROOT_MUTATION ("Mutation"), even if
          // we have never written that information into the cache.
          return policies.rootTypenamesById[dataId] as any;
        }
      } else {
        fieldValue = objectOrReference && objectOrReference[storeFieldName];
      }
      // Enforce Readonly<T> at runtime, in development.
      return maybeDeepFreeze(fieldValue) as SafeReadonly<T>;
    };
  }

  public getStoreFieldName(
    typename: string | undefined,
    field: FieldNode,
    variables: Record<string, any>,
  ): string {
    const fieldName = field.name.value;
    let storeFieldName: string | undefined;

    if (typeof typename === "string") {
      const policy = this.getFieldPolicy(typename, fieldName, false);
      const keyFn = policy && policy.keyFn;
      if (keyFn) {
        // If the custom keyFn returns a falsy value, fall back to
        // fieldName instead.
        storeFieldName = keyFn(field, {
          typename,
          variables,
          policies: this,
        }) || fieldName;
      }
    }

    if (storeFieldName === void 0) {
      storeFieldName = storeKeyNameFromField(field, variables);
    }

    // Make sure custom field names start with the actual field.name.value
    // of the field, so we can always figure out which properties of a
    // StoreObject correspond to which original field names.
    return fieldName === fieldNameFromStoreName(storeFieldName)
      ? storeFieldName
      : fieldName + ":" + storeFieldName;
  }

  private storageTrie = new KeyTrie<StorageType>(true);

  public readField<V = StoreValue>(
    objectOrReference: StoreObject | Reference,
    nameOrField: string | FieldNode,
    getFieldValue: FieldValueGetter,
    variables?: Record<string, any>,
    typename = getFieldValue<string>(objectOrReference, "__typename"),
  ): SafeReadonly<V> {
    invariant(
      objectOrReference,
      "Must provide an object or Reference when calling Policies#readField",
    );

    const policies = this;
    const storeFieldName = typeof nameOrField === "string" ? nameOrField
      : policies.getStoreFieldName(typename, nameOrField, variables);
    const fieldName = fieldNameFromStoreName(storeFieldName);
    const existing = getFieldValue<V>(objectOrReference, storeFieldName);
    const policy = policies.getFieldPolicy(typename, fieldName, false);
    const read = policy && policy.read;

    if (read) {
      const storage = policies.storageTrie.lookup(
        isReference(objectOrReference)
          ? objectOrReference.__ref
          : objectOrReference,
        storeFieldName,
      );

      return read(existing, makeFieldFunctionOptions(
        policies,
        typename,
        objectOrReference,
        nameOrField,
        storage,
        getFieldValue,
        variables,
      )) as SafeReadonly<V>;
    }

    return existing;
  }

  public hasMergeFunction(
    typename: string,
    fieldName: string,
  ) {
    const policy = this.getFieldPolicy(typename, fieldName, false);
    return !!(policy && policy.merge);
  }

  public applyMerges<T extends StoreValue>(
    existing: T | Reference,
    incoming: T | FieldValueToBeMerged,
    getFieldValue: FieldValueGetter,
    variables: Record<string, any>,
    storageKeys?: [string | StoreObject, string],
  ): T {
    const policies = this;

    if (isFieldValueToBeMerged(incoming)) {
      const field = incoming.__field;
      const fieldName = field.name.value;
      // This policy and its merge function are guaranteed to exist
      // because the incoming value is a FieldValueToBeMerged object.
      const { merge } = policies.getFieldPolicy(
        incoming.__typename, fieldName, false);

      // If storage ends up null, that just means no options.storage object
      // has ever been created for a read function for this field before, so
      // there's nothing this merge function could do with options.storage
      // that would help the read function do its work. Most merge functions
      // will never need to worry about options.storage, but if you're reading
      // this comment then you probably have good reasons for wanting to know
      // esoteric details like these, you wizard, you.
      const storage = storageKeys
        ? policies.storageTrie.lookupArray(storageKeys)
        : null;

      incoming = merge(existing, incoming.__value, makeFieldFunctionOptions(
        policies,
        incoming.__typename,
        // Unlike options.readField for read functions, we do not fall
        // back to the current object if no foreignObjOrRef is provided,
        // because it's not clear what the current object should be for
        // merge functions: the (possibly undefined) existing object, or
        // the incoming object? If you think your merge function needs
        // to read sibling fields in order to produce a new value for
        // the current field, you might want to rethink your strategy,
        // because that's a recipe for making merge behavior sensitive
        // to the order in which fields are written into the cache.
        // However, readField(name, ref) is useful for merge functions
        // that need to deduplicate child objects and references.
        null,
        field,
        storage,
        getFieldValue,
        variables,
      )) as T;
    }

    if (incoming && typeof incoming === "object") {
      if (isReference(incoming)) {
        return incoming;
      }

      if (Array.isArray(incoming)) {
        return incoming.map(item => policies.applyMerges(
          // Items in the same position in different arrays are not
          // necessarily related to each other, so there is no basis for
          // merging them. Passing void here means any FieldValueToBeMerged
          // objects within item will be handled as if there was no existing
          // data. Also, we do not pass storageKeys because the array itself
          // is never an entity with a __typename, so its indices can never
          // have custom read or merge functions.
          void 0,
          item,
          getFieldValue,
          variables,
        )) as T;
      }

      const e = existing as StoreObject | Reference;
      const i = incoming as object as StoreObject;

      // If the existing object is a { __ref } object, e.__ref provides a
      // stable key for looking up the storage object associated with
      // e.__ref and storeFieldName. Otherwise, storage is enabled only if
      // existing is actually a non-null object. It's less common for a
      // merge function to use options.storage, but it's conceivable that a
      // pair of read and merge functions might want to cooperate in
      // managing their shared options.storage object.
      const firstStorageKey = isReference(e)
        ? e.__ref
        : typeof e === "object" && e;

      Object.keys(i).forEach(storeFieldName => {
        i[storeFieldName] = policies.applyMerges(
          getFieldValue(e, storeFieldName),
          i[storeFieldName],
          getFieldValue,
          variables,
          // Avoid enabling storage when firstStorageKey is falsy, which
          // implies no options.storage object has ever been created for a
          // read function for this field.
          firstStorageKey && [firstStorageKey, storeFieldName],
        );
      });
    }

    return incoming;
  }
}

function makeFieldFunctionOptions(
  policies: Policies,
  typename: string,
  objectOrReference: StoreObject | Reference,
  nameOrField: string | FieldNode,
  storage: StorageType,
  getFieldValue: FieldValueGetter,
  variables?: Record<string, any>,
): FieldFunctionOptions {
  const storeFieldName = typeof nameOrField === "string" ? nameOrField :
    policies.getStoreFieldName(typename, nameOrField, variables);
  const fieldName = fieldNameFromStoreName(storeFieldName);
  return {
    args: typeof nameOrField === "string" ? null :
      argumentsObjectFromField(nameOrField, variables),
    field: typeof nameOrField === "string" ? null : nameOrField,
    fieldName,
    variables,
    policies,
    isReference,
    toReference: policies.toReference,
    storage,

    readField<T>(
      nameOrField: string | FieldNode,
      foreignObjOrRef: StoreObject | Reference,
    ) {
      return policies.readField<T>(
        foreignObjOrRef || objectOrReference,
        nameOrField,
        getFieldValue,
        variables,
      );
    },

    mergeObjects(existing, incoming) {
      if (Array.isArray(existing) || Array.isArray(incoming)) {
        throw new InvariantError("Cannot automatically merge arrays");
      }

      // These dynamic checks are necessary because the parameters of a
      // custom merge function can easily have the any type, so the type
      // system cannot always enforce the StoreObject | Reference
      // parameter types of options.mergeObjects.
      if (existing && typeof existing === "object" &&
          incoming && typeof incoming === "object") {
        const eType = getFieldValue(existing, "__typename");
        const iType = getFieldValue(incoming, "__typename");
        const typesDiffer = eType && iType && eType !== iType;

        const applied = policies.applyMerges(
          typesDiffer ? void 0 : existing,
          incoming,
          getFieldValue,
          variables,
        );

        if (
          typesDiffer ||
          !canBeMerged(existing) ||
          !canBeMerged(applied)
        ) {
          return applied;
        }

        return { ...existing, ...applied };
      }

      return incoming;
    }
  };
}

function canBeMerged(obj: StoreValue): boolean {
  return obj && typeof obj === "object" &&
    !isReference(obj) && !Array.isArray(obj);
}

function keyArgsFnFromSpecifier(
  specifier: KeySpecifier,
): KeyArgsFunction {
  const topLevelArgNames: Record<string, true> = Object.create(null);

  specifier.forEach(name => {
    if (typeof name === "string") {
      topLevelArgNames[name] = true;
    }
  });

  return (field, context) => {
    const fieldName = field.name.value;

    if (field.arguments && field.arguments.length > 0) {
      const args = Object.create(null);

      field.arguments.forEach(arg => {
        // Avoid converting arguments that were not mentioned in the specifier.
        if (topLevelArgNames[arg.name.value] === true) {
          valueToObjectRepresentation(args, arg.name, arg.value, context.variables);
        }
      });

      return `${fieldName}:${
        JSON.stringify(computeKeyObject(args, specifier))
      }`;
    }

    return fieldName;
  };
}

function keyFieldsFnFromSpecifier(
  specifier: KeySpecifier,
): KeyFieldsFunction {
  const trie = new KeyTrie<{
    aliasMap?: AliasMap;
  }>(canUseWeakMap);

  return (object, context) => {
    let aliasMap: AliasMap;
    if (context.selectionSet && context.fragmentMap) {
      const info = trie.lookupArray([
        context.selectionSet,
        context.fragmentMap,
      ]);
      aliasMap = info.aliasMap || (
        info.aliasMap = makeAliasMap(context.selectionSet, context.fragmentMap)
      );
    }
    return `${context.typename}:${
      JSON.stringify(computeKeyObject(object, specifier, aliasMap))
    }`;
  };
}

type AliasMap = {
  // Map from store key to corresponding response key. Undefined when there are
  // no aliased fields in this selection set.
  aliases?: Record<string, string>;
  // Map from store key to AliasMap correponding to a child selection set.
  // Undefined when there are no child selection sets.
  subsets?: Record<string, AliasMap>;
};

function makeAliasMap(
  selectionSet: SelectionSetNode,
  fragmentMap: FragmentMap,
): AliasMap {
  let map: AliasMap = Object.create(null);
  // TODO Cache this work, perhaps by storing selectionSet._aliasMap?
  const workQueue = new Set([selectionSet]);
  workQueue.forEach(selectionSet => {
    selectionSet.selections.forEach(selection => {
      if (isField(selection)) {
        if (selection.alias) {
          const responseKey = selection.alias.value;
          const storeKey = selection.name.value;
          if (storeKey !== responseKey) {
            const aliases = map.aliases || (map.aliases = Object.create(null));
            aliases[storeKey] = responseKey;
          }
        }
        if (selection.selectionSet) {
          const subsets = map.subsets || (map.subsets = Object.create(null));
          subsets[selection.name.value] =
            makeAliasMap(selection.selectionSet, fragmentMap);
        }
      } else {
        const fragment = getFragmentFromSelection(selection, fragmentMap);
        workQueue.add(fragment.selectionSet);
      }
    });
  });
  return map;
}

function computeKeyObject(
  response: Record<string, any>,
  specifier: KeySpecifier,
  aliasMap?: AliasMap,
): Record<string, any> {
  const keyObj = Object.create(null);
  let prevKey: string | undefined;
  specifier.forEach(s => {
    if (Array.isArray(s)) {
      if (typeof prevKey === "string") {
        const subsets = aliasMap && aliasMap.subsets;
        const subset = subsets && subsets[prevKey];
        keyObj[prevKey] = computeKeyObject(response[prevKey], s, subset);
      }
    } else {
      const aliases = aliasMap && aliasMap.aliases;
      const responseName = aliases && aliases[s] || s;
      invariant(
        hasOwn.call(response, responseName),
        // TODO Make this appropriate for keyArgs as well
        `Missing field ${responseName} while computing key fields`,
      );
      keyObj[prevKey = s] = response[responseName];
    }
  });
  return keyObj;
}
