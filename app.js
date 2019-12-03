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
        io.emit('new message', data)
    });

    socket.on('typing', data => {
        socket.broadcast.emit('typing', data)
    });

    // RECEIVE FILE FROM CLIENT AND STORE IT IN LOCAL FILE SYSTEM
    socketIOStream(socket).on('file upload', (stream, data) => {
        const file_name = path.basename(data.file_name)
        const filepath = path.join('./uploads', file_name)
        const ws = fs.createWriteStream(filepath)
        stream.pipe(ws)

        let size = 0;
        stream.on('data', (chunk) => {
            size += chunk.length;
            const progress = Math.floor(size / data.size * 100)
            socket.emit('upload progress', { progress })
        })

        stream.on('end', () => {
            console.log('UPLOAD SUCCESS')
            const outboundStream = socketIOStream.createStream()
            socketIOStream(socket).emit('stream-uploaded-file', outboundStream, {
                file_name: data.file_name,
                id: data.fileInfo.uid,
                success: true
            })
            fs.createReadStream(filepath).pipe(outboundStream)
        })


    })

    // STREAM FILE FROM SERVER TO CLIENT
    socket.on('client-stream-request', (data) => {
        console.log("TCL: client-stream-request -->", { data, file_name })
        // var stream = ss.createStream();
        // const file_name = path.basename(data.file_name)
        // const filepath = path.join('./uploads', file_name)
        // socketIOStream(socket).emit('client-stream-response', stream, { name: data.file_name });
        // fs.createReadStream(filepath).pipe(stream)

        // let size = 0;
        // stream.on('data', (chunk) => {
        //     size += chunk.length;
        //     const progress = Math.floor(size / data.size * 100)
        //     console.log(Math.floor(size / data.size * 100) + '%');
        //     socket.emit('streaming progress', { progress })
        //     if (progress === 100) {
        //         socket.emit('streaming sucess', {
        //             file_name: data.file_name,
        //             id: data.fileInfo.uid,
        //             success: true
        //         })
        //     }
        // })
    })

})

server.listen(4040, () => {
    console.log('Listening on Port 4040')
})
