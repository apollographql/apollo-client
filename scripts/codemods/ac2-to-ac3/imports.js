/**
 * This jscodeshift transform takes care of some of the rote things you'll
 * need to do while migrating from v2 to v3. See README.md for usage
 * instructions and further explanation.
 *
 * Original author: @dminkovsky (PR #6486)
 * Contributors: @jcreighton @benjamn
 * Reviewers: @hwillson @bnjmnt4n
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;

  const source = j(file.source);

  ensureModule('lodash')
  moveComposeToLodash()
  removeModuleIfEmpty('lodash')

  renameOrCreateApolloClientImport();

  ensureModule('@apollo/react-components')
  ensureModule('@apollo/react-hoc')

  moveOldSpecifiersToApolloReact()

  removeModuleIfEmpty('@apollo/react-components')
  removeModuleIfEmpty('@apollo/react-hoc')

  moveTestUtils()


  moveSpecifiersToApolloClient('react-apollo');
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

  renameDefaultSpecifier(getImport('apollo-link-schema'), 'SchemaLink');
  [
    'batch',
    'batch-http',
    'context',
    'error',
    'persisted-queries',
    'retry',
    'schema',
    'ws',
  ].forEach(link => renameImport(`apollo-link-${link}`, `@apollo/client/link/${link}`));

  removeApolloClientImportIfEmpty();

  return source.toSource();

  function ensureModule(modName = "modName") {
    const modImport = getImport(modName);
    if (modImport.size()) {
      return;
    }

    source.find(j.ImportDeclaration).at(0).insertBefore(() => j.importDeclaration([], j.literal(modName)));
  }

  function removeModuleIfEmpty(modName = "modName") {
    const modImport = getImport(modName);
    if (
      modImport.size() &&
      !modImport.get('specifiers', 'length').value
    ) {
      modImport.remove();
    }
  }

  function renameOrCreateApolloClientImport() {
    const ac3Import = getImport('@apollo/client');
    if (ac3Import.size()) {
      return;
    }

    const ac2Import = getImport('apollo-client');
    if (ac2Import.size()) {
      renameDefaultSpecifier(ac2Import, 'ApolloClient');
      renameImport('apollo-client', '@apollo/client');
    } else {
      source.find(j.ImportDeclaration).at(0).insertBefore(() => j.importDeclaration([], j.literal('@apollo/client')));
    }
  }

  function removeApolloClientImportIfEmpty() {
    const ac3Import = getImport('@apollo/client');
    if (
      ac3Import.size() &&
      !ac3Import.get('specifiers', 'length').value
    ) {
      ac3Import.remove();
    }
  }

  function moveOldSpecifiersToApolloReact(moduleName = "react-apollo") {
    const moduleImport = getImport(moduleName);
    const reactComponents = getImport('@apollo/react-components');
    const reactHoc = getImport('@apollo/react-hoc');

    function moveImport(importedName= "graphql", targetModule) {
      const speci = moduleImport.find(j.ImportSpecifier, {
        imported: {
          name: importedName
        }
      })
      if (speci.size()) {
        targetModule.get('specifiers').push(...speci.nodes()); 
      }

      speci.remove()
    }

    if (moduleImport.size()) {
      moveImport("graphql", reactHoc)
      moveImport("Query", reactComponents)
      moveImport("Mutation", reactComponents)
    }
  }

  function moveComposeToLodash() {
    const modImport = getImport("react-apollo");
    const col = modImport.find(j.ImportSpecifier, {
      imported: {
        name: "compose"
      }
    })

    if (!col.size()) {
      return
    }

    const lodashImport = getImport("lodash")
    lodashImport.get("specifiers").push(
      j.importSpecifier(
        j.identifier('flowRight'),
        j.identifier('compose'),
    ))

    col.remove()
  }

  function moveTestUtils() {
    const modImport = getImport("react-apollo/test-utils");
    if (!modImport.size()) {
      return
    }

    modImport.replaceWith(path => ({
      ...path.value,
      source: j.literal("@apollo/client/testing")
    }))
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

  function renameDefaultSpecifier(moduleImport, name) {
    function replacer(path) {
      return path.value.local.name === name
        ? j.importSpecifier(j.identifier(name))
        : j.importSpecifier(j.identifier(name), path.value.local);
    }

    // Handle ordinary (no-{}s) default imports.
    moduleImport
      .find(j.ImportDefaultSpecifier)
      .replaceWith(replacer);

    // Handle { default as Foo } default imports.
    moduleImport.find(j.ImportSpecifier, {
      imported: {
        name: "default",
      },
    }).replaceWith(replacer);
  }
}
