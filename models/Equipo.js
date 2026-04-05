import mongoose from 'mongoose';

const jugadorSchema = {
  nombre: { type: String },
  tipo: { type: String },
  dir: { type: String },
  media: { type: Number },
  valor: { type: Number }
};

const packDisSchema = {
  nombre: { type: String },
  tipo: { type: String },
  valor: { type: Number },
  desc: { type: String }
};

const defaultPlaceholder = {
  nombre: undefined,
  tipo: undefined,
  dir: 'https://cdn.jsdelivr.net/gh/lukitaz-r/assets@main/argenbot/cartas/placeholder.png',
  media: undefined,
  valor: undefined
};

const equipoSchema = new mongoose.Schema({
  nombreEq: { type: String, required: true },
  userN: { type: String, required: true },
  userID: { type: String, required: true, unique: true },
  jugadores: { type: Object, default: {} },
  equipo: {
    type: [Object],
    default: [
      { ...defaultPlaceholder },
      { ...defaultPlaceholder },
      { ...defaultPlaceholder },
      { ...defaultPlaceholder },
      { ...defaultPlaceholder }
    ]
  },
  dinero: { type: Number, default: 0 },
  ultimoDaily: { type: Date, default: null },
  ultimoWork: { type: Date, default: null },
  ultimoSlut: { type: Date, default: null },
  ultimoCrime: { type: Date, default: null },
  packs_dis: { type: [Object], default: [] }
});

export default mongoose.model('Equipo', equipoSchema);
