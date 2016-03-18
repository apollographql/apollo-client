function stripLoc(obj) {
  // For development only!
  const _ = require('lodash');
  if (! _.isObject(obj)) {
    return obj;
  }

  const omitted = _.omit(obj, ['loc']);

  return _.mapValues(omitted, (value) => {
    return stripLoc(value);
  });
}

export function printAST(fragAst) { // eslint-disable-line no-unused-vars
  console.log(JSON.stringify(stripLoc(fragAst), null, 2)); // eslint-disable-line no-console
}
