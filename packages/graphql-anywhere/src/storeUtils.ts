import {
  DirectiveNode,
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

type ScalarValue = StringValueNode | BooleanValueNode | EnumValueNode;

const SCALAR_TYPES = {
  StringValue: true,
  BooleanValue: true,
  EnumValue: true,
};

function isScalarValue(value: ValueNode): value is ScalarValue {
  return !!SCALAR_TYPES[value.kind];
}

type NumberValue = IntValueNode | FloatValueNode;

const NUMBER_TYPES = {
  IntValue: true,
  FloatValue: true,
};

function isNumberValue(value: ValueNode): value is NumberValue {
  return NUMBER_TYPES[value.kind];
}

function isVariable(value: ValueNode): value is VariableNode {
  return value.kind === 'Variable';
}

function isObject(value: ValueNode): value is ObjectValueNode {
  return value.kind === 'ObjectValue';
}

function isList(value: ValueNode): value is ListValueNode {
  return value.kind === 'ListValue';
}

function valueToObjectRepresentation(
  argObj: any,
  name: NameNode,
  value: ValueNode,
  variables: Object = {},
) {
  if (isNumberValue(value)) {
    argObj[name.value] = Number(value.value);
  } else if (isScalarValue(value)) {
    argObj[name.value] = value.value;
  } else if (isObject(value)) {
    const nestedArgObj = {};
    value.fields.map(obj =>
      valueToObjectRepresentation(nestedArgObj, obj.name, obj.value, variables),
    );
    argObj[name.value] = nestedArgObj;
  } else if (isVariable(value)) {
    const variableValue = variables[value.name.value];
    argObj[name.value] = variableValue;
  } else if (isList(value)) {
    argObj[name.value] = value.values.map(listValue => {
      const nestedArgArrayObj = {};
      valueToObjectRepresentation(
        nestedArgArrayObj,
        name,
        listValue,
        variables,
      );
      return nestedArgArrayObj[name.value];
    });
  } else {
    // There are no other types of values we know of, but some might be added later and we want
    // to have a nice error for that case.
    throw new Error(`The inline argument "${name.value}" of kind "${(value as any)
      .kind}" is not \
supported. Use variables instead of inline arguments to overcome this limitation.`);
  }
}

export function argumentsObjectFromField(
  field: FieldNode | DirectiveNode,
  variables: Object,
): Object {
  if (field.arguments && field.arguments.length) {
    const argObj: Object = {};
    field.arguments.forEach(({ name, value }) =>
      valueToObjectRepresentation(argObj, name, value, variables),
    );
    return argObj;
  }

  return null;
}

export function resultKeyNameFromField(field: FieldNode): string {
  return field.alias ? field.alias.value : field.name.value;
}

export function isField(selection: SelectionNode): selection is FieldNode {
  return selection.kind === 'Field';
}

export function isInlineFragment(
  selection: SelectionNode,
): selection is InlineFragmentNode {
  return selection.kind === 'InlineFragment';
}

export function graphQLResultHasError(result: ExecutionResult) {
  return result.errors && result.errors.length;
}
