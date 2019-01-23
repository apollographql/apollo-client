import {
  ExecutionResult,
  DocumentNode,
  OperationDefinitionNode,
  SelectionSetNode,
  SelectionNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
  FieldNode,
  ASTNode,
} from 'graphql';
import { print } from 'graphql/language/printer';
import { visit, BREAK } from 'graphql/language/visitor';

import { ApolloCache } from 'apollo-cache';
import {
  getMainDefinition,
  buildQueryFromSelectionSet,
  hasDirectives,
  removeClientSetsFromDocument,
  mergeDeep,
  mergeDeepArray,
  warnOnceInDevelopment,
  FragmentMap,
  argumentsObjectFromField,
  resultKeyNameFromField,
  getFragmentDefinitions,
  createFragmentMap,
  shouldInclude,
  isField,
  isInlineFragment,
} from 'apollo-utilities';

import ApolloClient from '../ApolloClient';
import { Initializers, Resolvers, OperationVariables } from './types';
import { capitalizeFirstLetter } from '../util/capitalizeFirstLetter';

export type Resolver = (
  fieldName: string,
  rootValue: any,
  args: any,
  context: any,
  info: {
    field: FieldNode;
  },
) => any;

export type VariableMap = { [name: string]: any };

export type FragmentMatcher = (
  rootValue: any,
  typeCondition: string,
  context: any,
) => boolean;

export type ExecContext = {
  fragmentMap: FragmentMap;
  context: any;
  variables: VariableMap;
  fragmentMatcher: FragmentMatcher;
  defaultOperationType: string;
  exportedVariables: Record<string, any>;
  onlyRunForcedResolvers: boolean;
};

export type LocalStateOptions<TCacheShape> = {
  cache: ApolloCache<TCacheShape>;
  client?: ApolloClient<TCacheShape>;
  initializers?: Initializers<TCacheShape> | Initializers<TCacheShape>[];
  resolvers?: Resolvers | Resolvers[];
  typeDefs?: string | string[] | DocumentNode | DocumentNode[];
  fragmentMatcher?: FragmentMatcher;
};

export class LocalState<TCacheShape> {
  private cache: ApolloCache<TCacheShape>;
  private client: ApolloClient<TCacheShape>;
  private resolvers: Resolvers | Resolvers[] = {};
  private typeDefs: string | string[] | DocumentNode | DocumentNode[];
  private fragmentMatcher: FragmentMatcher;
  private firedInitializers: string[] = [];

  constructor({
    cache,
    client,
    initializers,
    resolvers,
    typeDefs,
    fragmentMatcher,
  }: LocalStateOptions<TCacheShape>) {
    this.cache = cache;

    if (client) {
      this.client = client;
    }

    if (initializers) {
      this.runInitializersSync(initializers);
    }

    if (resolvers) {
      this.addResolvers(resolvers);
    }

    if (typeDefs) {
      this.setTypeDefs(typeDefs);
    }

    if (fragmentMatcher) {
      this.setFragmentMatcher(fragmentMatcher);
    }
  }

  // Run the incoming initializer functions, asynchronously. Initializers that
  // have already been run are tracked against the initializer field name, to
  // prevent them from being run a second time.
  //
  // NOTE: Initializers do not currently check to see if data already exists
  // in the cache, before writing to the cache. This means existing data
  // can be overwritten. We might decide to query into the cache first to
  // see if any previous data exists before overwritting it, but TBD.
  public runInitializers(
    initializers: Initializers<TCacheShape> | Initializers<TCacheShape>[],
  ) {
    if (!initializers) {
      throw new Error('Invalid/missing initializers');
    }

    const mergedInitializers = this.mergeInitializers(initializers);

    const initializerPromises: Promise<void>[] = [];
    this.processInitializers(
      mergedInitializers,
      (fieldName: string, initializer: any) => {
        initializerPromises.push(
          Promise.resolve(initializer()).then(result => {
            if (result !== undefined) {
              this.cache.writeData({ data: { [fieldName]: result } });
            }
          }),
        );
      },
    );

    return Promise.all(initializerPromises);
  }

