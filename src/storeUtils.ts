/// <reference path="../typings/browser/ambient/es6-promise/index.d.ts" />
/// <reference path="../typings/browser/ambient/graphql/index.d.ts" />

import {
  Field,
  Argument,
  IntValue,
  FloatValue,
  StringValue,
  BooleanValue,
  Value,
} from 'graphql';

import {
  includes,
} from 'lodash';

const SCALAR_TYPES = ['IntValue', 'FloatValue', 'StringValue', 'BooleanValue'];

export function storeKeyNameFromField(field: Field): string {
  if (field.arguments.length) {
    const argObj: Object = {};

    field.arguments.forEach((argument: Argument) => {
      const scalarArgumentValue = ensureScalarValue(argument.value);
      argObj[argument.name.value] = scalarArgumentValue.value;
    });

    const stringifiedArgs: string = JSON.stringify(argObj);
    return `${field.name.value}(${stringifiedArgs})`;
  }

  return field.name.value;
}

export function resultKeyNameFromField(field: Field): string {
  return field.alias ?
    field.alias.value :
    field.name.value;
}

function ensureScalarValue(value: Value): IntValue | FloatValue | StringValue | BooleanValue {
  if (! includes(SCALAR_TYPES, value.kind)) {
    throw new Error('Only scalar argument types currently supported.');
  }

  return value as IntValue | FloatValue | StringValue | BooleanValue;
}
