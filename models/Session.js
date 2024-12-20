const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  sessionToken: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 60 * 60 } // Sesja wygasa po 7 dniach
});

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
