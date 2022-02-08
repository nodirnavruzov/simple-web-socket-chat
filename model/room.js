const {model, Schema} = require('mongoose')
const dateNow = require('../utils/date')


const roomsSchema = new Schema({
  id: String,
  creator: String,
  name: String,
  participants: [String],
  messages: [Object],
  created_date: {type: Date, default: dateNow},
}, {
  toObject: {
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
    }
  },
  toJSON: {
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
    }
  }
})

const Rooms = module.exports = model("Rooms", roomsSchema)





// const uuid = require('uuid');

// class Rooms {
//   constructor() {
//     this.rooms = []
//   }

//   addRoom(room) {
//     const id = uuid.v4()
//     this.rooms = [...this.rooms, {id, ...room }]
//     return { id, ...room }
//   }

//   getRoomByName(name) {
//     console.log('getRoomByName', name)
    
//     return this.rooms.find(room => room.name === name)
//   }
//   getRoomById(id) {
//     return this.rooms.find(room => room.id === id)
//   }

//   getRooms() {
//     return this.rooms
//   }
  
//   addParticipant(data) {
//     this.rooms.forEach((room) => {
//       if (room.id === data.room.id) {
//         if (!!room.participants) {
//           room.participants.push({
//             ...data.user
//           })
//         } else {
//           room.participants = new Array({
//             ...data.user
//           })
//         }
//       }
//     })
//     console.log('rooms =>', this.rooms)
    
//   }
//   // getUsersByRoom(room) {
//   //   return this.users.filter(user => user.room === room)
//   // }

//   removeRoom(id) {
//     this.rooms = this.rooms.filter(room => room.id !== id);
//   }
// }

// module.exports = () => {
//   return new Rooms()
//  }