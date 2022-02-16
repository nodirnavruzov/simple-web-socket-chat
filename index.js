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
require('dotenv').config()

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
  try {
    const rooms = await Room.find({})
    rooms.filter(async (room) => {
      const res = room.participants.filter((partId) => {
        return partId !== id
      })
      room.participants = res
      await room.save()
    })
  } catch (error) {
    console.error(error);
  }

}

wss.on('connection', async (ws) => {
  
  try {
    // await mongoose.connect('mongodb://127.0.0.1:27017/livechat');
    await mongoose.connect(process.env.MONGO_URI);
  } catch (error) {
    console.error(error);
  }

  ws.id = uuid.v4()
  ws.isAlive = true
  console.log('connection', ws.id)

  ws.send(JSON.stringify({
    action: 'CONNECTION',
    body: 'Connection opened'
  }))

  ws.on('message', async (data) => {
    const msg = JSON.parse(data)
    const body = msg.body

    switch (msg.action) {
      case 'RE_LOGIN':
        try {
          const res = await User.updateOne({id: body.id}, {id: ws.id});
          console.log('res', res)
          user = await User.findOne({id: body.id})
          console.log('user', user)
          rooms = await Room.find({})
          ws.send(JSON.stringify({
            action: 'RE_LOGIN',
            body: {
              rooms, 
              user
            }
          }))
        } catch (error) {
          console.error(error);
        }
        break
      case 'LOGIN':
          try {
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
          } catch (error) {
            console.error(error);
          }
        break;

      case 'CREATE_ROOM':
        try {
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
        } catch (error) {
          console.error(error);
        }
        break;

      case 'JOIN_TO_ROOM':
        try {
          found = await Room.findOne({id: body.room.id})
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
        } catch (error) {
          console.error(error);
        }
        break;
    
      case 'NEW_MESSAGE':
        let mess = body.message
        try {
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
        } catch (error) {
          console.error(error);
        }
        break;
    
      case 'ROOM_LIST':
        try {
          rooms = await Room.find({})
          ws.send(JSON.stringify({
            action: 'ROOM_LIST',
            body: {
              rooms, 
            }
          }))
        } catch (error) {
          console.error(error);
        }
        break;
    
      case 'EXIT_ROOM':
        try {
          found = await Room.findOne({id: body.roomId})
          if(found) {
            const participants = found.participants
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
        } catch (error) {
          console.error(error);
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
        wss.clients.delete(ws.id)
        return ws.terminate()
      }
      ws.isAlive = false;
      ws.send(JSON.stringify({
        action: 'PING',
      }))
    });
  }, 10000);

  ws.on('close', () => {
    deleteParticipants(ws.id)
    clearInterval(interval);
  });
})

server.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})