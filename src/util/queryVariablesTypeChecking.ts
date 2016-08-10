import {
  OperationDefinition,
  Type,
  NonNullType,
  NamedType,
  ListType,
} from 'graphql';

export function checkVariablesTypes(query: OperationDefinition, variables: Object) {
  if (!query.variableDefinitions) {
    return;
  }

  query.variableDefinitions.forEach((variableDefinition) => {
    const name = variableDefinition.variable.name.value;
    const varValue = variables[name];
    const varType = variableDefinition.type;

    checkVariableType(name, varType, varValue);
  });
}

function checkVariableType(name: string, varType: Type, varValue: any) {
  if (varType.kind === 'NonNullType') {
    if (varValue === null) {
      throw new Error(`Variable value ${name} has a non-nullable type, but ${varValue} found.`);
    }
    checkVariableType(name, (varType as NonNullType).type, varValue);
  } else if (varType.kind === 'NamedType') {
    const typeName = (varType as NamedType).name.value;

    // nullable types
    if (varValue === null) {
      return;
    }
    if (typeName === 'Int') {
      if (typeof varValue !== 'number' || !isFinite(varValue) || Math.floor(varValue) !== varValue) {
        throw new Error(`Variable value ${name} must be an Int, but ${varValue} found.`);
      }
    } else if (typeName === 'Float') {
      if (typeof varValue !== 'number' || !isFinite(varValue)) {
        throw new Error(`Variable value ${name} must be a Float, but ${varValue} found.`);
      }
    } else if (typeName === 'String') {
      if (typeof varValue !== 'string') {
        throw new Error(`Variable value ${name} must be a String, but ${varValue} found.`);
      }
    } else if (typeName === 'Boolean') {
      if (typeof varValue !== 'boolean') {
        throw new Error(`Variable value ${name} must be a Boolean, but ${varValue} found.`);
      }
    } else {
      // Can't check a compound type
      return;
    }
  } else if (varType.kind === 'ListType') {
    if (!Array.isArray(varValue)) {
        throw new Error(`Variable value ${name} must be an array, but ${varValue} found.`);
    }
    varValue.forEach((subValue, index) => {
      checkVariableType(`${name}[${index}]`, (varType as ListType).type, subValue);
    });
  }
}
