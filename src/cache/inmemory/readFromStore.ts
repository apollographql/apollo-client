import {
  DocumentNode,
  FieldNode,
  SelectionSetNode,
} from 'graphql';
import { wrap, OptimisticWrapperFunction } from 'optimism';
import { invariant, InvariantError } from 'ts-invariant';

import {
  isField,
  resultKeyNameFromField,
  Reference,
  isReference,
  makeReference,
  StoreObject,
  createFragmentMap,
  FragmentMap,
  shouldInclude,
  addTypenameToDocument,
  getDefaultValues,
  getFragmentDefinitions,
  getMainDefinition,
  getQueryDefinition,
  maybeDeepFreeze,
  mergeDeepArray,
  getFragmentFromSelection,
} from '../../utilities';
import { Cache } from '../core/types/Cache';
import {
  DiffQueryAgainstStoreOptions,
  NormalizedCache,
  ReadMergeModifyContext,
} from './types';
import { supportsResultCaching } from './entityStore';
import { getTypenameFromStoreObject } from './helpers';
import { Policies } from './policies';
import { InMemoryCache } from './inMemoryCache';
import { MissingFieldError } from '../core/types/common';

export type VariableMap = { [name: string]: any };

interface ReadContext extends ReadMergeModifyContext {
  query: DocumentNode;
  policies: Policies;
  fragmentMap: FragmentMap;
  path: (string | number)[];
  clientOnly: boolean;
};

export type ExecResult<R = any> = {
  result: R;
  missing?: MissingFieldError[];
};

function missingFromInvariant(
  err: InvariantError,
  context: ReadContext,
) {
  return new MissingFieldError(
    err.message,
    context.path.slice(),
    context.query,
    context.clientOnly,
    context.variables,
  );
}

type ExecSelectionSetOptions = {
  selectionSet: SelectionSetNode;
  objectOrReference: StoreObject | Reference;
  context: ReadContext;
};

type ExecSubSelectedArrayOptions = {
  field: FieldNode;
  array: any[];
  context: ReadContext;
};

export interface StoreReaderConfig {
  cache: InMemoryCache,
  addTypename?: boolean;
}

export class StoreReader {
  constructor(private config: StoreReaderConfig) {
    this.config = { addTypename: true, ...config };
  }

  /**
   * Given a store and a query, return as much of the result as possible and
   * identify if any data was missing from the store.
   * @param  {DocumentNode} query A parsed GraphQL query document
   * @param  {Store} store The Apollo Client store object
   * @return {result: Object, complete: [boolean]}
   */
  public diffQueryAgainstStore<T>({
    store,
    query,
    rootId = 'ROOT_QUERY',
    variables,
    returnPartialData = true,
  }: DiffQueryAgainstStoreOptions): Cache.DiffResult<T> {
    const policies = this.config.cache.policies;

    variables = {
      ...getDefaultValues(getQueryDefinition(query)),
      ...variables,
    };

    const execResult = this.executeSelectionSet({
      selectionSet: getMainDefinition(query).selectionSet,
      objectOrReference: makeReference(rootId),
      context: {
        store,
        query,
        policies,
        variables,
        varString: JSON.stringify(variables),
        fragmentMap: createFragmentMap(getFragmentDefinitions(query)),
        path: [],
        clientOnly: false,
      },
    });

    const hasMissingFields =
      execResult.missing && execResult.missing.length > 0;
    if (hasMissingFields && !returnPartialData) {
      throw execResult.missing![0];
    }

    return {
      result: execResult.result,
      missing: execResult.missing,
      complete: !hasMissingFields,
    };
  }

  public isFresh(
    result: Record<string, any>,
    parent: StoreObject | Reference,
    selectionSet: SelectionSetNode,
    context: ReadMergeModifyContext,
  ): boolean {
    if (supportsResultCaching(context.store) &&
        this.knownResults.get(result) === selectionSet) {
      const latest = this.executeSelectionSet.peek(selectionSet, parent, context);
      if (latest && result === latest.result) {
        return true;
      }
    }
    return false;
  }

  // Cached version of execSelectionSetImpl.
  private executeSelectionSet: OptimisticWrapperFunction<
    [ExecSelectionSetOptions], // Actual arguments tuple type.
    ExecResult, // Actual return type.
    // Arguments type after keyArgs translation.
    [SelectionSetNode, StoreObject | Reference, ReadMergeModifyContext]
  > = wrap(options => this.execSelectionSetImpl(options), {
    keyArgs(options) {
      return [
        options.selectionSet,
        options.objectOrReference,
        options.context,
      ];
    },
    // Note that the parameters of makeCacheKey are determined by the
    // array returned by keyArgs.
    makeCacheKey(selectionSet, parent, context) {
      if (supportsResultCaching(context.store)) {
        return context.store.makeCacheKey(
          selectionSet,
          isReference(parent) ? parent.__ref : parent,
          context.varString,
        );
      }
    }
  });

