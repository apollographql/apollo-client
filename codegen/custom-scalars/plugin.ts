import { extname } from "node:path";

import type {
  PluginFunction,
  PluginValidateFn,
  Types,
} from "@graphql-codegen/plugin-helpers";
import type { DocumentNode, NamedTypeNode } from "graphql";
import {
  getNamedType,
  isInputObjectType,
  isScalarType,
  Kind,
  specifiedScalarTypes,
} from "graphql";

import type { CustomScalarsPluginConfig } from "./config.js";

type InputObjectMap = Map<string, Record<string, string>>;
type InputObjectsConfig = Record<string, { fields: Record<string, string> }>;

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
    filterByDocuments = true,
    includeScalars,
  } = config;
  const ext = extname(info?.outputFile ?? "").toLowerCase();

  if (includeScalars?.length === 0) {
    return buildOutput({}, ext);
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
        Object.entries(type.getFields()).map(([fieldName, fieldType]) => {
          return [fieldName, getNamedType(fieldType.type).name];
        })
      );

      inputObjects.set(type.name, fields);
    }
  }

  if (customScalars.size === 0) {
    return buildOutput({}, ext);
  }

  if (filterByDocuments) {
    // Get a list of input objects used by variables in all documents. An input
    // object is only considered used if a variable definition includes the type,
    // or the input object is a dependency of a used input object. This allows us
    // to keep the input config object as small as possible and limit it to only
    // used input object types.
    const used = getUsedInputObjectsFromDocuments(documents, inputObjects);

    for (const name of inputObjects.keys()) {
      if (!used.has(name)) {
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

  return buildOutput(inputObjectsConfig, ext);
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

function buildOutput(config: InputObjectsConfig, ext: string) {
  if (SUPPORTED_EXTENSIONS.ts.includes(ext)) {
    return buildTsOutput(config);
  }

  if (SUPPORTED_EXTENSIONS.js.includes(ext)) {
    return buildJsOutput(config);
  }

  throw new Error(`Cannot build output for unknown extension '${ext}'.`);
}

function buildTsOutput(config: InputObjectsConfig) {
  return `
import type { InputObjectsConfig } from "@apollo/client/cache";

export const inputObjects: InputObjectsConfig = ${JSON.stringify(
    config,
    null,
    2
  )};
`.trim();
}

function buildJsOutput(config: InputObjectsConfig) {
  return `
/** @type {import("@apollo/client/cache").InputObjectsOption} */
export const inputObjects = ${JSON.stringify(config, null, 2)};
`.trim();
}

function getUsedInputObjectsFromDocuments(
  documents: Types.DocumentFile[],
  inputObjects: InputObjectMap
) {
  const usedVariableTypes = new Set<string>();

  for (const { document } of documents) {
    if (!document) continue;

    eachVariableDef(document, (type) => {
      const typeName = type.name.value;

      if (inputObjects.has(typeName)) {
        usedVariableTypes.add(typeName);
      }
    });
  }

  const used = new Set(usedVariableTypes);
  const usedQueue = [...used];

  while (usedQueue.length) {
    const fields = inputObjects.get(usedQueue.pop()!)!;

    for (const typeName of Object.values(fields)) {
      if (inputObjects.has(typeName) && !used.has(typeName)) {
        used.add(typeName);
        usedQueue.push(typeName);
      }
    }
  }

  return used;
}

function eachVariableDef(
  document: DocumentNode,
  fn: (node: NamedTypeNode) => void
) {
  for (const definition of document.definitions) {
    if (
      definition.kind === Kind.OPERATION_DEFINITION &&
      definition.variableDefinitions
    ) {
      for (const variableDef of definition.variableDefinitions) {
        let type = variableDef.type;
        while (type.kind !== Kind.NAMED_TYPE) {
          type = type.type;
        }

        fn(type);
      }
    }
  }
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
