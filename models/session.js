const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sessionSchema = new Schema(
  {
    expires: Date,
    session: String
  },
  { collection: 'session' }
);

const Session = mongoose.model('session', sessionSchema);

module.exports = { Session };
