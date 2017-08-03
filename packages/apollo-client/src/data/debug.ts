// For development only!

export function stripLoc(obj: Object) {
  if (Array.isArray(obj)) {
    return obj.map(stripLoc);
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  const nextObj = {};

  Object.keys(obj).forEach(key => {
    if (key !== 'loc') {
      nextObj[key] = stripLoc(obj[key]);
    }
  });

  return nextObj;
}

export function printAST(fragAst: Object) {
  /* tslint:disable */
  console.log(JSON.stringify(stripLoc(fragAst), null, 2));
}