  // Run incoming intializer functions, synchronously.
  public runInitializersSync(
    initializers: Initializers<TCacheShape> | Initializers<TCacheShape>[],
  ) {
    if (!initializers) {
      throw new Error('Invalid/missing initializers');
    }

    const mergedInitializers = this.mergeInitializers(initializers);

    this.processInitializers(
      mergedInitializers,
      (fieldName: string, initializer: any) => {
        const result = initializer(this);
        if (result !== undefined) {
          this.cache.writeData({ data: { [fieldName]: result } });
        }
      },
    );
  }

  public addResolvers(resolvers: Resolvers | Resolvers[]) {
    if (Array.isArray(resolvers)) {
      resolvers.forEach(resolverGroup => {
        this.resolvers = mergeDeep(this.resolvers, resolverGroup);
      });
    } else {
      this.resolvers = mergeDeep(this.resolvers, resolvers);
    }
  }

  public setResolvers(resolvers: Resolvers | Resolvers[]) {
    this.resolvers = {};
    this.addResolvers(resolvers);
  }

  public getResolvers() {
    return this.resolvers;
  }

  // Run local client resolvers against the incoming query and remote data.
  // Locally resolved field values are merged with the incoming remote data,
  // and returned. Note that locally resolved fields will overwrite
  // remote data using the same field name.
  public async runResolvers({
    document,
    remoteResult,
    context,
    variables,
    onlyRunForcedResolvers = false,
  }: {
    document: DocumentNode | null;
    remoteResult?: ExecutionResult;
    context?: Record<string, any>;
    variables?: Record<string, any>;
    onlyRunForcedResolvers?: boolean;
  }): Promise<ExecutionResult> {
    if (document) {
      let rootValue = this.buildRootValueFromCache(document, variables);
      rootValue = rootValue ? mergeDeep(rootValue, remoteResult) : remoteResult;

      return this.resolveDocument(
        document,
        rootValue,
        context,
        variables,
        this.fragmentMatcher,
        onlyRunForcedResolvers,
      ).then(data => ({
        ...remoteResult,
        ...data.result,
      }));
    }

    return {
      ...remoteResult,
    };
  }

  public setTypeDefs(
    typeDefs: string | string[] | DocumentNode | DocumentNode[],
  ) {
    this.typeDefs = typeDefs;
  }

  public getTypeDefs(): string | string[] | DocumentNode | DocumentNode[] {
    return this.typeDefs;
  }

  public setFragmentMatcher(fragmentMatcher: FragmentMatcher) {
    this.fragmentMatcher = fragmentMatcher;
  }

  public getFragmentMatcher(): FragmentMatcher {
    return this.fragmentMatcher;
  }

  // Client queries contain everything in the incoming document (if a @client
  // directive is found).
  public clientQuery(document: DocumentNode) {
    return hasDirectives(['client'], document) ? document : null;
  }

  // Server queries are stripped of all @client based selection sets.
  public serverQuery(document: DocumentNode) {
    return removeClientSetsFromDocument(document);
  }

  public prepareContext(context = {}) {
    const cache = this.cache;

    let schemas: object[] = [];
    if (this.typeDefs) {
      const directives = 'directive @client on FIELD';
      const definition = this.normalizeTypeDefs(this.typeDefs);
      schemas.push({ definition, directives });
    }

    const newContext = {
      ...context,
      cache,
      // Getting an entry's cache key is useful for local state resolvers.
      getCacheKey: (obj: { __typename: string; id: string | number }) => {
        if ((cache as any).config) {
          return (cache as any).config.dataIdFromObject(obj);
        } else {
          throw new Error(
            'To use context.getCacheKey, you need to use a cache that has ' +
              'a configurable dataIdFromObject, like apollo-cache-inmemory.',
          );
        }
      },
      schemas,
    };

    return newContext;
  }

  // To support `@client @export(as: "someVar")` syntax, we'll first resolve
  // @client @export fields locally, then pass the resolved values back to be
  // used alongside the original operation variables.
  public async addExportedVariables(
    document: DocumentNode,
    variables: OperationVariables = {},
    context = {},
  ) {
    if (document) {
      return this.resolveDocument(
        document,
        this.buildRootValueFromCache(document, variables) || {},
        this.prepareContext(context),
        variables,
      ).then(data => ({
        ...variables,
        ...data.exportedVariables,
      }));
    }

    return {
      ...variables,
    };
  }

