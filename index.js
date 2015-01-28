var express = require('express'),
    fs = require('fs'),
    path = require('path'),
    app = express();
    var ffmpeg = require('fluent-ffmpeg/index');

var PORT = 8080,
    MAX_SIZE = 200 * 1024 * 1024,
    EXTENSIONS = ['wav', 'wma', 'flac'];

app.post('/mp3', function (req, res) {
    res.contentType('audio/mpeg');
    res.attachment('filename="file.mp3"');

    var name = req.headers['x-filename'];
    if (!name) {
        res.send(JSON.stringify({error: "No name specified."}));
        return;
    }

    var extension = path.extname(name).toLowerCase();
    if (EXTENSIONS.indexOf(extension.substr(1)) == -1) {
        res.send(JSON.stringify({error: "Unknown audio file type."}));
        return;
    }

    var fileName = safeFilename(
        path.basename(name, extension) + extension);
    if (fileName == extension) {
        res.send(JSON.stringify({error: "Invalid name."}));
        return;
    }

    var size = parseInt(req.headers['content-length'], 10);
    if (!size || size < 0) {
        res.send(JSON.stringify({error: "No size specified."}));
        return;
    }

    if (size > MAX_SIZE) {
        res.send(JSON.stringify({error: "Too big."}));
        return;
    }

    var filePath = '/tmp/' + fileName;
    var bytesUploaded = 0;
    var file = fs.createWriteStream(filePath, {
        flags: 'w',
        encoding: 'binary',
        mode: 0644
    });

    req.on('data', function (chunk) {
        if (bytesUploaded + chunk.length > MAX_SIZE) {
            file.end();
            res.send(JSON.stringify({error: "Too big."}));
// TODO: remove the partial file.
            return;
        }
        file.write(chunk);
        bytesUploaded += chunk.length;

// TODO: measure elapsed time to help ward off attacks?

// deliberately take our time
        req.pause();
        setTimeout(function () {
            req.resume();
        }, PAUSE_TIME);
    });

    req.on('end', function () {
        console.log('File Upload ended');
        file.end();
        ffmpeg(filePath)
            // set audio bitrate
            .audioBitrate('128k')
            // set audio codec
            .audioCodec('libmp3lame')
            // set number of audio channels
            .audioChannels(2)
            // setup event handlers
            .on('end', function () {
                console.log('File has been converted successfully');
            })
            .on('error', function (err) {
                console.log('an error happened: ' + err.message);
            })
            // save to stream
            .pipe(res, {end: true});
    });
});

// Server index.html as static file
app.use('/', express.static(__dirname + '/'));

app.listen(PORT);

/* probably a bit naive, but hey - we're just testing. */
function safeFilename(name) {
    name = name.replace(/ /g, '-');
    name = name.replace(/[^A-Za-z0-9-_\.]/g, '');
    name = name.replace(/\.+/g, '.');
    name = name.replace(/-+/g, '-');
    name = name.replace(/_+/g, '_');
    return name;
}

console.log('HTTP server running on ' + PORT + '.');
