// This is here for backcompat, even though the right way is to use the other package
module.exports = require('graphql-tag');
// We emit a development-only warning to deprecate this import
if(process.env.NODE_ENV === 'development') {
  console.warn(
    "Requiring 'apollo-client/gql' is now deprecated. " +
    "You should require 'graphql-tag' instead. " +
    "See http://docs.apollostack.com/apollo-client/core.html#gql for more information."
  )
}
