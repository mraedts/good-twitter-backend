const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  id: Number,
  token: String,
  tokenSecret: String
});

const User = mongoose.model('User', UserSchema);

module.exports = { User };
