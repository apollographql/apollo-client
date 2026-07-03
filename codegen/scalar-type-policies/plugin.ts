import { extname } from "node:path";

import type {
  PluginFunction,
  PluginValidateFn,
} from "@graphql-codegen/plugin-helpers";
import {
  getNamedType,
  isObjectType,
  isScalarType,
  specifiedScalarTypes,
} from "graphql";

import type { ScalarTypePoliciesPluginConfig } from "./config.js";

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

export const plugin: PluginFunction<ScalarTypePoliciesPluginConfig, string> = (
  schema,
  _documents,
  _config,
  info
) => {
  const ext = extname(info?.outputFile ?? "").toLowerCase();
  const customScalars = new Set<string>();
  const objectTypes: ObjectTypeMap = new Map();

  for (const type of Object.values(schema.getTypeMap())) {
    if (isScalarType(type) && !specifiedScalarTypes.includes(type)) {
      customScalars.add(type.name);
    } else if (isObjectType(type)) {
      const fields = Object.fromEntries(
        Object.entries(type.getFields()).map(([name, field]) => [
          name,
          getNamedType(field.type).name,
        ])
      );

      objectTypes.set(type.name, fields);
    }
  }

  if (customScalars.size === 0) {
    return buildOutput({}, ext);
  }

  const typePolicies: TypePolicies = {};

  for (const [typename, fields] of objectTypes) {
    const fieldPolicies: Record<string, FieldPolicy> = {};

    for (const [fieldName, type] of Object.entries(fields)) {
      if (customScalars.has(type)) {
        fieldPolicies[fieldName] = { scalar: type };
      }
    }

    if (Object.keys(fieldPolicies).length > 0) {
      typePolicies[typename] = { fields: fieldPolicies };
    }
  }

  return buildOutput(typePolicies, ext);
};

export const validate: PluginValidateFn<ScalarTypePoliciesPluginConfig> = (
  _schema,
  _documents,
  _config,
  outputFile
) => {
  const ext = extname(outputFile).toLowerCase();
  const all = Object.values(SUPPORTED_EXTENSIONS).flat();

  if (!all.includes(ext)) {
    throw new Error(
      `Plugin "@apollo/client-graphql-codegen/scalar-type-policies" requires extension to be one of ${all.join(
        ", "
      )}.`
    );
  }
};

function buildOutput(typePolicies: TypePolicies, ext: string) {
  if (SUPPORTED_EXTENSIONS.ts.includes(ext)) {
    return buildTsOutput(typePolicies);
  }

  if (SUPPORTED_EXTENSIONS.js.includes(ext)) {
    return buildJsOutput(typePolicies);
  }

  throw new Error(`Cannot built output for unknown extension '${ext}'.`);
}

function buildTsOutput(typePolicies: TypePolicies) {
  return `
import type { TypePolicies } from "@apollo/client/cache";

export const scalarTypePolicies: TypePolicies = ${JSON.stringify(
    typePolicies,
    null,
    2
  )};
`.trim();
}

function buildJsOutput(typePolicies: TypePolicies) {
  return `
/** @type {import("@apollo/client/cache").TypePolicies} */
export const scalarTypePolicies = ${JSON.stringify(typePolicies, null, 2)}
`.trim();
}
