// https://github.com/websockets/ws
const http = require('http')
const WebSocket = require('ws')
const server = http.createServer()
const wss = new WebSocket.WebSocketServer({ server })
const uuid = require('uuid');
const User = require('./model/user')
const Room = require('./model/room');
const mongoose = require('mongoose');
const dateNow = require('./utils/date')

const port = process.env.PORT || 3000;

// variables
let room;
let rooms;
let found;
let user;


function heartbeat(ws) {
  ws.isAlive = true;
}

async function deleteParticipants(id) {
  const rooms = await Room.find({})
  rooms.filter(async (room) => {
    const res = room.participants.filter((partId) => {
      return partId !== id
    })
    room.participants = res
    await room.save()
  })
}

wss.on('connection', async (ws) => {
  await mongoose.connect('mongodb://127.0.0.1:27017/livechat');
  ws.id = uuid.v4()
  ws.isAlive = true

  ws.send(JSON.stringify({
    action: 'CONNECTION',
    body: 'Connection opened'
  }))

  ws.on('message', async (data) => {
    const msg = JSON.parse(data)
    const body = msg.body
    console.log('message ====>>>', msg)
    
    switch (msg.action) {
      case 'LOGIN':
        if (body.id) {
          await User.updateOne({id: body.id}, {id: ws.id});
          user = await User.findOne({id: ws.id})
          rooms = await Room.find({})
          ws.send(JSON.stringify({
            action: 'LOGIN',
            body: {
              rooms, 
              user
            }
          }))
        } else {
          body.id = ws.id
          found = await User.findOne({name: body.name})
          if(!found) {
            user = await User.create(body)
            await user.save()
            rooms = await Room.find({})
            ws.send(JSON.stringify({
              action: 'LOGIN',
              body: {
                rooms, 
                user
              }
            }))
          } 
        }
        break;

      case 'CREATE_ROOM':
        found = await Room.find({name: body.room.name})
        if(!found.length) {
          const id = uuid.v4()
          room = await Room.create({ id, creator: body.user.id, name: body.room.name, participants: new Array(body.user.id) })
          await room.save()
          ws.send(JSON.stringify({
            action: 'CREATE_ROOM',
            body: room
          }))
        }
        break;

      case 'JOIN_TO_ROOM':
        found = await Room.findOne({id: body.room.id})
        console.log('wss.clients', wss.clients)
        
        if(found) {
          const participants = found.participants
          participants.push(body.user.id)
          found.participants = participants
          await found.save()
          for(let id of found.participants) {
            wss.clients.forEach( (client) => {
              if (client.readyState === WebSocket.OPEN && client.id === id) {
                if (found.messages.length > 200) {
                  found.messages = found.messages.slice(200)
                }
                client.send(JSON.stringify({
                    action: 'JOIN_ROOM',
                    body: { room: found, user: body.user } 
                }))
              }
            });
          }
        }
        break;
    
      case 'NEW_MESSAGE':
        let mess = body.message
        found = await Room.findOne({id: body.roomId})
        if(found) {
          const messages = found.messages
          messages.push({
            text: mess.text,
            senderId: mess.senderId,
            senderName: mess.senderName,
            created_date: dateNow()
          })
          found.messages = messages
          await found.save()
          for(let id of found.participants) {
            wss.clients.forEach( (client) => {
              if (client.readyState === WebSocket.OPEN && client.id === id) {
                client.send(JSON.stringify({
                    action: 'NEW_MESSAGE',
                    body: messages
                }))
              }
            });
          }
        }
        break;
    
      case 'ROOM_LIST':
        rooms = await Room.find({})
        ws.send(JSON.stringify({
          action: 'ROOM_LIST',
          body: {
            rooms, 
          }
        }))
        break;
    
      case 'EXIT_ROOM':
        found = await Room.findOne({id: body.roomId})
        if(found) {
          const participants = found.participants
          console.log('participants', participants)
          found.participants = participants.filter((user) => {
            return user.id !== body.user.id
          })
          await found.save()
          for(let id of found.participants) {
            wss.clients.forEach( (client) => {
              if (client.readyState === WebSocket.OPEN && client.id === id) {
                client.send(JSON.stringify({
                    action: 'USER_LEFT',
                    body: body.user
                }))
              }
            });
          }
        }
        break;

      case 'PONG':
        heartbeat(ws)
        break;

      default:
    }
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log('ws.id', ws.id)
        wss.clients.delete(ws.id)
        console.log('wss.clients', wss.clients)
        return ws.terminate()
      }
      ws.isAlive = false;
      ws.send(JSON.stringify({
        action: 'PING',
      }))
    });
  }, 30000);

  ws.on('close', () => {
    console.log('disconnected', ws.id);
    deleteParticipants(ws.id)
    clearInterval(interval);
  });
})

server.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})