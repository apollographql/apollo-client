import node from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import cjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import { terser } from 'rollup-plugin-terser';
import gzipPlugin from 'rollup-plugin-gzip'

function build({ outputPrefix, externals = [], minify = false, gzip = false }) {
  return {
    input: './src/index.js',
    output: {
      file: `./public/js/${outputPrefix}${minify ? '.min' : ''}.js`,
      format: 'cjs',
      sourcemap: true
    },
    external(id) {
      return externals.indexOf(id) >= 0;
    },
    treeshake: true,
    plugins: [
      node(),
      replace({
        'process.env.NODE_ENV': JSON.stringify('production')
      }),
      babel({
        exclude: 'node_modules/**'
      }),
      cjs({
        namedExports: {
          'react': [
            'useRef',
            'useContext',
            'useReducer',
            'useEffect',
            'useState'
          ]
        }
      }),
      minify && terser({
        mangle: {
          toplevel: true
        },
        compress: {
          dead_code: true,
          global_defs: {
            '@process.env.NODE_ENV': JSON.stringify('production')
          }
        }
      }),
      gzip && gzipPlugin()
    ]
  };
}

export default [
  build({
    externals: [],
    outputPrefix: 'app',
    minify: false,
    gzip: false
  }),
  build({
    externals: [],
    outputPrefix: 'app',
    minify: true,
    gzip: true
  })
];
