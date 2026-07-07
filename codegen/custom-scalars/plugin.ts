import { extname } from "node:path";

import type {
  PluginFunction,
  PluginValidateFn,
  Types,
} from "@graphql-codegen/plugin-helpers";
import type { GraphQLSchema } from "graphql";
import {
  getNamedType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  specifiedScalarTypes,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from "graphql";

import type { CustomScalarsPluginConfig } from "./config.js";

type InputObjectMap = Map<string, Record<string, string>>;
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
        Object.entries(type.getFields()).map(([fieldName, field]) => {
          return [fieldName, getNamedType(field.type).name];
        })
      );

      inputObjects.set(type.name, fields);
    }
  }

  if (customScalars.size === 0) {
    return buildOutput({ inputObjects: {}, typePolicies: {} }, ext);
  }

  let usedFields: Map<string, Set<string>> | undefined;

  if (filterByDocuments) {
    // Get a list of input objects used by variables in all documents. An input
    // object is only considered used if a variable definition includes the type,
    // or the input object is a dependency of a used input object. This allows us
    // to keep the input config object as small as possible and limit it to only
    // used input object types.
    const { usedInputObjects, usedFields: used } = getUsed(
      schema,
      documents,
      customScalars,
      inputObjects
    );

    usedFields = used;

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
  const usedInputObjects = new Set<string>();
  const typeInfo = new TypeInfo(schema);

  for (const { document } of documents) {
    if (!document) continue;

    visit(
      document,
      visitWithTypeInfo(typeInfo, {
        VariableDefinition() {
          const type = getNamedType(typeInfo.getInputType());

          if (type && inputObjects.has(type.name)) {
            usedInputObjects.add(type.name);
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
