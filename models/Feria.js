const mongoose = require('mongoose');

// fecha stored as "YYYY-MM-DD" string so string comparison works for date queries
const schema = new mongoose.Schema({
  fecha:           { type: String, required: true },
  lugar:           { type: String, required: true },
  precio:          { type: Number, required: true },
  recomendaciones: { type: String, required: true },
  activa:          { type: Boolean, default: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  toJSON: {
    virtuals: true,
    transform: (_, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; }
  }
});

module.exports = mongoose.model('Feria', schema);
