import { invariant } from '../../utilities/globals';

import {
  DocumentNode,
  FieldNode,
  SelectionSetNode,
} from 'graphql';
import { wrap, OptimisticWrapperFunction } from 'optimism';

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
  DeepMerger,
  getFragmentFromSelection,
  maybeDeepFreeze,
  isNonNullObject,
  canUseWeakMap,
  compact,
} from '../../utilities';
import { Cache } from '../core/types/Cache';
import {
  DiffQueryAgainstStoreOptions,
  NormalizedCache,
  ReadMergeModifyContext,
} from './types';
import { maybeDependOnExistenceOfEntity, supportsResultCaching } from './entityStore';
import { getTypenameFromStoreObject, shouldCanonizeResults } from './helpers';
import { Policies } from './policies';
import { InMemoryCache } from './inMemoryCache';
import { MissingFieldError, MissingTree } from '../core/types/common';
import { canonicalStringify, ObjectCanon } from './object-canon';

export type VariableMap = { [name: string]: any };

interface ReadContext extends ReadMergeModifyContext {
  query: DocumentNode;
  policies: Policies;
  canonizeResults: boolean;
  fragmentMap: FragmentMap;
  // General-purpose deep-merge function for use during reads.
  merge<T>(existing: T, incoming: T): T;
};

export type ExecResult<R = any> = {
  result: R;
  missing?: MissingTree;
};

type ExecSelectionSetOptions = {
  selectionSet: SelectionSetNode;
  objectOrReference: StoreObject | Reference;
  enclosingRef: Reference;
  context: ReadContext;
};

type ExecSubSelectedArrayOptions = {
  field: FieldNode;
  array: any[];
  enclosingRef: Reference;
  context: ReadContext;
};

export interface StoreReaderConfig {
  cache: InMemoryCache,
  addTypename?: boolean;
  resultCacheMaxSize?: number;
  canonizeResults?: boolean;
  canon?: ObjectCanon;
}

// Arguments type after keyArgs translation.
type ExecSelectionSetKeyArgs = [
  SelectionSetNode,
  StoreObject | Reference,
  ReadMergeModifyContext,
  boolean,
];

function execSelectionSetKeyArgs(
  options: ExecSelectionSetOptions,
): ExecSelectionSetKeyArgs {
  return [
    options.selectionSet,
    options.objectOrReference,
    options.context,
    // We split out this property so we can pass different values
    // independently without modifying options.context itself.
    options.context.canonizeResults,
  ];
}

export class StoreReader {
  // cached version of executeSelectionSet
  private executeSelectionSet: OptimisticWrapperFunction<
    [ExecSelectionSetOptions], // Actual arguments tuple type.
    ExecResult, // Actual return type.
    ExecSelectionSetKeyArgs
  >;

  // cached version of executeSubSelectedArray
  private executeSubSelectedArray: OptimisticWrapperFunction<
    [ExecSubSelectedArrayOptions],
    ExecResult<any>,
    [ExecSubSelectedArrayOptions]>;

  private config: {
    cache: InMemoryCache,
    addTypename: boolean;
    resultCacheMaxSize?: number;
    canonizeResults: boolean;
  };

  private knownResults = new (
    canUseWeakMap ? WeakMap : Map
  )<Record<string, any>, SelectionSetNode>();

  public canon: ObjectCanon;
  public resetCanon() {
    this.canon = new ObjectCanon;
  }

