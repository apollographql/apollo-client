import type { PluginFunction } from "@graphql-codegen/plugin-helpers";

import type { InputObjectsPluginConfig } from "./config.js";

export const plugin: PluginFunction<InputObjectsPluginConfig> = async (
  schema,
  documents,
  config
) => {
  return "";
};
