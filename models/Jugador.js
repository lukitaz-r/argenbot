import mongoose from 'mongoose';

const jugadorSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  tipo: { type: String, required: true },
  dir: { type: String, required: true },
  media: { type: Number, required: true },
  valor: { type: Number, required: true }
});

export default mongoose.model('Jugador', jugadorSchema);