  public resetInitializers() {
    this.firedInitializers = [];
  }

  public shouldForceResolvers(document: ASTNode) {
    let forceResolvers = false;
    visit(document, {
      Directive: {
        enter(node) {
          if (node.name.value === 'client' && node.arguments) {
            forceResolvers = node.arguments.some(
              arg =>
                arg.name.value === 'always' &&
                arg.value.kind === 'BooleanValue' &&
                arg.value.value === true,
            );
            if (forceResolvers) {
              return BREAK;
            }
          }
        },
      },
    });
    return forceResolvers;
  }

  public shouldForceResolver(field: FieldNode) {
    return this.shouldForceResolvers(field);
  }

  private mergeInitializers(
    initializers: Initializers<TCacheShape> | Initializers<TCacheShape>[],
  ) {
    let mergedInitializers: Initializers<TCacheShape> = {};
    if (Array.isArray(initializers)) {
      initializers.forEach(initializerGroup => {
        mergedInitializers = { ...mergedInitializers, ...initializerGroup };
      });
    } else {
      mergedInitializers = initializers;
    }
    return mergedInitializers;
  }

  private processInitializers(
    initializers: Initializers<TCacheShape>,
    runFunc: (fieldName: string, initializer: any) => any,
  ) {
    const alreadyFired: string[] = [];

    Object.keys(initializers).forEach(fieldName => {
      if (this.firedInitializers.indexOf(fieldName) < 0) {
        runFunc(fieldName, initializers[fieldName]);
        this.firedInitializers.push(fieldName);
      } else {
        alreadyFired.push(fieldName);
      }
    });

    if (alreadyFired.length > 0) {
      warnOnceInDevelopment(
        "You're attempting to re-fire initializers for fields that have " +
          'already been initalized once. These repeat initializer calls have ' +
          'been ignored. If you really want them to run again, ' +
          'call `ApolloClient.resetInitializers()` first. ' +
          `Fields: ${alreadyFired.join(', ')}`,
      );
    }
  }

  // Query the cache and return matching data.
  private buildRootValueFromCache(
    document: DocumentNode,
    variables?: Record<string, any>,
  ) {
    return this.cache.diff({
      query: buildQueryFromSelectionSet(document),
      variables,
      optimistic: false,
    }).result;
  }

  private normalizeTypeDefs(
    typeDefs: string | string[] | DocumentNode | DocumentNode[],
  ) {
    const defs = Array.isArray(typeDefs) ? typeDefs : [typeDefs];

    return defs
      .map(typeDef => (typeof typeDef === 'string' ? typeDef : print(typeDef)))
      .map(str => str.trim())
      .join('\n');
  }

  private async resolveDocument(
    document: DocumentNode,
    rootValue?: any,
    context: any = {},
    variables: VariableMap = {},
    fragmentMatcher: FragmentMatcher = () => true,
    onlyRunForcedResolvers: boolean = false,
  ) {
    const mainDefinition = getMainDefinition(document);
    const fragments = getFragmentDefinitions(document);
    const fragmentMap = createFragmentMap(fragments);

    const definitionOperation = (mainDefinition as OperationDefinitionNode)
      .operation;

    const defaultOperationType = definitionOperation
      ? capitalizeFirstLetter(definitionOperation)
      : 'Query';

    const { cache, client } = this;
    const execContext: ExecContext = {
      fragmentMap,
      context: {
        ...context,
        cache,
        client,
      },
      variables,
      fragmentMatcher,
      defaultOperationType,
      exportedVariables: {},
      onlyRunForcedResolvers,
    };

    return this.resolveSelectionSet(
      mainDefinition.selectionSet,
      rootValue,
      execContext,
    ).then(result => ({
      result,
      exportedVariables: execContext.exportedVariables,
    }));
  }

