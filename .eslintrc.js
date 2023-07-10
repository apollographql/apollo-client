const { entryPoints } = require("./config/entryPoints.js")
const {join} = require('node:path')

const fullImports = entryPoints.map(({ dirs }) => join(__dirname, 'src', ...dirs, 'index.{ts,tsx}'))

const zones = entryPoints.map(({ dirs }) => {
  const subEntrypoints = entryPoints.map(({dirs}) => dirs).filter(other => other.length > dirs.length && dirs.every((v,i) => v === other[i]))

  let target = join(__dirname, 'src', ...dirs);
  if (subEntrypoints.length) {
    target = join(target, `!(${subEntrypoints.map(e => join(...e.slice(dirs.length))).join('|')})`)
  }
  return {
    target,
    from: join(__dirname, 'src', '**'),
    except: fullImports.concat(
      join(__dirname, 'src', ...dirs, '*.ts'),
      join(target, '**'),
    )
  }
})

module.exports = {
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint", "import"],
  "env": {
    "browser": true,
    "node": true,
    "es2021": true
  },
  "parserOptions": {
    "ecmaVersion": "latest"
  },
  "settings": {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"]
    },
    "import/resolver": {
      "typescript": {
        "alwaysTryTypes": true
      }
    }
  },
  "overrides": [
    {
      "files": ["**/*.[jt]sx", "**/*.[jt]s"],
      "excludedFiles": ["**/__tests__/**/*.*"],
      "rules": {
        "@typescript-eslint/consistent-type-imports": ["error", {
          "prefer": "type-imports",
          "disallowTypeAnnotations": false,
          "fixStyle": "separate-type-imports"
        }],
        "@typescript-eslint/no-import-type-side-effects": "error",
        "import/extensions": [
          "error",
          "always",
          {
            "ignorePackages": true,
            "checkTypeImports": true
          }
        ],
        "import/no-restricted-paths": ["error", { zones }]
      }
    },
    {
      "files": ["**/__tests__/**/*.[jt]sx", "**/?(*.)+(test).[jt]sx"],
      "extends": ["plugin:testing-library/react"],
      "rules": {
        "testing-library/prefer-user-event": "error",
        "testing-library/no-wait-for-multiple-assertions": "off"
      }
    }
  ],
  "rules": {
    "import/no-unresolved": "error"
  }
}
