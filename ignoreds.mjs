// @ts-check
import { readFileSync, readdirSync } from 'node:fs'
import micromatch from 'micromatch'

const ignored = readFileSync('.gitignore', 'utf8').split("\n").filter(f => !f.startsWith('#') && f.trim() !== '')
const files = readdirSync('./src', { recursive: true }).map(f => `/src/${f}`)
.concat(readdirSync('./config', { recursive: true }).map(f => `/config/${f}`))
.concat(readdirSync('./integration-tests', { recursive: true }).map(f => `/integration-tests/${f}`))
.filter(f => f.includes(".") && !(/node_modules|.yalc|.next|dist/.test(f)))
// console.log({ignored, files})
const notIgnored = micromatch(files, '**/*.*', { ignore: ignored})

const ignoredMatches = files.filter(f => !notIgnored.includes(f))
for (const i of ignoredMatches) {
  console.log(i)
}

