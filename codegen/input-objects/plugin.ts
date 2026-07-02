import type { PluginFunction } from "@graphql-codegen/plugin-helpers";
import type { GraphQLInputObjectType } from "graphql";
import {
  getNamedType,
  isInputObjectType,
  isScalarType,
  specifiedScalarTypes,
} from "graphql";

import type { InputObjectsPluginConfig } from "./config.js";

const BUILTIN_SCALARS = new Set(specifiedScalarTypes);

export const plugin: PluginFunction<InputObjectsPluginConfig> = async (
  schema,
  _documents,
  _config
) => {
  const types = Object.values(schema.getTypeMap());
  const customScalars = new Set<string>();
  const inputObjects = new Map<string, Record<string, string>>();

  for (const type of types) {
    if (isScalarType(type) && !BUILTIN_SCALARS.has(type)) {
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

  const config: Record<string, { fields: Record<string, string> }> = {};

  // process input objects after we've gathered all types so that we can
  // reference nested input objects or custom scalars. We limit the config to
  // only output types with custom scalars to avoid bloating the object with
  // fields that would be unused by the client
  for (const [name, fields] of inputObjects) {
    const inputObjectConfig = { fields: {} as Record<string, string> };

    for (const [fieldName, typeName] of Object.entries(fields)) {
      if (customScalars.has(typeName)) {
        inputObjectConfig.fields[fieldName] = typeName;
        continue;
      }

      if (!inputObjects.has(typeName)) {
        continue;
      }

      if (customScalars.has(typeName) || inputObjects.has(typeName)) {
        inputObjectConfig.fields[fieldName] = typeName;
      }
    }

    config[name] = inputObjectConfig;
  }

  const contents = `
import type { InputObjectsConfig } from "@apollo/client/cache";

export const inputObjects: InputObjectsConfig = ${JSON.stringify(
    config,
    null,
    2
  )};
`.trim();

  return contents;
};
