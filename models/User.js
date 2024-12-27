const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordId: { type: String, required: true },
    username: { type: String, required: true },
    avatar: String,
    lastUpdated: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