  // Uncached version of executeSelectionSet.
  private execSelectionSetImpl({
    selectionSet,
    objectOrReference,
    context,
  }: ExecSelectionSetOptions): ExecResult {
    if (isReference(objectOrReference) &&
        !context.policies.rootTypenamesById[objectOrReference.__ref] &&
        !context.store.has(objectOrReference.__ref)) {
      return {
        result: {},
        missing: [missingFromInvariant(
          new InvariantError(
            `Dangling reference to missing ${objectOrReference.__ref} object`
          ),
          context,
        )],
      };
    }

    const { variables, policies, store } = context;
    const objectsToMerge: { [key: string]: any }[] = [];
    const finalResult: ExecResult = { result: null };
    const typename = store.getFieldValue<string>(objectOrReference, "__typename");

    if (this.config.addTypename &&
        typeof typename === "string" &&
        !policies.rootIdsByTypename[typename]) {
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

    const workSet = new Set(selectionSet.selections);

    workSet.forEach(selection => {
      // Omit fields with directives @skip(if: <truthy value>) or
      // @include(if: <falsy value>).
      if (!shouldInclude(selection, variables)) return;

      if (isField(selection)) {
        let fieldValue = policies.readField({
          fieldName: selection.name.value,
          field: selection,
          variables: context.variables,
          from: objectOrReference,
        }, context);

        const resultName = resultKeyNameFromField(selection);
        context.path.push(resultName);

        // If this field has an @client directive, then the field and
        // everything beneath it is client-only, meaning it will never be
        // sent to the server.
        const wasClientOnly = context.clientOnly;
        // Once we enter a client-only subtree of the query, we can avoid
        // repeatedly checking selection.directives.
        context.clientOnly = wasClientOnly || !!(
          // We don't use the hasDirectives helper here, because it looks
          // for directives anywhere inside the AST node, whereas we only
          // care about directives directly attached to this field.
          selection.directives &&
          selection.directives.some(d => d.name.value === "client")
        );

        if (fieldValue === void 0) {
          if (!addTypenameToDocument.added(selection)) {
            getMissing().push(
              missingFromInvariant(
                new InvariantError(`Can't find field '${
                  selection.name.value
                }' on ${
                  isReference(objectOrReference)
                    ? objectOrReference.__ref + " object"
                    : "object " + JSON.stringify(objectOrReference, null, 2)
                }`),
                context,
              ),
            );
          }

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
          objectsToMerge.push({ [resultName]: fieldValue });
        }

        context.clientOnly = wasClientOnly;

        invariant(context.path.pop() === resultName);

      } else {
        const fragment = getFragmentFromSelection(
          selection,
          context.fragmentMap,
        );

        if (fragment && policies.fragmentMatches(fragment, typename)) {
          fragment.selectionSet.selections.forEach(workSet.add, workSet);
        }
      }
    });

    // Perform a single merge at the end so that we can avoid making more
    // defensive shallow copies than necessary.
    finalResult.result = mergeDeepArray(objectsToMerge);

    if (process.env.NODE_ENV !== 'production') {
      Object.freeze(finalResult.result);
    }

    // Store this result with its selection set so that we can quickly
    // recognize it again in the StoreReader#isFresh method.
    this.knownResults.set(finalResult.result, selectionSet);

    return finalResult;
  }

  private knownResults = new WeakMap<Record<string, any>, SelectionSetNode>();

  // Cached version of execSubSelectedArrayImpl.
  private executeSubSelectedArray = wrap((options: ExecSubSelectedArrayOptions) => {
    return this.execSubSelectedArrayImpl(options);
  }, {
    makeCacheKey({ field, array, context }) {
      if (supportsResultCaching(context.store)) {
        return context.store.makeCacheKey(
          field,
          array,
          context.varString,
        );
      }
    }
  });

  // Uncached version of executeSubSelectedArray.
  private execSubSelectedArrayImpl({
    field,
    array,
    context,
  }: ExecSubSelectedArrayOptions): ExecResult {
    let missing: MissingFieldError[] | undefined;

    function handleMissing<T>(childResult: ExecResult<T>, i: number): T {
      if (childResult.missing) {
        missing = missing || [];
        missing.push(...childResult.missing);
      }

      invariant(context.path.pop() === i);

      return childResult.result;
    }

    if (field.selectionSet) {
      array = array.filter(context.store.canRead);
    }

    array = array.map((item, i) => {
      // null value in array
      if (item === null) {
        return null;
      }

      context.path.push(i);

      // This is a nested array, recurse
      if (Array.isArray(item)) {
        return handleMissing(this.executeSubSelectedArray({
          field,
          array: item,
          context,
        }), i);
      }

      // This is an object, run the selection set on it
      if (field.selectionSet) {
        return handleMissing(this.executeSelectionSet({
          selectionSet: field.selectionSet,
          objectOrReference: item,
          context,
        }), i);
      }

      if (process.env.NODE_ENV !== 'production') {
        assertSelectionSetForIdValue(context.store, field, item);
      }

      invariant(context.path.pop() === i);

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
