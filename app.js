require('dotenv').config('./.env');
var restify = require('restify');
var builder = require('./core/');
const log4js = require('log4js');
var needle = require('needle');
var speechService = require('./speech-service.js');

/* user import */
var util = require('./utils/util.js');
var intentHandler = require('./action/dialog/intent_handler.js');

/* log4j setting */
var logger = log4js.getLogger('worker');
log4js.configure({
    appenders: {
        out: { type: 'console' }
    },
    categories: { default: { appenders: ['out'], level: 'debug' } }
});
//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Bot Storage: Here we register the state storage for your bot. 
// Default store: volatile in-memory store - Only for prototyping!
// We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
// For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
var inMemoryStorage = new builder.MemoryBotStorage();

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
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

}); // Register in memory storage;
// var bot = new builder.UniversalBot(connector);
bot.set('storage', inMemoryStorage); // Register in memory storage;
var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
bot.recognizer(recognizer);
server.post('/api/messages', connector.listen());
//=========================================================
// Activity Events
//=========================================================
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

//=========================================================
// Bots Global Actions
//=========================================================
bot.endConversationAction('goodbye', 'Goodbye :)', { matches: /^goodbye/i });
bot.beginDialogAction('help', '/help', { matches: /^help/i });
bot.beginDialogAction('carousel', '/carousel', { matches: /^carousel/i });
bot.beginDialogAction('receipt', '/receipt', { matches: /^receipt/i });
//=========================================================
// proactive setting
//=========================================================

//=========================================================
// Bots Dialogs
//=========================================================
/*
bot.dialog('/', function (session, args) {
    logger.info("hello world");
    savedAddress = session.message.address;
  
    var message = 'Hey there, I\'m going to interrupt our conversation and start a survey in a few seconds.';
    session.send(message);
  
    message = 'You can also make me send a message by accessing: ';
    message += 'http://localhost:' + server.address().port + '/api/CustomWebApi';
    session.send(message);
  
    setTimeout(() => {
      startProactiveDialog(savedAddress);
    }, 5000);
  });
*/

bot.dialog('/help', [
    function (session) {
        session.endDialog("Global commands that are available anytime:\n\n* menu - Exits a demo and returns to the menu.\n* goodbye - End this conversation.\n* help - Displays these commands.");
    }
]);

bot.dialog('/carousel', [
    function (session) {
        session.send("You can pass a custom message to Prompts.choice() that will present the user with a carousel of cards to select from. Each card can even support multiple actions.");

        // Ask the user to select an item from a carousel.
        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                    .title("Space Needle")
                    .text("The <b>Space Needle</b> is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
                            .tap(builder.CardAction.showImage(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/800px-Seattlenighttimequeenanne.jpg")),
                    ])
                    .buttons([
                        builder.CardAction.imBack(session, "select:200", "OK"),
                        builder.CardAction.imBack(session, "select:100", "Cancel")
                    ])
            ]);
        builder.Prompts.choice(session, msg, "select:100|select:101|select:102");
    },
    function (session, results) {
        var action, item;
        var kvPair = results.response.entity.split(':');
        switch (kvPair[0]) {
            case 'select':
                action = 'selected';
                break;
        }
        switch (kvPair[1]) {
            case '100':
                item = "the <b>Space Needle</b>";
                break;
            case '101':
                item = "<b>Pikes Place Market</b>";
                break;
            case '102':
                item = "the <b>EMP Museum</b>";
                break;
        }
        session.endDialog('You %s "%s"', action, item);
    }
]).triggerAction({
    matches: /^prompt/i
});

bot.dialog('/receipt', [
    function (session) {
        session.send("You can send a receipts for purchased good with both images and without...");

        // Send a receipt with images
        var msg = new builder.Message(session)
            .attachments([
                new builder.ReceiptCard(session)
                    .title("Recipient's Name")
                    .items([
                        builder.ReceiptItem.create(session, "$22.00", "EMP Museum").image(builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/a/a0/Night_Exterior_EMP.jpg")),
                        builder.ReceiptItem.create(session, "$22.00", "Space Needle").image(builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/7/7c/Seattlenighttimequeenanne.jpg"))
                    ])
                    .facts([
                        builder.Fact.create(session, "1234567898", "Order Number"),
                        builder.Fact.create(session, "VISA 4076", "Payment Method"),
                        builder.Fact.create(session, "WILLCALL", "Delivery Method")
                    ])
                    .tax("$4.40")
                    .total("$48.40")
            ]);
        session.send(msg);

        // Send a receipt without images
        msg = new builder.Message(session)
            .attachments([
                new builder.ReceiptCard(session)
                    .title("Recipient's Name")
                    .items([
                        builder.ReceiptItem.create(session, "$22.00", "EMP Museum"),
                        builder.ReceiptItem.create(session, "$22.00", "Space Needle")
                    ])
                    .facts([
                        builder.Fact.create(session, "1234567898", "Order Number"),
                        builder.Fact.create(session, "VISA 4076", "Payment Method"),
                        builder.Fact.create(session, "WILLCALL", "Delivery Method")
                    ])
                    .tax("$4.40")
                    .total("$48.40")
            ]);
        session.endDialog(msg);
    }
]);

bot.dialog('/signin', [
    function (session) {
        // Send a signin 
        var msg = new builder.Message(session)
            .attachments([
                new builder.SigninCard(session)
                    .text("You must first signin to your account.")
                    .button("signin", "http://example.com/")
            ]);
        session.endDialog(msg);
    }
]);

/********************************************************************************************
 *
 *   PoC Conditions
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
/*
        [
    // Step 1
    function (session) {
        builder.Prompts.text(session, 'Hi! What is your name?');
    },
    // Step 2
    function (session, results) {
        session.endDialog(`Hello ${results.response}!`);
    }
]
 * 
 */
bot.customAction({
    matches: /^restart/i,
    onSelectAction: (session, args, next) => {
        session.endConversation('OK');
    }
});
