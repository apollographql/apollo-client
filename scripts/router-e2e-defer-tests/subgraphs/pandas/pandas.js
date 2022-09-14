const { ApolloServer, gql } = require('apollo-server');
const { readFileSync } = require('fs');

const port = process.env.APOLLO_PORT || 4000;

const pandas = [
    { name: 'Basi', favoriteFood: "bamboo leaves" },
    { name: 'Yun', favoriteFood: "apple" }
]

const typeDefs = gql(readFileSync('./pandas.graphql', { encoding: 'utf-8' }));
const resolvers = {
    Query: {
        allPandas: (_, args, context) => {
            return pandas;
        },
        panda: (_, args, context) => {
            return pandas.find(p => p.id == args.id);
        }
    },
}
const server = new ApolloServer({ typeDefs, resolvers });
server.listen( {port: port} ).then(({ url }) => {
  console.log(`🚀 Pandas subgraph ready at ${url}`);
}).catch(err => {console.error(err)});
