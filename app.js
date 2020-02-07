import express from 'express'
import socketIO from 'socket.io'
import http from 'http'
import bodyParser from 'body-parser'
import cors from 'cors'
import Busboy from 'busboy'
import path from 'path'
import fs from 'fs'
import socketIOStream from 'socket.io-stream'
import kafka from 'kafka-node'
import kafka_config from './kafka_config'

import { KafkaPubSub } from 'graphql-kafka-subscriptions'

import nodemailer from 'nodemailer'
import sgMail from '@sendgrid/mail'

import orientDB from 'orientjs'

import {
    ORIENT_DB_OPTIONS,
    ORIENT_DB_SESSION,
    KAFKA_SERVERS
    // SENDGRID_KEY
} from './Config'

const app = express()
app.use(bodyParser.json())
// app.use(cors({
//     origin: 'http://localhost:9000'
// }))
const server = http.createServer(app)
const io = socketIO(server)

// const transport = nodemailer.createTransport({
//     host: "smtp.mailtrap.io",
//     port: 2525,
//     auth: {
//         user: "6c106eedf74f10", // replace with your Mailtrap credentials
//         pass: "6c2005e07fde5c"
//     },
//     // debug: true, // show debug output
//     // logger: true // log information in console
// })

const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'singsonfernandojr@gmail.com',
        pass: 'eoyhiywyfvicaumz' // naturally, replace both with your real credentials or an application-specific password
    }
});


// const transport = nodemailer.createTransport({ sendMail: true })

; (async () => {
    const orient_client = await orientDB.OrientDBClient.connect(ORIENT_DB_OPTIONS)

    let orient_pool = await orient_client.sessions(ORIENT_DB_SESSION);

    let orient_db = await orient_pool.acquire()

    const topics = [
        'create-messsage-request',
        'delete-message-request',
        'query-request',
        'request-inbox',
        'request-sent-items'
    ]


    // const kafka_pubsub = new KafkaPubSub({
    //     topic: 'create-messsage-request',
    //     host: KAFKA_SERVERS,
    // })

    // kafka_pubsub.subscribe('create-messsage-request', payload => {
    //     console.log('SUBSCRIBE --> create-messsage-request', payload)

    // })


    // const emitMessage = value => io.emit('new message', { user: data.user, message: value })

    const options = {
        autoCommit: true,
        fromOffset: 'latest',
        groupId: 'API_SERVICE_CONSUMER'
    }


    const client = new kafka.KafkaClient({ kafkaHost: kafka_config.server })
    const HighLevelProducer = kafka.HighLevelProducer
    const producer = new HighLevelProducer(client)

    const consumerGroup = new kafka.ConsumerGroup(options, topics);
    consumerGroup.on('message', async message => {
        console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')
        console.log('CONSUMER GROUP ON MESSAGE -->', message)
        const {
            topic,
            value
        } = message

        const new_message = JSON.parse(value)
        console.log('consumer --> value --> ', new_message)


        if (topic === 'create-messsage-request') {
            const result = await orient_db.insert().into('Message').set({
                ...new_message
            }).one()
            // const Producer = kafka.Producer
            // const producer = new Producer(client)

            console.log('result -->', result)
            if (result) {

                const {
                    sender,
                    recipient,
                    subject,
                    body
                } = result

                const created_message = {
                    id: `#${Object.values(result['@rid']).join(':')}`,
                    ...result
                }

                const kafka_message = {
                    topic: 'create-message-response',
                    messages: [JSON.stringify(created_message)]
                }

                const payloads = [kafka_message]

                const mail_options = {
                    from: `"employee-presence" <${sender}>`,
                    to: recipient,
                    subject,
                    text: body,
                    html: '<b>Hey there! </b><br> this is sent using nodemailer!'
                }

                transport.sendMail(mail_options, (error, info) => {
                    if (error) {
                        return console.log(error)
                    }
                    producer.send(payloads, (error, data) => {
                        console.log('send -> db result', data)
                    })
                })

            }
        } else if (topic === 'delete-message-request') {
            const message = await orient_db
                .select()
                .from("Message")
                .where({ '@rid': new_message.id })
                .one()

            console.log('topic === delete-message-request', message)

            await orient_db.delete("VERTEX", "Message")
                .where({ '@rid': new_message.id })
                .one()

            const deleted_message = {
                id: `#${Object.values(message['@rid']).join(':')}`,
                ...message
            }

            const kafka_message = {
                topic: 'delete-message-response',
                messages: [JSON.stringify(deleted_message)]
            }

            const payloads = [kafka_message]

            return producer.send(payloads, (error, data) => {
                console.log('send -> delete result', data)
            })

        } else if (
            topic === 'query-request' ||
            topic === 'request-inbox' ||
            topic === 'request-sent-items'
        ) {
            const {
                entity,
                request_origin,
                filter_fields = [],
                filter_values = []
            } = new_message

            // const where_obj = Object.assign({}, ...filter_fields.map(field => filter_values.map(value => ({ [field]: value }))))
            const where_obj = Object.assign(...filter_fields.map((field, index) => ({ [field]: filter_values[index] })))
            console.log('where_obj: ', where_obj);

            const result = await orient_db
                .select()
                .from(entity)
                .where(where_obj)
                .all()

            let producer_topic
            switch (topic) {
                case 'query-request':
                    producer_topic = 'query-response'
                    break;
                case 'request-inbox':
                    producer_topic = 'response-inbox'
                    break;
                case 'request-sent-items':
                    producer_topic = 'response-sent-items'
                    break;
                default:
                    break;
            }


            console.log(`${producer_topic} -- DB QUERY RESULT`, result)

            const format_result = result.length > 0 ? result.map((e, index) => ({
                id: `#${result.length > 0 ? Object.values(result[index]['@rid']).join(':') : ''}`,
                ...e
            })) : []

            const response_message = {
                origin: request_origin,
                list: format_result
            }

            const kafka_message = {
                topic: producer_topic,
                // partition: 0,
                messages: [JSON.stringify(response_message)]
            }

            const payloads = [kafka_message]
            // const producer = new HighLevelProducer(client)
            if (result && result.length) {
                producer.send(payloads, (error, data) => {
                    console.log('send -> db result', data)
                })
            }
        }
    })

    server.listen(4040, () => {
        console.log('Listening on http://localhost:4040')
    })
})()



