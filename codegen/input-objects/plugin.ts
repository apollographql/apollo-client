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
  const inputObjects = new Set<GraphQLInputObjectType>();

  for (const type of types) {
    if (isScalarType(type) && !BUILTIN_SCALARS.has(type)) {
      customScalars.add(type.name);
    } else if (isInputObjectType(type)) {
      inputObjects.add(type);
    }
  }

  const config: Record<string, { fields: Record<string, string> }> = {};

  // process input objects after we've gathered all custom scalars so that we
  // avoid unnecessary config for builtin scalars
  for (const inputObject of inputObjects) {
    const inputObjectConfig = { fields: {} as Record<string, string> };
    const fields = inputObject.getFields();

    for (const [name, field] of Object.entries(fields)) {
      const { name: typeName } = getNamedType(field.type);

      if (customScalars.has(typeName)) {
        inputObjectConfig.fields[name] = typeName;
      }
    }

    config[inputObject.name] = inputObjectConfig;
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
