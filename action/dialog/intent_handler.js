var builder             = require('../../core/');
var needle              = require('needle');
var util                = require('../../utils/util.js');
var httpClient          = require('http');
var syncHttpClient      = require('sync-request');

const log4js = require('log4js');
log4js.configure({
    appenders: {
        out: { type: 'console' }
    },
    categories: { default: { appenders: ['out'], level: 'debug' } }
});
var logger = log4js.getLogger('worker');


exports.routeHandler = function (session, args) {
    var result = builder.EntityRecognizer.findEntity(args.intent.entities, 'poi-name');
    var entity;

    if(result != null) {
        entity = result.entity.replace(/ /g, "");  /* replace white space. */
    }
    
    logger.debug("user-id: " + session.message.user.id);
    logger.info("route: " + entity);

    var messageId   = 1000;
    var route       = "1";
    var etcObj      = null;
    if (!result || entity == null) {
        session.send("검색된 목적지가 없습니다.");
        session.endDialog();
        return;
    } else if(entity.toString() == '집') {               /* poi search */
        route = "1";
    } else if(entity.toString() == '인천공항') { 
        route = "2";
        etcObj = getEtcSchedule(session, entity.toString());
    } else if(entity.toString() == '양재터미널' || entity.toString() == '양재버스터미널') { 
        route = "3";
        etcObj = getEtcSchedule(session, entity.toString());
    } else if(entity.toString() == '용산역') { 
        route = "4";
        etcObj = getEtcSchedule(session, entity.toString());
    } else if(entity.toString() == '현대엠엔소프트' || entity.toString() == '회사') { 
        route = "5";
    } else {        
        session.send("검색된 목적지가 없습니다.");
        session.endDialog();
        return;
    }

    var url = process.env.THIRD_PARTY_SERVER_URL + process.env.THIRD_PARTY_SERVER_ROUTE_URI

    var res = syncHttpClient('POST', url, {
        json: { 
            'data': {
                'user': session.message.user.id
                ,'route': route
                
            }, 'message-id': messageId
        },
        'headers': {
            'Content-Type': 'application/json;charset=utf-8',
            'Accept': '*'
        }
    });
    var resData = JSON.parse(res.getBody('utf-8'));
    logger.info("[response]" + resData.data.toString());

    
    if(resData == null || resData.data[0] == null) {        
        session.send("검색된 목적지가 없습니다.");
        session.endDialog();
        return;
    }
    data = resData.data[0];

    var msg = new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachments([
            new builder.HeroCard(session)
            .title("목적지: " + entity.toString())
            .text("'" + entity.toString() + "'까지 " + util.getTime(data.duration) + "에 도착 예정입니다.")
            .images([
                builder.CardImage.create(session, data.url)
                    
            ]).tap(builder.CardAction.showImage(session, data.url))
        ]);
    session.send(msg);
    session.send("목적지까지 " + data.duration + "분 소요될 예정이며, 요금은 " + data.fee + "원 입니다.");

    /* EV */
    printEVStation(data, session);

    /* EV */
    printRecommendPoi(data, session);

    /* Reservation */
    if(etcObj == null || etcObj.schedule == null) {
        console.log("etc schedule is null.");
        session.endDialog();
        return;
    }
    etcObj = getReservationInformation(etcObj.schedule);
    
    session.send(etcObj.company + " '" + etcObj.schedule + "'가 " + etcObj.duration + "후 탑승 예정입니다.");
    session.endDialog();
}
function printEVStation(data, session) {
    if(data.ev == null) {
         return;
    }
    var arr = [];
    var msg;
    for(var i = 0; i<data.ev.length; i++) {
        var temp = new builder.HeroCard(session)
            .title(data.ev[i].name + " EV 충전소")
            .subtitle("EV 충전소를 안내해 드립니다.")
            .text("EV 충전소 페이지로 이동합니다.")
            .buttons([builder.CardAction.openUrl(session, data.ev[i].url, "충전소 정보보기")]);
        arr.push(temp);
    }    
    msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(arr);    
    session.send(msg);   
    session.send("목적지 근처에 EV충전소가 검색되었습니다.");
}
function printRecommendPoi(data, session) {
    if(data.recommend == null) {
        return;
   }
   var arr = [];
   var msg;
   for(var i = 0; i<data.recommend.length; i++) {
        var temp = new builder.HeroCard(session)
            .title("가까운 미슐랭 맛집 '" + data.recommend[i].name + "'")
            .subtitle(data.recommend[i].type)
            .text("추천 맛집 페이지로 이동합니다.")
            .images([builder.CardImage.create(session, data.recommend[i].img)])
            .buttons([builder.CardAction.openUrl(session, data.recommend[i].url, "'" + data.recommend[i].name + "' 정보보기")]);
        arr.push(temp);    
   }       
   msg = new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachmentLayout(builder.AttachmentLayout.carousel)
        .attachments(arr);    
   session.send(msg);
   session.send("목적지 근처에 추천맛집이 검색되었습니다.");
}
function getReservationInformation(scheduleName) {
    var url = process.env.THIRD_PARTY_SERVER_URL + process.env.THIRD_PARTY_SERVER_RESERVATION_URI;

    /* schedule information */
    var res = syncHttpClient('POST', url, {
        json: { 
            'data': {
                'schedule': scheduleName                
            }, 'message-id': 1000
        },
        'headers': {
            'Content-Type': 'application/json;charset=utf-8',
            'Accept': '*'
        }
    });
    var resData = JSON.parse(res.getBody('utf-8'));
    logger.info("[response]" + resData.data.toString());
    
    if(resData == null || resData.data[0] == null) {
        return null;
    } 
    return resData.data[0];
}
function getEtcSchedule(session, destination) {
    if(destination != "인천공항" && destination != "양재터미널" && destination != "용산역") {
        return;
    }
    var url = process.env.THIRD_PARTY_SERVER_URL + process.env.THIRD_PARTY_SERVER_CALENDAR_URI;

    /* schedule information */
    var qStartDate  = util.getCurrentDateTime(0);
    var qEndDate    = util.getEndDateTime(0);
    var messageId   =  1004;
    console.log("start: " + qStartDate + ", end: " + qEndDate);
    var res = syncHttpClient('POST', url, {
        json: { 
            'data': {
                'user': session.message.user.id
                ,'start-date': qStartDate
                ,'end-date': qEndDate
                
            }, 'message-id': messageId
        },
        'headers': {
            'Content-Type': 'application/json;charset=utf-8',
            'Accept': '*'
        }
    });
    var resData = JSON.parse(res.getBody('utf-8'));
    logger.info("[response]" + resData.data.toString());
    
    if(resData == null || resData.data[0] == null ||  resData.data[0].schedule == null ||  resData.data[0].schedule == '') {
        return null;
    }
    return resData.data[0];      
}
exports.scheduleHandler = function (session, args) {
    var result = builder.EntityRecognizer.findEntity(args.intent.entities, 'day-of-schedule');
    var entity;
    
    if(result != null) {
        entity = result.entity.replace(/ /g, "");  /* replace white space. */
    }

    var qStartDate;
    var qEndDate;
    var messageId       = 1001;
    if (!result) {
        qStartDate  = util.getCurrentDateTime(0);
        qEndDate    = util.getEndDateTime(0);
        messageId   =  1004;
    } else if(entity == null) {
        qStartDate = util.getStartDateTime(0);
        qEndDate    = util.getEndDateTime(0);
    } else if(entity.toString() == '오늘') {
        qStartDate = util.getStartDateTime(0);
        qEndDate    = util.getEndDateTime(0);
    } else if(entity.toString() == '내일') {
        qStartDate  = util.getStartDateTime(1);
        qEndDate    = util.getEndDateTime(1);
    } else {
        qStartDate  = entity + " 00:00";
        qEndDate    = entity + " 23:59";
    }
    logger.info("entity: " + entity);
    logger.info("query: " + qStartDate + "~" + qEndDate);
    logger.debug("user-id: " + session.message.user.id);

    var url = process.env.THIRD_PARTY_SERVER_URL + process.env.THIRD_PARTY_SERVER_CALENDAR_URI;

    var res = syncHttpClient('POST', url, {
        json: { 
            'data': {
                'user': session.message.user.id
                ,'start-date': qStartDate
                ,'end-date': qEndDate
                
            }, 'message-id': messageId
        },
        'headers': {
            'Content-Type': 'application/json;charset=utf-8'
            ,'Accept': '*'
        }
    });
    var resData = JSON.parse(res.getBody('utf-8'));


    logger.info("[response]" + resData.data.toString());

    data = resData.data[0];
    if(data == null) {
        var msg = new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachments([
            new builder.HeroCard(session)
                .title("일정이 없습니다.")
                .subtitle("일정을 등록하실 수 있게 도와드릴 수 있습니다.")
                .text("일정 등록 페이지로 이동합니다.")
                .buttons([
                    builder.CardAction.openUrl(session, process.env.THIRD_PARTY_SERVER_CALENDAR_WEB_INSERT_URL + "/" + session.message.user.id, "일정 등록하기")
                ])
        ]);
        session.send(msg);
        session.endDialog();
        return;
    }
    var msg;

    if(data.location != '-' && data.location != 0) {

        var command;
        if(data.location == '1') {
            command = "집으로 가자";
        } else if(data.location == '2') {
            command = "인천공항으로 가자";
        } else if(data.location == '3') {
            command = "양재터미널로 가자";
        } else if(data.location == '4') {
            command = "용산역으로 가자";
        } else if(data.location == '5') {
            command = "현대엠엔소프트로 가자";
        }

        msg = new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachments([
            new builder.HeroCard(session)
                .title(data.title)
                .subtitle(data.start_time + " ~ " + data.end_time)
                .text("등록된 장소로 길안내를 해드릴 수 있습니다.")
                .images([
                    builder.CardImage.create(session, "https://hmnsbotstorage01.blob.core.windows.net/poc-images/" + data.location + ".jpg")
                ])
                .buttons([
                    builder.CardAction.imBack(session, command, "길안내"),
                ])
                .tap(builder.CardAction.openUrl(session, process.env.THIRD_PARTY_SERVER_CALENDAR_WEB_URL + "/" + session.message.user.id))
        ]);
        builder.Prompts.choice(session, msg, "1|2|3|4|5");
    } else {
        msg = new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachments([
            new builder.HeroCard(session)
                .title(data.title)
                .subtitle(data.start_time + " ~ " + data.end_time)
                .text(data.description)
                .tap(builder.CardAction.openUrl(session, process.env.THIRD_PARTY_SERVER_CALENDAR_WEB_URL + "/" + session.message.user.id))
        ]);
        session.send(msg);
    }    
}
exports.weatherHandler = function (session, args) {
    logger.debug("user-id: " + session.message.user.id);
    var url         = process.env.THIRD_PARTY_SERVER_URL + process.env.THIRD_PARTY_SERVER_WEATHER_URI
    var messageId   = 1000;
    var res = syncHttpClient('POST', url, {
        json: { 
            'data': {
                'user': session.message.user.id
                
            }, 'message-id': messageId
        },
        'headers': {
            'Content-Type': 'application/json;charset=utf-8'
            ,'Accept': '*'
        }
    });
    var resData = JSON.parse(res.getBody('utf-8'));


    logger.info("[response]" + resData.data);
    var result = resData.data;
    if(result == null) {
        session.send("data is null.");
        return;
    }
    var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                    .title(result[0].date)
                    .text("최대온도 " + result[0].max + "(으)로 " + result[0].maxcomment + " (입)니다. " + " 최저온도는 " + result[0].min + "(으)로 " + result[0].mincomment + "이겠습니다.")
                    .images([
                        builder.CardImage.create(session, result[0].image),
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "http://www.weatheri.co.kr/", "날씨정보")
                    ]),
                new builder.HeroCard(session)
                    .title(result[1].date)
                    .text("최대온도 " + result[1].max + "(으)로 " + result[1].maxcomment + " (입)니다. " + " 최저온도는 " + result[1].min + "(으)로 " + result[1].mincomment + "이겠습니다.")
                    .images([
                        builder.CardImage.create(session, result[1].image),
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "http://www.weatheri.co.kr/", "날씨정보")
                    ]),
                new builder.HeroCard(session)
                    .title(result[2].date)
                    .text("최대온도 " + result[2].max + "(으)로 " + result[2].maxcomment + " (입)니다. " + " 최저온도는 " + result[2].min + "(으)로 " + result[2].mincomment + "이겠습니다.")
                    .images([
                        builder.CardImage.create(session, result[2].image),
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "http://www.weatheri.co.kr/", "날씨정보")
                    ])
            ]);
    
    session.send(session.message.user.name + "님 안녕하세요." );
    session.send("오늘 날씨안내 전달해 드리겠습니다." );
    session.send(msg);

    /* Do not work 
    msg = new builder.Message(session)
        .speak('This is the text that will be spoken.')
        .inputHint(builder.InputHint.acceptingInput);

    session.say('Please hold while I calculate a response.',
        'Please hold while I calculate a response.',
        { inputHint: builder.InputHint.ignoringInput });
    */
    session.endDialog();
}




