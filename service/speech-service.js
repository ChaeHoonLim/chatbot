const uuid      = require('node-uuid');
const request   = require('request');
const builder   = require('../core/');
const storage   = require('./storage.js');
const root      = require('app-root-path');
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
var logger = log4js.getLogger('service/storage.js');


const SPEECH_API_KEY            = process.env.MICROSOFT_SPEECH_API_KEY;
const TOKEN_EXPIRY_IN_SECONDS   = 600;

var speechApiAccessToken        = '';
exports.getTextFromAudioStream = function (stream) {
    return new Promise(
        function (resolve, reject) {
            if (!speechApiAccessToken) {
                try {
                    authenticate(function () {
                        streamToText(stream, resolve, reject);
                    });
                } catch (exception) {
                    reject(exception);
                }
            } else {
                streamToText(stream, resolve, reject);
            }
        }
    );
};

function authenticate(callback) {
    var requestData = {
        url: 'https://api.cognitive.microsoft.com/sts/v1.0/issueToken',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'Ocp-Apim-Subscription-Key': SPEECH_API_KEY
        }
    };

    request.post(requestData, function (error, response, token) {
        if (error) {
            console.error(error);
        } else if (response.statusCode !== 200) {
            console.error(token);
        } else {
            speechApiAccessToken = 'Bearer ' + token;

            // We need to refresh the token before it expires.
            setTimeout(authenticate, (TOKEN_EXPIRY_IN_SECONDS - 60) * 1000);
            if (callback) {
                callback();
            }
        }
    });
}

function streamToText(stream, resolve, reject) {
    var speechApiUrl = [
        'https://speech.platform.bing.com/recognize?scenarios=smd',
        'appid=D4D52672-91D7-4C74-8AD8-42B1D98141A5',
        'locale=ko-KR',     /* ko-KR 한국어 */
        'device.os=wp7',
        'version=3.0',
        'format=json',
        'form=BCSSTT',
        'instanceid=0F8EBADC-3DE7-46FB-B11A-1B3C3C4309F5',
        'requestid=' + uuid.v4()
    ].join('&');

    var speechRequestData = {
        url: speechApiUrl,
        headers: {
            'Authorization': speechApiAccessToken,
            'content-type': 'audio/wav; codec=\'audio/pcm\'; samplerate=16000'
        }
    };

    stream.pipe(request.post(speechRequestData, function (error, response, body) {
        if (error) {
            reject(error);
        } else if (response.statusCode !== 200) {
            reject(body);
        } else {
            resolve(JSON.parse(body).header.name);
        }
    }));
}

var     client  = require('bingspeech-api-client/lib/client');
const   fs      = require('fs');

exports.sendSpeechMessage = function (session, message, attachments) {
    sendTTS(session, message, attachments);
}
exports.sendSpeechMessage = function (session, message) {
    sendTTS(session, message, null);
}
function sendTTS(session, message, attachments) {
    if(attachments == null) {
        attachments = [];
    }
    let bing = new client.BingSpeechClient(process.env.MICROSOFT_SPEECH_API_KEY);   
    bing.synthesize(message).then(result => {
        var dir = root + "\\resource";

        if (fs.existsSync(dir) == false){
            fs.mkdirSync(dir);
        }

        var fileName    = uuid.v4() + ".wav";
        var file        = root + "\\resource\\" + fileName;
        var wstream     = fs.createWriteStream(file);
        wstream.write(result.wave);
        wstream.close();
        storage.sendAudioCard(session, fileName, message, attachments);       
    });
}