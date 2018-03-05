var uuid = require('node-uuid'),
    request = require('request');
var builder = require('./core/');

var SPEECH_API_KEY = process.env.MICROSOFT_SPEECH_API_KEY;

// The token has an expiry time of 10 minutes https://www.microsoft.com/cognitive-services/en-us/Speech-api/documentation/API-Reference-REST/BingVoiceRecognition
var TOKEN_EXPIRY_IN_SECONDS = 600;

var speechApiAccessToken = '';

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
exports.stt = function (session) {
    /*
        if (!process.env.MICROSOFT_SPEECH_API_KEY) {
            console.log('You need to set a MICROSOFT_SPEECH_API_KEY env var');
        }    
    var bing = new client.BingSpeechClient(process.env.MICROSOFT_SPEECH_API_KEY);
    let bing = new client.BingSpeechClient(process.env.MICROSOFT_SPEECH_API_KEY);
    bing.synthesize('I have a dream').then(response => { 
        console.log('Text to Speech completed. Audio file written to');
    });
    
    bing.synthesize("hello world").then(result => {
        var file        = "./speech.wav";
        var wstream     = fs.createWriteStream(file);
        wstream.write(result.wave);
        wstream.close();
        
        session.send(wstream,'audio/wav','bing-synthesized.wav');

    });
    */
   let bing = new client.BingSpeechClient(process.env.MICROSOFT_SPEECH_API_KEY);
   
   bing.synthesize("hello world").then(result => {
       var file        = "./speech.wav";
       var wstream     = fs.createWriteStream(file);
       wstream.write(result.wave);
       wstream.close();
       
       session.send(wstream,'audio/wav','bing-synthesized.wav');

   });

   /*

    var msg = new builder.Message(session)       
        .speak("hello world")
        .inputHint(builder.InputHint.acceptingInput);
    session.send(msg);
    */
}