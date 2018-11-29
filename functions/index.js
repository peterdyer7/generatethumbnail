'use strict';

const functions = require('firebase-functions');
const { Storage } = require('@google-cloud/storage');
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');

const gcs = new Storage();

exports.helloWorld = functions.https.onRequest((request, response) => {
  response.send('Hello from Firebase!');
});

exports.generateThumbnail = functions.storage
  .object()
  .onFinalize(async (object) => {
    const fileBucket = object.bucket;
    const filePath = object.name;
    const contentType = object.contentType;
    const metageneration = object.metageneration;

    if (!contentType.startsWith('image/')) {
      console.log('This is not an image.');
      return null;
    }

    if (!metageneration === 1) {
      console.log('Metadata update - not a new object.');
      return null;
    }

    const fileName = path.basename(filePath);
    if (fileName.startsWith('thumb_')) {
      console.log('Image is already a thumbnail.');
      return null;
    }

    const bucket = gcs.bucket(fileBucket);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const metadata = {
      contentType: contentType
    };

    await bucket.file(filePath).download({ destination: tempFilePath });
    console.log('Image downloaded locally to - ', tempFilePath);

    await spawn('convert', [
      tempFilePath,
      '-thumbnail',
      '200x200>',
      tempFilePath
    ]);
    console.log('Thumbnail created at - ', tempFilePath);

    const thumbFileName = `thumb_${fileName}`;
    const thumbFilePath = path.join(path.dirname(filePath), thumbFileName);
    await bucket.upload(tempFilePath, {
      destination: thumbFilePath,
      metadata: metadata
    });

    fs.unlinkSync(tempFilePath);
    return console.log('Cleanup successful');
  });