//------------------------------------------------------------------------------------------
// SOCKETS

// io.on('connection', socket => {
//     console.log('made socket connection', socket.id)

//     const emitMessage = value => io.emit('new message', { user: data.user, message: value })

//     const options = {
//         autoCommit: true,
//         fromOffset: 'latest'
//     }
//     const consumerGroup = new kafka.ConsumerGroup(options, [topic]);
//     consumerGroup.on('message', message => {
//         console.log('CONSUMER GROUP ON MESSAGE -->', message)
//         emitMessage(message.value)
//         // io.emit('new message', { user: data.user, message: message.value })
//     })

//     socket.emit('connected', socket.id)

//     socket.on('send message', data => {
//         io.emit('new message', data)
//     })

//     socket.on('kafka message', data => {
//         const client = new kafka.KafkaClient({ kafkaHost: kafka_config.server })
//         const Producer = kafka.Producer
//         const producer = new Producer(client)

//         const { topic, partition } = data.kafka_message
//         const payloads = [{ ...data.kafka_message }]

//         producer.on('ready', () => {
//             console.log('KAFKA --> ON READY')
//             producer.send(payloads, (error, data) => {
//                 console.log('send -> error', error)
//                 io.emit('NEW MESSAGE SENT', { user: data.user, message: message.value })
//             })
//         })
//         producer.on('error', error => console.log('PRODUCER ON ERROR', error))

//         // const emitMessage = value => io.emit('new message', { user: data.user, message: value })

//         // const options = {
//         //     autoCommit: true,
//         //     fromOffset: 'latest'
//         // }
//         // const consumerGroup = new kafka.ConsumerGroup(options, [topic]);
//         // consumerGroup.on('message', message => {
//         //     console.log('CONSUMER GROUP ON MESSAGE -->', message)
//         //     emitMessage(message.value)
//         //     // io.emit('new message', { user: data.user, message: message.value })
//         // })
//     })

//     socket.on('')

//     socket.on('typing', data => {
//         socket.broadcast.emit('typing', data)
//     });

//     // RECEIVE FILE FROM CLIENT, STORE IT IN DIRECTORY, SEND IT BACK AGAIN TO CLIENT
//     socketIOStream(socket).on('file upload', (stream, data) => {
//         const file_name = path.basename(data.file_name)
//         const filepath = path.join('./uploads', file_name)
//         const ws = fs.createWriteStream(filepath)
//         stream.pipe(ws)

//         let size = 0;
//         stream.on('data', (chunk) => {
//             size += chunk.length;
//             const progress = Math.floor(size / data.size * 100)
//             socket.emit('upload progress', { percent: progress, file_uid: data.fileInfo.uid })
//         })

//         stream.on('end', () => {
//             console.log('UPLOAD SUCCESS --> ', data.file_name)
//             // CREATE NEW STREAM AND PIPE TO CLIENT or MULTIPLE CLIENTS
//             // const outboundStream = socketIOStream.createStream()
//             // socketIOStream(io).emit('stream-uploaded-file', outboundStream, {
//             // file_name: data.file_name,
//             // file_uid: data.fileInfo.uid,
//             // message: data.message,
//             // files_count: data.files_count
//             // })
//             // fs.createReadStream(filepath).pipe(outboundStream)

//             // PIPE THE STREAM RIGHT AWAY --------------------
//             // fs.createReadStream(filepath).pipe(stream)

//             // NOTIFY THE CLIENT -----------------------
//             io.emit('upload-success', {
//                 file_name: data.file_name,
//                 file_uid: data.fileInfo.uid,
//                 message: data.message,
//                 files_count: data.files_count,
//                 size: data.size
//             })
//         })
//     })

//     // STREAM FILE FROM SERVER TO CLIENT
//     socket.on('request-file', (data) => {
//         console.log('request-file -->', data.file_name)
//         const file_name = path.basename(data.file_name)
//         const filepath = path.join('./uploads', file_name)
//         const outboundStream = socketIOStream.createStream()
//         socketIOStream(socket).emit('stream-uploaded-file', outboundStream, {
//             file_name: data.file_name,
//             file_uid: data.file_uid,
//             message: data.message,
//             size: data.size
//         })
//         fs.createReadStream(filepath).pipe(outboundStream)
//     })

// })

// server.listen(4040, () => {
//     console.log('Listening on http://localhost:4040')
// })
