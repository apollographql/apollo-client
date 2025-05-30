import { invariant, newInvariantError } from "../../utilities/globals/index.js";

import type {
  InlineFragmentNode,
  FragmentDefinitionNode,
  SelectionSetNode,
  FieldNode,
} from "graphql";

import type {
  FragmentMap,
  StoreValue,
  StoreObject,
  Reference,
} from "../../utilities/index.js";
import {
  storeKeyNameFromField,
  argumentsObjectFromField,
  isReference,
  getStoreKeyName,
  isNonNullObject,
  stringifyForDisplay,
} from "../../utilities/index.js";
import type {
  IdGetter,
  MergeInfo,
  NormalizedCache,
  ReadMergeModifyContext,
} from "./types.js";
import {
  hasOwn,
  fieldNameFromStoreName,
  storeValueIsStoreObject,
  selectionSetMatchesResult,
  TypeOrFieldNameRegExp,
  defaultDataIdFromObject,
  isArray,
} from "./helpers.js";
import { cacheSlot } from "./reactiveVars.js";
import type { InMemoryCache } from "./inMemoryCache.js";
import type {
  SafeReadonly,
  FieldSpecifier,
  ToReferenceFunction,
  ReadFieldFunction,
  ReadFieldOptions,
  CanReadFunction,
} from "../core/types/common.js";
import type { WriteContext } from "./writeToStore.js";

import {
  keyArgsFnFromSpecifier,
  keyFieldsFnFromSpecifier,
} from "./key-extractor.js";
import { disableWarningsSlot } from "../../masking/index.js";

export type TypePolicies = {
  [__typename: string]: TypePolicy;
};

// TypeScript 3.7 will allow recursive type aliases, so this should work:
// type KeySpecifier = (string | KeySpecifier)[]
export type KeySpecifier = ReadonlyArray<string | KeySpecifier>;

export type KeyFieldsContext = {
  // The __typename of the incoming object, even if the __typename field was
  // aliased to another name in the raw result object. May be undefined when
  // dataIdFromObject is called for objects without __typename fields.
  typename: string | undefined;

  // The object to be identified, after processing to remove aliases and
  // normalize identifiable child objects with references.
  storeObject: StoreObject;

  // Handy tool for reading additional fields from context.storeObject, either
  // readField("fieldName") to read storeObject[fieldName], or readField("name",
  // objectOrReference) to read from another object or Reference. If you read a
  // field with a read function, that function will be invoked.
  readField: ReadFieldFunction;

  // If you are writing a custom keyFields function, and you plan to use the raw
  // result object passed as the first argument, you may also need access to the
  // selection set and available fragments for this object, just in case any
  // fields have aliases. Since this logic is tricky to get right, and these
  // context properties are not even always provided (for example, they are
  // omitted when calling cache.identify(object), where object is assumed to be
  // a StoreObject), we recommend you use context.storeObject (which has already
  // been de-aliased) and context.readField (which can read from references as
  // well as objects) instead of the raw result object in your keyFields
  // functions, or just rely on the internal implementation of keyFields:[...]
  // syntax to get these details right for you.
  selectionSet?: SelectionSetNode;
  fragmentMap?: FragmentMap;

  // Internal. May be set by the KeyFieldsFunction to report fields that were
  // involved in computing the ID. Never passed in by the caller.
  keyObject?: Record<string, any>;
};

export type KeyFieldsFunction = (
  object: Readonly<StoreObject>,
  context: KeyFieldsContext
) => KeySpecifier | false | ReturnType<IdGetter>;

type KeyFieldsResult = Exclude<ReturnType<KeyFieldsFunction>, KeySpecifier>;

// TODO Should TypePolicy be a generic type, with a TObject or TEntity
// type parameter?
export type TypePolicy = {
  // Allows defining the primary key fields for this type, either using an
  // array of field names or a function that returns an arbitrary string.
  keyFields?: KeySpecifier | KeyFieldsFunction | false;

  // Allows defining a merge function (or merge:true/false shorthand) to
  // be used for merging objects of this type wherever they appear, unless
  // the parent field also defines a merge function/boolean (that is,
  // parent field merge functions take precedence over type policy merge
  // functions). In many cases, defining merge:true for a given type
  // policy can save you from specifying merge:true for all the field
  // policies where that type might be encountered.
  merge?: FieldMergeFunction | boolean;

  // In the rare event that your schema happens to use a different
  // __typename for the root Query, Mutation, and/or Schema types, you can
  // express your deviant preferences by enabling one of these options.
  queryType?: true;
  mutationType?: true;
  subscriptionType?: true;

  fields?: {
    [fieldName: string]: FieldPolicy<any> | FieldReadFunction<any>;
  };
};

