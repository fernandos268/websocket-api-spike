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
    origin: 'http://localhost:5050',
  })
);
const server = http.createServer(app);
const io = socketIO(server);

const bucket_name = 'fern';
const bucketParams = {
  Bucket: bucket_name,
};

let s3Client = new AWS.S3({
  endpoint: 'http://10.110.80.51:7480/',
  accessKeyId: '8DLDFFVY2E15YBJ9RES9',
  secretAccessKey: 'XHoHwEQlOrfOy45mcfIKNhvrdH4XbbGk02jyvCFr',
  sslEnabled: true,
  s3ForcePathStyle: false,
});

(async () => {
  // const checkBucket = await s3Client.headBucket(bucketParams).promise();
  // console.log('%c 🌮 checkBucket: ', 'font-size:20px;background-color: #2EAFB0;color:#fff;', checkBucket);

  // s3Client.createBucket(
  //     {
  //       Bucket: 'fernsssssssss',
  //       CreateBucketConfiguration: {
  //         LocationConstraint: 'default',
  //       },
  //     },
  //     function (err, data) {
  //       if (err) {
  //         console.log('Error', err);
  //       } else {
  //         console.log('Success creating bucket', data.Location);
  //       }
  //     }
  //   );

  // const buckets = await s3Client.listBuckets().promise()
  // console.log('%c 🍺 buckets: ', 'font-size:20px;background-color: #FCA650;color:#fff;', buckets);

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

      stream.on('end', () => {
        console.log('UPLOAD SUCCESS --> ', data.file_name);

        // NOTIFY THE CLIENT -----------------------
        io.emit('upload-success', {
          file_name: data.file_name,
          file_uid: data.fileInfo.uid,
          message: data.message,
          files_count: data.files_count,
        });
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

  server.listen(4040, () => {
    console.log('Listening on Port 4040');
  });
})();
