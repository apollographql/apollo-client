import { extname } from "node:path";

import type {
  PluginFunction,
  PluginValidateFn,
  Types,
} from "@graphql-codegen/plugin-helpers";
import type {
  GraphQLNamedType,
  GraphQLScalarType,
  GraphQLSchema,
} from "graphql";
import {
  getNamedType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isSpecifiedScalarType,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from "graphql";

import type { CustomScalarsPluginConfig } from "./config.js";

interface InputFieldType {
  name: string;
  type: string;
}

type InputObjectMap = Map<string, Record<string, InputFieldType>>;
type InputObjectsConfig = Record<string, { fields: Record<string, string> }>;

// Use a shim to avoid the need to add `@apollo/client` as a peer dependency
type TypePolicies = {
  [__typename: string]: {
    fields: {
      [fieldName: string]: FieldPolicy;
    };
  };
};

type FieldPolicy = {
  scalar: string;
};

const SUPPORTED_EXTENSIONS = {
  ts: [".ts", ".tsx"],
  js: [".js", ".jsx"],
};

export const plugin: PluginFunction<CustomScalarsPluginConfig, string> = async (
  schema,
  documents,
  config,
  info
) => {
  const { includeScalars, filterByDocuments = true } = config;
  const ext = extname(info?.outputFile ?? "").toLowerCase();

  if (includeScalars?.length === 0) {
    return buildOutput({ inputObjects: {}, typePolicies: {} }, ext);
  }

  const types = Object.values(schema.getTypeMap());
  const customScalars = new Set<string>();
  let inputObjects: InputObjectMap = new Map();

  for (const type of types) {
    if (isCustomScalar(type, config)) {
      customScalars.add(type.name);
    } else if (isInputObjectType(type)) {
      const fields: Record<string, InputFieldType> = {};

      for (const [fieldName, field] of Object.entries(type.getFields())) {
        const inputType = getNamedType(field.type);

        if (isCustomScalar(inputType, config) || isInputObjectType(inputType)) {
          fields[fieldName] = {
            name: inputType.name,
            type: field.type.toString().replaceAll("!", ""),
          };
        }
      }

      if (Object.keys(fields).length > 0) {
        inputObjects.set(type.name, fields);
      }
    }
  }

  if (customScalars.size === 0) {
    return buildOutput({ inputObjects: {}, typePolicies: {} }, ext);
  }

  let usedFields: Map<string, Set<string>> | undefined;

  if (filterByDocuments) {
    // Limit the config to what the documents actually use. Object type policies
    // are limited to the selected custom scalar fields, and input objects are
    // limited to those reachable from a variable definition.
    const { usedInputObjects, usedFields: fields } = getDocumentUsage(
      schema,
      documents,
      customScalars
    );

    usedFields = fields;
    inputObjects = getReachableInputObjects(inputObjects, usedInputObjects);
  }

  // After filtering input objects used by documents, we need to figure out
  // which remaining input objects contain custom scalars or references to other
  // input objects with custom scalars. This ensures we keep the config object
  // as small as possible.
  const withCustomScalars = getInputObjectsWithCustomScalars(
    inputObjects,
    customScalars
  );

  const inputObjectsConfig: InputObjectsConfig = {};

  for (const name of withCustomScalars) {
    const fields = inputObjects.get(name)!;
    const fieldsConfig: Record<string, string> = {};

    for (const [fieldName, inputType] of Object.entries(fields)) {
      if (
        customScalars.has(inputType.name) ||
        withCustomScalars.has(inputType.name)
      ) {
        fieldsConfig[fieldName] = inputType.type;
      }
    }

    inputObjectsConfig[name] = { fields: fieldsConfig };
  }

  // Iterate the schema types a 2nd time to build type policies for object type
  // fields that resolve to a custom scalar. This runs after gathering custom
  // scalars so we can skip object types outright instead of recording them,
  // which keeps the memory footprint small for large schemas.
  const typePolicies: TypePolicies = {};

  for (const type of types) {
    if (!isObjectType(type)) {
      continue;
    }

    const fieldPolicies: Record<string, FieldPolicy> = {};

    for (const [fieldName, field] of Object.entries(type.getFields())) {
      const typeName = getNamedType(field.type).name;

      if (!customScalars.has(typeName)) {
        continue;
      }

      if (!usedFields || usedFields.get(type.name)?.has(fieldName)) {
        fieldPolicies[fieldName] = { scalar: typeName };
      }
    }

    if (Object.keys(fieldPolicies).length > 0) {
      typePolicies[type.name] = { fields: fieldPolicies };
    }
  }

  return buildOutput({ inputObjects: inputObjectsConfig, typePolicies }, ext);
};

export const validate: PluginValidateFn<CustomScalarsPluginConfig> = (
  _schema,
  _documents,
  config,
  outputFile
) => {
  const { ignoreScalars, includeScalars } = config;
  const ext = extname(outputFile).toLowerCase();
  const all = Object.values(SUPPORTED_EXTENSIONS).flat();

  if (!all.includes(ext)) {
    throw new Error(
      `Plugin "@apollo/client-graphql-codegen/custom-scalars" requires extension to be one of ${all.join(
        ", "
      )}.`
    );
  }

  if (includeScalars && ignoreScalars) {
    throw new Error(
      `Plugin "@apollo/client-graphql-codegen/custom-scalars" supports 'ignoreScalars' or 'includeScalars' but not both.`
    );
  }
};

interface BuildOutputConfig {
  inputObjects: InputObjectsConfig;
  typePolicies: TypePolicies;
}

function buildOutput(config: BuildOutputConfig, ext: string) {
  if (SUPPORTED_EXTENSIONS.ts.includes(ext)) {
    return buildTsOutput(config);
  }

  if (SUPPORTED_EXTENSIONS.js.includes(ext)) {
    return buildJsOutput(config);
  }

  throw new Error(`Cannot build output for unknown extension '${ext}'.`);
}

function buildTsOutput(config: BuildOutputConfig) {
  return `
import type { InputObjectsOption, TypePolicies } from "@apollo/client/cache";

export const inputObjects: InputObjectsOption = ${JSON.stringify(
    config.inputObjects,
    null,
    2
  )};

export const scalarTypePolicies: TypePolicies = ${JSON.stringify(
    config.typePolicies,
    null,
    2
  )};
`.trim();
}

function buildJsOutput(config: BuildOutputConfig) {
  return `
/** @type {import("@apollo/client/cache").InputObjectsOption} */
export const inputObjects = ${JSON.stringify(config.inputObjects, null, 2)};

/** @type {import("@apollo/client/cache").TypePolicies} */
export const scalarTypePolicies = ${JSON.stringify(
    config.typePolicies,
    null,
    2
  )};
`.trim();
}

function getInputObjectsWithCustomScalars(
  inputObjects: InputObjectMap,
  customScalars: Set<string>
) {
  const useful = new Set<string>();
  const dependents = new Map<string, string[]>();
  const queue: string[] = [];

  for (const [name, fields] of inputObjects) {
    for (const inputType of Object.values(fields)) {
      if (customScalars.has(inputType.name)) {
        if (!useful.has(name)) {
          useful.add(name);
          queue.push(name);
        }
      } else if (inputObjects.has(inputType.name)) {
        let deps = dependents.get(inputType.name);
        if (!deps) {
          dependents.set(inputType.name, (deps = []));
        }
        deps.push(name);
      }
    }
  }

  while (queue.length) {
    const name = queue.pop()!;
    for (const dependent of dependents.get(name) ?? []) {
      if (!useful.has(dependent)) {
        useful.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return useful;
}

function getDocumentUsage(
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  customScalars: Set<string>
) {
  const usedFields = new Map<string, Set<string>>();
  const usedInputObjects = new Set<string>();
  const typeInfo = new TypeInfo(schema);

  const visitor = visitWithTypeInfo(typeInfo, {
    VariableDefinition() {
      const type = getNamedType(typeInfo.getInputType());

      if (type && isInputObjectType(type)) {
        usedInputObjects.add(type.name);
      }
    },
    Field(node) {
      const parentType = typeInfo.getParentType();
      const fieldTypeName = getNamedType(typeInfo.getType())?.name;

      if (!parentType || !fieldTypeName || !customScalars.has(fieldTypeName)) {
        return;
      }

      const typenames =
        isInterfaceType(parentType) ?
          schema.getPossibleTypes(parentType).map((type) => type.name)
        : [parentType.name];

      for (const typename of typenames) {
        let fields = usedFields.get(typename);
        if (!fields) {
          usedFields.set(typename, (fields = new Set()));
        }
        fields.add(node.name.value);
      }
    },
  });

  for (const { document } of documents) {
    if (document) {
      visit(document, visitor);
    }
  }

  return { usedInputObjects, usedFields };
}

function getReachableInputObjects(
  inputObjects: InputObjectMap,
  usedInputObjects: Set<string>
): InputObjectMap {
  const reachable: InputObjectMap = new Map();
  const queue: string[] = [];

  for (const name of usedInputObjects) {
    const fields = inputObjects.get(name);

    if (fields && !reachable.has(name)) {
      reachable.set(name, fields);
      queue.push(name);
    }
  }

  while (queue.length) {
    const fields = reachable.get(queue.pop()!)!;

    for (const inputType of Object.values(fields)) {
      if (!reachable.has(inputType.name)) {
        const dependencyFields = inputObjects.get(inputType.name);

        if (dependencyFields) {
          reachable.set(inputType.name, dependencyFields);
          queue.push(inputType.name);
        }
      }
    }
  }

  return reachable;
}

function isCustomScalar(
  type: GraphQLNamedType,
  { ignoreScalars = [], includeScalars }: CustomScalarsPluginConfig
): type is GraphQLScalarType {
  return (
    isScalarType(type) &&
    !isSpecifiedScalarType(type) &&
    !ignoreScalars.includes(type.name) &&
    (!includeScalars || includeScalars.includes(type.name))
  );
}