exports.routeGuidance = function (session, entity) {
    
    if(entity != null) {
        entity = entity.replace(/ /g, "");  /* replace white space. */
    }

    logger.debug("user-id: " + session.message.user.id);
    logger.info("route: " + entity);

    var messageId   = 1000;
    var route       = "1";
    var etcObj      = null;
    if (entity == null) {
        session.send("검색된 목적지가 없습니다.");
        session.endDialog();
        return;
    } else if(entity.toString() == '집') {               /* poi search */
        route = "1";
    } else if(entity.toString() == '인천공항') { 
        route = "2";
        etcObj = getEtcSchedule(session, entity.toString());
    } else if(entity.toString() == '양재터미널' || entity.toString() == '양재버스터미널') { 
        route = "3";
        etcObj = getEtcSchedule(session, entity.toString());
    } else if(entity.toString() == '용산역') { 
        route = "4";
        etcObj = getEtcSchedule(session, entity.toString());
    } else if(entity.toString() == '현대엠엔소프트' || entity.toString() == '회사') { 
        route = "5";
    } else {        
        session.send("검색된 목적지가 없습니다.");
        session.endDialog();
        return;
    }

    var url = process.env.THIRD_PARTY_SERVER_URL + process.env.THIRD_PARTY_SERVER_ROUTE_URI

    var res = syncHttpClient('POST', url, {
        json: { 
            'data': {
                'user': session.message.user.id
                ,'route': route
                
            }, 'message-id': messageId
        },
        'headers': {
            'Content-Type': 'application/json;charset=utf-8',
            'Accept': '*'
        }
    });
    var resData = JSON.parse(res.getBody('utf-8'));
    logger.info("[response]" + resData.data.toString());

    
    if(resData == null || resData.data[0] == null) {        
        session.send("검색된 목적지가 없습니다.");
        session.endDialog();
        return;
    }
    data = resData.data[0];

    var msg = new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachments([
            new builder.HeroCard(session)
            .title("목적지: " + entity.toString())
            .text("'" + entity.toString() + "'까지 " + util.getTime(data.duration) + "에 도착 예정입니다.")
            .images([
                builder.CardImage.create(session, data.url)
                    
            ]).tap(builder.CardAction.showImage(session, data.url))
        ]);
    session.send(msg);
    session.send("목적지까지 " + data.duration + "분 소요될 예정이며, 요금은 " + data.fee + "원 입니다.");

    /* EV */
    printEVStation(data, session);

    /* EV */
    printRecommendPoi(data, session);

    /* Reservation */
    if(etcObj == null || etcObj.schedule == null) {
        console.log("etc schedule is null.");
        session.endDialog();
        return;
    }
    etcObj = getReservationInformation(etcObj.schedule);
    
    session.send(etcObj.company + " '" + etcObj.schedule + "'가 " + etcObj.duration + "후 탑승 예정입니다.");
    session.endDialog();
}