export type KeyArgsFunction = (
  args: Record<string, any> | null,
  context: {
    typename: string;
    fieldName: string;
    field: FieldNode | null;
    variables?: Record<string, any>;
  }
) => KeySpecifier | false | ReturnType<IdGetter>;

export type FieldPolicy<
  // The internal representation used to store the field's data in the
  // cache. Must be JSON-serializable if you plan to serialize the result
  // of cache.extract() using JSON.
  TExisting = any,
  // The type of the incoming parameter passed to the merge function,
  // typically matching the GraphQL response format, but with Reference
  // objects substituted for any identifiable child objects. Often the
  // same as TExisting, but not necessarily.
  TIncoming = TExisting,
  // The type that the read function actually returns, using TExisting
  // data and options.args as input. Usually the same as TIncoming.
  TReadResult = TIncoming,
  // Allows FieldFunctionOptions definition to be overwritten by the
  // developer
  TOptions extends FieldFunctionOptions = FieldFunctionOptions,
> = {
  keyArgs?: KeySpecifier | KeyArgsFunction | false;
  read?: FieldReadFunction<TExisting, TReadResult, TOptions>;
  merge?: FieldMergeFunction<TExisting, TIncoming, TOptions> | boolean;
};

export type StorageType = Record<string, any>;

function argsFromFieldSpecifier(spec: FieldSpecifier) {
  return (
    spec.args !== void 0 ? spec.args
    : spec.field ? argumentsObjectFromField(spec.field, spec.variables)
    : null
  );
}

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

  // The full field key used internally, including serialized key arguments.
  storeFieldName: string;

  // The FieldNode object used to read this field. Useful if you need to
  // know about other attributes of the field, such as its directives. This
  // option will be null when a string was passed to options.readField.
  field: FieldNode | null;

  variables?: TVars;

  // Utilities for dealing with { __ref } objects.
  isReference: typeof isReference;
  toReference: ToReferenceFunction;

  // A handy place to put field-specific data that you want to survive
  // across multiple read function calls. Useful for field-level caching,
  // if your read function does any expensive work.
  storage: StorageType;

  cache: InMemoryCache;

  // Helper function for reading other fields within the current object.
  // If a foreign object or reference is provided, the field will be read
  // from that object instead of the current object, so this function can
  // be used (together with isReference) to examine the cache outside the
  // current object. If a FieldNode is passed instead of a string, and
  // that FieldNode has arguments, the same options.variables will be used
  // to compute the argument values. Note that this function will invoke
  // custom read functions for other fields, if defined. Always returns
  // immutable data (enforced with Object.freeze in development).
  readField: ReadFieldFunction;

  // Returns true for non-normalized StoreObjects and non-dangling
  // References, indicating that readField(name, objOrRef) has a chance of
  // working. Useful for filtering out dangling references from lists.
  canRead: CanReadFunction;

  // Instead of just merging objects with { ...existing, ...incoming }, this
  // helper function can be used to merge objects in a way that respects any
  // custom merge functions defined for their fields.
  mergeObjects: MergeObjectsFunction;
}

type MergeObjectsFunction = <T extends StoreObject | Reference>(
  existing: T,
  incoming: T
) => T;

export type FieldReadFunction<
  TExisting = any,
  TReadResult = TExisting,
  TOptions extends FieldFunctionOptions = FieldFunctionOptions,
> = (
  // When reading a field, one often needs to know about any existing
  // value stored for that field. If the field is read before any value
  // has been written to the cache, this existing parameter will be
  // undefined, which makes it easy to use a default parameter expression
  // to supply the initial value. This parameter is positional (rather
  // than one of the named options) because that makes it possible for the
  // developer to annotate it with a type, without also having to provide
  // a whole new type for the options object.
  existing: SafeReadonly<TExisting> | undefined,
  options: TOptions
) => TReadResult | undefined;

export type FieldMergeFunction<
  TExisting = any,
  TIncoming = TExisting,
  // Passing the whole FieldFunctionOptions makes the current definition
  // independent from its implementation
  TOptions extends FieldFunctionOptions = FieldFunctionOptions,
