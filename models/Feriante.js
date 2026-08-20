const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  nombre_emprendimiento: { type: String, required: true },
  rubro:                 { type: String, required: true },
  nombre_contacto:       { type: String, required: true },
  email:                 { type: String, required: true, unique: true, lowercase: true },
  telefono:              { type: String, default: '' },
  password_hash:         { type: String, required: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  toJSON: {
    virtuals: true,
    transform: (_, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; }
  }
});

module.exports = mongoose.model('Feriante', schema);
