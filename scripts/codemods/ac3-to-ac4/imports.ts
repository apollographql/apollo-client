import type { namedTypes } from "ast-types";
import type { ASTPath, Transform } from "jscodeshift";

type ImportKind = "type" | "value";

const transform: Transform = function transform(file, api) {
  const j = api.jscodeshift;
  const source = j(file.source);
  const combined: Record<string, boolean> = {};

  renameTypeSpecifier("QueryReference", "QueryRef", "@apollo/client");
  renameTypeSpecifier("QueryReference", "QueryRef", "@apollo/client/react");
  renameTypeSpecifier(
    "QueryReference",
    "QueryRef",
    "@apollo/client/react/internal"
  );

  moveSpecifiersToEntrypoint(
    REACT_IMPORTS_FROM_ROOT,
    "@apollo/client",
    "@apollo/client/react"
  );
  moveSpecifiersToEntrypoint(
    REACT_CONTEXT_IMPORTS,
    "@apollo/client/react/context",
    "@apollo/client/react"
  );

  moveSpecifiersToEntrypoint(
    UTILITIES_INTERNAL_IMPORTS,
    "@apollo/client/utilities",
    "@apollo/client/utilities/internal"
  );

  moveSpecifiersToEntrypoint(
    ["MockedProvider", "MockedProviderProps"],
    "@apollo/client/testing",
    "@apollo/client/testing/react"
  );

  moveAllSpecifiersToEntrypoint("@apollo/client/core", "@apollo/client");
  moveAllSpecifiersToEntrypoint(
    "@apollo/client/link/core",
    "@apollo/client/link"
  );
  moveAllSpecifiersToEntrypoint(
    "@apollo/client/testing/core",
    "@apollo/client/testing"
  );

  return source.toSource();

  function isOnlySpecifier(
    name: string,
    entrypoint: string,
    importKind: ImportKind = "value"
  ) {
    if (!hasSpecifier(name, entrypoint, importKind)) {
      return false;
    }

    return (
      getImportWithKind(entrypoint, importKind)
        .find(j.ImportSpecifier)
        .size() === 1
    );
  }

  function renameTypeSpecifier(
    from: string,
    to: string,
    sourceEntrypoint: string
  ) {
    const specifier = getImport(sourceEntrypoint).find(j.ImportSpecifier, {
      imported: { name: from },
    });

    if (!specifier.size()) {
      return;
    }

    const alias = specifier.get("local", "name").value;
    const newIdentifier = j.identifier(to);

    specifier.find(j.Identifier, { name: from }).replaceWith(newIdentifier);

    if (alias === from) {
      source
        .find(j.Identifier, { name: from })
        .filter(({ parentPath }) => {
          return (
            j.TSTypeAnnotation.check(parentPath.value) ||
            j.TSTypeReference.check(parentPath.value)
          );
        })
        .replaceWith(newIdentifier);
    }
  }

  function moveSpecifiersToEntrypoint(
    specifiers: string[],
    sourceEntrypoint: string,
    targetEntrypoint: string
  ) {
    if (
      areAllSpecifiersFrom(
        specifiers.concat(specifiers === REACT_IMPORTS_FROM_ROOT ? "gql" : []),
        sourceEntrypoint
      ) &&
      !isOnlySpecifier("gql", sourceEntrypoint)
    ) {
      renameImport(sourceEntrypoint, targetEntrypoint);
    } else {
      specifiers.forEach((name) =>
        moveSpecifierToEntrypoint(name, sourceEntrypoint, targetEntrypoint)
      );
    }
  }

  function areAllSpecifiersFrom(specifiers: string[], moduleName: string) {
    return getImport(moduleName)
      .find(j.ImportSpecifier)
      .every((specifier) => {
        return specifiers.includes(specifier.value.imported.name.toString());
      });
  }

  function renameImport(from: string, to: string) {
    getImport(from).find(j.Literal).replaceWith(j.literal(to));
  }

  function moveSpecifierToEntrypoint(
    name: string,
    sourceEntrypoint: string,
    targetEntrypoint: string
  ) {
    moveSpecifier(name, "value", sourceEntrypoint, targetEntrypoint);
    moveSpecifier(name, "type", sourceEntrypoint, targetEntrypoint);
    removeImportIfEmpty(sourceEntrypoint);
  }

  function moveSpecifier(
    name: string,
    importKind: ImportKind,
    sourceEntrypoint: string,
    targetEntrypoint: string
  ) {
    combineImports(sourceEntrypoint);
    combineImports(targetEntrypoint);

    if (
      hasSpecifier(name, targetEntrypoint, importKind) ||
      !hasSpecifier(name, sourceEntrypoint, importKind)
    ) {
      return;
    }

    const specifier = getSpecifier(name, sourceEntrypoint, importKind);
    let targetImports = getImportWithKind(targetEntrypoint, importKind);

    if (!targetImports.size()) {
      const newModule = j.importDeclaration(
        [],
        j.literal(targetEntrypoint),
        importKind
      );
      getImportWithKind(sourceEntrypoint, importKind).insertAfter(newModule);
      targetImports = j(newModule);
    }

    targetImports.get("specifiers").push(specifier.paths()[0].value);
    specifier.remove();
  }

  function getImport(moduleName: string) {
    return source.find(j.ImportDeclaration, {
      source: { value: moduleName },
    });
  }

  function getImportWithKind(moduleName: string, importKind: ImportKind) {
    return source.find(j.ImportDeclaration, {
      importKind,
      source: { value: moduleName },
    });
  }

  function getSpecifier(
    name: string,
    moduleName: string,
    importKind: ImportKind
  ) {
    return getImportWithKind(moduleName, importKind).find(j.ImportSpecifier, {
      imported: { type: "Identifier", name },
    });
  }

  function hasSpecifier(
    name: string,
    moduleName: string,
    importKind: ImportKind
  ) {
    return !!getSpecifier(name, moduleName, importKind).size();
  }

  function removeImportIfEmpty(moduleName: string) {
    const imports = getImport(moduleName);

    if (imports.size()) {
      imports.forEach((astPath) => {
        if (!astPath.value.specifiers?.length) {
          j(astPath).remove();
        }
      });
    }
  }

  function combineImports(moduleName: string) {
    if (combined[moduleName]) {
      return;
    }

    combined[moduleName] = true;

    const cache: Partial<
      Record<ImportKind, ASTPath<namedTypes.ImportDeclaration>>
    > = {};

    getImport(moduleName).forEach((astPath) => {
      const { importKind } = astPath.value;

      if (importKind !== "type" && importKind !== "value") {
        return;
      }

      const imports = (cache[importKind] ||= astPath);

      if (imports === astPath) {
        return;
      }

      astPath.value.specifiers?.forEach((specifier) => {
        imports.get("specifiers").push(specifier);
      });

      j(astPath).remove();
    });
  }

  function moveAllSpecifiersToEntrypoint(
    sourceEntrypoint: string,
    targetEntrypoint: string
  ) {
    (["value", "type"] as const).forEach((importKind) => {
      const imports = getImportWithKind(sourceEntrypoint, importKind);

      if (!imports.size()) {
        return;
      }

      imports
        .get("specifiers")
        .value.forEach((specifier: namedTypes.ImportSpecifier) => {
          moveSpecifier(
            specifier.imported.name.toString(),
            importKind,
            sourceEntrypoint,
            targetEntrypoint
          );
        });

      imports.remove();
    });
  }
};