exports.getSchedule = function (session, entity) {
    var qStartDate;
    var qEndDate;
    var messageId       = 1001;

    if(entity != null) {
        entity = entity.replace(/ /g, "");  /* replace white space. */
    }
    
    if(entity == null) {
        qStartDate = util.getStartDateTime(0);
        qEndDate    = util.getEndDateTime(0);
    } else if(entity.toString() == '오늘') {
        qStartDate = util.getStartDateTime(0);
        qEndDate    = util.getEndDateTime(0);
    } else if(entity.toString() == '내일') {
        qStartDate  = util.getStartDateTime(1);
        qEndDate    = util.getEndDateTime(1);
    } else {
        qStartDate  = entity + " 00:00";
        qEndDate    = entity + " 23:59";
    }
    logger.info("entity: " + entity);
    logger.info("query: " + qStartDate + "~" + qEndDate);
    logger.debug("user-id: " + session.message.user.id);

    var url = process.env.THIRD_PARTY_SERVER_URL + process.env.THIRD_PARTY_SERVER_CALENDAR_URI;

    var res = syncHttpClient('POST', url, {
        json: { 
            'data': {
                'user': session.message.user.id
                ,'start-date': qStartDate
                ,'end-date': qEndDate
                
            }, 'message-id': messageId
        },
        'headers': {
            'Content-Type': 'application/json;charset=utf-8'
            ,'Accept': '*'
        }
    });
    var resData = JSON.parse(res.getBody('utf-8'));


    logger.info("[response]" + resData.data.toString());

    data = resData.data[0];
    if(data == null) {
        var msg = new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachments([
            new builder.HeroCard(session)
                .title("일정이 없습니다.")
                .subtitle("일정을 등록하실 수 있게 도와드릴 수 있습니다.")
                .text("일정 등록 페이지로 이동합니다.")
                .buttons([
                    builder.CardAction.openUrl(session, process.env.THIRD_PARTY_SERVER_CALENDAR_WEB_INSERT_URL + "/" + session.message.user.id, "일정 등록하기")
                ])
        ]);
        session.send(msg);
        session.endDialog();
        return;
    }
    var msg;

    if(data.location != '-' && data.location != 0) {

        var command;
        if(data.location == '1') {
            command = "집으로 가자";
        } else if(data.location == '2') {
            command = "인천공항으로 가자";
        } else if(data.location == '3') {
            command = "양재터미널로 가자";
        } else if(data.location == '4') {
            command = "용산역으로 가자";
        } else if(data.location == '5') {
            command = "현대엠엔소프트로 가자";
        }

        msg = new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachments([
            new builder.HeroCard(session)
                .title(data.title)
                .subtitle(data.start_time + " ~ " + data.end_time)
                .text("등록된 장소로 길안내를 해드릴 수 있습니다.")
                .images([
                    builder.CardImage.create(session, "https://hmnsbotstorage01.blob.core.windows.net/poc-images/" + data.location + ".jpg")
                ])
                .buttons([
                    builder.CardAction.imBack(session, command, "길안내"),
                ])
                .tap(builder.CardAction.openUrl(session, process.env.THIRD_PARTY_SERVER_CALENDAR_WEB_URL + "/" + session.message.user.id))
        ]);
        builder.Prompts.choice(session, msg, "1|2|3|4|5");
    } else {
        msg = new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachments([
            new builder.HeroCard(session)
                .title(data.title)
                .subtitle(data.start_time + " ~ " + data.end_time)
                .text(data.description)
                .tap(builder.CardAction.openUrl(session, process.env.THIRD_PARTY_SERVER_CALENDAR_WEB_URL + "/" + session.message.user.id))
        ]);
        session.send(msg);
    }    
}