var getbabelRelayPlugin = require('babel-relay-plugin');
var schema = require('./starwars.json');

module.exports = getbabelRelayPlugin(schema.data);
