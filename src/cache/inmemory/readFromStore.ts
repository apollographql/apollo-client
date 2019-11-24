import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  SelectionSetNode,
} from 'graphql';
import { wrap, KeyTrie } from 'optimism';
import { invariant } from 'ts-invariant';

import {
  isField,
  isInlineFragment,
  resultKeyNameFromField,
  Reference,
  isReference,
  makeReference,
  StoreValue,
} from '../../utilities/graphql/storeUtils';
import { canUseWeakMap } from '../../utilities/common/canUse';
import { createFragmentMap, FragmentMap } from '../../utilities/graphql/fragments';
import { shouldInclude } from '../../utilities/graphql/directives';
import {
  getDefaultValues,
  getFragmentDefinitions,
  getMainDefinition,
  getQueryDefinition,
} from '../../utilities/graphql/getFromAST';
import { isEqual } from '../../utilities/common/isEqual';
import { maybeDeepFreeze } from '../../utilities/common/maybeDeepFreeze';
import { mergeDeepArray } from '../../utilities/common/mergeDeep';
import { Cache } from '../core/types/Cache';
import {
  DiffQueryAgainstStoreOptions,
  ReadQueryOptions,
  StoreObject,
  NormalizedCache,
} from './types';
import { supportsResultCaching } from './entityStore';
import { getTypenameFromStoreObject } from './helpers';
import { Policies } from './policies';

export type VariableMap = { [name: string]: any };

interface ExecContext {
  query: DocumentNode;
  store: NormalizedCache;
  policies: Policies;
  fragmentMap: FragmentMap;
  variables: VariableMap;
};

export type ExecResultMissingField = {
  object: StoreObject;
  fieldName: string;
  tolerable: boolean;
};

export type ExecResult<R = any> = {
  result: R;
  // Empty array if no missing fields encountered while computing result.
  missing?: ExecResultMissingField[];
};

type ExecSelectionSetOptions = {
  selectionSet: SelectionSetNode;
  objectOrReference: StoreObject | Reference;
  context: ExecContext;
};

type ExecSubSelectedArrayOptions = {
  field: FieldNode;
  array: any[];
  context: ExecContext;
};

export interface StoreReaderConfig {
  addTypename?: boolean;
  cacheKeyRoot?: KeyTrie<object>;
  policies: Policies;
}

export class StoreReader {
  constructor(private config: StoreReaderConfig) {
    const cacheKeyRoot =
      config && config.cacheKeyRoot || new KeyTrie<object>(canUseWeakMap);

    this.config = {
      addTypename: true,
      cacheKeyRoot,
      ...config,
    };

    const {
      executeSelectionSet,
      executeSubSelectedArray,
    } = this;

    this.executeSelectionSet = wrap((options: ExecSelectionSetOptions) => {
      return executeSelectionSet.call(this, options);
    }, {
      makeCacheKey({
        selectionSet,
        objectOrReference,
        context,
      }: ExecSelectionSetOptions) {
        if (supportsResultCaching(context.store)) {
          return cacheKeyRoot.lookup(
            context.store,
            selectionSet,
            JSON.stringify(context.variables),
            isReference(objectOrReference) ? objectOrReference.__ref : objectOrReference,
          );
        }
      }
    });

    this.executeSubSelectedArray = wrap((options: ExecSubSelectedArrayOptions) => {
      return executeSubSelectedArray.call(this, options);
    }, {
      makeCacheKey({ field, array, context }) {
        if (supportsResultCaching(context.store)) {
          return cacheKeyRoot.lookup(
            context.store,
            field,
            array,
            JSON.stringify(context.variables),
          );
        }
      }
    });
  }

  /**
   * Resolves the result of a query solely from the store (i.e. never hits the server).
   *
   * @param {Store} store The {@link NormalizedCache} used by Apollo for the `data` portion of the
   * store.
   *
   * @param {DocumentNode} query The query document to resolve from the data available in the store.
   *
   * @param {Object} [variables] A map from the name of a variable to its value. These variables can
   * be referenced by the query document.
   *
   * @param {any} previousResult The previous result returned by this function for the same query.
   * If nothing in the store changed since that previous result then values from the previous result
   * will be returned to preserve referential equality.
   */
  public readQueryFromStore<QueryType>(
    options: ReadQueryOptions,
  ): QueryType | undefined {
    return this.diffQueryAgainstStore<QueryType>({
      ...options,
      returnPartialData: false,
    }).result;
  }

