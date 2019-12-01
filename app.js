import express from 'express'
import socketIO from 'socket.io'
import http from 'http'
import cors from 'cors'

const app = express()
app.use(cors({
    origin: 'http://localhost:9000'
}))
const server = http.createServer(app)
const io = socketIO(server)

io.on('connection', socket => {
    console.log('made socket connection', socket.id);

    socket.emit('connected', socket.id)

    // Handle chat event
    socket.on('send message', function (data) {
        console.log("TCL: send message", data)
        io.emit('new message', data);
    });

    // Handle typing event
    socket.on('typing', function (data) {
        socket.broadcast.emit('typing', data);
    });
})

server.listen(4040, () => {
    console.log('Listening on Port 4040')
})
