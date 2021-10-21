import { invariant, InvariantError } from '../../utilities/globals';
import { equal } from '@wry/equality';
import { Trie } from '@wry/trie';
import {
  SelectionSetNode,
  FieldNode,
} from 'graphql';

import {
  createFragmentMap,
  FragmentMap,
  getFragmentFromSelection,
  getDefaultValues,
  getFragmentDefinitions,
  getOperationDefinition,
  getTypenameFromResult,
  makeReference,
  isField,
  resultKeyNameFromField,
  StoreValue,
  StoreObject,
  Reference,
  isReference,
  shouldInclude,
  cloneDeep,
  addTypenameToDocument,
  isNonEmptyArray,
} from '../../utilities';

import { NormalizedCache, ReadMergeModifyContext, MergeTree } from './types';
import { makeProcessedFieldsMerger, fieldNameFromStoreName, storeValueIsStoreObject } from './helpers';
import { StoreReader } from './readFromStore';
import { InMemoryCache } from './inMemoryCache';
import { EntityStore } from './entityStore';
import { Cache } from '../../core';
import { canonicalStringify } from './object-canon';

export interface WriteContext extends ReadMergeModifyContext {
  readonly written: {
    [dataId: string]: SelectionSetNode[];
  };
  readonly fragmentMap?: FragmentMap;
  // General-purpose deep-merge function for use during writes.
  merge<T>(existing: T, incoming: T): T;
  // If true, merge functions will be called with undefined existing data.
  overwrite: boolean;
  incomingById: Map<string, {
    storeObject: StoreObject;
    mergeTree?: MergeTree;
    fieldNodeSet: Set<FieldNode>;
  }>;
  // Directive metadata for @client and @defer. We could use a bitfield for this
  // information to save some space, if that matters.
  clientOnly: boolean;
  deferred: boolean;
};

interface ProcessSelectionSetOptions {
  dataId?: string,
  result: Record<string, any>;
  selectionSet: SelectionSetNode;
  context: WriteContext;
  mergeTree: MergeTree;
}

export class StoreWriter {
  constructor(
    public readonly cache: InMemoryCache,
    private reader?: StoreReader,
  ) {}

  public writeToStore(store: NormalizedCache, {
    query,
    result,
    dataId,
    variables,
    overwrite,
  }: Cache.WriteOptions): Reference | undefined {
    const operationDefinition = getOperationDefinition(query)!;
    const merger = makeProcessedFieldsMerger();

    variables = {
      ...getDefaultValues(operationDefinition),
      ...variables!,
    };

    const context: WriteContext = {
      store,
      written: Object.create(null),
      merge<T>(existing: T, incoming: T) {
        return merger.merge(existing, incoming) as T;
      },
      variables,
      varString: canonicalStringify(variables),
      fragmentMap: createFragmentMap(getFragmentDefinitions(query)),
      overwrite: !!overwrite,
      incomingById: new Map,
      clientOnly: false,
      deferred: false,
    };

    const ref = this.processSelectionSet({
      result: result || Object.create(null),
      dataId,
      selectionSet: operationDefinition.selectionSet,
      mergeTree: { map: new Map },
      context,
    });

    if (!isReference(ref)) {
      throw new InvariantError(`Could not identify object ${JSON.stringify(result)}`);
    }

    // So far, the store has not been modified, so now it's time to process
    // context.incomingById and merge those incoming fields into context.store.
    context.incomingById.forEach(({ storeObject, mergeTree, fieldNodeSet }, dataId) => {
      const entityRef = makeReference(dataId);

      if (mergeTree && mergeTree.map.size) {
        const applied = this.applyMerges(mergeTree, entityRef, storeObject, context);
        if (isReference(applied)) {
          // Assume References returned by applyMerges have already been merged
          // into the store. See makeMergeObjectsFunction in policies.ts for an
          // example of how this can happen.
          return;
        }
        // Otherwise, applyMerges returned a StoreObject, whose fields we should
        // merge into the store (see store.merge statement below).
        storeObject = applied;
      }

      if (__DEV__ && !context.overwrite) {
        const fieldsWithSelectionSets: Record<string, true> = Object.create(null);
        fieldNodeSet.forEach(field => {
          if (field.selectionSet) {
            fieldsWithSelectionSets[field.name.value] = true;
          }
        });

        const hasSelectionSet = (storeFieldName: string) =>
          fieldsWithSelectionSets[
            fieldNameFromStoreName(storeFieldName)
          ] === true;

        const hasMergeFunction = (storeFieldName: string) => {
          const childTree = mergeTree && mergeTree.map.get(storeFieldName);
          return Boolean(childTree && childTree.info && childTree.info.merge);
        };

        Object.keys(storeObject).forEach(storeFieldName => {
          // If a merge function was defined for this field, trust that it
          // did the right thing about (not) clobbering data. If the field
          // has no selection set, it's a scalar field, so it doesn't need
          // a merge function (even if it's an object, like JSON data).
          if (hasSelectionSet(storeFieldName) &&
              !hasMergeFunction(storeFieldName)) {
            warnAboutDataLoss(
              entityRef,
              storeObject,
              storeFieldName,
              context.store,
            );
          }
        });
      }

      store.merge(dataId, storeObject);
    });

    // Any IDs written explicitly to the cache will be retained as
    // reachable root IDs for garbage collection purposes. Although this
    // logic includes root IDs like ROOT_QUERY and ROOT_MUTATION, their
    // retainment counts are effectively ignored because cache.gc() always
    // includes them in its root ID set.
    store.retain(ref.__ref);

    return ref;
  }

