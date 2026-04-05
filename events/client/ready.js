import mongoose from "mongoose";
import seedJugadores from "../../utils/seedJugadores.js";
import seedPacks from "../../utils/seedPacks.js";

export default {
  name: 'clientReady',
  once: true,
  run: async (client) => {
    try {
      await mongoose.connect(process.env.MONGO_DB);
      console.log(`☁ CONECTADO A LA BASE DE DATOS DE MONGODB`.green);

      // Seed de jugadores y packs
      await seedJugadores();
      await seedPacks();
    } catch (err) {
      console.log(`☁ ERROR AL CONECTAR A LA BASE DE DATOS DE MONGODB`.red);
      console.log(err);
    }

    console.log(`SESIÓN INICIADA COMO ${client.user.tag}`.green);
  }
}
