/* We are placing this file in the root to enable npm-link development
 * Currently, gql resides in a submodule and is not able to be imported when linked
 */
module.exports = require('./lib/src/gql');
