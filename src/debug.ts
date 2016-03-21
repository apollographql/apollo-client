/// <reference path="../typings/browser/definitions/lodash/index.d.ts" />

// For development only!
import * as _ from 'lodash';

function stripLoc(obj: Object) {
  if (! _.isObject(obj)) {
    return obj;
  }

  const omitted: Object = _.omit(obj, ['loc']);

  return _.mapValues(omitted, (value) => {
    return stripLoc(value);
  });
}

export function printAST(fragAst: Object) { // eslint-disable-line no-unused-vars
  console.log(JSON.stringify(stripLoc(fragAst), null, 2)); // eslint-disable-line no-console
}
