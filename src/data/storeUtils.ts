import {
  FieldNode,
  IntValueNode,
  FloatValueNode,
  StringValueNode,
  BooleanValueNode,
  ObjectValueNode,
  ListValueNode,
  EnumValueNode,
  VariableNode,
  InlineFragmentNode,
  ValueNode,
  SelectionNode,
  ExecutionResult,
  NameNode,
} from 'graphql';

function isStringValue(value: ValueNode): value is StringValueNode {
  return value.kind === 'StringValue';
}

function isBooleanValue(value: ValueNode): value is BooleanValueNode {
  return value.kind === 'BooleanValue';
}

function isIntValue(value: ValueNode): value is IntValueNode {
  return value.kind === 'IntValue';
}

function isFloatValue(value: ValueNode): value is FloatValueNode {
  return value.kind === 'FloatValue';
}

function isVariable(value: ValueNode): value is VariableNode {
  return value.kind === 'Variable';
}

function isObjectValue(value: ValueNode): value is ObjectValueNode {
  return value.kind === 'ObjectValue';
}

function isListValue(value: ValueNode): value is ListValueNode {
  return value.kind === 'ListValue';
}

function isEnumValue(value: ValueNode): value is EnumValueNode {
  return value.kind === 'EnumValue';
}

export function valueToObjectRepresentation(argObj: any, name: NameNode, value: ValueNode, variables?: Object) {
  if (isIntValue(value) || isFloatValue(value)) {
    argObj[name.value] = Number(value.value);
  } else if (isBooleanValue(value) || isStringValue(value)) {
    argObj[name.value] = value.value;
  } else if (isObjectValue(value)) {
    const nestedArgObj = {};
    value.fields.map((obj) => valueToObjectRepresentation(nestedArgObj, obj.name, obj.value, variables));
    argObj[name.value] = nestedArgObj;
  } else if (isVariable(value)) {
    const variableValue = (variables || {} as any)[value.name.value];
    argObj[name.value] = variableValue;
  } else if (isListValue(value)) {
    argObj[name.value] = value.values.map((listValue) => {
      const nestedArgArrayObj = {};
      valueToObjectRepresentation(nestedArgArrayObj, name, listValue, variables);
      return (nestedArgArrayObj as any)[name.value];
    });
  } else if (isEnumValue(value)) {
    argObj[name.value] = (value as EnumValueNode).value;
  } else {
    throw new Error(`The inline argument "${name.value}" of kind "${(value as any).kind}" is not supported.
                    Use variables instead of inline arguments to overcome this limitation.`);
  }
}

export function storeKeyNameFromField(field: FieldNode, variables?: Object): string {
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

export function resultKeyNameFromField(field: FieldNode): string {
  return field.alias ?
    field.alias.value :
    field.name.value;
}

export function isField(selection: SelectionNode): selection is FieldNode {
  return selection.kind === 'Field';
}

export function isInlineFragment(selection: SelectionNode): selection is InlineFragmentNode {
  return selection.kind === 'InlineFragment';
}

export function graphQLResultHasError(result: ExecutionResult) {
  return result.errors && result.errors.length;
}

/**
 * This is a normalized representation of the Apollo query result cache. It consists of
 * a flattened representation of query result trees.
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

export type ListValue = Array<null | IdValue>;

export type StoreValue = number | string | string[] | IdValue  | ListValue | JsonValue | null | undefined | void;

export function isIdValue(idObject: StoreValue): idObject is IdValue {
  return (
    idObject != null &&
    typeof idObject === 'object' &&
    (idObject as (IdValue | JsonValue)).type === 'id'
  );
}

export function toIdValue(id: string, generated = false): IdValue {
  return {
    type: 'id',
    id,
    generated,
  };
}

export function isJsonValue(jsonObject: StoreValue): jsonObject is JsonValue {
  return (
    jsonObject != null &&
    typeof jsonObject === 'object' &&
    (jsonObject as (IdValue | JsonValue)).type === 'json'
  );
}
