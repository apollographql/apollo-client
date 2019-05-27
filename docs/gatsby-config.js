module.exports = {
  __experimentalThemes: [
    {
      resolve: 'gatsby-theme-apollo-docs',
      options: {
        root: __dirname,
        docs: require('./docs.json'),
        subtitle: 'Apollo Client',
        description: 'A guide to using the Apollo GraphQL Client with React',
        contentDir: 'docs/source',
        basePath: '/docs/react',
        githubRepo: 'apollographql/apollo-client',
        versions: [
          {
            value: '2.4',
            ref: 'version-2.4',
          },
          {
            value: '2.5',
            ref: 'HEAD',
            default: true,
          },
        ],
        typescriptApiBox: {
          filepathPrefix: 'packages/apollo-client/src/',
        },
        sidebarCategories: {
          null: [
            'index',
            'why-apollo',
            'integrations',
            'react-apollo-migration',
          ],
          Essentials: [
            'essentials/get-started',
            'essentials/queries',
            'essentials/mutations',
            'essentials/local-state',
          ],
          Features: [
            'features/error-handling',
            'features/pagination',
            'features/optimistic-ui',
            'features/server-side-rendering',
            'features/developer-tooling',
          ],
          Advanced: [
            'advanced/boost-migration',
            'advanced/subscriptions',
            'advanced/network-layer',
            'advanced/caching',
            'advanced/fragments',
          ],
          Recipes: [
            'recipes/authentication',
            'recipes/testing',
            'recipes/client-schema-mocking',
            'recipes/static-typing',
            'recipes/performance',
            'recipes/react-native',
            'recipes/babel',
            'recipes/webpack',
            'recipes/meteor',
            'recipes/recompose',
            'recipes/2.0-migration',
          ],
          API: ['api/apollo-client', 'api/react-apollo'],
        },
      },
    },
  ],
};
