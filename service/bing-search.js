const https               = require('https');
const syncHttpClient      = require('sync-request');
const builder             = require('../core/');
/********************************************************************************************
 * 
 * Initailize 
 * 
********************************************************************************************/
/* log4j setting */
const log4js = require('log4js');
log4js.configure({
    appenders: {
        out: { type: 'console' }
    },
    categories: { default: { appenders: ['out'], level: 'debug' } }
});
const logger            = log4js.getLogger('service/bing-search.js');
const subscriptionKey   = process.env.BING_SEARCH_API_KEY;
const host              = 'api.cognitive.microsoft.com';
const path              = '/bing/v7.0/search';

exports.bingSearch = function (session, search) {
  logger.info('[BING-KEYWORD] ' + search);
  let request_params = {
        method : 'GET',
        hostname : host,
        path : path + '?q=' + encodeURIComponent(search),
        headers : {
            'Ocp-Apim-Subscription-Key' : subscriptionKey,
        }
    };

    var url = "https://api.cognitive.microsoft.com/bing/v7.0/search?q=" + encodeURIComponent(search);

    var res = syncHttpClient('GET', url, {
        'headers': {
            'Ocp-Apim-Subscription-Key': subscriptionKey
        }
    });
    var resData = JSON.parse(res.getBody('utf-8'));
    var arr = [];
    
    if(resData == null || resData.webPages == null || resData.webPages.value == null || resData.webPages.value.length == 0) {
        return;
    }
    var data = resData.webPages.value;
    for(var i = 0; i<data.length; i++) {
        var temp = new builder.HeroCard(session)
            .title(data[i].name)
            .subtitle(data[i].dateLastCrawled)
            .text(data[i].snippet)
            .buttons([builder.CardAction.openUrl(session, data[i].url, "Bing검색 보기")]);
        arr.push(temp);  
    }
    msg = new builder.Message(session)
    .textFormat(builder.TextFormat.xml)
    .attachmentLayout(builder.AttachmentLayout.carousel)
    .attachments(arr); 
    session.send(msg);
    session.endDialog();
}