> = (
  existing: SafeReadonly<TExisting> | undefined,
  // The incoming parameter needs to be positional as well, for the same
  // reasons discussed in FieldReadFunction above.
  incoming: SafeReadonly<TIncoming>,
  options: TOptions
) => SafeReadonly<TExisting>;

const nullKeyFieldsFn: KeyFieldsFunction = () => void 0;
const simpleKeyArgsFn: KeyArgsFunction = (_args, context) => context.fieldName;

// These merge functions can be selected by specifying merge:true or
// merge:false in a field policy.
const mergeTrueFn: FieldMergeFunction<any> = (
  existing,
  incoming,
  { mergeObjects }
) => mergeObjects(existing, incoming);
const mergeFalseFn: FieldMergeFunction<any> = (_, incoming) => incoming;

export type PossibleTypesMap = {
  [supertype: string]: string[];
};

export class Policies {
  private typePolicies: {
    [__typename: string]: {
      keyFn?: KeyFieldsFunction;
      merge?: FieldMergeFunction<any>;
      fields: {
        [fieldName: string]: {
          keyFn?: KeyArgsFunction;
          read?: FieldReadFunction<any>;
          merge?: FieldMergeFunction<any>;
        };
      };
    };
  } = Object.create(null);

  private toBeAdded: {
    [__typename: string]: TypePolicy[];
  } = Object.create(null);

  // Map from subtype names to sets of supertype names. Note that this
  // representation inverts the structure of possibleTypes (whose keys are
  // supertypes and whose values are arrays of subtypes) because it tends
  // to be much more efficient to search upwards than downwards.
  private supertypeMap = new Map<string, Set<string>>();

  // Any fuzzy subtypes specified by possibleTypes will be converted to
  // RegExp objects and recorded here. Every key of this map can also be
  // found in supertypeMap. In many cases this Map will be empty, which
  // means no fuzzy subtype checking will happen in fragmentMatches.
  private fuzzySubtypes = new Map<string, RegExp>();

  public readonly cache: InMemoryCache;

  public readonly rootIdsByTypename: Record<string, string> =
    Object.create(null);
  public readonly rootTypenamesById: Record<string, string> =
    Object.create(null);

  public readonly usingPossibleTypes = false;

  constructor(
    private config: {
      cache: InMemoryCache;
      dataIdFromObject?: KeyFieldsFunction;
      possibleTypes?: PossibleTypesMap;
      typePolicies?: TypePolicies;
    }
  ) {
    this.config = {
      dataIdFromObject: defaultDataIdFromObject,
      ...config,
    };

    this.cache = this.config.cache;

    this.setRootTypename("Query");
    this.setRootTypename("Mutation");
    this.setRootTypename("Subscription");

    if (config.possibleTypes) {
      this.addPossibleTypes(config.possibleTypes);
    }

    if (config.typePolicies) {
      this.addTypePolicies(config.typePolicies);
    }
  }

  public identify(
    object: StoreObject,
    partialContext?: Partial<KeyFieldsContext>
  ): [string?, StoreObject?] {
    const policies = this;

    const typename =
      (partialContext &&
        (partialContext.typename || partialContext.storeObject?.__typename)) ||
      object.__typename;

    // It should be possible to write root Query fields with writeFragment,
    // using { __typename: "Query", ... } as the data, but it does not make
    // sense to allow the same identification behavior for the Mutation and
    // Subscription types, since application code should never be writing
    // directly to (or reading directly from) those root objects.
    if (typename === this.rootTypenamesById.ROOT_QUERY) {
      return ["ROOT_QUERY"];
    }

    // Default context.storeObject to object if not otherwise provided.
    const storeObject =
      (partialContext && partialContext.storeObject) || object;

    const context: KeyFieldsContext = {
      ...partialContext,
      typename,
      storeObject,
      readField:
        (partialContext && partialContext.readField) ||
        function () {
          const options = normalizeReadFieldOptions(arguments, storeObject);
          return policies.readField(options, {
            store: policies.cache["data"],
            variables: options.variables,
          });
        },
    };

    let id: KeyFieldsResult;

    const policy = typename && this.getTypePolicy(typename);
    let keyFn = (policy && policy.keyFn) || this.config.dataIdFromObject;

    disableWarningsSlot.withValue(true, () => {
      while (keyFn) {
        const specifierOrId = keyFn({ ...object, ...storeObject }, context);
        if (isArray(specifierOrId)) {
          keyFn = keyFieldsFnFromSpecifier(specifierOrId);
        } else {
          id = specifierOrId;
          break;
        }
      }
    });

    id = id ? String(id) : void 0;
    return context.keyObject ? [id, context.keyObject] : [id];
  }

