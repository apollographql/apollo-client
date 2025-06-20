import type { Transform } from "jscodeshift";

const transform: Transform = function transform(file, api) {
  const j = api.jscodeshift;
  const source = j(file.source);

  [
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
  ].forEach((name) => moveValueSpecifierToEntrypoint(name, "/", "/react"));

  // Types
  [
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
  ].forEach((name) => {
    moveTypeSpecifierToEntrypoint(name, "/", "/react");
    moveValueSpecifierToEntrypoint(name, "/", "/react");
  });

  // Move `gql` to `@apollo/client/react` if its the only one left
  if (isOnlySpecifier("gql", "/") && hasImport(getEntrypoint("/react"))) {
    moveValueSpecifierToEntrypoint("gql", "/", "/react");
  }

  removeImportIfEmpty("@apollo/client");

  return source.toSource();

  function isOnlySpecifier(name: string, path: string) {
    const entrypoint = getEntrypoint(path);

    if (!hasSpecifier(name, entrypoint)) {
      return false;
    }

    return getImport(entrypoint).find(j.ImportSpecifier).size() === 1;
  }

  function hasImport(moduleName: string) {
    return getImport(moduleName).size() > 0;
  }

  function moveValueSpecifierToEntrypoint(
    name: string,
    sourcePath: string,
    targetPath: string
  ) {
    moveSpecifier(name, "value", sourcePath, targetPath);
  }

  function moveTypeSpecifierToEntrypoint(
    name: string,
    sourcePath: string,
    targetPath: string
  ) {
    moveSpecifier(name, "type", sourcePath, targetPath);
  }

  function moveSpecifier(
    name: string,
    importKind: "type" | "value",
    sourcePath: string,
    targetPath: string
  ) {
    const source = getEntrypoint(sourcePath);
    const target = getEntrypoint(targetPath);

    if (hasSpecifier(name, target) || !hasSpecifier(name, source)) {
      return;
    }

    const specifier = getImportSpecifier(name, source);
    let targetImports = getImportWithKind(target, importKind);

    if (!targetImports.size()) {
      const newModule = j.importDeclaration([], j.literal(target), importKind);
      getImport(source).insertAfter(newModule);
      targetImports = j(newModule);
    }

    targetImports
      .get("specifiers")
      .push(createSpecifier(name, specifier.get("local", "name").value));

    specifier.remove();
  }

  function getImport(moduleName: string) {
    return source.find(j.ImportDeclaration, {
      source: { value: moduleName },
    });
  }

  function getImportWithKind(moduleName: string, importKind: "type" | "value") {
    return source.find(j.ImportDeclaration, {
      importKind,
      source: { value: moduleName },
    });
  }

  function getImportSpecifier(name: string, moduleName: string) {
    const imports = getImport(moduleName);

    return imports.find(j.ImportSpecifier, {
      imported: { type: "Identifier", name },
    });
  }

  function hasSpecifier(name: string, moduleName: string) {
    return !!getImport(moduleName)
      .find(j.ImportSpecifier, { imported: { type: "Identifier", name } })
      .size();
  }

  function createSpecifier(name: string, local?: string) {
    return j.importSpecifier(j.identifier(name), j.identifier(local ?? name));
  }

  function getEntrypoint(path: string) {
    return "@apollo/client" + (path === "/" ? "" : path);
  }

  function removeImportIfEmpty(moduleName: string) {
    const imports = getImport(moduleName);

    if (imports.size() && !imports.get("specifiers", "length").value) {
      imports.remove();
    }
  }
};

export default transform;
