import express from 'express'
import socketIO from 'socket.io'
import http from 'http'
import bodyParser from 'body-parser'
import cors from 'cors'
import Busboy from 'busboy'
import path from 'path'
import fs from 'fs'

const app = express()
app.use(bodyParser.json())
app.use(cors({
    origin: 'http://localhost:9000'
}))
const server = http.createServer(app)
const io = socketIO(server)

app.post('/fileupload', (req, res, next) => {
    console.log(req.body)
    res.send(req.body)
    // const busboy = new Busboy({
    //     headers: req.headers
    // })

    // busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    //     fstream = fs.createWriteStream(__dirname + '/uploads' + filename);
    //     file.pipe(fstream);
    // })
})

io.on('connection', socket => {
    console.log('made socket connection', socket.id);

    socket.emit('connected', socket.id)

    // Handle chat event
    socket.on('send message', data => {
        console.log("TCL: send message", data)
        io.emit('new message', data);
    });

    // Handle typing event
    socket.on('typing', data => {
        socket.broadcast.emit('typing', data);
    });
})

server.listen(4040, () => {
    console.log('Listening on Port 4040')
})
