import type { EnumValueNode, NameNode, ValueNode } from "graphql";
import { Kind } from "graphql";

import { newInvariantError } from "@apollo/client/utilities/invariant";

/** @internal */
export function valueToObjectRepresentation(
  argObj: any,
  name: NameNode,
  value: ValueNode,
  variables?: Object
) {
  if (value.kind === Kind.INT || value.kind === Kind.FLOAT) {
    argObj[name.value] = Number(value.value);
  } else if (value.kind === Kind.BOOLEAN || value.kind === Kind.STRING) {
    argObj[name.value] = value.value;
  } else if (value.kind === Kind.OBJECT) {
    const nestedArgObj = {};
    value.fields.map((obj) =>
      valueToObjectRepresentation(nestedArgObj, obj.name, obj.value, variables)
    );
    argObj[name.value] = nestedArgObj;
  } else if (value.kind === Kind.VARIABLE) {
    const variableValue = (variables || ({} as any))[value.name.value];
    argObj[name.value] = variableValue;
  } else if (value.kind === Kind.LIST) {
    argObj[name.value] = value.values.map((listValue) => {
      const nestedArgArrayObj = {};
      valueToObjectRepresentation(
        nestedArgArrayObj,
        name,
        listValue,
        variables
      );
      return (nestedArgArrayObj as any)[name.value];
    });
  } else if (value.kind === Kind.ENUM) {
    argObj[name.value] = (value as EnumValueNode).value;
  } else if (value.kind === Kind.NULL) {
    argObj[name.value] = null;
  } else {
    throw newInvariantError(
      `The inline argument "%s" of kind "%s"` +
        "is not supported. Use variables instead of inline arguments to " +
        "overcome this limitation.",
      name.value,
      (value as any).kind
    );
  }
}