const REACT_IMPORTS_FROM_ROOT = [
  "ApolloConsumer",
  "ApolloProvider",
  "createQueryPreloader",
  "getApolloContext",
  "skipToken",
  "useApolloClient",
  "useBackgroundQuery",
  "useFragment",
  "useLazyQuery",
  "useLoadableQuery",
  "useMutation",
  "useQuery",
  "useQueryRefHandlers",
  "useSubscription",
  "useSuspenseFragment",
  "useSuspenseQuery",
  "useReactiveVar",
  "useReadQuery",

  // Types
  "ApolloContextValue",
  "BackgroundQueryHookFetchPolicy",
  "BackgroundQueryHookOptions",
  "LazyQueryExecFunction",
  "LazyQueryHookExecOptions",
  "LazyQueryHookOptions",
  "LazyQueryResult",
  "LazyQueryResultTuple",
  "LoadableQueryFetchPolicy",
  "LoadableQueryHookOptions",
  "LoadQueryFunction",
  "MutationFunctionOptions",
  "MutationHookOptions",
  "MutationResult",
  "MutationTuple",
  "OnDataOptions",
  "OnSubscriptionDataOptions",
  "PreloadedQueryRef",
  "PreloadQueryFetchPolicy",
  "PreloadQueryFunction",
  "PreloadQueryOptions",
  "QueryHookOptions",
  "QueryRef",
  "QueryResult",
  "SkipToken",
  "SubscriptionHookOptions",
  "SubscriptionResult",
  "SuspenseQueryHookFetchPolicy",
  "SuspenseQueryHookOptions",
  "UseBackgroundQueryResult",
  "UseFragmentOptions",
  "UseFragmentResult",
  "UseLoadableQueryResult",
  "UseQueryRefHandlersResult",
  "UseReadQueryResult",
  "UseSuspenseFragmentOptions",
  "UseSuspenseFragmentResult",
  "UseSuspenseQueryResult",
];

