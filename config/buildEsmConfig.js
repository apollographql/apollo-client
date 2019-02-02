import nodeResolve from 'rollup-plugin-node-resolve';
import typescriptPlugin from 'rollup-plugin-typescript2';
import typescript from 'typescript';
import path from 'path';

// treat as externals not relative and not absolute paths
const external = id => !id.startsWith('.') && !id.startsWith('/');

export default pkg => {
  const projectDir = path.join(__filename, '..');
  console.info(`Building project esm ${projectDir}`);
  const tsconfig = `${projectDir}/tsconfig.json`;
  return {
    input: './src/index.ts',
    external,
    output: {
      file: pkg.module,
      format: 'esm',
      sourcemap: true,
    },
    plugins: [
      nodeResolve({
        extensions: ['.ts', '.tsx'],
        // Inline anything imported from the tslib package, e.g. __extends
        // and __assign. This depends on the "importHelpers":true option in
        // tsconfig.base.json.
        module: true,
        only: ['tslib'],
      }),
      typescriptPlugin({ typescript, tsconfig }),
    ],
  };
};
