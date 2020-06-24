/**
 * This jscodeshift transform takes care of some of the rote
 * things you'll need to do while migrating from v2 to v3.
 * Currently it:
 *   - Replaces @apollo/react-hooks imports with
 *     @apollo/client
 *   - Removes gql imports from graphql-tag and replaces them
 *     with an import from @apollo/client
 *
 * Author: Dmitry Minkovsky <dminkovsky@gmail.com>
 */
export default function transformer(file, api) {
    const j = api.jscodeshift;

    const source = j(file.source);

    source
        .find(j.ImportDeclaration)
        .filter(
            path =>
                path.value.source.value ===
                '@apollo/react-hooks',
        )
        .find(j.Literal)
        .replaceWith(path => {
            return {...path.value, value: '@apollo/client'};
        });

    const gqls = source
        .find(j.ImportDeclaration)
        .filter(path => {
            return path.value.source.value === 'graphql-tag';
        });

    if (gqls.size()) {
        gqls.remove();
        const clientImports = source
            .find(j.ImportDeclaration)
            .filter(
                path =>
                    path.value.source.value === '@apollo/client',
            );
        if (clientImports.size()) {
            clientImports.replaceWith(p => {
                return {
                    ...p.value,
                    specifiers: [
                        {
                            type: 'ImportSpecifier',
                            imported: {
                                type: 'Identifier',
                                name: 'gql',
                            },
                        },
                        ...p.value.specifiers,
                    ],
                };
            });
        } else {
            source.find(j.Program).replaceWith(p => {
                return {
                    ...p.value,
                    body: [
                        {
                            type: 'ImportDeclaration',
                            specifiers: [
                                {
                                    type: 'ImportSpecifier',
                                    imported: {
                                        type: 'Identifier',
                                        name: 'gql',
                                    },
                                },
                            ],
                            source: {
                                type: 'Literal',
                                value: '@apollo/client',
                            },
                        },
                        ...p.value.body,
                    ],
                };
            });
        }
    }

    return source.toSource();
}
