import nodeResolve from 'rollup-plugin-node-resolve';
import typescriptPlugin from 'rollup-plugin-typescript';
import typescript from 'typescript';
import path from 'path';

// treat as externals not relative and not absolute paths
const external = id => !id.startsWith('.') && !id.startsWith('/');

const extensions = ['.ts', '.tsx'];
const input = './src/index.ts';

export default pkg => {
  console.info(`uhhh1 ${path.basename(__filename)}`);
  console.info(`uhhh2 ${path.join(__filename)}`);
  const projectDir = path.join(__filename, `../packages/${pkg.name}`);
  console.info(`Building project: ${projectDir}`);
  const tsconfig = `${projectDir}/tsconfig.json`;
  return {
    input,
    external,
    output: {
      file: pkg.module,
      format: 'esm',
      sourcemap: true,
    },
    plugins: [
      nodeResolve({ extensions }),
      typescriptPlugin({ typescript, tsconfig }),
    ],
  };
};