  private processSelectionSet({
    dataId,
    result,
    selectionSet,
    context,
    // This object allows processSelectionSet to report useful information
    // to its callers without explicitly returning that information.
    mergeTree,
  }: ProcessSelectionSetOptions): StoreObject | Reference {
    const { policies } = this.cache;

    // Identify the result object, even if dataId was already provided,
    // since we always need keyObject below.
    const [id, keyObject] = policies.identify(
      result, selectionSet, context.fragmentMap);

    // If dataId was not provided, fall back to the id just generated by
    // policies.identify.
    dataId = dataId || id;

    if ("string" === typeof dataId) {
      // Avoid processing the same entity object using the same selection
      // set more than once. We use an array instead of a Set since most
      // entity IDs will be written using only one selection set, so the
      // size of this array is likely to be very small, meaning indexOf is
      // likely to be faster than Set.prototype.has.
      const sets = context.written[dataId] || (context.written[dataId] = []);
      const ref = makeReference(dataId);
      if (sets.indexOf(selectionSet) >= 0) return ref;
      sets.push(selectionSet);

      // If we're about to write a result object into the store, but we
      // happen to know that the exact same (===) result object would be
      // returned if we were to reread the result with the same inputs,
      // then we can skip the rest of the processSelectionSet work for
      // this object, and immediately return a Reference to it.
      if (this.reader && this.reader.isFresh(
        result,
        ref,
        selectionSet,
        context,
      )) {
        return ref;
      }
    }

    // This variable will be repeatedly updated using context.merge to
    // accumulate all fields that need to be written into the store.
    let incoming: StoreObject = Object.create(null);

    // Write any key fields that were used during identification, even if
    // they were not mentioned in the original query.
    if (keyObject) {
      incoming = context.merge(incoming, keyObject);
    }

    // If typename was not passed in, infer it. Note that typename is
    // always passed in for tricky-to-infer cases such as "Query" for
    // ROOT_QUERY.
    const typename: string | undefined =
      (dataId && policies.rootTypenamesById[dataId]) ||
      getTypenameFromResult(result, selectionSet, context.fragmentMap) ||
      (dataId && context.store.get(dataId, "__typename") as string);

    if ("string" === typeof typename) {
      incoming.__typename = typename;
    }

    const fieldNodeSet = new Set<FieldNode>();

    this.flattenFields(
      selectionSet,
      result,
      // This WriteContext will be the default context value for fields returned
      // by the flattenFields method, but some fields may be assigned a modified
      // context, depending on the presence of @client and other directives.
      context,
      typename,
    ).forEach((context, field) => {
      const resultFieldKey = resultKeyNameFromField(field);
      const value = result[resultFieldKey];

      fieldNodeSet.add(field);

      if (value !== void 0) {
        const storeFieldName = policies.getStoreFieldName({
          typename,
          fieldName: field.name.value,
          field,
          variables: context.variables,
        });

        const childTree = getChildMergeTree(mergeTree, storeFieldName);

        let incomingValue =
          this.processFieldValue(value, field, context, childTree);

        // To determine if this field holds a child object with a merge function
        // defined in its type policy (see PR #7070), we need to figure out the
        // child object's __typename.
        let childTypename: string | undefined;

        // The field's value can be an object that has a __typename only if the
        // field has a selection set. Otherwise incomingValue is scalar.
        if (field.selectionSet) {
          // We attempt to find the child __typename first in context.store, but
          // the child object may not exist in the store yet, likely because
          // it's being written for the first time, during this very call to
          // writeToStore. Note: if incomingValue is a non-normalized
          // StoreObject (not a Reference), getFieldValue will read from that
          // object's properties to find its __typename.
          childTypename = context.store.getFieldValue<string>(
            incomingValue as StoreObject | Reference,
            "__typename",
          );

          // If the child object is being written for the first time, but
          // incomingValue is a Reference, then the entity that Reference
          // identifies should have an entry in context.incomingById, which
          // likely contains a __typename field we can use. After all, how could
          // we know the object's ID if it had no __typename? If we wrote data
          // into context.store as each processSelectionSet call finished
          // processing an entity object, the child object would already be in
          // context.store, so we wouldn't need this extra check, but holding
          // all context.store.merge calls until after we've finished all
          // processSelectionSet work is cleaner and solves other problems, such
          // as issue #8370.
          if (!childTypename && isReference(incomingValue)) {
            const info = context.incomingById.get(incomingValue.__ref);
            childTypename = info && info.storeObject.__typename;
          }
        }

        const merge = policies.getMergeFunction(
          typename,
          field.name.value,
          childTypename,
        );

        if (merge) {
          childTree.info = {
            // TODO Check compatibility against any existing childTree.field?
            field,
            typename,
            merge,
          };
        } else {
          maybeRecycleChildMergeTree(mergeTree, storeFieldName);
        }

        incoming = context.merge(incoming, {
          [storeFieldName]: incomingValue,
        });

      } else if (
        __DEV__ &&
        !context.clientOnly &&
        !context.deferred &&
        !addTypenameToDocument.added(field) &&
        // If the field has a read function, it may be a synthetic field or
        // provide a default value, so its absence from the written data should
        // not be cause for alarm.
        !policies.getReadFunction(typename, field.name.value)
      ) {
        invariant.error(`Missing field '${
          resultKeyNameFromField(field)
        }' while writing result ${
          JSON.stringify(result, null, 2)
        }`.substring(0, 1000));
      }
    });

    if ("string" === typeof dataId) {
      const previous = context.incomingById.get(dataId);
      if (previous) {
        previous.storeObject = context.merge(previous.storeObject, incoming);
        previous.mergeTree = mergeMergeTrees(previous.mergeTree, mergeTree);
        fieldNodeSet.forEach(field => previous.fieldNodeSet.add(field));
      } else {
        context.incomingById.set(dataId, {
          storeObject: incoming,
          // Save a reference to mergeTree only if it is not empty, because
          // empty MergeTrees may be recycled by maybeRecycleChildMergeTree and
          // reused for entirely different parts of the result tree.
          mergeTree: mergeTreeIsEmpty(mergeTree) ? void 0 : mergeTree,
          fieldNodeSet,
        });
      }
      return makeReference(dataId);
    }

    return incoming;
  }

