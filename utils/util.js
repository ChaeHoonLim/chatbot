/*
    Utils
    by. chaehoon.lim
*/

var needle              = require('needle');
const log4js            = require('log4js');
var httpClient          = require('http');
var syncHttpClient      = require('sync-request');
log4js.configure({
    appenders: {
      out: { type: 'console' }
    },
    categories: { default: { appenders: ['out'], level: 'debug' } }
});
var logger          = log4js.getLogger('worker');

function getDate(days) {
    var result = new Date();
    result.setDate(result.getDate() + days);
    return result;
  }
  exports.getCurrentDateTime = function (days) {
    var currentDate = getDate(days);
    return currentDate.getYear() + 1900
                        + '-'
                        + ((currentDate.getMonth() + 1 < 10) ? '0' + (currentDate.getMonth() + 1) : currentDate.getMonth() + 1)
                        + '-' + ((currentDate.getDate() < 10) ? '0' + (currentDate.getDate()) : currentDate.getDate())
                        + ' ' + ((currentDate.getHours() < 10) ? '0' + (currentDate.getHours()) : currentDate.getHours())
                        + ':' + ((currentDate.getMinutes() < 10) ? '0' + (currentDate.getMinutes()) : currentDate.getMinutes());
}
exports.getStartDateTime = function (days) {
    var currentDate = getDate(days);
    return currentDate.getYear() + 1900
                        + '-'
                        + ((currentDate.getMonth() + 1 < 10) ? '0' + (currentDate.getMonth() + 1) : currentDate.getMonth() + 1)
                        + '-' + ((currentDate.getDate() < 10) ? '0' + (currentDate.getDate()) : currentDate.getDate())
                        + ' 00:00';
}
exports.getEndDateTime = function (days) {
    var currentDate = getDate(days);
    return currentDate.getYear() + 1900
                        + '-'
                        + ((currentDate.getMonth() + 1 < 10) ? '0' + (currentDate.getMonth() + 1) : currentDate.getMonth() + 1)
                        + '-' + ((currentDate.getDate() < 10) ? '0' + (currentDate.getDate()) : currentDate.getDate())
                        + ' 23:59';
}
function getDateAddMinutes(minutes) {
    return new Date(new Date().getTime() + minutes * 60000);
}
exports.getTime = function (minutes) {
    var currentDate = getDateAddMinutes(minutes);
    return ((currentDate.getHours() < 10) ? '0' + (currentDate.getHours()) : currentDate.getHours())
            + '시' + ((currentDate.getMinutes() < 10) ? '0' + (currentDate.getMinutes()) : currentDate.getMinutes()) + '분';
}

exports.hasAudioAttachment = function (session) {
    logger.debug("[attachment-size]" + session.message.attachments.length);
    return session.message.attachments.length > 0 &&
        (session.message.attachments[0].contentType === 'audio/wav' ||
            session.message.attachments[0].contentType === 'application/octet-stream');
}

function checkRequiresToken(message) {
    return message.source === 'skype' || message.source === 'msteams';
}

exports.getAudioStreamFromMessage = function (connector, message) {
    var headers = {};
    var attachment = message.attachments[0];
    if (checkRequiresToken(message)) {
        // The Skype attachment URLs are secured by JwtToken,
        // you should set the JwtToken of your bot as the authorization header for the GET request your bot initiates to fetch the image.
        // https://github.com/Microsoft/BotBuilder/issues/662
        connector.getAccessToken(function (error, token) {
            var tok = token;
            headers['Authorization'] = 'Bearer ' + token;
            headers['Content-Type'] = 'application/octet-stream';

            return needle.get(attachment.contentUrl, { headers: headers });
        });
    }

    headers['Content-Type'] = attachment.contentType;
    return needle.get(attachment.contentUrl, { headers: headers });
}

exports.processText = function (text) {
    var result = 'You said: ' + text + '.';

    if (text && text.length > 0) {
        var wordCount = text.split(' ').filter(function (x) { return x; }).length;
        result += '\n\nWord Count: ' + wordCount;

        var characterCount = text.replace(/ /g, '').length;
        result += '\n\nCharacter Count: ' + characterCount;

        var spaceCount = text.split(' ').length - 1;
        result += '\n\nSpace Count: ' + spaceCount;

        var m = text.match(/[aeiou]/gi);
        var vowelCount = m === null ? 0 : m.length;
        result += '\n\nVowel Count: ' + vowelCount;
    }
    return result;
}



exports.getIntentAndEntity = function (session, attrance) {
    if(attrance == null || attrance == "") {
        return;
    }
    var url = process.env.THIRD_PARTY_SERVER_URL + process.env.THIRD_PARTY_SERVER_LUIS_URI

    /* luis information */
    var messageId   =  1000;
    var res = syncHttpClient('POST', url, {
        json: { 
            'data': {
                'user': session.message.user.id
                , 'query': attrance
                
            }, 'message-id': messageId
        },
        'headers': {
            'Content-Type': 'application/json;charset=utf-8',
            'Accept': '*'
        }
    });
    var resData = JSON.parse(res.getBody('utf-8'));
    logger.info("[response]" + resData.data.toString());
    
    if(resData == null || resData.data == null) {
        return null;
    }
    return resData.data;      
}