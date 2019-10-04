import {
  InlineFragmentNode,
  FragmentDefinitionNode,
  SelectionSetNode,
  FieldNode,
} from "graphql";

import { KeyTrie } from 'optimism';
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
} from '../../utilities/graphql/storeUtils';

import { canUseWeakMap } from '../../utilities/common/canUse';

import {
  IdGetter,
  StoreObject,
} from "./types";

const hasOwn = Object.prototype.hasOwnProperty;

export type TypePolicies = {
  [__typename: string]: TypePolicy;
}

// TypeScript 3.7 will allow recursive type aliases, so this should work:
// type KeySpecifier = (string | KeySpecifier)[]
type KeySpecifier = (string | any[])[];

type KeyFieldsFunction = (
  this: Policies,
  object: Readonly<StoreObject>,
  context: {
    typename: string;
    selectionSet?: SelectionSetNode;
    fragmentMap?: FragmentMap;
  },
) => ReturnType<IdGetter>;

type TypePolicy = {
  // Allows defining the primary key fields for this type, either using an
  // array of field names or a function that returns an arbitrary string.
  keyFields?: KeySpecifier | KeyFieldsFunction;
  fields?: {
    [fieldName: string]: FieldPolicy;
  }
};

type KeyArgsFunction = (
  this: Policies,
  field: FieldNode,
  context: {
    typename: string;
    variables: Record<string, any>;
  },
) => ReturnType<IdGetter>;

type FieldPolicy = {
  keyArgs?: KeySpecifier | KeyArgsFunction;
};

export function defaultDataIdFromObject(object: StoreObject) {
  const { __typename, id, _id } = object;
  if (typeof __typename === "string") {
    if (typeof id !== "undefined") return `${__typename}:${id}`;
    if (typeof _id !== "undefined") return `${__typename}:${_id}`;
  }
  return null;
}

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
        };
      };
    };
  } = Object.create(null);

  public readonly usingPossibleTypes = false;

  constructor(private config: {
    dataIdFromObject?: IdGetter;
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
    };

    const policy = typename && this.typePolicies[typename];
    if (policy && policy.keyFn) {
      return policy.keyFn.call(this, object, context);
    }

    return this.config.dataIdFromObject
      ? this.config.dataIdFromObject.call(this, object, context)
      : null;
  }

  public addTypePolicies(typePolicies: TypePolicies) {
    Object.keys(typePolicies).forEach(typename => {
      const existing = this.getTypePolicy(typename, true);
      const incoming = typePolicies[typename];
      const { keyFields, fields } = incoming;

      if (Array.isArray(keyFields)) {
        existing.keyFn = keyFieldsFnFromSpecifier(keyFields);
      } else if (typeof keyFields === "function") {
        existing.keyFn = keyFields;
      }

      if (fields) {
        Object.keys(fields).forEach(fieldName => {
          const existing = this.getFieldPolicy(typename, fieldName, true);
          const { keyArgs } = fields[fieldName];
          if (Array.isArray(keyArgs)) {
            existing.keyFn = keyArgsFnFromSpecifier(keyArgs);
          } else if (typeof keyArgs === "function") {
            existing.keyFn = keyArgs;
          }
        });
      }
    });
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
    if (typeof typename === "string") {
      const policy = this.getFieldPolicy(typename, field.name.value, false);
      if (policy && policy.keyFn) {
        return policy.keyFn.call(this, field, {
          typename,
          variables,
        });
      }
    }
    return storeKeyNameFromField(field, variables);
  }
}

function keyArgsFnFromSpecifier(
  specifier: KeySpecifier,
): Policies["typePolicies"][string]["fields"][string]["keyFn"] {
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
): Policies["typePolicies"][string]["keyFn"] {
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
