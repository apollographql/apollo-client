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

  // An input object is only useful if it transitively reaches a custom scalar
  // through its fields. Seed with input objects that directly contain a custom
  // scalar field, then flood usefulness backwards through reverse edges so
  // cycles and arbitrarily deep nesting are handled in O(total fields).
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

  const config = new Map<string, { fields: Record<string, string> }>();

  // process input objects after we've gathered all types so that we can
  // reference nested input objects or custom scalars. We limit the config to
  // only output types with custom scalars to avoid bloating the object with
  // fields that would be unused by the client
  for (const [name, fields] of inputObjects) {
    if (!useful.has(name)) {
      continue;
    }

    const fieldsConfig: Record<string, string> = {};

    for (const [fieldName, typeName] of Object.entries(fields)) {
      if (customScalars.has(typeName) || useful.has(typeName)) {
        fieldsConfig[fieldName] = typeName;
      }
    }

    config.set(name, { fields: fieldsConfig });
  }

  const configObj = Object.fromEntries(config.entries());

  const contents = `
import type { InputObjectsConfig } from "@apollo/client/cache";

export const inputObjects: InputObjectsConfig = ${JSON.stringify(
    configObj,
    null,
    2
  )};
`.trim();

  return contents;
};
