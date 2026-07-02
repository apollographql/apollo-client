import type { PluginFunction } from "@graphql-codegen/plugin-helpers";
import {
  getNamedType,
  isInputObjectType,
  isScalarType,
  Kind,
  specifiedScalarTypes,
} from "graphql";

import type { InputObjectsPluginConfig } from "./config.js";

const BUILTIN_SCALARS = new Set(specifiedScalarTypes);

export const plugin: PluginFunction<InputObjectsPluginConfig> = async (
  schema,
  documents,
  _config
) => {
  const types = Object.values(schema.getTypeMap());
  const usedVariableTypes = new Set<string>();
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

  for (const { document } of documents) {
    if (!document) continue;

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

          const typeName = type.name.value;

          if (inputObjects.has(typeName)) {
            usedVariableTypes.add(typeName);
          }
        }
      }
    }
  }

  // Usage flows forward from document variable definitions: an input object
  // is used if a variable references it, or if it appears as a field of
  // another used input object. Flood forward from the variable types, then
  // drop unused input objects entirely so the usefulness pass below never
  // considers them.
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

  for (const name of inputObjects.keys()) {
    if (!used.has(name)) {
      inputObjects.delete(name);
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
