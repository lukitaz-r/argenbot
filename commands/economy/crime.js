import Equipo from '../../models/Equipo.js';
import { EmbedBuilder } from 'discord.js';
import formatNumber from '../../utils/formatNumber.js';

const crimeMessages = [
  (amount) => `Le robaste guita a los viejos de Trollface. Ganas **$GDS ${amount}**`,
  (amount) => `Votaste al kirchnerismo. Ganas **$GDS ${amount}** y un chori.`,
  (amount) => `Robaste un diamante de una joyería pero se te rompió mientras escapabas de la policia. Vendiste los restos por **$GDS ${amount}**`,
  (amount) => `Cagaste a un chabon en Facebook marketplace. Ganas **$GDS ${amount}**`,
  (amount) => `Le afanaste a una gorda. Ganas **$GDS ${amount}**`,
  (amount) => `Le pediste plata 4 veces a tu abuelo con Alzheimer. Ganas **$GDS ${amount}**`,
  (amount) => `Asaltaste a pablito. Ganas **$GDS ${amount}**`,
  (amount) => `Le robaste la garrafa a tu amigo. Ganas **$GDS ${amount}**`,
  (amount) => `Le robaste la cartera a una jubilada. Ganas **$GDS ${amount}**`,
  (amount) => `Robaste quesos cremosos del mini carrefour. Ganas **$GDS ${amount}**`,
  (amount) => `Te robaste el celular a Alex. Ganas **$GDS ${amount}**`,
  (amount) => `Todos se durmiero en la fiesta y aprovechaste para afanarte el Budokai Tenkaichi 3. Lo vendiste por **$GDS ${amount}**`,
  (amount) => `Viste a skarff haciendo "cosas". Te pago **$GDS ${amount}** para que no lo mandes en cana.`,
  (amount) => `Hiciste collab con una casa de apuestas. Ganas **$GDS ${amount}**`,
  (amount) => `Hiciste una estafa piramidal. Ganas **$GDS ${amount}**`,
];

export default {
  name: 'crime',
  aliases: ['crimen', 'robar'],
  desc: 'Cometé un crimen para ganar Godeanos (25% éxito. Gancia alta, pero podés perder dinero si te atrapan)',
  run: async (client, message, args) => {
    const equipo = await Equipo.findOne({ userID: message.author.id });

    if (!equipo) {
      return message.reply('❌ **No tenés un club registrado!** Usá `ar!registro <nombre>` para crear uno.');
    }

    const now = message.createdTimestamp;
    const cooldownAmount = 2 * 60 * 60 * 1000; // 2 hours in ms

    if (equipo.ultimoCrime && (now - equipo.ultimoCrime.getTime()) < cooldownAmount) {
      const timeLeft = cooldownAmount - (now - equipo.ultimoCrime.getTime());
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      return message.reply(`⏳ **La policía te está buscando!** Escondete. Podés volver a cometer un crimen en **${hours}h ${minutes}m**.`);
    }

    equipo.ultimoCrime = now;

    // Probabilidad de éxito: 25%
    const exito = Math.random() < 0.25;

    if (exito) {
      // Recompensa alta: entre 10000 y 35000
      const recompensa = Math.floor(Math.random() * (35000 - 10000 + 1)) + 10000;
      equipo.dinero += recompensa;
      await equipo.save();

      const msg = crimeMessages[Math.floor(Math.random() * crimeMessages.length)](formatNumber(recompensa));

      const embedExito = new EmbedBuilder()
        .setColor('#FF00FF') // Violeta
        .setTitle('🕵️‍♂️ ¡Golpe Perfecto!')
        .setDescription(`${msg}\n\n💵 **Nuevo saldo:** $GDS ${formatNumber(equipo.dinero)}`)
        .setTimestamp();

      return message.reply({ embeds: [embedExito] });
    } else {
      // Castigo si falla: perder entre 2500 y 5000
      const perdida = Math.floor(Math.random() * (5000 - 2500 + 1)) + 2500;
      
      // Evitar saldos negativos
      const perdidaReal = Math.min(equipo.dinero, perdida);
      equipo.dinero -= perdidaReal;
      await equipo.save();

      const embedFallo = new EmbedBuilder()
        .setColor('#FF0000') // Rojo
        .setTitle('🚨 ¡Te atraparon!')
        .setDescription(`La policía te descubrió en medio del acto. Tuviste que pagar una fianza de **$GDS ${formatNumber(perdidaReal)}**.\n\n💵 **Nuevo saldo:** $GDS ${formatNumber(equipo.dinero)}`)
        .setTimestamp();

      return message.reply({ embeds: [embedFallo] });
    }
  }
};
