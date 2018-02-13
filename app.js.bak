// This loads the environment variables from the .env file
require('dotenv').config('./.env');

//var builder = require('../../core/');
const log4js            = require('log4js');
var builder             = require('botbuilder');
var restify             = require('restify');
var Store               = require('./store');
var spellService        = require('./spell-service');
var logger              = log4js.getLogger('worker');
var httpClient          = require('http');
var syncHttpClient      = require('sync-request');

// log4j setting
log4js.configure({
  appenders: {
    out: { type: 'console' }
  },
  categories: { default: { appenders: ['out'], level: 'debug' } }
});

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});
// Create connector and listen for messages
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
server.post('/api/messages', connector.listen());



var bot = new builder.UniversalBot(connector, function (session) {
    session.send('Sorry, I did not understand \'%s\'. Type \'help\' if you need assistance.', session.message.text);
});

// You can provide your own model by specifing the 'LUIS_MODEL_URL' environment variable
// This Url can be obtained by uploading or creating your model from the LUIS portal: https://www.luis.ai/
var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
bot.recognizer(recognizer);

var httpOption;



/*
    Activity Events
*/
bot.on('conversationUpdate', function (message) {
    // Check for group conversations
     if (message.address.conversation.isGroup) {
         // Send a hello message when bot is added
         if (message.membersAdded) {
             message.membersAdded.forEach(function (identity) {
                 if (identity.id === message.address.bot.id) {
                     var reply = new builder.Message()
                             .address(message.address)
                             .text("Hello everyone!");
                     bot.send(reply);
                 }
             });
         }
 
         // Send a goodbye message when bot is removed
         if (message.membersRemoved) {
             message.membersRemoved.forEach(function (identity) {
                 if (identity.id === message.address.bot.id) {
                     var reply = new builder.Message()
                         .address(message.address)
                         .text("Goodbye");
                     bot.send(reply);
                 }
             });
         }
     }
 });
 
 bot.on('contactRelationUpdate', function (message) {
     if (message.action === 'add') {
         var name = message.user ? message.user.name : null;
         var reply = new builder.Message()
                 .address(message.address)
                 .text("Hello %s... Thanks for adding me. Say 'hello' to see some great demos.", name || 'there');
         bot.send(reply);
     } else {
         // delete their data
     }
 });
 
 bot.on('deleteUserData', function (message) {
     // User asked to delete their data
 });
 
//=========================================================
// Bots Middleware
//=========================================================

// Anytime the major version is incremented any existing conversations will be restarted.
bot.use(builder.Middleware.dialogVersion({ version: 1.0, resetCommand: /^reset/i }));

//=========================================================
// Bots Global Actions
//=========================================================

bot.endConversationAction('goodbye', 'Goodbye :)', { matches: /^goodbye/i });
bot.beginDialogAction('help', '/help', { matches: /^help/i });


bot.dialog('route', function (session, args) {
        var result = builder.EntityRecognizer.findEntity(args.intent.entities, 'poi-name');
        var entity;

		if (!result || !result.entity) {
            return;
        }       
        entity = result.entity.replace(/ /g, "");  /* replace white space. */
        logger.info("route: " + entity);
       
}).triggerAction({
    matches: 'route'
});

bot.dialog('schedule', function (session, args) {
		var result = builder.EntityRecognizer.findEntity(args.intent.entities, 'day-of-schedule');
        var entity;
        
		if (!result && !result.entity) {         
            return;    
        }      
        entity = result.entity.replace(/ /g, "");  /* replace white space. */
        logger.info("schedule: " + entity);    
        /*
        httpOption = {
            host: process.env.THIRD_PARTY_SERVER_CALENDAR_IP,
            path: process.env.THIRD_PARTY_SERVER_CALENDAR_URI,
            port: process.env.THIRD_PARTY_SERVER_CALENDAR_PORT,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        var url = "http://" + process.env.THIRD_PARTY_SERVER_CALENDAR_IP + ":" 
                + process.env.THIRD_PARTY_SERVER_CALENDAR_PORT 
                + process.env.THIRD_PARTY_SERVER_CALENDAR_URI;
                
        var res = syncHttpClient('POST', url, {
            json: { 'hello': 'world' }
        });
        var data = JSON.parse(res.getBody('utf8'));
        logger.info("[response]" + data.msg);
        session.send(data.msg);	
        */
       var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachments([
                new builder.HeroCard(session)
                    .title("Hero Card")
                    .subtitle("Space Needle")
                    .text("The <b>Space Needle</b> is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
                    ]),
                new builder.ThumbnailCard(session)
                    .title("Thumbnail Card")
                    .subtitle("Pikes Place Market")
                    .text("<b>Pike Place Market</b> is a public market overlooking the Elliott Bay waterfront in Seattle, Washington, United States.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/PikePlaceMarket.jpg/320px-PikePlaceMarket.jpg")
                    ])
            ]);

        session.send(msg)
}).triggerAction({
    matches: 'schedule'
});

