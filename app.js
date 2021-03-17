import express from 'express';
import socketIO from 'socket.io';
import http from 'http';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import socketIOStream from 'socket.io-stream';
import AWS from 'aws-sdk';

const app = express();
app.use(bodyParser.json());
app.use(
  cors({
    origin: 'http://localhost:9002',
  })
);
const server = http.createServer(app);
const io = socketIO(server);

const bucket_name = 'Fern-sample-5';

let s3Client = new AWS.S3({
  endpoint: 'http://10.110.80.51:7480/',
  accessKeyId: '8DLDFFVY2E15YBJ9RES9',
  secretAccessKey: 'XHoHwEQlOrfOy45mcfIKNhvrdH4XbbGk02jyvCFr',
});

(async () => {

  try {
    await s3Client.headBucket({ Bucket: bucket_name}).promise();
  } catch (err) {
    console.log('HEAD BUCKET ERROR --> ',err)
    const createBucketParams = {
      Bucket: bucket_name,
      CreateBucketConfiguration: {
        LocationConstraint: 'default',
      }
    }
    const new_bucket = await s3Client.createBucket(createBucketParams);
    console.log(']]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]')
    console.log('%c 🍅 new_bucket: ', 'font-size:20px;background-color: #E41A6A;color:#fff;', new_bucket);
  }

  const buckets = await s3Client.listBuckets().promise()
  console.log(']]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]')
  console.log('%c 🍺 buckets: ', 'font-size:20px;background-color: #FCA650;color:#fff;', buckets);

  console.log(']]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]')
  // const bucketObjects = await s3Client.listObjects({Bucket: 'Fern'})
  // console.log('%c 🍢 bucketObjects: ', 'font-size:20px;background-color: #93C0A4;color:#fff;', bucketObjects);

  s3Client.listObjects(
    {
      Bucket: bucket_name,
    },
    function (err, data) {
      if (err) {
        console.log('Error', err);
      } else {
        console.log('Success listing objects: ', data);
      }
    }
  );
  

  io.on('connection', (socket) => {
    console.log('made socket connection', socket.id);

    socket.emit('connected', socket.id);

    socket.on('send message', (data) => {
      console.log('SEND MESSAGE', data);
      io.emit('new message', data);
    });

    socket.on('typing', (data) => {
      socket.broadcast.emit('typing', data);
    });

    // RECEIVE FILE FROM CLIENT, STORE IT IN DIRECTORY, SEND IT BACK AGAIN TO CLIENT
    socketIOStream(socket).on('file upload', (stream, data) => {
      const file_name = path.basename(data.file_name);
      const filepath = path.join('./uploads', file_name);
      const ws = fs.createWriteStream(filepath);
      stream.pipe(ws);

      let size = 0;
      stream.on('data', (chunk) => {
        size += chunk.length;
        const progress = Math.floor((size / data.size) * 100);
        socket.emit('upload progress', {
          percent: progress,
          file_uid: data.fileInfo.uid,
        });
      });

      stream.on('end', async () => {
        console.log('UPLOAD SUCCESS --> ', data.file_name);

        const uploadParams = {
          Bucket: bucket_name,
          Key: data.file_name,
          Body: fs.readFileSync(filepath),
          ACL: 'public-read',
          Metadata: {
            'file_name': `${data.file_name}`,
            'file_uid': `${data.fileInfo.uid}`,
            'message': `${data.message}`,
            'files_count': `${data.files_count}`
          }
        }

        const uploadedObject = await s3Client.upload(uploadParams).promise()
        console.log('%c 🍾 uploadedObject: ', 'font-size:20px;background-color: #7F2B82;color:#fff;', uploadedObject);

        if (uploadedObject && uploadedObject.Key) {
         fs.unlink(filepath, (unlinkError) => {
          if (!unlinkError) {
            // NOTIFY THE CLIENT -----------------------
            socket.emit('upload-success', {
              file_url: uploadedObject.Location,
              file_name: uploadedObject.Key,
              file_uid: uploadedObject.ETag,
              message: data.message
            });
          }
         })
        }
      });
    });

    // STREAM FILE FROM SERVER TO CLIENT
    socket.on('request-file', (data) => {
      console.log('request-file -->', data.file_name);
      const file_name = path.basename(data.file_name);
      const filepath = path.join('./uploads', file_name);
      const outboundStream = socketIOStream.createStream();
      socketIOStream(socket).emit('stream-uploaded-file', outboundStream, {
        file_name: data.file_name,
        file_uid: data.file_uid,
        message: data.message,
      });
      fs.createReadStream(filepath).pipe(outboundStream);
    });
  });

  server.listen(4141, () => {
    console.log('Listening on Port 4141');
  });
})();
