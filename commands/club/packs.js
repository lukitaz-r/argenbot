import Equipo from '../../models/Equipo.js';
import Pack from '../../models/Pack.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import formatNumber from '../../utils/formatNumber.js';

export default {
  name: 'packs',
  aliases: ['mispacks', 'sobres'],
  desc: 'Ver los packs disponibles en tu club',
  run: async (client, message) => {
    const equipo = await Equipo.findOne({ userID: message.author.id });

    if (!equipo) {
      return message.reply('❌ **No tenés un club registrado!** Usá `ar!registro <nombre>` para crear uno.');
    }

    if (!equipo.packs_dis || equipo.packs_dis.length === 0) {
      return message.reply('📦 **No tenés packs disponibles en tu club!**');
    }

    // Agrupar packs por nombre
    const packsAgrupados = {};
    for (const pack of equipo.packs_dis) {
      if (!packsAgrupados[pack.nombre]) {
        packsAgrupados[pack.nombre] = { ...pack, cantidad: 1 };
      } else {
        packsAgrupados[pack.nombre].cantidad++;
      }
    }

    const packsArray = Object.values(packsAgrupados);
    let paginaActual = 0;

    // Obtener la URL CDN de la imagen del pack desde la BD
    async function obtenerImagenUrl(nombrePack) {
      const packDB = await Pack.findOne({ nombre: nombrePack });
      if (packDB && packDB.dir && packDB.dir.startsWith('http')) {
        return packDB.dir;
      }
      return null;
    }

    const crearEmbed = (index, imageUrl) => {
      const pack = packsArray[index];
      const titulo = pack.cantidad > 1
        ? `📦 ${pack.nombre} x${pack.cantidad}`
        : `📦 ${pack.nombre}`;

      const embed = new EmbedBuilder()
        .setColor(client.color)
        .setTitle(titulo)
        .setDescription(pack.desc || 'Sin descripción')
        .addFields(
          { name: '🏷️ Tipo', value: pack.tipo || 'N/A', inline: true },
          { name: '💰 Valor', value: `$GDS ${formatNumber(pack.valor || 0)}`, inline: true }
        )
        .setFooter({ text: `Pack ${index + 1} de ${packsArray.length} | Club: ${equipo.nombreEq}` })
        .setTimestamp();

      if (imageUrl) {
        embed.setImage(imageUrl);
      }

      return embed;
    };

    const crearBotones = (index) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('packs_prev')
          .setLabel('◀️ Anterior')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(index === 0),
        new ButtonBuilder()
          .setCustomId('packs_next')
          .setLabel('Siguiente ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(index === packsArray.length - 1)
      );
      return row;
    };

    const imageUrl = await obtenerImagenUrl(packsArray[paginaActual].nombre);

    const msg = await message.reply({
      embeds: [crearEmbed(paginaActual, imageUrl)],
      components: packsArray.length > 1 ? [crearBotones(paginaActual)] : []
    });

    if (packsArray.length <= 1) return;

    const collector = msg.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 60000
    });

    collector.on('collect', async (i) => {
      if (i.customId === 'packs_prev') {
        paginaActual = Math.max(0, paginaActual - 1);
      } else if (i.customId === 'packs_next') {
        paginaActual = Math.min(packsArray.length - 1, paginaActual + 1);
      }

      const newImageUrl = await obtenerImagenUrl(packsArray[paginaActual].nombre);

      await i.update({
        embeds: [crearEmbed(paginaActual, newImageUrl)],
        components: [crearBotones(paginaActual)]
      });
    });

    collector.on('end', async () => {
      try {
        await msg.edit({ components: [] });
      } catch (e) { /* mensaje eliminado */ }
    });
  }
}