  public addTypePolicies(typePolicies: TypePolicies) {
    Object.keys(typePolicies).forEach((typename) => {
      const { queryType, mutationType, subscriptionType, ...incoming } =
        typePolicies[typename];

      // Though {query,mutation,subscription}Type configurations are rare,
      // it's important to call setRootTypename as early as possible,
      // since these configurations should apply consistently for the
      // entire lifetime of the cache. Also, since only one __typename can
      // qualify as one of these root types, these three properties cannot
      // be inherited, unlike the rest of the incoming properties. That
      // restriction is convenient, because the purpose of this.toBeAdded
      // is to delay the processing of type/field policies until the first
      // time they're used, allowing policies to be added in any order as
      // long as all relevant policies (including policies for supertypes)
      // have been added by the time a given policy is used for the first
      // time. In other words, since inheritance doesn't matter for these
      // properties, there's also no need to delay their processing using
      // the this.toBeAdded queue.
      if (queryType) this.setRootTypename("Query", typename);
      if (mutationType) this.setRootTypename("Mutation", typename);
      if (subscriptionType) this.setRootTypename("Subscription", typename);

      if (hasOwn.call(this.toBeAdded, typename)) {
        this.toBeAdded[typename].push(incoming);
      } else {
        this.toBeAdded[typename] = [incoming];
      }
    });
  }