  /**
   * Given a store and a query, return as much of the result as possible and
   * identify if any data was missing from the store.
   * @param  {DocumentNode} query A parsed GraphQL query document
   * @param  {Store} store The Apollo Client store object
   * @param  {any} previousResult The previous result returned by this function for the same query
   * @return {result: Object, complete: [boolean]}
   */
  public diffQueryAgainstStore<T>({
    store,
    query,
    variables,
    previousResult,
    returnPartialData = true,
    rootId = 'ROOT_QUERY',
    config,
  }: DiffQueryAgainstStoreOptions): Cache.DiffResult<T> {
    const { policies } = this.config;

    const execResult = this.executeSelectionSet({
      selectionSet: getMainDefinition(query).selectionSet,
      objectOrReference: makeReference(rootId),
      context: {
        store,
        query,
        policies,
        variables: {
          ...getDefaultValues(getQueryDefinition(query)),
          ...variables,
        },
        fragmentMap: createFragmentMap(getFragmentDefinitions(query)),
      },
    });

    const hasMissingFields =
      execResult.missing && execResult.missing.length > 0;

    if (hasMissingFields && ! returnPartialData) {
      execResult.missing!.forEach(info => {
        invariant(
          info.tolerable,
          `Can't find field ${info.fieldName} on object ${JSON.stringify(
            info.object,
            null,
            2,
          )}.`,
        );
      });
    }

    if (previousResult) {
      if (isEqual(previousResult, execResult.result)) {
        execResult.result = previousResult;
      }
    }

    return {
      result: execResult.result,
      complete: !hasMissingFields,
    };
  }

