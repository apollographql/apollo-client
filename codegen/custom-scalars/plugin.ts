import { extname } from "node:path";

import type {
  PluginFunction,
  PluginValidateFn,
  Types,
} from "@graphql-codegen/plugin-helpers";
import type { DocumentNode, GraphQLSchema, NamedTypeNode } from "graphql";
import {
  getNamedType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  Kind,
  specifiedScalarTypes,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from "graphql";

import type { CustomScalarsPluginConfig } from "./config.js";

type InputObjectMap = Map<string, Record<string, string>>;
type InputObjectsConfig = Record<string, { fields: Record<string, string> }>;
type ObjectTypeMap = Map<string, Record<string, string>>;

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
  const {
    ignoreScalars = [],
    includeScalars,
    filterByDocuments = true,
  } = config;
  const ext = extname(info?.outputFile ?? "").toLowerCase();

  if (includeScalars?.length === 0) {
    return buildOutput({ inputObjects: {}, typePolicies: {} }, ext);
  }

  const types = Object.values(schema.getTypeMap());
  const customScalars = new Set<string>();
  const inputObjects: InputObjectMap = new Map();
  const objectTypes: ObjectTypeMap = new Map();

  for (const type of types) {
    if (
      isScalarType(type) &&
      !specifiedScalarTypes.includes(type) &&
      !ignoreScalars.includes(type.name) &&
      (!includeScalars || includeScalars.includes(type.name))
    ) {
      customScalars.add(type.name);
    } else if (isInputObjectType(type)) {
      const fields = Object.fromEntries(
        Object.entries(type.getFields()).map(([fieldName, fieldType]) => {
          return [fieldName, getNamedType(fieldType.type).name];
        })
      );

      inputObjects.set(type.name, fields);
    }
  }

  if (customScalars.size === 0) {
    return buildOutput({ inputObjects: {}, typePolicies: {} }, ext);
  }

  // Iterate a 2nd time to gather object types so that we only record object
  // types for known custom scalars to reduce the memory footprint for large
  // schemas
  for (const type of types) {
    if (isObjectType(type)) {
      const fields = Object.entries(type.getFields()).reduce(
        (memo, [name, field]) => {
          const fieldType = getNamedType(field.type).name;

          if (customScalars.has(fieldType)) {
            memo[name] = fieldType;
          }

          return memo;
        },
        {} as Record<string, string>
      );

      if (Object.keys(fields).length) {
        objectTypes.set(type.name, fields);
      }
    }
  }

  let fieldsUsed: Map<string, Set<string>> | undefined;

  if (filterByDocuments) {
    // Get a list of input objects used by variables in all documents. An input
    // object is only considered used if a variable definition includes the type,
    // or the input object is a dependency of a used input object. This allows us
    // to keep the input config object as small as possible and limit it to only
    // used input object types.
    const { usedInputObjects, usedFields } = getUsed(
      schema,
      documents,
      customScalars,
      inputObjects
    );

    fieldsUsed = usedFields;

    for (const name of inputObjects.keys()) {
      if (!usedInputObjects.has(name)) {
        inputObjects.delete(name);
      }
    }
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
  const typePolicies: TypePolicies = {};

  for (const name of withCustomScalars) {
    const fields = inputObjects.get(name)!;
    const fieldsConfig: Record<string, string> = {};

    for (const [fieldName, typeName] of Object.entries(fields)) {
      if (customScalars.has(typeName) || withCustomScalars.has(typeName)) {
        fieldsConfig[fieldName] = typeName;
      }
    }

    inputObjectsConfig[name] = { fields: fieldsConfig };
  }

  for (const [typename, fields] of objectTypes) {
    const fieldPolicies: Record<string, FieldPolicy> = {};

    for (const [fieldName, type] of Object.entries(fields)) {
      if (!fieldsUsed || fieldsUsed.get(typename)?.has(fieldName)) {
        fieldPolicies[fieldName] = { scalar: type };
      }
    }

    if (Object.keys(fieldPolicies).length > 0) {
      typePolicies[typename] = { fields: fieldPolicies };
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
      `Plugin "@apollo/client-graphql-codegen/custom-scalars supports 'ignoreScalars' or 'includeScalars' but not both.`
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
import type { InputObjectsConfig, TypePolicies } from "@apollo/client/cache";

export const inputObjects: InputObjectsConfig = ${JSON.stringify(
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
    for (const typeName of Object.values(fields)) {
      if (customScalars.has(typeName)) {
        if (!useful.has(name)) {
          useful.add(name);
          queue.push(name);
        }
      } else if (inputObjects.has(typeName)) {
        let deps = dependents.get(typeName);
        if (!deps) {
          dependents.set(typeName, (deps = []));
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

function getUsed(
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  customScalars: Set<string>,
  inputObjects: InputObjectMap
) {
  const usedFields = new Map<string, Set<string>>();
  const usedVariableTypes = new Set<string>();
  const typeInfo = new TypeInfo(schema);

  for (const { document } of documents) {
    if (!document) continue;

    visit(
      document,
      visitWithTypeInfo(typeInfo, {
        VariableDefinition(node) {
          let type = node.type;
          while (type.kind !== Kind.NAMED_TYPE) {
            type = type.type;
          }

          const typeName = type.name.value;

          if (inputObjects.has(typeName)) {
            usedVariableTypes.add(typeName);
          }
        },
        Field(node) {
          const parentType = typeInfo.getParentType();
          const fieldType = getNamedType(typeInfo.getType())?.name;

          if (!parentType || !fieldType || !customScalars.has(fieldType)) {
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
      })
    );
  }

  const usedInputObjects = new Set(usedVariableTypes);
  const usedQueue = [...usedInputObjects];

  while (usedQueue.length) {
    const fields = inputObjects.get(usedQueue.pop()!)!;

    for (const typeName of Object.values(fields)) {
      if (inputObjects.has(typeName) && !usedInputObjects.has(typeName)) {
        usedInputObjects.add(typeName);
        usedQueue.push(typeName);
      }
    }
  }

  return { usedInputObjects, usedFields };
}