  constructor(config: StoreReaderConfig) {
    this.config = compact(config, {
      addTypename: config.addTypename !== false,
      canonizeResults: shouldCanonizeResults(config),
    });

    this.canon = config.canon || new ObjectCanon;

    this.executeSelectionSet = wrap(options => {
      const { canonizeResults } = options.context;

      const peekArgs = execSelectionSetKeyArgs(options);

      // Negate this boolean option so we can find out if we've already read
      // this result using the other boolean value.
      peekArgs[3] = !canonizeResults;

      const other = this.executeSelectionSet.peek(...peekArgs);

      if (other) {
        if (canonizeResults) {
          return {
            ...other,
            // If we previously read this result without canonizing it, we can
            // reuse that result simply by canonizing it now.
            result: this.canon.admit(other.result),
          };
        }
        // If we previously read this result with canonization enabled, we can
        // return that canonized result as-is.
        return other;
      }

      maybeDependOnExistenceOfEntity(
        options.context.store,
        options.enclosingRef.__ref,
      );

      // Finally, if we didn't find any useful previous results, run the real
      // execSelectionSetImpl method with the given options.
      return this.execSelectionSetImpl(options);

    }, {
      max: this.config.resultCacheMaxSize,
      keyArgs: execSelectionSetKeyArgs,
      // Note that the parameters of makeCacheKey are determined by the
      // array returned by keyArgs.
      makeCacheKey(selectionSet, parent, context, canonizeResults) {
        if (supportsResultCaching(context.store)) {
          return context.store.makeCacheKey(
            selectionSet,
            isReference(parent) ? parent.__ref : parent,
            context.varString,
            canonizeResults,
          );
        }
      }
    });

    this.executeSubSelectedArray = wrap((options: ExecSubSelectedArrayOptions) => {
      maybeDependOnExistenceOfEntity(
        options.context.store,
        options.enclosingRef.__ref,
      );
      return this.execSubSelectedArrayImpl(options);
    }, {
      max: this.config.resultCacheMaxSize,
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
    canonizeResults = this.config.canonizeResults,
  }: DiffQueryAgainstStoreOptions): Cache.DiffResult<T> {
    const policies = this.config.cache.policies;

    variables = {
      ...getDefaultValues(getQueryDefinition(query)),
      ...variables!,
    };

    const rootRef = makeReference(rootId);
    const merger = new DeepMerger;
    const execResult = this.executeSelectionSet({
      selectionSet: getMainDefinition(query).selectionSet,
      objectOrReference: rootRef,
      enclosingRef: rootRef,
      context: {
        store,
        query,
        policies,
        variables,
        varString: canonicalStringify(variables),
        canonizeResults,
        fragmentMap: createFragmentMap(getFragmentDefinitions(query)),
        merge(a, b) {
          // We use the same DeepMerger instance throughout the read, so any
          // merged objects created during this read can be updated later in the
          // read using in-place/destructive property assignments. Once the read
          // is finished, these objects will be frozen, but in the meantime it's
          // good for performance and memory usage if we avoid allocating a new
          // object for every merged property.
          return merger.merge(a, b);
        },
      },
    });

    let missing: MissingFieldError[] | undefined;
    if (execResult.missing) {
      // For backwards compatibility we still report an array of
      // MissingFieldError objects, even though there will only ever be at most
      // one of them, now that all missing field error messages are grouped
      // together in the execResult.missing tree.
      missing = [new MissingFieldError(
        firstMissing(execResult.missing)!,
        execResult.missing,
        query,
        variables,
      )];
      if (!returnPartialData) {
        throw missing[0];
      }
    }

    return {
      result: execResult.result,
      complete: !missing,
      missing,
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
      const latest = this.executeSelectionSet.peek(
        selectionSet,
        parent,
        context,
        // If result is canonical, then it could only have been previously
        // cached by the canonizing version of executeSelectionSet, so we can
        // avoid checking both possibilities here.
        this.canon.isKnown(result),
      );
      if (latest && result === latest.result) {
        return true;
      }
    }
    return false;
  }

  // Uncached version of executeSelectionSet.
  private execSelectionSetImpl({
    selectionSet,
    objectOrReference,
    enclosingRef,
    context,
  }: ExecSelectionSetOptions): ExecResult {
    if (isReference(objectOrReference) &&
        !context.policies.rootTypenamesById[objectOrReference.__ref] &&
        !context.store.has(objectOrReference.__ref)) {
      return {
        result: this.canon.empty,
        missing: `Dangling reference to missing ${objectOrReference.__ref} object`,
      };
    }

    const { variables, policies, store } = context;
    const typename = store.getFieldValue<string>(objectOrReference, "__typename");

    let result: any = {};
    let missing: MissingTree | undefined;

    if (this.config.addTypename &&
        typeof typename === "string" &&
        !policies.rootIdsByTypename[typename]) {
      // Ensure we always include a default value for the __typename
      // field, if we have one, and this.config.addTypename is true. Note
      // that this field can be overridden by other merged objects.
      result = { __typename: typename };
    }

    function handleMissing<T>(result: ExecResult<T>, resultName: string): T {
      if (result.missing) {
        missing = context.merge(missing, { [resultName]: result.missing });
      }
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

        if (fieldValue === void 0) {
          if (!addTypenameToDocument.added(selection)) {
            missing = context.merge(missing, {
              [resultName]: `Can't find field '${
                selection.name.value
              }' on ${
                isReference(objectOrReference)
                  ? objectOrReference.__ref + " object"
                  : "object " + JSON.stringify(objectOrReference, null, 2)
              }`
            });
          }

        } else if (Array.isArray(fieldValue)) {
          fieldValue = handleMissing(this.executeSubSelectedArray({
            field: selection,
            array: fieldValue,
            enclosingRef,
            context,
          }), resultName);

        } else if (!selection.selectionSet) {
          // If the field does not have a selection set, then we handle it
          // as a scalar value. To keep this.canon from canonicalizing
          // this value, we use this.canon.pass to wrap fieldValue in a
          // Pass object that this.canon.admit will later unwrap as-is.
          if (context.canonizeResults) {
            fieldValue = this.canon.pass(fieldValue);
          }

        } else if (fieldValue != null) {
          // In this case, because we know the field has a selection set,
          // it must be trying to query a GraphQLObjectType, which is why
          // fieldValue must be != null.
          fieldValue = handleMissing(this.executeSelectionSet({
            selectionSet: selection.selectionSet,
            objectOrReference: fieldValue as StoreObject | Reference,
            enclosingRef: isReference(fieldValue) ? fieldValue : enclosingRef,
            context,
          }), resultName);
        }

        if (fieldValue !== void 0) {
          result = context.merge(result, { [resultName]: fieldValue });
        }

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

    const finalResult: ExecResult = { result, missing };
    const frozen = context.canonizeResults
      ? this.canon.admit(finalResult)
      // Since this.canon is normally responsible for freezing results (only in
      // development), freeze them manually if canonization is disabled.
      : maybeDeepFreeze(finalResult);

    // Store this result with its selection set so that we can quickly
    // recognize it again in the StoreReader#isFresh method.
    if (frozen.result) {
      this.knownResults.set(frozen.result, selectionSet);
    }

    return frozen;
  }

  // Uncached version of executeSubSelectedArray.
  private execSubSelectedArrayImpl({
    field,
    array,
    enclosingRef,
    context,
  }: ExecSubSelectedArrayOptions): ExecResult {
    let missing: MissingTree | undefined;

    function handleMissing<T>(childResult: ExecResult<T>, i: number): T {
      if (childResult.missing) {
        missing = context.merge(missing, { [i]: childResult.missing });
      }
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

      // This is a nested array, recurse
      if (Array.isArray(item)) {
        return handleMissing(this.executeSubSelectedArray({
          field,
          array: item,
          enclosingRef,
          context,
        }), i);
      }

      // This is an object, run the selection set on it
      if (field.selectionSet) {
        return handleMissing(this.executeSelectionSet({
          selectionSet: field.selectionSet,
          objectOrReference: item,
          enclosingRef: isReference(item) ? item : enclosingRef,
          context,
        }), i);
      }

      if (__DEV__) {
        assertSelectionSetForIdValue(context.store, field, item);
      }

      return item;
    });

    return {
      result: context.canonizeResults ? this.canon.admit(array) : array,
      missing,
    };
  }
}

function firstMissing(tree: MissingTree): string | undefined {
  try {
    JSON.stringify(tree, (_, value) => {
      if (typeof value === "string") throw value;
      return value;
    });
  } catch (result) {
    return result;
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
      if (isNonNullObject(value)) {
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
