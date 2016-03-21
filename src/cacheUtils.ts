/// <reference path="../typings/browser/ambient/es6-promise/index.d.ts" />
/// <reference path="../typings/browser/ambient/graphql/index.d.ts" />

import { Field, Argument } from 'graphql'

export function cacheFieldNameFromSelection(selection: Field): string {
  if (selection.arguments.length) {
    const argObj: Object = {};
    selection.arguments.forEach((argument: Argument) => {
      argObj[argument.name.value] = argument.value.value;
    });
    const stringifiedArgs: string = JSON.stringify(argObj);
    return `${selection.name.value}(${stringifiedArgs})`;
  }

  return selection.name.value;
}

export function resultFieldNameFromSelection(selection: Field): string {
  return selection.alias ?
    selection.alias.value :
    selection.name.value;
}
