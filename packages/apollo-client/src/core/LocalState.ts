import {
  ExecutionResult,
  DocumentNode,
  OperationDefinitionNode,
  print,
} from 'graphql';
import graphql, { Resolver, FragmentMatcher } from 'graphql-anywhere';
import { ApolloCache } from 'apollo-cache';
import {
  getMainDefinition,
  buildQueryFromSelectionSet,
  hasDirectives,
  removeClientSetsFromDocument,
  mergeDeep,
} from 'apollo-utilities';

import ApolloClient from '../ApolloClient';
import { Initializers, Resolvers, OperationVariables } from './types';
import { capitalizeFirstLetter } from '../util/capitalizeFirstLetter';

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
  }: {
    cache: ApolloCache<TCacheShape>;
    client?: ApolloClient<TCacheShape>;
    initializers?: Initializers<TCacheShape> | Initializers<TCacheShape>[];
    resolvers?: Resolvers | Resolvers[];
    typeDefs?: string | string[] | DocumentNode | DocumentNode[];
    fragmentMatcher?: FragmentMatcher;
  }) {
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
            if (result !== null) {
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
        if (result !== null) {
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
  public runResolvers({
    query,
    remoteResult,
    context,
    variables,
    onError,
  }: {
    query: DocumentNode | null;
    remoteResult?: ExecutionResult;
    context?: Record<string, any>;
    variables?: Record<string, any>;
    onError?: (error: any) => void;
  }) {
    let localResult: Record<string, any> = {};

    if (query) {
      const { resolver } = this.prepareResolver(query);
      if (resolver) {
        let rootValue = this.buildRootValueFromCache(query, variables);
        rootValue = rootValue
          ? mergeDeep(rootValue, remoteResult)
          : remoteResult;

        try {
          localResult = graphql(
            resolver,
            query,
            rootValue,
            context,
            variables,
            { fragmentMatcher: this.fragmentMatcher },
          );
        } catch (error) {
          if (onError) {
            onError(error);
            return;
          } else {
            throw error;
          }
        }
      }
    }

    return {
      ...remoteResult,
      ...localResult,
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
      schemas = schemas.concat([{ definition, directives }]);
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
  public addExportedVariables(
    document: DocumentNode,
    variables: OperationVariables = {},
    context = {},
  ) {
    let exportedVariables: { [fieldName: string]: string } = {};

    if (
      document &&
      hasDirectives(['client'], document) &&
      hasDirectives(['export'], document)
    ) {
      const preparedResolver = this.prepareResolver(document);
      if (preparedResolver.resolver) {
        const rootValue = this.buildRootValueFromCache(document, variables);
        const updatedContext = this.prepareContext(context);
        graphql(
          preparedResolver.resolver,
          document,
          rootValue || {},
          updatedContext,
          variables,
        );
        exportedVariables = preparedResolver.exportedVariables;
      }
    }

    return {
      ...variables,
      ...exportedVariables,
    };
  }

  public resetInitializers() {
    this.firedInitializers = [];
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
    Object.keys(initializers).forEach(fieldName => {
      if (this.firedInitializers.indexOf(fieldName) < 0) {
        runFunc(fieldName, initializers[fieldName]);
        this.firedInitializers.push(fieldName);
      }
    });
  }

  // Prepare and return a local resolver function, that can be used to
  // resolve @client fields.
  private prepareResolver(query: DocumentNode | null) {
    let resolver: Resolver | null = null;
    const exportedVariables: Record<string, any> = {};

    if (!query) {
      return {
        resolver,
        exportedVariables,
      };
    }

    const definition = getMainDefinition(query);
    const definitionOperation = (<OperationDefinitionNode>definition).operation;
    let type: string | null = definitionOperation
      ? capitalizeFirstLetter(definitionOperation)
      : 'Query';
    const { cache, client } = this;

    resolver = (
      fieldName: string,
      rootValue: any = {},
      args: any,
      context: any,
      info: any,
    ) => {
      const { resultKey } = info;

      // If an @export directive is associated with the current field, store
      // the `as` export variable name for later use.
      let exportedVariable;
      if (info.directives && info.directives.export) {
        exportedVariable = info.directives.export.as;
      }

      // To add a bit of flexibility, we'll try resolving data in root value
      // objects, as well as an object pointed to by the first root
      // value property (if it exists). This means we're resolving using
      // { property1: '', property2: '', ... } objects, as well as
      // { someField: { property1: '', property2: '', ... } } objects.
      let childRootValue: { [key: string]: any } = {};
      let rootValueKey = Object.keys(rootValue)[0];
      if (rootValueKey) {
        childRootValue = rootValue[rootValueKey];
      }

      let normalNode =
        rootValue[fieldName] !== undefined
          ? rootValue[fieldName]
          : childRootValue[fieldName];
      let aliasedNode =
        rootValue[resultKey] !== undefined
          ? rootValue[resultKey]
          : childRootValue[resultKey];

      const aliasUsed = resultKey !== fieldName;
      const field = aliasUsed ? fieldName : resultKey;

      // Make sure the context has access to the cache and query/mutate
      // functions, so resolvers can use them.
      const updatedContext = {
        ...context,
        cache,
        client,
      };

      let result;

      // If a local resolver function is defined, run it and return the
      // outcome.
      const resolverType = rootValue.__typename || type;
      const resolverMap = (this.resolvers as any)[resolverType];
      if (resolverMap) {
        const resolve = resolverMap[field];
        if (resolve) {
          result = resolve(rootValue, args, updatedContext, info);
        }
      }

      if (result === undefined) {
        // If we were able to find a matching field in the root value, return
        // that value as the resolved value.
        if (normalNode !== undefined || aliasedNode !== undefined) {
          result = aliasedNode || normalNode;
        }
      }

      // If an @export directive is associated with this field, store
      // the calculated result for later use.
      if (exportedVariable) {
        exportedVariables[exportedVariable] = result;
      }

      return result;
    };

    return {
      resolver,
      exportedVariables,
    };
  }

  // Query the cache and return matching data.
  private buildRootValueFromCache(
    document: DocumentNode,
    variables?: Record<string, any>,
  ) {
    const query = buildQueryFromSelectionSet(document);
    const cachedData = this.cache.diff({
      query,
      variables,
      optimistic: false,
    });
    return cachedData.result;
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
}