  private executeSelectionSet({
    selectionSet,
    objectOrReference,
    context,
  }: ExecSelectionSetOptions): ExecResult {
    const { store, fragmentMap, variables, policies } = context;
    const objectsToMerge: { [key: string]: any }[] = [];
    const finalResult: ExecResult = { result: null };

    // Provides a uniform interface from reading field values, whether or
    // not the parent object is a normalized entity object.
    function getFieldValue(fieldName: string): StoreValue {
      if (isReference(objectOrReference)) {
        const dataId = objectOrReference.__ref;
        const fieldValue = store.getFieldValue(dataId, fieldName);
        if (fieldValue === void 0 && fieldName === "__typename") {
          // We can infer the __typename of singleton root objects like
          // ROOT_QUERY ("Query") and ROOT_MUTATION ("Mutation"), even if
          // we have never written that information into the cache.
          return policies.rootTypenamesById[dataId];
        }
        return fieldValue;
      }
      return objectOrReference && objectOrReference[fieldName];
    }

    const typename = getFieldValue("__typename") as string;

    if (this.config.addTypename &&
        typeof typename === "string" &&
        Object.values(
          policies.rootTypenamesById
        ).indexOf(typename) < 0) {
      // Ensure we always include a default value for the __typename
      // field, if we have one, and this.config.addTypename is true. Note
      // that this field can be overridden by other merged objects.
      objectsToMerge.push({ __typename: typename });
    }

    function getMissing() {
      return finalResult.missing || (finalResult.missing = []);
    }

    function handleMissing<T>(result: ExecResult<T>): T {
      if (result.missing) getMissing().push(...result.missing);
      return result.result;
    }

    selectionSet.selections.forEach(selection => {
      // Omit fields with directives @skip(if: <truthy value>) or
      // @include(if: <falsy value>).
      if (!shouldInclude(selection, variables)) return;

      if (isField(selection)) {
        let fieldValue = policies.readFieldFromStoreObject(
          selection,
          getFieldValue,
          typename,
          variables,
        );

        if (fieldValue === void 0) {
          getMissing().push({
            object: objectOrReference as StoreObject,
            fieldName: selection.name.value,
            tolerable: false,
          });

        } else if (Array.isArray(fieldValue)) {
          fieldValue = handleMissing(this.executeSubSelectedArray({
            field: selection,
            array: fieldValue,
            context,
          }));

        } else if (!selection.selectionSet) {
          // If the field does not have a selection set, then we handle it
          // as a scalar value. However, that value should not contain any
          // Reference objects, and should be frozen in development, if it
          // happens to be an object that is mutable.
          if (process.env.NODE_ENV !== 'production') {
            assertSelectionSetForIdValue(
              context.store,
              selection,
              fieldValue,
            );
            maybeDeepFreeze(fieldValue);
          }

        } else if (fieldValue != null) {
          // In this case, because we know the field has a selection set,
          // it must be trying to query a GraphQLObjectType, which is why
          // fieldValue must be != null.
          fieldValue = handleMissing(this.executeSelectionSet({
            selectionSet: selection.selectionSet,
            objectOrReference: fieldValue as StoreObject | Reference,
            context,
          }));
        }

        if (fieldValue !== void 0) {
          objectsToMerge.push({
            [resultKeyNameFromField(selection)]: fieldValue,
          });
        }

      } else {
        let fragment: InlineFragmentNode | FragmentDefinitionNode;

        if (isInlineFragment(selection)) {
          fragment = selection;
        } else {
          // This is a named fragment
          invariant(
            fragment = fragmentMap[selection.name.value],
            `No fragment named ${selection.name.value}`,
          );
        }

        const match = policies.fragmentMatches(fragment, typename);

        if (match) {
          let fragmentExecResult = this.executeSelectionSet({
            selectionSet: fragment.selectionSet,
            objectOrReference,
            context,
          });

          if (match === 'heuristic' && fragmentExecResult.missing) {
            fragmentExecResult = {
              ...fragmentExecResult,
              missing: fragmentExecResult.missing.map(info => {
                return { ...info, tolerable: true };
              }),
            };
          }

          objectsToMerge.push(handleMissing(fragmentExecResult));
        }
      }
    });

    // Perform a single merge at the end so that we can avoid making more
    // defensive shallow copies than necessary.
    finalResult.result = mergeDeepArray(objectsToMerge);

    if (process.env.NODE_ENV !== 'production') {
      Object.freeze(finalResult.result);
    }

    return finalResult;
  }

  private executeSubSelectedArray({
    field,
    array,
    context,
  }: ExecSubSelectedArrayOptions): ExecResult {
    let missing: ExecResultMissingField[] | undefined;

    function handleMissing<T>(childResult: ExecResult<T>): T {
      if (childResult.missing) {
        missing = missing || [];
        missing.push(...childResult.missing);
      }

      return childResult.result;
    }

    array = array.map(item => {
      // null value in array
      if (item === null) {
        return null;
      }

      // This is a nested array, recurse
      if (Array.isArray(item)) {
        return handleMissing(this.executeSubSelectedArray({
          field,
          array: item,
          context,
        }));
      }

      // This is an object, run the selection set on it
      if (field.selectionSet) {
        return handleMissing(this.executeSelectionSet({
          selectionSet: field.selectionSet,
          objectOrReference: item,
          context,
        }));
      }

      if (process.env.NODE_ENV !== 'production') {
        assertSelectionSetForIdValue(context.store, field, item);
      }

      return item;
    });

    if (process.env.NODE_ENV !== 'production') {
      Object.freeze(array);
    }

    return { result: array, missing };
  }
}

function assertSelectionSetForIdValue(
  store: NormalizedCache,
  field: FieldNode,
  fieldValue: any,
) {
  if (!field.selectionSet) {
    const workSet = new Set([fieldValue]);
    workSet.forEach(value => {
      if (value && typeof value === "object") {
        invariant(
          !isReference(value),
          `Missing selection set for object of type ${
            getTypenameFromStoreObject(store, value)
          } returned for query field ${field.name.value}`,
        );
        Object.values(value).forEach(workSet.add, workSet);
      }
    });
  }
}
