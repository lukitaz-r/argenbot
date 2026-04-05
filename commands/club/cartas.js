import Equipo from '../../models/Equipo.js';
import { EmbedBuilder } from 'discord.js';

export default {
  name: 'cartas',
  aliases: ['inventario', 'misjugadores', 'misticos', 'club'],
  desc: 'Ver todas tus cartas (en plantilla y en el club)',
  run: async (client, message, args) => {
    // Permitir ver las cartas de otro usuario
    const targetUser = message.mentions.users.first() || message.author;
    const equipo = await Equipo.findOne({ userID: targetUser.id });

    if (!equipo) {
      if (targetUser.id === message.author.id) {
        return message.reply('❌ **No tenés un club registrado!** Usá `ar!registro <nombre>` para crear uno.');
      } else {
        return message.reply(`❌ **${targetUser.username} no tiene un club registrado!**`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`🗂️ Cartas de ${equipo.nombreEq}`)
      .setDescription(`Listado completo de las cartas de ${targetUser.username}.`)
      .setTimestamp();

    // 1. Plantilla (los que están en el equipo, máximo 4 slots posibles)
    // El array 'equipo' tiene 4 elementos. Los placeholders no tienen 'nombre'.
    const enPlantilla = equipo.equipo.filter(j => j && j.nombre);
    
    let textoPlantilla = '';
    if (enPlantilla.length > 0) {
      // Recorremos el array original para mantener la posición real 1, 2, 3 o 4
      equipo.equipo.forEach((j, index) => {
        if (j && j.nombre) {
          textoPlantilla += `**Pos ${index + 1}:** ${j.nombre} — ⭐ ${j.media} [${j.tipo}]\n`;
        }
      });
    } else {
      textoPlantilla = '*No hay jugadores en la plantilla.*\n';
    }

    embed.addFields({ name: '⚽ En Plantilla', value: textoPlantilla });

    // 2. Reserva / Club
    const reserva = Object.values(equipo.jugadores || {});
    // Ordenar de mayor a menor media
    reserva.sort((a, b) => b.media - a.media);

    if (reserva.length > 0) {
      let lineasReserva = reserva.map(j => `▫️ **${j.nombre}** — ⭐ ${j.media} [${j.tipo}]`);
      let textoReserva = '';
      let cortado = false;
      let countMostrados = 0;
      
      for (const linea of lineasReserva) {
        // Limite de embed field value es 1024 caracteres
        if (textoReserva.length + linea.length + 50 > 1024) {
          cortado = true;
          break;
        }
        textoReserva += linea + '\n';
        countMostrados++;
      }
      
      if (cortado) {
        textoReserva += `*... y ${reserva.length - countMostrados} cartas más.*`;
      }

      embed.addFields({ name: `📦 En el Club / Reserva (${reserva.length})`, value: textoReserva });
    } else {
      embed.addFields({ name: '📦 En el Club / Reserva (0)', value: '*No tenés jugadores extra en el club.*' });
    }

    message.reply({ embeds: [embed] });
  }
};
