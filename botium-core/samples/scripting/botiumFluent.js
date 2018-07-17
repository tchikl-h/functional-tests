const fs = require('fs')

const BotDriver = require('../../index').BotDriver
const Capabilities = require('../../index').Capabilities
const Source = require('../../index').Source

function assert (botresponse, tomatch, stepTag) {
  console.log(`{stepTag}: BOTRESPONSE "${botresponse}", EXPECTED "${tomatch}"`)
}
function fail(err) {
    console.log(`ERROR: <${err}>`)
    throw err
}

const driver = new BotDriver()
  .setCapability(Capabilities.PROJECTNAME, 'IBM Watson Conversation Sample')
  .setCapability(Capabilities.CONTAINERMODE, 'watsonconversation')
  .setCapability(Capabilities.WATSONCONVERSATION_USER, '0274cb6f-3680-4cf7-bd6b-71c7f447542d')
  .setCapability(Capabilities.WATSONCONVERSATION_PASSWORD, 'ZWDE5xo02sby')
  .setCapability(Capabilities.WATSONCONVERSATION_WORKSPACE_ID, '97513bc0-c581-4bec-ac9f-ea6a8ec308a9')
  .setCapability(Capabilities.WATSONCONVERSATION_COPY_WORKSPACE, false)

const scriptBuffer = fs.readFileSync(__dirname + '/convos/txt/restaurant.convo.txt')

const compiler = driver.BuildCompiler()
const convos = compiler.Compile(scriptBuffer, 'SCRIPTING_FORMAT_TXT')
const decompiledscript = compiler.Decompile(convos, 'SCRIPTING_FORMAT_TXT')
console.log(decompiledscript)

driver.BuildFluent()
  .Compile(scriptBuffer, 'SCRIPTING_FORMAT_TXT')
  .RunScripts(assert, fail)
  .Exec()
  .then(() => {
    console.log('READY')
  })
  .catch((err) => {
    console.log('ERROR: ', err)
  })
