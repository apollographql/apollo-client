// Open Telemetry (optional)
const { ApolloOpenTelemetry } = require('supergraph-demo-opentelemetry');

if (process.env.APOLLO_OTEL_EXPORTER_TYPE) {
  new ApolloOpenTelemetry({
    type: 'subgraph',
    name: 'products',
    exporter: {
      type: process.env.APOLLO_OTEL_EXPORTER_TYPE, // console, zipkin, collector
      host: process.env.APOLLO_OTEL_EXPORTER_HOST,
      port: process.env.APOLLO_OTEL_EXPORTER_PORT,
    }
  }).setupInstrumentation();
}

const { ApolloServer, gql } = require('apollo-server');
const { buildSubgraphSchema } = require('@apollo/subgraph');
const { readFileSync } = require('fs');

const port = process.env.APOLLO_PORT || 4000;

const products = [
    { id: 'apollo-federation', sku: 'federation', package: '@apollo/federation', oldField: 'deprecated'},
    { id: 'apollo-studio', sku: 'studio', package: '', oldField: 'deprecated'},
]

const variationByProduct = [
    { id: 'apollo-federation', variation: { id: "OSS", name: "platform"}},
    { id: 'apollo-studio', variation: { id: "platform", name: "platform-name"}},
]

const typeDefs = gql(readFileSync('./products.graphql', { encoding: 'utf-8' }));
const resolvers = {
    Query: {
        allProducts: (_, args, context) => {
            return products;
        },
        product: (_, args, context) => {
            return products.find(p => p.id == args.id);
        }
    },
    ProductItf: {
        __resolveType(obj, context, info){
            return 'Product';
        },
    },
    Product: {
        variation: (reference) => {
            return new Promise(r => setTimeout(() => {
              if (reference.id) {
                const variation = variationByProduct.find(p => p.id == reference.id).variation;
                r(variation);
	      }
	      r({ id: 'defaultVariation', name: 'default variation' });
	    }, 1000));
        },
        dimensions: () => {
            return { size: "1", weight: 1 }
        },
        createdBy: (reference) => {
            return { email: 'support@apollographql.com', totalProductsCreated: 1337 }
        },
        reviewsScore: () => {
            return 4.5;
        },
        __resolveReference: (reference) => {
            if (reference.id) return products.find(p => p.id == reference.id);
            else if (reference.sku && reference.package) return products.find(p => p.sku == reference.sku && p.package == reference.package);
            else return { id: 'rover', package: '@apollo/rover', ...reference };
        }
    }
}
const server = new ApolloServer({ schema: buildSubgraphSchema({ typeDefs, resolvers }) });
server.listen( {port: port} ).then(({ url }) => {
  console.log(`🚀 Products subgraph ready at ${url}`);
}).catch(err => {console.error(err)});
