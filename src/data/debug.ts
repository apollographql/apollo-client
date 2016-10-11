// For development only!
import isObject = require('lodash.isobject');
import omit = require('lodash.omit');
import mapValues = require('lodash.mapvalues');

export function stripLoc(obj: Object) {
  if (Array.isArray(obj)) {
    return obj.map(stripLoc);
  }

  if (! isObject(obj)) {
    return obj;
  }

  const omitted: Object = omit(obj, ['loc']);

  return mapValues(omitted, (value) => {
    return stripLoc(value);
  });
}

export function printAST(fragAst: Object) {
  /* tslint:disable */
  console.log(JSON.stringify(stripLoc(fragAst), null, 2));
}
