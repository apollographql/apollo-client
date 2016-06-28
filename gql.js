// This is here for backcompat, even though the right way is to use the other package
module.exports = require('graphql-tag');

module.exports.registerGqlTag = function () {
  if (typeof window !== 'undefined') {
    window['gql'] = module.exports;
  } else if (typeof global !== 'undefined') {
    global['gql'] = module.exports;
  }
}
