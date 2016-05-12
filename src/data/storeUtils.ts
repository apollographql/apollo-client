import {
  Field,
  IntValue,
  FloatValue,
  StringValue,
  BooleanValue,
  Variable,
  InlineFragment,
  Value,
  Selection,
  GraphQLResult,
} from 'graphql';

import includes = require('lodash.includes');

type ScalarValue = IntValue | FloatValue | StringValue | BooleanValue;

function isScalarValue(value: Value): value is ScalarValue {
  const SCALAR_TYPES = ['IntValue', 'FloatValue', 'StringValue', 'BooleanValue'];
  return includes(SCALAR_TYPES, value.kind);
}

function isVariable(value: Value): value is Variable {
  return value.kind === 'Variable';
}

export function storeKeyNameFromField(field: Field, variables?: Object): string {
  if (field.arguments && field.arguments.length) {
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
        throw new Error(`For inline arguments, only scalar types are supported. To use Enum or \
Object types, please pass them as variables.`);
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

export function isField(selection: Selection): selection is Field {
  return selection.kind === 'Field';
}

export function isInlineFragment(selection: Selection): selection is InlineFragment {
  return selection.kind === 'InlineFragment';
}

export function graphQLResultHasError(result: GraphQLResult) {
  return result.errors && result.errors.length;
}
