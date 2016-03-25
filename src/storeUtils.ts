import {
  Field,
  IntValue,
  FloatValue,
  StringValue,
  BooleanValue,
  Variable,
  Value,
} from 'graphql';

import {
  includes,
} from 'lodash';

type ScalarValue = IntValue | FloatValue | StringValue | BooleanValue;

function isScalarValue(value: Value): value is ScalarValue {
  const SCALAR_TYPES = ['IntValue', 'FloatValue', 'StringValue', 'BooleanValue'];
  return includes(SCALAR_TYPES, value.kind);
}

function isVariable(value: Value): value is Variable {
  return value.kind === 'Variable';
}

export function storeKeyNameFromField(field: Field, variables?: Object): string {
  if (field.arguments.length) {
    const argObj: Object = {};

    field.arguments.forEach(({name, value}) => {
      if (isScalarValue(value)) {
        argObj[name.value] = value.value;
      } else if (isVariable(value)) {
        if (! variables) {
          throw new Error('Internal err: Field has a variable argument but variables not passed.');
        }
        const variableValue = variables[value.name.value];
        argObj[name.value] = variableValue;
      } else {
        throw new Error('Only scalar argument types currently supported.');
      }
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