  private processFieldValue(
    value: any,
    field: FieldNode,
    context: WriteContext,
    mergeTree: MergeTree,
  ): StoreValue {
    if (!field.selectionSet || value === null) {
      // In development, we need to clone scalar values so that they can be
      // safely frozen with maybeDeepFreeze in readFromStore.ts. In production,
      // it's cheaper to store the scalar values directly in the cache.
      return __DEV__ ? cloneDeep(value) : value;
    }

    if (Array.isArray(value)) {
      return value.map((item, i) => {
        const value = this.processFieldValue(
          item, field, context, getChildMergeTree(mergeTree, i));
        maybeRecycleChildMergeTree(mergeTree, i);
        return value;
      });
    }

    return this.processSelectionSet({
      result: value,
      selectionSet: field.selectionSet,
      context,
      mergeTree,
    });
  }

  // Implements https://spec.graphql.org/draft/#sec-Field-Collection, but with
  // some additions for tracking @client and @defer directives.
  private flattenFields(
    selectionSet: SelectionSetNode,
    result: Record<string, any>,
    context: WriteContext,
    typename = getTypenameFromResult(result, selectionSet, context.fragmentMap),
  ): Map<FieldNode, WriteContext> {
    const fieldMap = new Map<FieldNode, WriteContext>();
    const { policies } = this.cache;

    const limitingTrie = new Trie<{
      // Since there are only four combinations of clientOnly and deferred
      // values, we should need at most four versions of context, including the
      // one originally passed to flattenFields. To avoid creating multiple
      // copies of any given context configuration, we cache the contexts in
      // limitingTrie according to their clientOnly and deferred values (always
      // in that order).
      context?: WriteContext;
      // Tracks whether (clientOnly, deferred, selectionSet) has been flattened
      // before. The GraphQL specification only uses the fragment name for
      // skipping previously visited fragments, but the top-level fragment
      // selection set corresponds 1:1 with the fagment name (and is slightly
      // easier too work with), and we need to consider clientOnly and deferred
      // values as well, potentially revisiting selection sets that were
      // previously visited with different inherited configurations of those
      // directives.
      visited?: boolean;
    }>(false); // No need for WeakMap, since limitingTrie does not escape.

    limitingTrie.lookup(
      context.clientOnly,
      context.deferred,
    ).context = context;

    (function flatten(
      this: void,
      selectionSet: SelectionSetNode,
      inheritedClientOnly: boolean,
      inheritedDeferred: boolean,
    ) {
      const visitedNode = limitingTrie.lookup(
        // Because we take inheritedClientOnly and inheritedDeferred into
        // consideration here (in addition to selectionSet), it's possible for
        // the same selection set to be flattened more than once, if it appears
        // in the query with different @client and/or @directive configurations.
        inheritedClientOnly,
        inheritedDeferred,
        selectionSet,
      );
      if (visitedNode.visited) return;
      visitedNode.visited = true;

      selectionSet.selections.forEach(selection => {
        if (!shouldInclude(selection, context.variables)) return;

        let clientOnly = inheritedClientOnly;
        let deferred = inheritedDeferred;
        if (
          // Since the presence of @client or @defer on this field can only
          // cause clientOnly or deferred to become true, we can skip the
          // forEach loop if both clientOnly and deferred are already true.
          !(clientOnly && deferred) &&
          isNonEmptyArray(selection.directives)
        ) {
          selection.directives.forEach(dir => {
            const name = dir.name.value;
            if (name === "client") clientOnly = true;
            if (name === "defer") deferred = true;
          });
        }

        if (isField(selection)) {
          const existing = fieldMap.get(selection);
          if (existing) {
            // If this field has been visited along another recursive path
            // before, the final context should have clientOnly or deferred set
            // to true only if *all* paths have the directive (hence the &&).
            clientOnly = clientOnly && existing.clientOnly;
            deferred = deferred && existing.deferred;
          }

          const contextNode = limitingTrie.lookup(clientOnly, deferred);
          fieldMap.set(
            selection,
            contextNode.context || (contextNode.context = {
              ...context,
              clientOnly,
              deferred,
            }),
          );

        } else {
          const fragment =
            getFragmentFromSelection(selection, context.fragmentMap);
          if (fragment &&
              policies.fragmentMatches(
                fragment, typename, result, context.variables)) {
            flatten(fragment.selectionSet, clientOnly, deferred);
          }
        }
      });
    })(selectionSet, false, false);

    return fieldMap;
  }

