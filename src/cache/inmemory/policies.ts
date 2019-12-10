import {
  InlineFragmentNode,
  FragmentDefinitionNode,
  SelectionSetNode,
  FieldNode,
} from "graphql";

import { dep, KeyTrie } from 'optimism';
import invariant from 'ts-invariant';

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

import { canUseWeakMap } from '../../utilities/common/canUse';

import {
  IdGetter,
  StoreObject,
} from "./types";

import { fieldNameFromStoreName } from './helpers';
import { FieldValueGetter } from './readFromStore';

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

type TypePolicy = {
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
      | FieldPolicy<StoreValue>
      | FieldReadFunction<StoreValue>;
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

export type FieldPolicy<TValue> = {
  keyArgs?: KeySpecifier | KeyArgsFunction | false;
  read?: FieldReadFunction<TValue>;
  merge?: FieldMergeFunction<TValue>;
};

interface FieldFunctionOptions {
  args: Record<string, any> | null;

  // When a field function is called as part of reading or writing a
  // query, options.field will be a FieldNode from the query, but it could
  // be the field.name.value string instead, if the function was called
  // via options.readField(fieldName).
  field: string | FieldNode;

  variables?: Record<string, any>;

  // In rare advanced use cases, a read or merge function may wish to
  // consult the current Policies object, for example to call
  // getStoreFieldName manually.
  policies: Policies;

  // Utilities for dealing with { __ref } objects.
  isReference: typeof isReference;
  toReference: Policies["toReference"];
}

type StorageType = Record<string, any>;

interface ReadFunctionOptions extends FieldFunctionOptions {
  // A handy place to put field-specific data that you want to survive
  // across multiple read function calls. Useful for caching.
  storage: StorageType;

  // Call this function to invalidate any cached queries that previously
  // consumed this field. If you use options.storage as a cache, setting a
  // new value in the cache and then calling options.invalidate() can be a
  // good way to deliver asynchronous results.
  invalidate(): void;

  // Gets the existing StoreValue for a given field within the current
  // object, without calling any read functions (to prevent any risk of
  // infinite recursion). If the provided FieldNode has arguments, the
  // same options.variables will be used to compute the argument values.
  // If a foreignRef is provided, the value will be read from that object
  // instead of the current object, so this function can be used (together
  // with isReference) to examine the cache outside the current entity.
  readField<T = StoreValue>(
    nameOrField: string | FieldNode,
    foreignRef?: Reference,
  ): Readonly<T>;
}

type FieldReadFunction<TExisting, TResult = TExisting> = (
  // When reading a field, one often needs to know about any existing
  // value stored for that field. If the field is read before any value
  // has been written to the cache, this existing parameter will be
  // undefined, which makes it easy to use a default parameter expression
  // to supply the initial value. This parameter is positional (rather
  // than one of the named options) because that makes it possible for the
  // developer to annotate it with a type, without also having to provide
  // a whole new type for the options object.
  existing: Readonly<TExisting> | undefined,
  options: ReadFunctionOptions,
) => TResult;

type FieldMergeFunction<TExisting> = (
  existing: Readonly<TExisting> | undefined,
  // The incoming parameter needs to be positional as well, for the same
  // reasons discussed in FieldReadFunction above.
  incoming: Readonly<StoreValue>,
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
          read?: FieldReadFunction<StoreValue>;
          merge?: FieldMergeFunction<StoreValue>;
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
              typeof keyArgs === "function" ? keyArgs : void 0;

            if (typeof read === "function") existing.read = read;
            if (typeof merge === "function") existing.merge = merge;
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
    const { typePolicies } = this;
    return typePolicies[typename] || (
      createIfMissing && (typePolicies[typename] = Object.create(null)));
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
  ): boolean | "heuristic" {
    if (!fragment.typeCondition) return true;

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
      // When possibleTypes is defined, we always either return true from the
      // loop above or return false here (never 'heuristic' below).
      return false;
    }

    return "heuristic";
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
  private fieldDep = dep<StorageType>();

  public readField<V = StoreValue>(
    objectOrReference: StoreObject | Reference,
    nameOrField: string | FieldNode,
    getFieldValue: FieldValueGetter,
    variables?: Record<string, any>,
  ): Readonly<V> {
    const policies = this;
    const typename = getFieldValue<string>(objectOrReference, "__typename");
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

      // By depending on the options.storage object when we call
      // policy.read, we can easily invalidate the result of the read
      // function when/if the options.invalidate function is called.
      policies.fieldDep(storage);

      return read(existing, {
        args: typeof nameOrField === "string" ? null :
          argumentsObjectFromField(nameOrField, variables),
        field: typeof nameOrField === "string" ? fieldName : nameOrField,
        variables,
        policies,
        isReference,
        toReference: policies.toReference,
        storage,
        // I'm not sure why it's necessary to repeat the parameter types
        // here, but TypeScript complains if I leave them out.
        readField<T>(nameOrField: string | FieldNode, ref?: Reference) {
          return policies.readField<T>(
            ref || objectOrReference,
            nameOrField,
            getFieldValue,
            variables,
          );
        },
        invalidate() {
          policies.fieldDep.dirty(storage);
        },
      }) as Readonly<V>;
    }

    return existing;
  }

  public getFieldMergeFunction(
    typename: string,
    field: FieldNode,
    variables?: Record<string, any>,
  ): StoreValueMergeFunction {
    const policies = this;
    const policy = policies.getFieldPolicy(typename, field.name.value, false);
    const merge = policy && policy.merge;
    if (merge) {
      const args = argumentsObjectFromField(field, variables);
      return (
        existing: StoreValue,
        incoming: StoreValue,
      ) => merge(existing, incoming, {
        args,
        field,
        variables,
        policies,
        isReference,
        toReference: policies.toReference,
      });
    }
  }
}

export type StoreValueMergeFunction = (
  existing: StoreValue,
  incoming: StoreValue,
) => StoreValue;

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
