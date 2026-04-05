import mongoose from 'mongoose';

const packSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  tipo: { type: String, default: 'normal' },
  desc: { type: String, default: 'Sin descripción' },
  dir: { type: String, required: true },
  contenido: { type: Object, default: {} },
  valor: { type: Number, required: true }
});

export default mongoose.model('Pack', packSchema);
