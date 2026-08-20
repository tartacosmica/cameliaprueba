const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true }
});

module.exports = mongoose.model('Admin', schema);