  private updateTypePolicy(typename: string, incoming: TypePolicy) {
    const existing = this.getTypePolicy(typename);
    const { keyFields, fields } = incoming;

    function setMerge(
      existing: { merge?: FieldMergeFunction | boolean },
      merge?: FieldMergeFunction | boolean
    ) {
      existing.merge =
        typeof merge === "function" ? merge
          // Pass merge:true as a shorthand for a merge implementation
          // that returns options.mergeObjects(existing, incoming).
        : merge === true ? mergeTrueFn
          // Pass merge:false to make incoming always replace existing
          // without any warnings about data clobbering.
        : merge === false ? mergeFalseFn
        : existing.merge;
    }

    // Type policies can define merge functions, as an alternative to
    // using field policies to merge child objects.
    setMerge(existing, incoming.merge);

    existing.keyFn =
      // Pass false to disable normalization for this typename.
      keyFields === false ? nullKeyFieldsFn
        // Pass an array of strings to use those fields to compute a
        // composite ID for objects of this typename.
      : isArray(keyFields) ? keyFieldsFnFromSpecifier(keyFields)
        // Pass a function to take full control over identification.
      : typeof keyFields === "function" ? keyFields
        // Leave existing.keyFn unchanged if above cases fail.
      : existing.keyFn;

    if (fields) {
      Object.keys(fields).forEach((fieldName) => {
        const existing = this.getFieldPolicy(typename, fieldName, true)!;
        const incoming = fields[fieldName];

        if (typeof incoming === "function") {
          existing.read = incoming;
        } else {
          const { keyArgs, read, merge } = incoming;

          existing.keyFn =
            // Pass false to disable argument-based differentiation of
            // field identities.
            keyArgs === false ? simpleKeyArgsFn
              // Pass an array of strings to use named arguments to
              // compute a composite identity for the field.
            : isArray(keyArgs) ? keyArgsFnFromSpecifier(keyArgs)
              // Pass a function to take full control over field identity.
            : typeof keyArgs === "function" ? keyArgs
              // Leave existing.keyFn unchanged if above cases fail.
            : existing.keyFn;

          if (typeof read === "function") {
            existing.read = read;
          }

          setMerge(existing, merge);
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
  }

  private setRootTypename(
    which: "Query" | "Mutation" | "Subscription",
    typename: string = which
  ) {
    const rootId = "ROOT_" + which.toUpperCase();
    const old = this.rootTypenamesById[rootId];
    if (typename !== old) {
      invariant(
        !old || old === which,
        `Cannot change root %s __typename more than once`,
        which
      );
      // First, delete any old __typename associated with this rootId from
      // rootIdsByTypename.
      if (old) delete this.rootIdsByTypename[old];
      // Now make this the only __typename that maps to this rootId.
      this.rootIdsByTypename[typename] = rootId;
      // Finally, update the __typename associated with this rootId.
      this.rootTypenamesById[rootId] = typename;
    }
  }

  public addPossibleTypes(possibleTypes: PossibleTypesMap) {
    (this.usingPossibleTypes as boolean) = true;
    Object.keys(possibleTypes).forEach((supertype) => {
      // Make sure all types have an entry in this.supertypeMap, even if
      // their supertype set is empty, so we can return false immediately
      // from policies.fragmentMatches for unknown supertypes.
      this.getSupertypeSet(supertype, true);

      possibleTypes[supertype].forEach((subtype) => {
        this.getSupertypeSet(subtype, true)!.add(supertype);
        const match = subtype.match(TypeOrFieldNameRegExp);
        if (!match || match[0] !== subtype) {
          // TODO Don't interpret just any invalid typename as a RegExp.
          this.fuzzySubtypes.set(subtype, new RegExp(subtype));
        }
      });
    });
  }

  private getTypePolicy(typename: string): Policies["typePolicies"][string] {
    if (!hasOwn.call(this.typePolicies, typename)) {
      const policy: Policies["typePolicies"][string] = (this.typePolicies[
        typename
      ] = Object.create(null));
      policy.fields = Object.create(null);

      // When the TypePolicy for typename is first accessed, instead of
      // starting with an empty policy object, inherit any properties or
      // fields from the type policies of the supertypes of typename.
      //
      // Any properties or fields defined explicitly within the TypePolicy
      // for typename will take precedence, and if there are multiple
      // supertypes, the properties of policies whose types were added
      // later via addPossibleTypes will take precedence over those of
      // earlier supertypes. TODO Perhaps we should warn about these
      // conflicts in development, and recommend defining the property
      // explicitly in the subtype policy?
      //
      // Field policy inheritance is atomic/shallow: you can't inherit a
      // field policy and then override just its read function, since read
      // and merge functions often need to cooperate, so changing only one
      // of them would be a recipe for inconsistency.
      //
      // Once the TypePolicy for typename has been accessed, its properties can
      // still be updated directly using addTypePolicies, but future changes to
      // inherited supertype policies will not be reflected in this subtype
      // policy, because this code runs at most once per typename.
      let supertypes = this.supertypeMap.get(typename);
      if (!supertypes && this.fuzzySubtypes.size) {
        // To make the inheritance logic work for unknown typename strings that
        // may have fuzzy supertypes, we give this typename an empty supertype
        // set and then populate it with any fuzzy supertypes that match.
        supertypes = this.getSupertypeSet(typename, true)!;
        // This only works for typenames that are directly matched by a fuzzy
        // supertype. What if there is an intermediate chain of supertypes?
        // While possible, that situation can only be solved effectively by
        // specifying the intermediate relationships via possibleTypes, manually
        // and in a non-fuzzy way.
        this.fuzzySubtypes.forEach((regExp, fuzzy) => {
          if (regExp.test(typename)) {
            // The fuzzy parameter is just the original string version of regExp
            // (not a valid __typename string), but we can look up the
            // associated supertype(s) in this.supertypeMap.
            const fuzzySupertypes = this.supertypeMap.get(fuzzy);
            if (fuzzySupertypes) {
              fuzzySupertypes.forEach((supertype) =>
                supertypes!.add(supertype)
              );
            }
          }
        });
      }
      if (supertypes && supertypes.size) {
        supertypes.forEach((supertype) => {
          const { fields, ...rest } = this.getTypePolicy(supertype);
          Object.assign(policy, rest);
          Object.assign(policy.fields, fields);
        });
      }
    }

    const inbox = this.toBeAdded[typename];
    if (inbox && inbox.length) {
      // Merge the pending policies into this.typePolicies, in the order they
      // were originally passed to addTypePolicy.
      inbox.splice(0).forEach((policy) => {
        this.updateTypePolicy(typename, policy);
      });
    }

    return this.typePolicies[typename];
  }

  private getFieldPolicy(
    typename: string | undefined,
    fieldName: string,
    createIfMissing: boolean
  ):
    | {
        keyFn?: KeyArgsFunction;
        read?: FieldReadFunction<any>;
        merge?: FieldMergeFunction<any>;
      }
    | undefined {
    if (typename) {
      const fieldPolicies = this.getTypePolicy(typename).fields;
      return (
        fieldPolicies[fieldName] ||
        (createIfMissing && (fieldPolicies[fieldName] = Object.create(null)))
      );
    }
  }

  private getSupertypeSet(
    subtype: string,
    createIfMissing: boolean
  ): Set<string> | undefined {
    let supertypeSet = this.supertypeMap.get(subtype);
    if (!supertypeSet && createIfMissing) {
      this.supertypeMap.set(subtype, (supertypeSet = new Set<string>()));
    }
    return supertypeSet;
  }

  public fragmentMatches(
    fragment: InlineFragmentNode | FragmentDefinitionNode,
    typename: string | undefined,
    result?: Record<string, any>,
    variables?: Record<string, any>
  ): boolean {
    if (!fragment.typeCondition) return true;

    // If the fragment has a type condition but the object we're matching
    // against does not have a __typename, the fragment cannot match.
    if (!typename) return false;

    const supertype = fragment.typeCondition.name.value;
    // Common case: fragment type condition and __typename are the same.
    if (typename === supertype) return true;

    if (this.usingPossibleTypes && this.supertypeMap.has(supertype)) {
      const typenameSupertypeSet = this.getSupertypeSet(typename, true)!;
      const workQueue = [typenameSupertypeSet];
      const maybeEnqueue = (subtype: string) => {
        const supertypeSet = this.getSupertypeSet(subtype, false);
        if (
          supertypeSet &&
          supertypeSet.size &&
          workQueue.indexOf(supertypeSet) < 0
        ) {
          workQueue.push(supertypeSet);
        }
      };

      // We need to check fuzzy subtypes only if we encountered fuzzy
      // subtype strings in addPossibleTypes, and only while writing to
      // the cache, since that's when selectionSetMatchesResult gives a
      // strong signal of fragment matching. The StoreReader class calls
      // policies.fragmentMatches without passing a result object, so
      // needToCheckFuzzySubtypes is always false while reading.
      let needToCheckFuzzySubtypes = !!(result && this.fuzzySubtypes.size);
      let checkingFuzzySubtypes = false;

      // It's important to keep evaluating workQueue.length each time through
      // the loop, because the queue can grow while we're iterating over it.
      for (let i = 0; i < workQueue.length; ++i) {
        const supertypeSet = workQueue[i];

        if (supertypeSet.has(supertype)) {
          if (!typenameSupertypeSet.has(supertype)) {
            if (checkingFuzzySubtypes) {
              invariant.warn(
                `Inferring subtype %s of supertype %s`,
                typename,
                supertype
              );
            }
            // Record positive results for faster future lookup.
            // Unfortunately, we cannot safely cache negative results,
            // because new possibleTypes data could always be added to the
            // Policies class.
            typenameSupertypeSet.add(supertype);
          }
          return true;
        }

        supertypeSet.forEach(maybeEnqueue);

        if (
          needToCheckFuzzySubtypes &&
          // Start checking fuzzy subtypes only after exhausting all
          // non-fuzzy subtypes (after the final iteration of the loop).
          i === workQueue.length - 1 &&
          // We could wait to compare fragment.selectionSet to result
          // after we verify the supertype, but this check is often less
          // expensive than that search, and we will have to do the
          // comparison anyway whenever we find a potential match.
          selectionSetMatchesResult(fragment.selectionSet, result!, variables)
        ) {
          // We don't always need to check fuzzy subtypes (if no result
          // was provided, or !this.fuzzySubtypes.size), but, when we do,
          // we only want to check them once.
          needToCheckFuzzySubtypes = false;
          checkingFuzzySubtypes = true;

          // If we find any fuzzy subtypes that match typename, extend the
          // workQueue to search through the supertypes of those fuzzy
          // subtypes. Otherwise the for-loop will terminate and we'll
          // return false below.
          this.fuzzySubtypes.forEach((regExp, fuzzyString) => {
            const match = typename.match(regExp);
            if (match && match[0] === typename) {
              maybeEnqueue(fuzzyString);
            }
          });
        }
      }
    }

    return false;
  }

  public hasKeyArgs(typename: string | undefined, fieldName: string) {
    const policy = this.getFieldPolicy(typename, fieldName, false);
    return !!(policy && policy.keyFn);
  }

  public getStoreFieldName(fieldSpec: FieldSpecifier): string {
    const { typename, fieldName } = fieldSpec;
    const policy = this.getFieldPolicy(typename, fieldName, false);
    let storeFieldName: Exclude<ReturnType<KeyArgsFunction>, KeySpecifier>;

    let keyFn = policy && policy.keyFn;
    if (keyFn && typename) {
      const context: Parameters<KeyArgsFunction>[1] = {
        typename,
        fieldName,
        field: fieldSpec.field || null,
        variables: fieldSpec.variables,
      };
      const args = argsFromFieldSpecifier(fieldSpec);
      while (keyFn) {
        const specifierOrString = keyFn(args, context);
        if (isArray(specifierOrString)) {
          keyFn = keyArgsFnFromSpecifier(specifierOrString);
        } else {
          // If the custom keyFn returns a falsy value, fall back to
          // fieldName instead.
          storeFieldName = specifierOrString || fieldName;
          break;
        }
      }
    }

    if (storeFieldName === void 0) {
      storeFieldName =
        fieldSpec.field ?
          storeKeyNameFromField(fieldSpec.field, fieldSpec.variables)
        : getStoreKeyName(fieldName, argsFromFieldSpecifier(fieldSpec));
    }

    // Returning false from a keyArgs function is like configuring
    // keyArgs: false, but more dynamic.
    if (storeFieldName === false) {
      return fieldName;
    }

    // Make sure custom field names start with the actual field.name.value
    // of the field, so we can always figure out which properties of a
    // StoreObject correspond to which original field names.
    return fieldName === fieldNameFromStoreName(storeFieldName) ? storeFieldName
      : fieldName + ":" + storeFieldName;
  }

  public readField<V = StoreValue>(
    options: ReadFieldOptions,
    context: ReadMergeModifyContext
  ): SafeReadonly<V> | undefined {
    const objectOrReference = options.from;
    if (!objectOrReference) return;

    const nameOrField = options.field || options.fieldName;
    if (!nameOrField) return;

    if (options.typename === void 0) {
      const typename = context.store.getFieldValue<string>(
        objectOrReference,
        "__typename"
      );
      if (typename) options.typename = typename;
    }

    const storeFieldName = this.getStoreFieldName(options);
    const fieldName = fieldNameFromStoreName(storeFieldName);
    const existing = context.store.getFieldValue<V>(
      objectOrReference,
      storeFieldName
    );
    const policy = this.getFieldPolicy(options.typename, fieldName, false);
    const read = policy && policy.read;

    if (read) {
      const readOptions = makeFieldFunctionOptions(
        this,
        objectOrReference,
        options,
        context,
        context.store.getStorage(
          isReference(objectOrReference) ?
            objectOrReference.__ref
          : objectOrReference,
          storeFieldName
        )
      );

      // Call read(existing, readOptions) with cacheSlot holding this.cache.
      return cacheSlot.withValue(this.cache, read, [
        existing,
        readOptions,
      ]) as SafeReadonly<V>;
    }

    return existing;
  }

  public getReadFunction(
    typename: string | undefined,
    fieldName: string
  ): FieldReadFunction | undefined {
    const policy = this.getFieldPolicy(typename, fieldName, false);
    return policy && policy.read;
  }

  public getMergeFunction(
    parentTypename: string | undefined,
    fieldName: string,
    childTypename: string | undefined
  ): FieldMergeFunction | undefined {
    let policy:
      | Policies["typePolicies"][string]
      | Policies["typePolicies"][string]["fields"][string]
      | undefined = this.getFieldPolicy(parentTypename, fieldName, false);
    let merge = policy && policy.merge;
    if (!merge && childTypename) {
      policy = this.getTypePolicy(childTypename);
      merge = policy && policy.merge;
    }
    return merge;
  }

  public runMergeFunction(
    existing: StoreValue,
    incoming: StoreValue,
    { field, typename, merge }: MergeInfo,
    context: WriteContext,
    storage?: StorageType
  ) {
    if (merge === mergeTrueFn) {
      // Instead of going to the trouble of creating a full
      // FieldFunctionOptions object and calling mergeTrueFn, we can
      // simply call mergeObjects, as mergeTrueFn would.
      return makeMergeObjectsFunction(context.store)(
        existing as StoreObject,
        incoming as StoreObject
      );
    }

    if (merge === mergeFalseFn) {
      // Likewise for mergeFalseFn, whose implementation is even simpler.
      return incoming;
    }

    // If cache.writeQuery or cache.writeFragment was called with
    // options.overwrite set to true, we still call merge functions, but
    // the existing data is always undefined, so the merge function will
    // not attempt to combine the incoming data with the existing data.
    if (context.overwrite) {
      existing = void 0;
    }

    return merge(
      existing,
      incoming,
      makeFieldFunctionOptions(
        this,
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
        void 0,
        {
          typename,
          fieldName: field.name.value,
          field,
          variables: context.variables,
        },
        context,
        storage || Object.create(null)
      )
    );
  }
}

function makeFieldFunctionOptions(
  policies: Policies,
  objectOrReference: StoreObject | Reference | undefined,
  fieldSpec: FieldSpecifier,
  context: ReadMergeModifyContext,
  storage: StorageType
): FieldFunctionOptions {
  const storeFieldName = policies.getStoreFieldName(fieldSpec);
  const fieldName = fieldNameFromStoreName(storeFieldName);
  const variables = fieldSpec.variables || context.variables;
  const { toReference, canRead } = context.store;

  return {
    args: argsFromFieldSpecifier(fieldSpec),
    field: fieldSpec.field || null,
    fieldName,
    storeFieldName,
    variables,
    isReference,
    toReference,
    storage,
    cache: policies.cache,
    canRead,
    readField<T>() {
      return policies.readField<T>(
        normalizeReadFieldOptions(arguments, objectOrReference, variables),
        context
      );
    },
    mergeObjects: makeMergeObjectsFunction(context.store),
  };
}

export function normalizeReadFieldOptions(
  readFieldArgs: IArguments,
  objectOrReference: StoreObject | Reference | undefined,
  variables?: ReadMergeModifyContext["variables"]
): ReadFieldOptions {
  const { 0: fieldNameOrOptions, 1: from, length: argc } = readFieldArgs;

  let options: ReadFieldOptions;

  if (typeof fieldNameOrOptions === "string") {
    options = {
      fieldName: fieldNameOrOptions,
      // Default to objectOrReference only when no second argument was
      // passed for the from parameter, not when undefined is explicitly
      // passed as the second argument.
      from: argc > 1 ? from : objectOrReference,
    };
  } else {
    options = { ...fieldNameOrOptions };
    // Default to objectOrReference only when fieldNameOrOptions.from is
    // actually omitted, rather than just undefined.
    if (!hasOwn.call(options, "from")) {
      options.from = objectOrReference;
    }
  }

  if (__DEV__ && options.from === void 0) {
    invariant.warn(
      `Undefined 'from' passed to readField with arguments %s`,
      stringifyForDisplay(Array.from(readFieldArgs))
    );
  }

  if (void 0 === options.variables) {
    options.variables = variables;
  }

  return options;
}

function makeMergeObjectsFunction(
  store: NormalizedCache
): MergeObjectsFunction {
  return function mergeObjects(existing, incoming) {
    if (isArray(existing) || isArray(incoming)) {
      throw newInvariantError("Cannot automatically merge arrays");
    }

    // These dynamic checks are necessary because the parameters of a
    // custom merge function can easily have the any type, so the type
    // system cannot always enforce the StoreObject | Reference parameter
    // types of options.mergeObjects.
    if (isNonNullObject(existing) && isNonNullObject(incoming)) {
      const eType = store.getFieldValue(existing, "__typename");
      const iType = store.getFieldValue(incoming, "__typename");
      const typesDiffer = eType && iType && eType !== iType;

      if (typesDiffer) {
        return incoming;
      }

      if (isReference(existing) && storeValueIsStoreObject(incoming)) {
        // Update the normalized EntityStore for the entity identified by
        // existing.__ref, preferring/overwriting any fields contributed by the
        // newer incoming StoreObject.
        store.merge(existing.__ref, incoming);
        return existing;
      }

      if (storeValueIsStoreObject(existing) && isReference(incoming)) {
        // Update the normalized EntityStore for the entity identified by
        // incoming.__ref, taking fields from the older existing object only if
        // those fields are not already present in the newer StoreObject
        // identified by incoming.__ref.
        store.merge(existing, incoming.__ref);
        return incoming;
      }

      if (
        storeValueIsStoreObject(existing) &&
        storeValueIsStoreObject(incoming)
      ) {
        return { ...existing, ...incoming };
      }
    }

    return incoming;
  };
}
