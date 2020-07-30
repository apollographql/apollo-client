/**
 * This jscodeshift transform takes care of some of the rote
 * things you'll need to do while migrating from v2 to v3.
 */

export default function transformer(file, api) {
  const j = api.jscodeshift;

  const source = j(file.source);

  renameOrCreateApolloClientImport();

  moveSpecifiersToApolloClient('@apollo/react-hooks');
  moveSpecifiersToApolloClient('apollo-cache-inmemory', ['InMemoryCache']);
  moveSpecifiersToApolloClient('graphql-tag');
  moveSpecifiersToApolloClient('apollo-link');
  moveSpecifiersToApolloClient('apollo-link-http');
  moveSpecifiersToApolloClient('apollo-link-http-common');

  renameImport('@apollo/react-components', '@apollo/client/react/components');
  renameImport('@apollo/react-hoc', '@apollo/client/react/hoc');
  renameImport('@apollo/react-ssr', '@apollo/client/react/ssr');
  renameImport('@apollo/react-testing', '@apollo/client/testing');

  return source.toSource();

  function renameOrCreateApolloClientImport() {
    const apolloClientImport = getImport('apollo-client');
    if (apolloClientImport.size()) {
      renameImport('apollo-client', '@apollo/client');
    } else {
      source.find(j.ImportDeclaration).at(0).insertBefore(() => j.importDeclaration([], j.literal('@apollo/client')));
    }
  }

  function moveSpecifiersToApolloClient(
    moduleName,
    specifiers = [],
  ) {
    const moduleImport = getImport(moduleName);

    if (moduleImport.size()) {
      const clientImports = getImport('@apollo/client');
      const specifiersToAdd = (specifiers.length ? specifiers.map(importSpecifier) : moduleImport.get("specifiers").value);
      clientImports.replaceWith(p => ({
        ...p.value,
        specifiers: [
            ...p.value.specifiers,
            ...specifiersToAdd.map(path => importSpecifier((path.imported || path.local).name)),
        ],
      }));
    }

    moduleImport.remove();
  }

  function renameImport(oldModuleName, newModuleName) {
    getImport(oldModuleName)
      .find(j.Literal)
      .replaceWith(path => ({
          ...path.value,
          value: newModuleName,
      }));
  }

  function getImport(moduleName) {
    return source
      .find(j.ImportDeclaration, {
        source: { value: moduleName }
      });
  }

  function importSpecifier(name) {
    return j.importSpecifier(j.identifier(name));
  }
}
