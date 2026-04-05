import Equipo from '../../models/Equipo.js';
import { EmbedBuilder } from 'discord.js';
import { calcularMedia, plantillaCompleta } from '../../utils/calcularMedia.js';

export default {
  name: 'media',
  aliases: ['overall', 'ovr'],
  desc: 'Ver la media (overall) de tu plantilla',
  run: async (client, message) => {
    const equipo = await Equipo.findOne({ userID: message.author.id });

    if (!equipo) {
      return message.reply('❌ **No tenés un club registrado!** Usá `ar!registro <nombre>` para crear uno.');
    }

    const completa = plantillaCompleta(equipo.equipo);
    const media = calcularMedia(equipo.equipo);

    const embed = new EmbedBuilder()
      .setColor(client.color)
      .setTitle(`📊 Media de ${equipo.nombreEq}`)
      .setFooter({ text: `Club de ${message.author.username}` })
      .setTimestamp();

    // Construir la lista de jugadores con su media
    let desc = '';
    equipo.equipo.forEach((slot, i) => {
      if (slot && slot.nombre && slot.media != null) {
        desc += `**Pos ${i + 1}:** ${slot.nombre} — ⭐ **${slot.media}**\n`;
      } else {
        desc += `**Pos ${i + 1}:** ❌ *Vacía*\n`;
      }
    });

    desc += '\n───────────────────\n';

    if (media !== null) {
      // Emoji según rango de media
      let mediaEmoji = '⚪';
      if (media >= 90) mediaEmoji = '🔴';
      else if (media >= 85) mediaEmoji = '🟡';
      else if (media >= 80) mediaEmoji = '🟢';
      else if (media >= 75) mediaEmoji = '🔵';

      desc += `${mediaEmoji} **Media Total: ${media}**\n`;
    } else {
      desc += '❌ **No tenés jugadores en la plantilla.**\n';
    }

    if (!completa) {
      desc += '\n⚠️ *Tu plantilla no está completa. Necesitás 4 jugadores en campo para duelear.*';
    } else {
      desc += '\n✅ *Plantilla completa. ¡Listo para duelear!*';
    }

    embed.setDescription(desc);

    return message.reply({ embeds: [embed] });
  }
};
