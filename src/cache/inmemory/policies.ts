import {
  InlineFragmentNode,
  FragmentDefinitionNode,
  SelectionSetNode,
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
      const existing = this.getTypePolicy(typename);
      const incoming = typePolicies[typename];

      const { keyFields } = incoming;
      if (Array.isArray(keyFields)) {
        existing.keyFn = keyFnFromSpecifier(keyFields);
      } else if (typeof keyFields === "function") {
        existing.keyFn = keyFields;
      }
    });
  }

  public addPossibleTypes(possibleTypes: PossibleTypesMap) {
    (this.usingPossibleTypes as boolean) = true;
    Object.keys(possibleTypes).forEach(supertype => {
      const subtypeSet = this.getSubtypeSet(supertype);
      possibleTypes[supertype].forEach(subtypeSet.add, subtypeSet);
    });
  }

  private getTypePolicy(typename: string): Policies["typePolicies"][string] {
    return this.typePolicies[typename] || (
      this.typePolicies[typename] = Object.create(null));
  }

  private getSubtypeSet(supertype: string): Set<string> {
    const policy = this.getTypePolicy(supertype);
    return policy.subtypes || (policy.subtypes = new Set<string>());
  }

  public fragmentMatches(
    fragment: InlineFragmentNode | FragmentDefinitionNode,
    typename: string,
  ): boolean | "heuristic" {
    if (!fragment.typeCondition) return true;

    const supertype = fragment.typeCondition.name.value;
    if (typename === supertype) return true;

    if (this.usingPossibleTypes) {
      const workQueue = [this.getSubtypeSet(supertype)];
      // It's important to keep evaluating workQueue.length each time through
      // the loop, because the queue can grow while we're iterating over it.
      for (let i = 0; i < workQueue.length; ++i) {
        const subtypes = workQueue[i];
        if (subtypes.has(typename)) return true;
        subtypes.forEach(subtype => {
          const subsubtypes = this.getSubtypeSet(subtype);
          if (workQueue.indexOf(subsubtypes) < 0) {
            workQueue.push(subsubtypes);
          }
        });
      }
      // When possibleTypes is defined, we always either return true from the
      // loop above or return false here (never 'heuristic' below).
      return false;
    }

    return "heuristic";
  }
}

function keyFnFromSpecifier(
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
        `Missing field ${responseName} while computing key fields`,
      );
      keyObj[prevKey = s] = response[responseName];
    }
  });
  return keyObj;
}
