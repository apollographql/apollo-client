// == `cacheUtils.js` == //
// @flow
import type { Selection } from 'graphql/language/ast';

export function cacheFieldNameFromSelection(selection: Selection): string {
  if (selection.arguments.length) {
    const argObj = {};
    selection.arguments.forEach((argument) => {
      argObj[argument.name.value] = argument.value.value;
    });
    const stringifiedArgs = JSON.stringify(argObj);
    return `${selection.name.value}(${stringifiedArgs})`;
  }

  return selection.name.value;
}

export function resultFieldNameFromSelection(selection: Selection): string {
  return selection.alias ?
    selection.alias.value :
    selection.name.value;
}
