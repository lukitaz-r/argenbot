import Equipo from '../../models/Equipo.js';
import { EmbedBuilder } from 'discord.js';
import formatNumber from '../../utils/formatNumber.js';

const slutMessages = [
  (amount) => `Te compraron el onlyfans. Ganas **$GDS ${amount}**`,
  (amount) => `Se la chupaste a un patagonico. Ganas **$GDS ${amount}**`,
  (amount) => `Cogiste con un enano. Ganas **$GDS ${amount}**`,
  (amount) => `Cogiste con un Chileno. Ganas **$GDS ${amount}**`,
  (amount) => `Le chupaste el pilin a Licha. Ganas **$GDS ${amount}**`,
  (amount) => `Le hiciste un anashex a Tadeo. Ganas **$GDS ${amount}**`,
  (amount) => `Te grabaron para un video casero. Ganas **$GDS ${amount}**`,
  (amount) => `Cogiste con un gordo. Ganas **$GDS ${amount}**`,
  (amount) => `Te compraron servicios en el parque de palermo. Ganas **$GDS ${amount}**`,
  (amount) => `Le tocaste el hombro a pardox y eyaculo. Te pago para que no se lo cuentes a nadie. Ganas **$GDS ${amount}**`,
  (amount) => `Le chupaste la pija al admin. Ganas **$GDS ${amount}**`,
  (amount) => `Hiciste cosplay de black souls para sanity. Ganas **$GDS ${amount}**`,
  (amount) => `Hablaste con Skarff. Ganas **$GDS ${amount}**`,
  (amount) => `Te invitaron a pasar la noche en el clu de magia. Ganas **$GDS ${amount}**`,
  (amount) => `Le hiciste una bajita a un down. Ganas **$GDS ${amount}**`,
  (amount) => `Subiste una foto en orto a ig y te pasaron plata. Ganas **$GDS ${amount}**`,
];

export default {
  name: 'slut',
  aliases: ['prostituirse'],
  desc: 'Vendé tu cuerpo para ganar Godeanos (50% de éxito, ganancia media)',
  run: async (client, message, args) => {
    const equipo = await Equipo.findOne({ userID: message.author.id });

    if (!equipo) {
      return message.reply('❌ **No tenés un club registrado!** Usá `ar!registro <nombre>` para crear uno.');
    }

    const now = message.createdTimestamp;
    const cooldownAmount = 1 * 60 * 60 * 1000; // 1 hour in ms

    if (equipo.ultimoSlut && (now - equipo.ultimoSlut.getTime()) < cooldownAmount) {
      const timeLeft = cooldownAmount - (now - equipo.ultimoSlut.getTime());
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      return message.reply(`⏳ **Aún te duele la cadera!** Podés volver a venderte en **${hours}h ${minutes}m**.`);
    }

    equipo.ultimoSlut = now;

    // Probabilidad de éxito: 50%
    const exito = Math.random() < 0.50;

    if (exito) {
      // Recompensa entre 10000 y 20000
      const recompensa = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
      equipo.dinero += recompensa;
      await equipo.save();

      const msg = slutMessages[Math.floor(Math.random() * slutMessages.length)](formatNumber(recompensa));

      const embedExito = new EmbedBuilder()
        .setColor('#FF69B4') // Rosa
        .setTitle('💋 ¡Noche exitosa!')
        .setDescription(`${msg}\n\n💵 **Nuevo saldo:** $GDS ${formatNumber(equipo.dinero)}`)
        .setTimestamp();

      return message.reply({ embeds: [embedExito] });
    } else {
      await equipo.save();

      const embedFallo = new EmbedBuilder()
        .setColor('#808080') // Gris
        .setTitle('🚶‍♂️ Noche fría')
        .setDescription(`Nadie te prestó atención hoy. No ganaste ni perdiste nada.\n\n💵 **Tu saldo se mantiene en:** $GDS ${formatNumber(equipo.dinero)}`)
        .setTimestamp();

      return message.reply({ embeds: [embedFallo] });
    }
  }
};
