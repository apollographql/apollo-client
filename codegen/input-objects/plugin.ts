import type { PluginFunction } from "@graphql-codegen/plugin-helpers";
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
  const inputObjects: Record<string, { fields: Record<string, string> }> = {};

  for (const type of types) {
    if (isScalarType(type) && !BUILTIN_SCALARS.has(type)) {
      customScalars.add(type.name);
    } else if (isInputObjectType(type)) {
      const config = { fields: {} as Record<string, string> };
      const fields = type.getFields();

      for (const [name, field] of Object.entries(fields)) {
        config.fields[name] = getNamedType(field.type).name;
      }

      inputObjects[type.name] = config;
    }
  }

  const contents = `
import type { InputObjectsConfig } from "@apollo/client/cache";

export const inputObjects: InputObjectsConfig = ${JSON.stringify(
    inputObjects,
    null,
    2
  )};
`.trim();

  return contents;
};
