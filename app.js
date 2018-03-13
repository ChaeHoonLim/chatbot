
/* setting file */
require('dotenv').config('./.env');

/* library import */
const restify           = require('restify');
const needle            = require('needle');
const log4js            = require('log4js');

/* user import */
const builder           = require('./core/');
const speechService     = require('./service/speech-service.js');
const util              = require('./utils/util.js');
const intentHandler     = require('./handler/intent_handler.js');
const bingSearch        = require('./service/bing-search.js');

/********************************************************************************************
 * 
 * Initailize Server
 * 
********************************************************************************************/
/* log4j setting */
var logger = log4js.getLogger('[app.js]');
log4js.configure({
    appenders: {
        out: { type: 'console' }
    },
    categories: { default: { appenders: ['out'], level: 'debug' } }
});
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    logger.info('----------------------------------------');    
    logger.info('HMNS Bot Server %s', process.env.HMNS_BOT_VERSION);    
    logger.info('Listening: %s', server.url);
    logger.info('----------------------------------------');    
    
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
    

    var attachment  = util.hasAudioAttachment(session);
    var text        = session.message.text;

    if(attachment == false && session.message.text == '') { 
        session.send('다시 한번 말씀해 주시겠습니까?');
        return;
    }
    if(text != '') {
        logger.info("[NEED-CHECK] " + session.message.text);
        return;
    }
    /* attachment */
    var stream = util.getAudioStreamFromMessage(connector, session.message);
    var responseMessage = "";
    speechService.getTextFromAudioStream(stream)
        .then(function (text) {
            logger.info("[STT] " + text);
            responseMessage = "'" + text + "' 음성메시지에 대한 처리결과를 전달해 드립니다.";            
            var data = util.getIntentAndEntity(session, text);
            if(data.intent == 'weather' || data.intent == 'hello' || data.intent == 'hi') {
                session.send(responseMessage);
                intentHandler.weatherHandler(session);
            } else if(data.intent == 'route') {                
                if(data.entity == null) {
                    responseMessage = "다시 한번 말씀해 주시겠습니까? '" + text  + "'를 인식하지 못했습니다. 포털 검색 결과를 참고해 주십시오. ";                
                    speechService.sendSpeechMessage(session, responseMessage);
                    bingSearch.bingSearch(session, text);
                }else {
                    session.send(responseMessage);
                    intentHandler.routeGuidance(session, data.entity);
                }
            } else if(data.intent == 'schedule') {                
                if(data.entity == null) {
                    responseMessage = "다시 한번 말씀해 주시겠습니까? '" + text  + "'를 인식하지 못했습니다. 포털 검색 결과를 참고해 주십시오. ";                
                    speechService.sendSpeechMessage(session, responseMessage);
                    bingSearch.bingSearch(session, text);
                }else {
                    session.send(responseMessage);
                    intentHandler.getSchedule(session, data.entity);
                }
            } else if(data.intent == 'news') {
                session.send(responseMessage);
                intentHandler.getNews(session);
            } else {
                responseMessage = "다시 한번 말씀해 주시겠습니까? '" + text  + "'를 인식하지 못했습니다. 포털 검색 결과를 참고해 주십시오. ";                
                speechService.sendSpeechMessage(session, responseMessage);
                bingSearch.bingSearch(session, text);
            }                       
        })
        .catch(function (error) {
            session.send('"Speech To Text" 처리과정에서 오류가 발생하였습니다.');
            logger.error(error);
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
const welcomeMap = [];
bot.on('conversationUpdate', function (message) {
    if(welcomeMap[message.user.id] != null) {
        return;
    }
    bot.beginDialog(message.address, 'weather');
    welcomeMap[message.user.id] = true;
    if(!message.address.conversation.isGroup) {
        return;
    }
});
 bot.on('contactRelationUpdate', function (message) {
    if (message.action != 'add') {
        return;
    }
    bot.beginDialog(message.address, 'weather');
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
bot.dialog('news', intentHandler.getNews).triggerAction({
    matches: 'news'
});
bot.dialog('greeting', intentHandler.weatherHandler).triggerAction({
    matches: /^hello/i
});
bot.dialog('weather', intentHandler.weatherHandler).triggerAction({
    matches: 'weather'
});

bot.customAction({
    matches: /^restart/i,
    onSelectAction: (session, args, next) => {
        session.endConversation('OK');
    }
});
