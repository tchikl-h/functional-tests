const util = require('util')
const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const debug = require('debug')('testmybot-readconfig')

const globals = require('./globals')

module.exports = (configToSet, configfile) => {
  const resolvedConfig = {}

  if (!configfile) {
    configfile = globals.get().configfile
  }

  try {
    const contents = fs.readFileSync(path.resolve(__dirname, '../testmybot.default.json'))
    const configJson = JSON.parse(contents)
    if (configJson) {
      _.merge(resolvedConfig, configJson)
    }
  } catch (err) {
    debug(`warning: could not read file testmybot.default.json: ${util.inspect(err)}`)
  }
  try {
    const contents = fs.readFileSync(configfile)
    const configJson = JSON.parse(contents)
    if (configJson) {
      _.merge(resolvedConfig, configJson)
    }
  } catch (err) {
    debug(`warning: could not read file ${configfile}: ${util.inspect(err)}`)
  }
  if (configToSet) {
    _.merge(resolvedConfig, configToSet)
  }
  if (globals.get().configToSet) {
    _.merge(resolvedConfig, globals.get().configToSet)
  }
  return resolvedConfig
}
