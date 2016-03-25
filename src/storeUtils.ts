import {
  Field,
  IntValue,
  FloatValue,
  StringValue,
  BooleanValue,
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

export function storeKeyNameFromField(field: Field): string {
  if (field.arguments.length) {
    const argObj: Object = {};

    field.arguments.forEach(({name, value}) => {
      if (isScalarValue(value)) {
        argObj[name.value] = value.value;
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
