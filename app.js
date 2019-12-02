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
        console.log("TCL: send message", data)
        io.emit('new message', data)
    });

    socket.on('typing', data => {
        socket.broadcast.emit('typing', data)
    });

    socketIOStream(socket).on('file upload', (stream, data) => {
        const file_name = path.basename(data.fileName)
        const filepath = path.join('./uploads', file_name)
        const ws = fs.createWriteStream(filepath)
        stream.pipe(ws)
    })

})

server.listen(4040, () => {
    console.log('Listening on Port 4040')
})