  private applyMerges<T extends StoreValue>(
    mergeTree: MergeTree,
    existing: StoreValue,
    incoming: T,
    context: WriteContext,
    getStorageArgs?: Parameters<EntityStore["getStorage"]>,
  ): T | Reference {
    if (mergeTree.map.size && !isReference(incoming)) {
      const e: StoreObject | Reference | undefined = (
        // Items in the same position in different arrays are not
        // necessarily related to each other, so when incoming is an array
        // we process its elements as if there was no existing data.
        !Array.isArray(incoming) &&
        // Likewise, existing must be either a Reference or a StoreObject
        // in order for its fields to be safe to merge with the fields of
        // the incoming object.
        (isReference(existing) || storeValueIsStoreObject(existing))
      ) ? existing : void 0;

      // This narrowing is implied by mergeTree.map.size > 0 and
      // !isReference(incoming), though TypeScript understandably cannot
      // hope to infer this type.
      const i = incoming as StoreObject | StoreValue[];

      // The options.storage objects provided to read and merge functions
      // are derived from the identity of the parent object plus a
      // sequence of storeFieldName strings/numbers identifying the nested
      // field name path of each field value to be merged.
      if (e && !getStorageArgs) {
        getStorageArgs = [isReference(e) ? e.__ref : e];
      }

      // It's possible that applying merge functions to this subtree will
      // not change the incoming data, so this variable tracks the fields
      // that did change, so we can create a new incoming object when (and
      // only when) at least one incoming field has changed. We use a Map
      // to preserve the type of numeric keys.
      let changedFields: Map<string | number, StoreValue> | undefined;

      const getValue = (
        from: typeof e | typeof i,
        name: string | number,
      ): StoreValue => {
        return Array.isArray(from)
          ? (typeof name === "number" ? from[name] : void 0)
          : context.store.getFieldValue(from, String(name))
      };

      mergeTree.map.forEach((childTree, storeFieldName) => {
        const eVal = getValue(e, storeFieldName);
        const iVal = getValue(i, storeFieldName);
        // If we have no incoming data, leave any existing data untouched.
        if (void 0 === iVal) return;
        if (getStorageArgs) {
          getStorageArgs.push(storeFieldName);
        }
        const aVal = this.applyMerges(
          childTree,
          eVal,
          iVal,
          context,
          getStorageArgs,
        );
        if (aVal !== iVal) {
          changedFields = changedFields || new Map;
          changedFields.set(storeFieldName, aVal);
        }
        if (getStorageArgs) {
          invariant(getStorageArgs.pop() === storeFieldName);
        }
      });

      if (changedFields) {
        // Shallow clone i so we can add changed fields to it.
        incoming = (Array.isArray(i) ? i.slice(0) : { ...i }) as T;
        changedFields.forEach((value, name) => {
          (incoming as any)[name] = value;
        });
      }
    }

    if (mergeTree.info) {
      return this.cache.policies.runMergeFunction(
        existing,
        incoming,
        mergeTree.info,
        context,
        getStorageArgs && context.store.getStorage(...getStorageArgs),
      );
    }

    return incoming;
  }
}

