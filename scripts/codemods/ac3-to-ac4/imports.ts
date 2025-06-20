import type { Transform } from "jscodeshift";

const transform: Transform = function transform(file, api) {
  const j = api.jscodeshift;
  const source = j(file.source);

  moveSpecifierToEntrypoint("ApolloConsumer", "/", "/react");
  moveSpecifierToEntrypoint("ApolloProvider", "/", "/react");
  moveSpecifierToEntrypoint("createQueryPreloader", "/", "/react");
  moveSpecifierToEntrypoint("getApolloContext", "/", "/react");
  moveSpecifierToEntrypoint("useApolloClient", "/", "/react");
  moveSpecifierToEntrypoint("useBackgroundQuery", "/", "/react");
  moveSpecifierToEntrypoint("useFragment", "/", "/react");
  moveSpecifierToEntrypoint("useLazyQuery", "/", "/react");
  moveSpecifierToEntrypoint("useLoadableQuery", "/", "/react");
  moveSpecifierToEntrypoint("useMutation", "/", "/react");
  moveSpecifierToEntrypoint("useQuery", "/", "/react");
  moveSpecifierToEntrypoint("useQueryRefHandlers", "/", "/react");
  moveSpecifierToEntrypoint("useSubscription", "/", "/react");
  moveSpecifierToEntrypoint("useSuspenseFragment", "/", "/react");
  moveSpecifierToEntrypoint("useSuspenseQuery", "/", "/react");
  moveSpecifierToEntrypoint("useReactiveVar", "/", "/react");
  moveSpecifierToEntrypoint("useReadQuery", "/", "/react");
  moveSpecifierToEntrypoint("skipToken", "/", "/react");

  // Move `gql` to `@apollo/client/react` if its the only one left
  if (isOnlySpecifier("gql", "/")) {
    moveSpecifierToEntrypoint("gql", "/", "/react");
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

  function moveSpecifierToEntrypoint(
    name: string,
    sourcePath: string,
    targetPath: string
  ) {
    const source = getEntrypoint(sourcePath);
    const target = getEntrypoint(targetPath);

    if (hasSpecifier(name, target) || !hasSpecifier(name, source)) {
      return;
    }

    const specifier = getImportSpecifier(name, source);
    let targetImports = getImport(target);

    if (!targetImports.size()) {
      const newModule = j.importDeclaration([], j.literal(target));
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
