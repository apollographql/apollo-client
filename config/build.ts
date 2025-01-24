import { $ } from "zx";
import { join } from "node:path";

$.cwd = join(import.meta.dirname, "..");
$.verbose = true;

await $`npx tsc`;
await $`npm run update-version`;
await $`npm run inline-inherit-doc `;
await $`npm run invariants `;
await $`npm run sourcemaps `;
await $`npm run rollup `;
await $`npm run prepdist `;
await $`npm run postprocess-dist`;
await $`npm run verify-version`;