const emptyMergeTreePool: MergeTree[] = [];

function getChildMergeTree(
  { map }: MergeTree,
  name: string | number,
): MergeTree {
  if (!map.has(name)) {
    map.set(name, emptyMergeTreePool.pop() || { map: new Map });
  }
  return map.get(name)!;
}

function mergeMergeTrees(
  left: MergeTree | undefined,
  right: MergeTree | undefined,
): MergeTree {
  if (left === right || !right || mergeTreeIsEmpty(right)) return left!;
  if (!left || mergeTreeIsEmpty(left)) return right;

  const info = left.info && right.info ? {
    ...left.info,
    ...right.info,
  } : left.info || right.info;

  const needToMergeMaps = left.map.size && right.map.size;
  const map = needToMergeMaps ? new Map :
    left.map.size ? left.map : right.map;

  const merged = { info, map };

  if (needToMergeMaps) {
    const remainingRightKeys = new Set(right.map.keys());

    left.map.forEach((leftTree, key) => {
      merged.map.set(
        key,
        mergeMergeTrees(leftTree, right.map.get(key)),
      );
      remainingRightKeys.delete(key);
    });

    remainingRightKeys.forEach(key => {
      merged.map.set(
        key,
        mergeMergeTrees(
          right.map.get(key),
          left.map.get(key),
        ),
      );
    });
  }

  return merged;
}

