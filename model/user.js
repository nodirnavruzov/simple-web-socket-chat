const { model, Schema } = require('mongoose')


const userScheme = new Schema({
  id: String,
  name: String,
}, { 
  timestamps: { createdAt: 'created_at' },
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
module.exports = model("User", userScheme)
