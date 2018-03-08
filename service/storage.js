const azure     = require('azure-storage');
const fs        = require('fs');
const builder   = require('../core/');
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

var URL             = "https://" + process.env.AZURE_STORAGE_ACCOUNT + ".blob.core.windows.net/" + process.env.AZURE_CONTAINER_NAME;

exports.sendAudioCard = function (session, fileName, message, attachments) {
    if(attachments == null) {
        attachments = [];
    }

    var file            = root + "\\" + fileName;
    var blobSvc         = azure.createBlobService();    
    /* create container if not exist. */
    blobSvc.createContainerIfNotExists(process.env.AZURE_CONTAINER_NAME,  {publicAccessLevel : 'blob'}, function(error, result, response){
        if(error) {
            logger.error(error);
            logger.error(process.env.AZURE_CONTAINER_NAME);
            return;
        }
        logger.info("[STORAGE] " + process.env.AZURE_CONTAINER_NAME + " container created.")
    });
    /* upload blob file */
    blobSvc.createAppendBlobFromLocalFile(process.env.AZURE_CONTAINER_NAME, fileName, file, function(error, result, response){
        if(error) {
            logger.error(error);
            return;
        }
        //fs.unlinkSync(file); /* remove temporary file */
        var provide = URL + "/" + fileName;
        
        /* add attachments */
        var card    = createAudioCard(session, provide, message);
        attachments.push(card);
        
        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(attachments);    
        session.send(msg);
    });
}
function createAudioCard(session, ttsURL, text) {
    return new builder.AudioCard(session)
        .text(text)
        .media([
            { url: ttsURL }
        ]);
}
function createVideoCard(session, ttsURL) {
    return new builder.VideoCard(session)
        .title('Big Buck Bunny')
        .subtitle('by the Blender Institute')
        .text('Big Buck Bunny (code-named Peach) is a short computer-animated comedy film by the Blender Institute, part of the Blender Foundation. Like the foundation\'s previous film Elephants Dream, the film was made using Blender, a free software application for animation made by the same foundation. It was released as an open-source film under Creative Commons License Attribution 3.0.')
        .image(builder.CardImage.create(session, 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/220px-Big_buck_bunny_poster_big.jpg'))
        .media([
            { url: ttsURL }
        ])
        .buttons([
            builder.CardAction.openUrl(session, 'https://peach.blender.org/', 'Learn More')
        ]);
}