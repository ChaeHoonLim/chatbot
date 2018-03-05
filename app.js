require('dotenv').config('./.env');
var restify = require('restify');
var builder = require('./core/');
const log4js = require('log4js');
var needle = require('needle');
var speechService = require('./speech-service.js');

/* user import */
var util = require('./utils/util.js');
var intentHandler = require('./action/dialog/intent_handler.js');

/********************************************************************************************
 * 
 * Initailize Server
 * 
********************************************************************************************/
/* log4j setting */
var logger = log4js.getLogger('worker');
log4js.configure({
    appenders: {
        out: { type: 'console' }
    },
    categories: { default: { appenders: ['out'], level: 'debug' } }
});
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});
/********************************************************************************************
 * 
 * Initailize Bot
 * 
********************************************************************************************/
var inMemoryStorage = new builder.MemoryBotStorage();
// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
/*
    Attachment(audio)
 */
var bot = new builder.UniversalBot(connector, function (session) {
    if(util.hasAudioAttachment(session) == false) {
        logger.debug(session);
        session.send('다시 한번 말씀해 주시겠습니까?');
        return;
    }
    var stream = util.getAudioStreamFromMessage(connector, session.message);
    speechService.getTextFromAudioStream(stream)
        .then(function (text) {
            var data = util.getIntentAndEntity(session, text);
            if(data.intent == 'weather' || data.intent == 'hello' || data.intent == 'hi') {
                intentHandler.weatherHandler(session);
            } else if(data.intent == 'route') {
                console.log(data.intent + ", " + data.entity);
                intentHandler.routeGuidance(session, data.entity);
            } else if(data.intent == 'schedule') {
                console.log(data.intent + ", " + data.entity);
                intentHandler.getSchedule(session, data.entity);
            } else {
                session.send('다시 한번 말씀해 주시겠습니까? 잘 인식하지 못했습니다.');
            }
        })
        .catch(function (error) {
            session.send('Oops! Something went wrong. Try again later.');
            console.error(error);
        });

}); 
bot.set('storage', inMemoryStorage); // Register in memory storage;
var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
bot.recognizer(recognizer);
server.post('/api/messages', connector.listen());

/********************************************************************************************
 * 
 * Activity Events (Welcome Message)
 * 
 ********************************************************************************************/
var welcomeMap = new Object();
bot.on('conversationUpdate', function (message) {
    // Check for group conversations    
    logger.debug(message);
    if(welcomeMap[message.user.id] != null) {
        return;
    }
    bot.beginDialog(message.address, 'weather');
    welcomeMap[message.user.id] = true;
    if(!message.address.conversation.isGroup) {
        return;
    }
});
/********************************************************************************************
 *
 *   PoC Dialog
 *   by chaehoon.lim 
 * 
 ********************************************************************************************/
bot.dialog('route', intentHandler.routeHandler).triggerAction({
    matches: 'route'
});
bot.dialog('schedule', intentHandler.scheduleHandler).triggerAction({
    matches: 'schedule'
});
bot.dialog('greeting', intentHandler.weatherHandler).triggerAction({
    matches: /^hello/i
});
bot.dialog('weather', intentHandler.weatherHandler).triggerAction({
    matches: 'weather'
});
bot.dialog('syntherise', speechService.stt).triggerAction({
    matches: /^tts/i
});
bot.customAction({
    matches: /^restart/i,
    onSelectAction: (session, args, next) => {
        session.endConversation('OK');
    }
});
