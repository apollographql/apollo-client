'use strict'

import path from 'path'

// This is a custom Jest transformer turning file imports into filenames.
// http://facebook.github.io/jest/docs/en/webpack.html

module.exports = {
  process(src: string, filename: string) {
    return `module.exports = ${JSON.stringify(path.basename(filename))};`
  },
}
