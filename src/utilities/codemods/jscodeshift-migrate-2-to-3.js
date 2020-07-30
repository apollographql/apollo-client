/**
 * This jscodeshift transform takes care of some of the rote
 * things you'll need to do while migrating from v2 to v3.
 */

export default function transformer(file, api) {
  const j = api.jscodeshift;

  const source = j(file.source);

  renameOrCreateApolloClientImport();

  moveSpecifiersToApolloClient('@apollo/react-hooks');
  moveSpecifiersToApolloClient('apollo-cache-inmemory');
  moveSpecifiersToApolloClient('apollo-link');
  moveSpecifiersToApolloClient('apollo-link-http');
  moveSpecifiersToApolloClient('apollo-link-http-common');

  renameDefaultSpecifier(getImport('graphql-tag'), 'gql');
  moveSpecifiersToApolloClient('graphql-tag');

  renameImport('@apollo/react-components', '@apollo/client/react/components');
  renameImport('@apollo/react-hoc', '@apollo/client/react/hoc');
  renameImport('@apollo/react-ssr', '@apollo/client/react/ssr');
  renameImport('@apollo/react-testing', '@apollo/client/testing');
  [
    'batch',
    'batch-http',
    'context',
    'error',
    'retry',
    'schema',
    'ws',
  ].forEach(link => renameImport(`@apollo-link-${link}`, `@apollo/client/link/${link}`));

  return source.toSource();

  function renameOrCreateApolloClientImport() {
    const v3Import = getImport('@apollo/client');
    if (v3Import.size()) {
      return;
    }

    const v2Import = getImport('apollo-client');
    if (v2Import.size()) {
      renameDefaultSpecifier(v2Import, 'ApolloClient');
      renameImport('apollo-client', '@apollo/client');
    } else {
      source.find(j.ImportDeclaration).at(0).insertBefore(() => j.importDeclaration([], j.literal('@apollo/client')));
    }
  }

  function moveSpecifiersToApolloClient(
    moduleName,
  ) {
    const moduleImport = getImport(moduleName);

    if (moduleImport.size()) {
      const clientImports = getImport('@apollo/client');
      const specifiersToAdd = moduleImport.get('specifiers').value;
      clientImports.get('specifiers').push(...specifiersToAdd);
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

  function renameDefaultSpecifier(moduleImport, name) {
    moduleImport
      .find(j.ImportDefaultSpecifier).replaceWith(path => {
        return path.value.local.name === name
          ? importSpecifier(name)
          : j.importSpecifier(j.identifier(name), path.value.local);
      });
  }
}
