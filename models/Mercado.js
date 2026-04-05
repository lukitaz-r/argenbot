import mongoose from 'mongoose';

const mercadoSchema = new mongoose.Schema({
  vendedorID: { type: String, required: true },
  vendedorUserN: { type: String, required: true },
  jugadorKey: { type: String, required: true },
  jugadorData: { type: Object, required: true },
  precio: { type: Number, required: true },
  fechaPublicacion: { type: Date, default: Date.now }
});

export default mongoose.model('Mercado', mercadoSchema);