  private async resolveSelectionSet(
    selectionSet: SelectionSetNode,
    rootValue: any,
    execContext: ExecContext,
  ) {
    const { fragmentMap, context, variables } = execContext;
    const resultsToMerge: any[] = [];

    const execute = async (selection: SelectionNode): Promise<void> => {
      if (!shouldInclude(selection, variables)) {
        // Skip this entirely.
        return;
      }

      if (isField(selection)) {
        return this.resolveField(selection, rootValue, execContext).then(
          fieldResult => {
            if (typeof fieldResult !== 'undefined') {
              resultsToMerge.push({
                [resultKeyNameFromField(selection)]: fieldResult,
              });
            }
          },
        );
      }

      let fragment: InlineFragmentNode | FragmentDefinitionNode;

      if (isInlineFragment(selection)) {
        fragment = selection;
      } else {
        // This is a named fragment.
        fragment = fragmentMap[selection.name.value];
        if (!fragment) {
          throw new Error(`No fragment named ${selection.name.value}`);
        }
      }

      if (fragment && fragment.typeCondition) {
        const typeCondition = fragment.typeCondition.name.value;
        if (execContext.fragmentMatcher(rootValue, typeCondition, context)) {
          return this.resolveSelectionSet(
            fragment.selectionSet,
            rootValue,
            execContext,
          ).then(fragmentResult => {
            resultsToMerge.push(fragmentResult);
          });
        }
      }
    };

    return Promise.all(selectionSet.selections.map(execute)).then(function() {
      return mergeDeepArray(resultsToMerge);
    });
  }

  private async resolveField(
    field: FieldNode,
    rootValue: any,
    execContext: ExecContext,
  ): Promise<any> {
    const { variables } = execContext;
    const fieldName = field.name.value;
    const aliasedFieldName = resultKeyNameFromField(field);
    const aliasUsed = fieldName !== aliasedFieldName;
    const defaultResult = rootValue[aliasedFieldName] || rootValue[fieldName];
    let resultPromise = Promise.resolve(defaultResult);

    // Usually all local resolvers are run when passing through here, but
    // if we've specifically identified that we only want to run forced
    // resolvers (that is, resolvers for fields marked with
    // `@client(always: true)`), then we'll skip running non-forced resolvers.
    if (
      !execContext.onlyRunForcedResolvers ||
      this.shouldForceResolver(field)
    ) {
      const resolverType =
        rootValue.__typename || execContext.defaultOperationType;
      const resolverMap = (this.resolvers as any)[resolverType];
      if (resolverMap) {
        const resolve = resolverMap[aliasUsed ? fieldName : aliasedFieldName];
        if (resolve) {
          resultPromise = Promise.resolve(resolve(
            rootValue,
            argumentsObjectFromField(field, variables),
            execContext.context,
            { field },
          ));
        }
      }
    }

    return resultPromise.then((result = defaultResult) => {
      // If an @export directive is associated with the current field, store
      // the `as` export variable name and current result for later use.
      if (field.directives) {
        field.directives.forEach(directive => {
          if (directive.name.value === 'export' && directive.arguments) {
            directive.arguments.forEach(arg => {
              if (arg.name.value === 'as' && arg.value.kind === 'StringValue') {
                execContext.exportedVariables[arg.value.value] = result;
              }
            });
          }
        });
      }

      // Handle all scalar types here.
      if (!field.selectionSet) {
        return result;
      }

      // From here down, the field has a selection set, which means it's trying
      // to query a GraphQLObjectType.
      if (result == null) {
        // Basically any field in a GraphQL response can be null, or missing
        return result;
      }

      if (Array.isArray(result)) {
        return this.resolveSubSelectedArray(field, result, execContext);
      }

      // Returned value is an object, and the query has a sub-selection. Recurse.
      if (field.selectionSet) {
        return this.resolveSelectionSet(
          field.selectionSet,
          result,
          execContext,
        );
      }
    });
  }

  private resolveSubSelectedArray(
    field: FieldNode,
    result: any[],
    execContext: ExecContext,
  ): any {
    return Promise.all(
      result.map(item => {
        if (item === null) {
          return null;
        }

        // This is a nested array, recurse.
        if (Array.isArray(item)) {
          return this.resolveSubSelectedArray(field, item, execContext);
        }

        // This is an object, run the selection set on it.
        if (field.selectionSet) {
          return this.resolveSelectionSet(field.selectionSet, item, execContext);
        }
      }),
    );
  }
}
