const util = require('util')
const fs = require('fs')
const path = require('path')
const async = require('async')
const mkdirp = require('mkdirp')
const slug = require('slug')
const moment = require('moment')
const randomize = require('randomatic')
const EventEmitter = require('events')
const debug = require('debug')('botium-BotDriver')

const Defaults = require('./Defaults')
const Capabilities = require('./Capabilities')
const Source = require('./Source')
const Fluent = require('./Fluent')
const Events = require('./Events')
const ScriptingProvider = require('./scripting/ScriptingProvider')

module.exports = class BotDriver {
  constructor (caps = {}, sources = {}, env = {}) {
    this.eventEmitter = new EventEmitter()

    this.caps = Object.assign({}, Defaults.Capabilities)
    this.sources = Object.assign({}, Defaults.Sources)
    this.envs = Object.assign({}, Defaults.Envs)

    const loadConfigFile = (filename) => {
      try {
        let configJson = JSON.parse(fs.readFileSync(filename))
        if (configJson.botium) {
          this.caps = Object.assign(this.caps, configJson.botium.Capabilities)
          this.sources = Object.assign(this.sources, configJson.botium.Sources)
          this.envs = Object.assign(this.envs, configJson.botium.Envs)
          debug(`Loaded Botium configuration file ${filename}`)
        } else {
          debug(`Botium configuration file ${filename} contains no botium configuration. Ignored.`)
        }
      } catch (err) {
        throw new Error(`FAILED: loading Botium configuration file ${filename}: ${util.inspect(err)}`)
      }
    }

    if (fs.existsSync('./botium.json')) {
      loadConfigFile('./botium.json')
    }

    let botiumConfigEnv = process.env['BOTIUM_CONFIG']
    if (botiumConfigEnv) {
      if (fs.existsSync(botiumConfigEnv)) {
        loadConfigFile(botiumConfigEnv)
      } else {
        throw new Error(`FAILED: Botium configuration file ${botiumConfigEnv} not available`)
      }
    }

    let capsToTest = Object.keys(Capabilities)
    let sourcesToTest = Object.keys(Source)

    Object.keys(process.env).filter(e => e.startsWith('BOTIUM_')).forEach((element) => {
      let elementToTest = element.replace(/^BOTIUM_/, '')
      if (capsToTest.includes(elementToTest)) {
        this.caps[elementToTest] = process.env[element]
        debug('Changed capability : ' + elementToTest + ' to : ' + process.env[element] + ' using environment variables.')
      }
      if (sourcesToTest.includes(elementToTest)) {
        this.sources[elementToTest] = process.env[element]
        debug('Changed capability : ' + elementToTest + ' to : ' + process.env[element] + ' using environment variables.')
      }
      if (element.startsWith('BOTIUM_ENV_')) {
        let envName = element.replace(/^BOTIUM_ENV_/, '')
        this.envs[envName] = process.env[element]
        debug('Changed env : ' + envName + ' to : ' + process.env[element] + ' using environment variables.')
      }
    })

    this.caps = Object.assign(this.caps, caps)
    this.sources = Object.assign(this.sources, sources)
  }

  on (event, listener) {
    this.eventEmitter.on(event, listener)
    return this
  }

  setCapabilities (caps) {
    this.caps = Object.assign(this.caps, caps)
    return this
  }

  setCapability (cap, value) {
    this.caps[cap] = value
    return this
  }

  setSources (sources) {
    this.sources = Object.assign(this.sources, sources)
    return this
  }

  setSource (source, value) {
    this.sources[source] = value
    return this
  }

  setEnvs (envs) {
    this.envs = Object.assign(this.envs, envs)
    return this
  }

  setEnv (name, value) {
    this.envs[name] = value
    return this
  }

  BuildFluent () {
    this.Fluent = new Fluent(this)
    return this.Fluent
  }

  Build () {
    debug(`Build - Capabilites: ${util.inspect(this.caps)}`)
    debug(`Build - Sources : ${util.inspect(this.sources)}`)
    debug(`Build - Envs : ${util.inspect(this.envs)}`)
    this.eventEmitter.emit(Events.CONTAINER_BUILDING)

    return new Promise((resolve, reject) => {
      let repo = null
      let container = null

      async.series([

        (driverValidated) => {
          this._validate()
            .then(() => driverValidated())
            .catch(driverValidated)
        },

        (repoValidated) => {
          try {
            repo = this._getRepo()
          } catch (err) {
            return repoValidated(err)
          }
          repo.Validate().then(() => repoValidated()).catch(repoValidated)
        },

        (repoPrepared) => {
          repo.Prepare().then(() => repoPrepared()).catch(repoPrepared)
        },

        (containerValidated) => {
          try {
            container = this._getContainer(repo)
          } catch (err) {
            return containerValidated(err)
          }
          container.Validate().then(() => containerValidated()).catch(containerValidated)
        },

        (containerBuilt) => {
          container.Build().then(() => containerBuilt()).catch(containerBuilt)
        }

      ], (err) => {
        if (err) {
          debug(`BotDriver Build error: ${err}`)
          this.eventEmitter.emit(Events.CONTAINER_BUILD_ERROR, err)
          return reject(err)
        }
        this.eventEmitter.emit(Events.CONTAINER_BUILT, container)
        resolve(container)
      })
    })
  }

  BuildCompiler () {
    debug(`BuildCompiler: Capabilites: ${util.inspect(this.caps)}`)
    try {
      let compiler = new ScriptingProvider(this.caps)
      compiler.Build()
      return compiler
    } catch (err) {
      debug(`BotDriver BuildCompiler error: ${err}`)
      throw err
    }
  }

  /* Private Functions */

  _validate () {
    return new Promise((resolve, reject) => {
      if (!this.caps[Capabilities.PROJECTNAME]) {
        throw new Error(`Capability property ${Capabilities.PROJECTNAME} not set`)
      }
      if (!this.caps[Capabilities.TEMPDIR]) {
        throw new Error(`Capability property ${Capabilities.TEMPDIR} not set`)
      }

      async.series([
        (tempdirCreated) => {
          this.tempDirectory = path.resolve(process.cwd(), this.caps[Capabilities.TEMPDIR], slug(`${this.caps[Capabilities.PROJECTNAME]} ${moment().format('YYYYMMDD HHmmss')} ${randomize('Aa0', 5)}`))

          mkdirp(this.tempDirectory, (err) => {
            if (err) {
              return tempdirCreated(new Error(`Unable to create temp directory ${this.tempDirectory}: ${err}`))
            }
            tempdirCreated()
          })
        }

      ], (err) => {
        if (err) {
          return reject(err)
        }
        resolve(this)
      })
    })
  }

  _getRepo () {
    if (this.caps[Capabilities.BOTIUMGRIDURL]) {
      const NoRepo = require('./repos/NoRepo')
      return new NoRepo(this.tempDirectory, this.sources)
    }
    if (this.sources[Source.GITURL]) {
      const GitRepo = require('./repos/GitRepo')
      return new GitRepo(this.tempDirectory, this.sources)
    }
    if (this.sources[Source.LOCALPATH]) {
      const LocalRepo = require('./repos/LocalRepo')
      return new LocalRepo(this.tempDirectory, this.sources)
    }
    throw new Error(`No Repo provider found for Sources ${util.inspect(this.sources)}`)
  }

  _getContainer (repo) {
    if (this.caps[Capabilities.BOTIUMGRIDURL]) {
      const GridContainer = require('./containers/GridContainer')
      return new GridContainer(this.eventEmitter, this.tempDirectory, repo, this.caps, this.envs)
    }
    if (!this.caps[Capabilities.CONTAINERMODE]) {
      throw new Error(`Capability '${Capabilities.CONTAINERMODE}' missing`)
    }
    if (this.caps[Capabilities.CONTAINERMODE] === 'docker') {
      const DockerContainer = require('./containers/DockerContainer')
      return new DockerContainer(this.eventEmitter, this.tempDirectory, repo, this.caps, this.envs)
    }
    if (this.caps[Capabilities.CONTAINERMODE] === 'fbdirect') {
      const FbContainer = require('./containers/FbContainer')
      return new FbContainer(this.eventEmitter, this.tempDirectory, repo, this.caps, this.envs)
    }
    if (this.caps[Capabilities.CONTAINERMODE] === 'watsonconversation') {
      const WatsonConversationContainer = require('./containers/WatsonConversationContainer')
      return new WatsonConversationContainer(this.eventEmitter, this.tempDirectory, repo, this.caps, this.envs)
    }
    if (this.caps[Capabilities.CONTAINERMODE] === 'dialogflow') {
      const DialogflowContainer = require('./containers/DialogflowContainer')
      return new DialogflowContainer(this.eventEmitter, this.tempDirectory, repo, this.caps, this.envs)
    }
    if (this.caps[Capabilities.CONTAINERMODE] === 'simplerest') {
      const SimpleRestContainer = require('./containers/SimpleRestContainer')
      return new SimpleRestContainer(this.eventEmitter, this.tempDirectory, repo, this.caps, this.envs)
    }
    if (this.caps[Capabilities.CONTAINERMODE] === 'webspeech') {
      const WebSpeechContainer = require('./containers/WebSpeechContainer')
      return new WebSpeechContainer(this.eventEmitter, this.tempDirectory, repo, this.caps, this.envs)
    }
    if (this.caps[Capabilities.CONTAINERMODE] === 'inprocess') {
      const InProcessContainer = require('./containers/InProcessContainer')
      return new InProcessContainer(this.eventEmitter, this.tempDirectory, repo, this.caps, this.envs)
    }
    const PluginConnectorContainer = require('./containers/PluginConnectorContainer')
    return new PluginConnectorContainer(this.eventEmitter, this.tempDirectory, repo, this.caps, this.envs)
  }
}
