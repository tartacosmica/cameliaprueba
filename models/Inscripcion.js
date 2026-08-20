const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  feriante:      { type: mongoose.Schema.Types.ObjectId, ref: 'Feriante', required: true },
  feria:         { type: mongoose.Schema.Types.ObjectId, ref: 'Feria',    required: true },
  tipo_espacio:  { type: String, default: '' },
  necesita_tablon: { type: Boolean, default: false }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  toJSON: {
    virtuals: true,
    transform: (_, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; }
  }
});

schema.index({ feriante: 1, feria: 1 }, { unique: true });

module.exports = mongoose.model('Inscripcion', schema);
