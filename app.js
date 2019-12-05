import express from 'express'
import socketIO from 'socket.io'
import http from 'http'
import bodyParser from 'body-parser'
import cors from 'cors'
import Busboy from 'busboy'
import path from 'path'
import fs from 'fs'
import socketIOStream from 'socket.io-stream'

const app = express()
app.use(bodyParser.json())
app.use(cors({
    origin: 'http://localhost:9000'
}))
const server = http.createServer(app)
const io = socketIO(server)

app.post('/fileupload', (req, res, next) => {
    // console.log(req.body)
    // res.send(req.body)

    const busboy = new Busboy({ headers: req.headers })
    console.log(req.headers);
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {

        const saveTo = path.join(__dirname, 'uploads/' + filename)
        file.pipe(fs.createWriteStream(saveTo))
    });

    busboy.on('finish', () => {
        res.writeHead(200, { 'Connection': 'close' })
        res.end("Image has been uploaded")
    });

    return req.pipe(busboy)
})

io.on('connection', socket => {
    console.log('made socket connection', socket.id)

    socket.emit('connected', socket.id)

    socket.on('send message', data => {
        console.log('SEND MESSAGE', data)
        io.emit('new message', data)
    });

    socket.on('typing', data => {
        socket.broadcast.emit('typing', data)
    });

    // RECEIVE FILE FROM CLIENT, STORE IT IN DIRECTORY, SEND IT BACK AGAIN TO CLIENT
    socketIOStream(socket).on('file upload', (stream, data) => {
        const file_name = path.basename(data.file_name)
        const filepath = path.join('./uploads', file_name)
        const ws = fs.createWriteStream(filepath)
        stream.pipe(ws)

        let size = 0;
        stream.on('data', (chunk) => {
            size += chunk.length;
            const progress = Math.floor(size / data.size * 100)
            socket.emit('upload progress', { percent: progress, file_uid: data.fileInfo.uid })
        })

        stream.on('end', () => {
            console.log('UPLOAD SUCCESS --> ', data.file_name)
            // CREATE NEW STREAM AND PIPE TO CLIENT or MULTIPLE CLIENTS
            // const outboundStream = socketIOStream.createStream()
            // socketIOStream(io).emit('stream-uploaded-file', outboundStream, {
            // file_name: data.file_name,
            // file_uid: data.fileInfo.uid,
            // message: data.message,
            // files_count: data.files_count
            // })
            // fs.createReadStream(filepath).pipe(outboundStream)

            // PIPE THE STREAM RIGHT AWAY --------------------
            // fs.createReadStream(filepath).pipe(stream)

            // NOTIFY THE CLIENT -----------------------
            io.emit('upload-success', {
                file_name: data.file_name,
                file_uid: data.fileInfo.uid,
                message: data.message,
                files_count: data.files_count
            })
        })
    })

    // STREAM FILE FROM SERVER TO CLIENT
    socket.on('request-file', (data) => {
        console.log('request-file -->', data.file_name)
        const file_name = path.basename(data.file_name)
        const filepath = path.join('./uploads', file_name)
        const outboundStream = socketIOStream.createStream()
        socketIOStream(socket).emit('stream-uploaded-file', outboundStream, {
            file_name: data.file_name,
            file_uid: data.file_uid,
            message: data.message
        })
        fs.createReadStream(filepath).pipe(outboundStream)
    })

})

server.listen(4040, () => {
    console.log('Listening on Port 4040')
})