function mergeTreeIsEmpty(tree: MergeTree | undefined): boolean {
  return !tree || !(tree.info || tree.map.size);
}

function maybeRecycleChildMergeTree(
  { map }: MergeTree,
  name: string | number,
) {
  const childTree = map.get(name);
  if (childTree && mergeTreeIsEmpty(childTree)) {
    emptyMergeTreePool.push(childTree);
    map.delete(name);
  }
}

const warnings = new Set<string>();

// Note that this function is unused in production, and thus should be
// pruned by any well-configured minifier.
function warnAboutDataLoss(
  existingRef: Reference,
  incomingObj: StoreObject,
  storeFieldName: string,
  store: NormalizedCache,
) {
  const getChild = (objOrRef: StoreObject | Reference): StoreObject | false => {
    const child = store.getFieldValue<StoreObject>(objOrRef, storeFieldName);
    return typeof child === "object" && child;
  };

  const existing = getChild(existingRef);
  if (!existing) return;

  const incoming = getChild(incomingObj);
  if (!incoming) return;

  // It's always safe to replace a reference, since it refers to data
  // safely stored elsewhere.
  if (isReference(existing)) return;

  // If the values are structurally equivalent, we do not need to worry
  // about incoming replacing existing.
  if (equal(existing, incoming)) return;

  // If we're replacing every key of the existing object, then the
  // existing data would be overwritten even if the objects were
  // normalized, so warning would not be helpful here.
  if (Object.keys(existing).every(
    key => store.getFieldValue(incoming, key) !== void 0)) {
    return;
  }

  const parentType =
    store.getFieldValue<string>(existingRef, "__typename") ||
    store.getFieldValue<string>(incomingObj, "__typename");
  const fieldName = fieldNameFromStoreName(storeFieldName);
  const typeDotName = `${parentType}.${fieldName}`;
  // Avoid warning more than once for the same type and field name.
  if (warnings.has(typeDotName)) return;
  warnings.add(typeDotName);

  const childTypenames: string[] = [];
  // Arrays do not have __typename fields, and always need a custom merge
  // function, even if their elements are normalized entities.
  if (!Array.isArray(existing) &&
      !Array.isArray(incoming)) {
    [existing, incoming].forEach(child => {
      const typename = store.getFieldValue(child, "__typename");
      if (typeof typename === "string" &&
          !childTypenames.includes(typename)) {
        childTypenames.push(typename);
      }
    });
  }

  invariant.warn(
`Cache data may be lost when replacing the ${fieldName} field of a ${parentType} object.

To address this problem (which is not a bug in Apollo Client), ${
  childTypenames.length
    ? "either ensure all objects of type " +
        childTypenames.join(" and ") + " have an ID or a custom merge function, or "
    : ""
}define a custom merge function for the ${
  typeDotName
} field, so InMemoryCache can safely merge these objects:

  existing: ${JSON.stringify(existing).slice(0, 1000)}
  incoming: ${JSON.stringify(incoming).slice(0, 1000)}

For more information about these options, please refer to the documentation:

  * Ensuring entity objects have IDs: https://go.apollo.dev/c/generating-unique-identifiers
  * Defining custom merge functions: https://go.apollo.dev/c/merging-non-normalized-objects
`);
}
