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

  removeImportIfEmpty("@apollo/client");

  return source.toSource();

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

    findOrCreateModuleImport(target, { after: source })
      .get("specifiers")
      .push(createSpecifier(name, specifier.get("local", "name").value));

    specifier.remove();
  }

  function getImport(moduleName: string) {
    return source.find(j.ImportDeclaration, {
      source: { value: moduleName },
    });
  }

  function findOrCreateModuleImport(
    moduleName: string,
    { after }: { after: string }
  ) {
    const mod = getImport(moduleName);

    if (mod.size()) {
      return mod;
    }

    const newModule = j.importDeclaration([], j.literal(moduleName));

    getImport(after).insertAfter(newModule);

    return j(newModule);
  }

  function getImportSpecifier(name: string, moduleName: string) {
    const imports = getImport(moduleName);

    return imports.find(j.ImportSpecifier, {
      imported: { type: "Identifier", name },
    });
  }

  function hasSpecifier(name: string, moduleName: string) {
    return !!getImport(moduleName)
      .find(j.ImportSpecifier, { imported: { name } })
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

    if (!imports.get("specifiers", "length").value) {
      imports.remove();
    }
  }
};

export default transform;