const REACT_CONTEXT_IMPORTS = [
  "ApolloConsumer",
  "getApolloContext",
  "ApolloProvider",

  // Types
  // TODO: Rename to ApolloConsumer.Props
  // "ApolloConsumerProps",
  "ApolloContextValue",
  // TODO: Rename to ApolloProvider.Props
  // "ApolloProviderProps",
];

const UTILITIES_INTERNAL_IMPORTS = [
  "AutoCleanedStrongCache",
  "AutoCleanedWeakCache",
  "argumentsObjectFromField",
  "canUseDOM",
  "checkDocument",
  "cloneDeep",
  "compact",
  "createFragmentMap",
  "createFulfilledPromise",
  "createRejectedPromise",
  "dealias",
  "decoratePromise",
  "DeepMerger",
  "getDefaultValues",
  "getFragmentFromSelection",
  "getFragmentQueryDocument",
  "getFragmentDefinition",
  "getFragmentDefinitions",
  "getGraphQLErrorsFromResult",
  "getOperationDefinition",
  "getOperationName",
  "getQueryDefinition",
  "getStoreKeyName",
  "graphQLResultHasError",
  "hasDirectives",
  "hasForcedResolvers",
  "isArray",
  "isDocumentNode",
  "isField",
  "isNonEmptyArray",
  "isNonNullObject",
  "isPlainObject",
  "makeReference",
  "makeUniqueId",
  "maybeDeepFreeze",
  "mergeDeep",
  "mergeDeepArray",
  "mergeOptions",
  "omitDeep",
  "preventUnhandledRejection",
  "removeDirectivesFromDocument",
  "resultKeyNameFromField",
  "shouldInclude",
  "storeKeyNameFromField",
  "stringifyForDisplay",
  "toQueryResult",
  "filterMap",
  "getApolloCacheMemoryInternals",
  "getApolloClientMemoryInternals",
  "getInMemoryCacheMemoryInternals",
  "registerGlobalCache",

  // Types
  "DecoratedPromise",
  "DeepOmit",
  "FragmentMap",
  "FragmentMapFunction",
  "FulfilledPromise",
  "IsAny",
  "NoInfer",
  "PendingPromise",
  "Prettify",
  "Primitive",
  "RejectedPromise",
  "RemoveIndexSignature",
  "VariablesOption",
];

export default transform;
