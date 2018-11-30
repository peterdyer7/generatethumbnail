'use strict';

const functions = require('firebase-functions');
// const { Storage } = require('@google-cloud/storage');
// const gcs = new Storage();
const admin = require('firebase-admin');
admin.initializeApp();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');

// Max height and width of the thumbnail in pixels.
const THUMB_MAX_HEIGHT = 200;
const THUMB_MAX_WIDTH = 200;
// Thumbnail prefix added to file names.
const THUMB_PREFIX = 'thumb_';

exports.helloWorld = functions.https.onRequest((request, response) => {
  response.send('Hello from Firebase!');
});

exports.generateThumbnail = functions.storage
  .object()
  .onFinalize(async (object) => {
    // source file
    const filePath = object.name; // folder/file.jpg
    const fileName = path.basename(filePath); // file.jpg
    const fileDir = path.dirname(filePath); // folder
    const contentType = object.contentType; // image/jpeg
    const metageneration = object.metageneration; // 1

    if (!contentType.startsWith('image/')) {
      console.log('This is not an image.');
      return null;
    }

    if (!metageneration === 1) {
      console.log('Metadata update - not a new object.');
      return null;
    }

    if (fileName.startsWith(THUMB_PREFIX)) {
      console.log('Image is already a thumbnail.');
      return null;
    }

    // Cloud Storage
    const fileBucket = object.bucket; // project.appspot.com
    const bucket = admin.storage().bucket(fileBucket); // Bucket { ... }
    const sourceFile = bucket.file(filePath); // File { ... }

    // temporary local files
    const tempSourceFilePath = path.join(os.tmpdir(), fileName); // /tmp/file.jpg
    const thumbFileName = `${THUMB_PREFIX}${fileName}`; // thumb_file.jpg
    const tempThumbFilePath = path.join(os.tmpdir(), thumbFileName); // /tmp/thumb_file.jpg

    // download source and create thumbnail
    await sourceFile.download({ destination: tempSourceFilePath });
    await spawn(
      'convert',
      [
        tempSourceFilePath,
        '-thumbnail',
        `${THUMB_MAX_WIDTH}x${THUMB_MAX_HEIGHT}>`,
        tempThumbFilePath
      ],
      { capture: ['stdout', 'stderr'] }
    );

    // target file - thumbnail
    const thumbFilePath = path.join(fileDir, thumbFileName); // folder/thumb_file.jpg
    const metadata = {
      contentType: contentType
    };
    await bucket.upload(tempThumbFilePath, {
      destination: thumbFilePath,
      metadata: metadata
    });

    fs.unlinkSync(tempSourceFilePath);
    fs.unlinkSync(tempThumbFilePath);
    return console.log('Thumbnail created, cleanup successful');
  });
