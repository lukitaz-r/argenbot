import Equipo from '../../models/Equipo.js';
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import formatNumber from '../../utils/formatNumber.js';

export default {
  name: 'descartar',
  aliases: ['vender'],
  desc: 'Descarta un jugador de tu club (reserva) por el 50% de su valor',
  run: async (client, message, args) => {
    const inputNombre = args.join(' ').trim().toLowerCase();

    if (!inputNombre) {
      return message.reply('❌ **Debes especificar el nombre del jugador que quieres descartar!**\nUso: `ar!descartar <nombre_del_jugador>`');
    }

    const equipo = await Equipo.findOne({ userID: message.author.id });

    if (!equipo) {
      return message.reply('❌ **No tenés un club registrado!** Usá `ar!registro <nombre>` para crear uno.');
    }

    if (!equipo.jugadores || Object.keys(equipo.jugadores).length === 0) {
      return message.reply('❌ **No tenés jugadores en tu reserva para descartar!**');
    }

    // Buscar TODOS los jugadores que coincidan con el nombre
    const matches = [];
    for (const [key, jugador] of Object.entries(equipo.jugadores)) {
      if (jugador.nombre.toLowerCase() === inputNombre) {
        matches.push({ key, ...jugador });
      }
    }

    if (matches.length === 0) {
      return message.reply(`❌ **No tenés ningún jugador llamado "${inputNombre}" en tu reserva!**`);
    }

    const procesarDescarte = async (jugadorKey, jugadorData, targetMsg = message) => {
      // Recargar equipo por si hubo cambios concurrentes
      const equipoUpdate = await Equipo.findOne({ userID: message.author.id });
      if (!equipoUpdate || !equipoUpdate.jugadores[jugadorKey]) {
        return targetMsg.reply('❌ **Hubo un error al procesar el descarte. El jugador ya no está en tu reserva.**');
      }

      // Calcular compensación
      const compensacion = Math.floor(jugadorData.valor / 2);

      // Eliminar jugador y dar dinero
      delete equipoUpdate.jugadores[jugadorKey];
      equipoUpdate.markModified('jugadores');
      equipoUpdate.dinero += compensacion;

      await equipoUpdate.save();

      const embed = new EmbedBuilder()
        .setColor('#ff4a4a')
        .setTitle('🗑️ Jugador Descartado')
        .setDescription(`Has descartado a **${jugadorData.nombre}** (${jugadorData.tipo}) de tu club.`)
        .addFields(
          { name: '💰 Valor original', value: `$GDS ${formatNumber(jugadorData.valor)}`, inline: true },
          { name: '💵 Godeanos obtenidos', value: `+$GDS ${formatNumber(compensacion)}`, inline: true }
        )
        .setFooter({ text: `Club: ${equipoUpdate.nombreEq} | Nuevo saldo: $GDS ${formatNumber(equipoUpdate.dinero)}` })
        .setTimestamp();

      if (targetMsg === message) {
        return message.reply({ embeds: [embed] });
      } else {
        return targetMsg.editReply({ embeds: [embed], components: [], content: null });
      }
    };

    if (matches.length === 1) {
      return procesarDescarte(matches[0].key, matches[0]);
    } else {
      // Múltiples versiones encontradas
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('descartar_select')
          .setPlaceholder('Seleccioná qué versión querés descartar')
          .addOptions(matches.map(m => ({
            label: `${m.nombre} (${m.media})`,
            description: `${m.tipo} | Valor: $GDS ${formatNumber(m.valor)}`,
            value: m.key
          })))
      );

      const embed = new EmbedBuilder()
        .setColor('#ff4a4a')
        .setTitle('🤔 Múltiples versiones encontradas')
        .setDescription(`Tenés ${matches.length} versiones de **${matches[0].nombre}**. Seleccioná cuál querés descartar por el 50% de su valor:`)
        .setFooter({ text: 'Tenés 30 segundos para elegir.' });

      const msgMenu = await message.reply({ embeds: [embed], components: [row] });

      const collector = msgMenu.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 30000,
        max: 1
      });

      collector.on('collect', async (i) => {
        await i.deferUpdate();
        const seleccionadaKey = i.values[0];
        const match = matches.find(m => m.key === seleccionadaKey);
        await procesarDescarte(seleccionadaKey, match, i);
      });

      collector.on('end', async (collected) => {
        if (collected.size === 0) {
          try { await msgMenu.edit({ content: '❌ **Tiempo agotado.** Descarte cancelado.', components: [], embeds: [] }); } catch (e) {}
        }
      });
    }
  }
};
