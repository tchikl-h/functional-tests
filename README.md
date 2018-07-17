# TestMyBot (Botframework)

## What is it ?
Testmybot is a user friendly interface which allow you to create functional tests for your chatbot.

## How to use it ?
First of all, in order to install it you will need to execute this command :

    npm install
Also make sure you have installed docker.

Then you need to inform this file at the root of the project :

testmybot.json

> {
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "testmybot-sample-botframework",
      "BOTFRAMEWORK_API": true,
      "BOTFRAMEWORK_APP_ID": "",
      "CONTAINERMODE": "docker",
      "CLEANUPTEMPDIR": false,
      "STARTCMD": "npm run start"
    },
    "Sources": {
      "GITURL": "https://expnantes.visualstudio.com/Expertime%20-%20Lilou/_git/Expertime%20-%20Lilou",
      "GITBRANCH": "dev",
      "GITPREPARECMD": "npm install",
      "GITDIR": "./"
    },
    "Envs": {
      "MICROSOFT_APP_ID": "",
      "MICROSOFT_APP_PASSWORD": "",
      "NODE_DEBUG": "botbuilder"
    }
  }
}

You also need to add your .env file into the project to copy it to the git repository.
Place it like this ~/env/.env

If you use typescript, your STARTCMD must copy the .env from /env/ to ./built/, here is my STARTCMD script for example :

    "tsc && cd built && cp /env/.env . && node Server.js"

To launch the emulator, use this command :

    npm run emulator

testmybot simulates your chatbot and then you can start a dialog with it. Once you are satisfied with your test, you can write #SAVE \<filename\> to save the test or #EXIT to quit the interface.

> files are saved in spec/convo

![enter image description here](https://cdn-images-1.medium.com/max/1600/0*Nds_sN8-YAVrMOQA.)
 
When you wrote all your tests, you can launch it with the command :

    npm run test

You will get an output similar to this :

![enter image description here](https://cdn-images-1.medium.com/max/1600/1*NXTbHbmZtnubamumDEeMjw.png)

sources :
https://github.com/codeforequity-at/testmybot
https://github.com/botium/botium
