// @ts-check

import { mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";

/**
 * @typedef Config
 * @property {string} cwd
 * @property {string} configPath
 * @property {boolean} why
 * @property {string} saveBundle
 * @property {boolean} cleanDir
 * @property {Check[]} checks
 */

/** @typedef {import('size-limit').Check} Check */

/**
 * @typedef EsbuildCheck
 * @property {string} esbuildOutfile
 */

export default {
  name: "size-limit-apollo-plugin",
  async before(/** @type {Config} */ config) {
    const originalChecks = /** @type {Check[]} */ (
      (await import(join(config.cwd, config.configPath))).default
    );

    for (const i in originalChecks) {
      // undo all the resolution logic going on in https://github.com/ai/size-limit/blob/058b1f132c4e51272e94e9d3650e480b3e0d6851/packages/size-limit/get-config.js#L217-L228
      config.checks[i].import = originalChecks[i].import;
    }
  },
  async step21(
    /** @type {Config} */ config,
    /** @type {Check & EsbuildCheck} */ check
  ) {
    await mkdir(join(check.esbuildOutfile, "node_modules", "@apollo"), {
      recursive: true,
    });
    await symlink(
      join(config.cwd, "dist"),
      join(check.esbuildOutfile, "node_modules", "@apollo", "client")
    );
  },
};
