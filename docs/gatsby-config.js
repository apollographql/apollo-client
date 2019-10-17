const themeOptions = require('gatsby-theme-apollo-docs/theme-options');

module.exports = {
  pathPrefix: '/docs/react',
  plugins: [
    {
      resolve: 'gatsby-theme-apollo-docs',
      options: {
        ...themeOptions,
        root: __dirname,
        subtitle: 'Client (React)',
        description: 'A guide to using the Apollo GraphQL Client with React',
        githubRepo: 'apollographql/apollo-client',
        defaultVersion: 3.0,
        /*
        versions: {
          2.6: 'version-2.6',
          2.5: 'version-2.5',
          2.4: 'version-2.4',
        },
        */
        checkLinksOptions: {
          exceptions: [
            '/api/core/',
            '/v2.4/api/core/',
            '/v2.5/api/core/',
            '/v2.6/api/core/',
            '/v3.0/api/core/'
          ],
        },
        typescriptApiBox: {
          data: require('./docs.json'),
          filepathPrefix: 'src/',
        },
        sidebarCategories: {
          null: [
            'index',
            'why-apollo',
            'get-started',
          ],
          'Fetching data': [
            'data/queries',
            'data/mutations',
            'data/local-state',
            'data/subscriptions',
            'data/pagination',
            'data/fragments',
            'data/error-handling',
          ],
          'Caching': [
            'caching/cache-configuration',
            'caching/cache-interaction',
          ],
          'Development & Testing': [
            'development-testing/static-typing',
            'development-testing/testing',
            'development-testing/client-schema-mocking',
            'development-testing/developer-tooling',
            'development-testing/recompose',
          ],
          Performance: [
            'performance/performance',
            'performance/optimistic-ui',
            'performance/server-side-rendering',
            'performance/babel',
          ],
          Integrations: [
            'integrations/integrations',
            'integrations/react-native',
            'integrations/meteor',
            'integrations/webpack',
          ],
          Networking: [
            'networking/network-layer',
            'networking/authentication',
          ],
          'API - Core': [
            'api/core/ApolloClient',
            'api/core/ObservableQuery'
          ],
          'API - React': [
            'api/react/hooks',
            'api/react/testing',
            'api/react/ssr',
            'api/react/components',
            'api/react/hoc'
          ],
          'API - Link': [
            'api/link/introduction',
            'api/link/concepts',
            'api/link/apollo-link-error',
            'api/link/apollo-link-context',
            'api/link/apollo-link-retry',
            'api/link/apollo-link-ws',
            'api/link/apollo-link-batch-http',
            'api/link/apollo-link-dedup',
            'api/link/apollo-link-schema',
            'api/link/apollo-link-rest'
          ],
          Migrating: [
            'migrating/hooks-migration',
            'migrating/boost-migration',
          ]
        },
      },
    },
  ],
};
