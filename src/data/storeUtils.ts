import {
  Field,
  IntValue,
  FloatValue,
  StringValue,
  BooleanValue,
  ObjectValue,
  ListValue,
  EnumValue,
  Variable,
  InlineFragment,
  Value,
  Selection,
  GraphQLResult,
  Name,
} from 'graphql';

import isObject = require('lodash.isobject');

function isStringValue(value: Value): value is StringValue {
  return value.kind === 'StringValue';
}

function isBooleanValue(value: Value): value is BooleanValue {
  return value.kind === 'BooleanValue';
}

function isIntValue(value: Value): value is IntValue {
  return value.kind === 'IntValue';
}

function isFloatValue(value: Value): value is FloatValue {
  return value.kind === 'FloatValue';
}

function isVariable(value: Value): value is Variable {
  return value.kind === 'Variable';
}

function isObjectValue(value: Value): value is ObjectValue {
  return value.kind === 'ObjectValue';
}

function isListValue(value: Value): value is ListValue {
  return value.kind === 'ListValue';
}

function isEnumValue(value: Value): value is EnumValue {
  return value.kind === 'EnumValue';
}

function valueToObjectRepresentation(argObj: any, name: Name, value: Value, variables?: Object) {
  if (isIntValue(value) || isFloatValue(value)) {
    argObj[name.value] = Number(value.value);
  } else if (isBooleanValue(value) || isStringValue(value)) {
    argObj[name.value] = value.value;
  } else if (isObjectValue(value)) {
    const nestedArgObj = {};
    value.fields.map((obj) => valueToObjectRepresentation(nestedArgObj, obj.name, obj.value, variables));
    argObj[name.value] = nestedArgObj;
  } else if (isVariable(value)) {
    if (! variables || !(value.name.value in variables)) {
      throw new Error(`The inline argument "${value.name.value}" is expected as a variable but was not provided.`);
    }
    const variableValue = (variables as any)[value.name.value];
    argObj[name.value] = variableValue;
  } else if (isListValue(value)) {
    argObj[name.value] = value.values.map((listValue) => {
      const nestedArgArrayObj = {};
      valueToObjectRepresentation(nestedArgArrayObj, name, listValue, variables);
      return (nestedArgArrayObj as any)[name.value];
    });
  } else if (isEnumValue(value)) {
    argObj[name.value] = value.value;
  } else {
    throw new Error(`The inline argument "${name.value}" of kind "${(value as any).kind}" is not supported.
                    Use variables instead of inline arguments to overcome this limitation.`);
  }
}

export function storeKeyNameFromField(field: Field, variables?: Object): string {
  if (field.arguments && field.arguments.length) {
    const argObj: Object = {};

    field.arguments.forEach(({name, value}) => valueToObjectRepresentation(
      argObj, name, value, variables));

    return storeKeyNameFromFieldNameAndArgs(field.name.value, argObj);
  }

  return field.name.value;
}

export function storeKeyNameFromFieldNameAndArgs(fieldName: string, args?: Object): string {
  if (args) {
    const stringifiedArgs: string = JSON.stringify(args);

    return `${fieldName}(${stringifiedArgs})`;
  }

  return fieldName;
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

/**
 * This is a normalized representation of the Apollo query result cache. Briefly, it consists of
 * a flatten representation of query result trees.
 */
export interface NormalizedCache {
  [dataId: string]: StoreObject;
}

export interface StoreObject {
  __typename?: string;
  [storeFieldKey: string]: StoreValue;
}

export interface IdValue {
  type: 'id';
  id: string;
  generated: boolean;
}

export interface JsonValue {
  type: 'json';
  json: any;
}

export type StoreValue = number | string | string[] | IdValue | JsonValue | void;

export function isIdValue(idObject: StoreValue): idObject is IdValue {
  return (isObject(idObject) && (idObject as (IdValue | JsonValue)).type === 'id');
}

export function toIdValue(id: string, generated = false): IdValue {
  return {
    type: 'id',
    id,
    generated,
  };
}

export function isJsonValue(jsonObject: StoreValue): jsonObject is JsonValue {
  return (isObject(jsonObject) && (jsonObject as (IdValue | JsonValue)).type === 'json');
}
