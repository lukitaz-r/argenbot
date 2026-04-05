import Equipo from '../../models/Equipo.js';
import Pack from '../../models/Pack.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import formatNumber from '../../utils/formatNumber.js';

export default {
  name: 'tienda',
  aliases: ['shop', 'store'],
  desc: 'Compra nuevos packs para tu club',
  run: async (client, message) => {
    // Buscar equipo (necesitamos saldo)
    let equipo = await Equipo.findOne({ userID: message.author.id });

    if (!equipo) {
      return message.reply('❌ **No tenés un club registrado!** Usá `ar!registro <nombre>` para crear uno.');
    }

    const packsDB = await Pack.find({}).lean();

    if (!packsDB || packsDB.length === 0) {
      return message.reply('❌ **No hay packs disponibles en la tienda en este momento.**');
    }

    let paginaActual = 0;

    const crearEmbed = (index) => {
      const pack = packsDB[index];
      const precioTexto = pack.valor === 0 ? 'Gratis' : `$GDS ${formatNumber(pack.valor)}`;

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`🛒 Tienda | ${pack.nombre}`)
        .setDescription(`**${pack.desc || 'Sin descripción'}**\n\n💵 **Tu saldo actual:** $GDS ${formatNumber(equipo.dinero)}`)
        .addFields(
          { name: '🏷️ Tipo', value: pack.tipo || 'N/A', inline: true },
          { name: '💰 Precio', value: precioTexto, inline: true }
        )
        .setFooter({ text: `Pack ${index + 1} de ${packsDB.length} | Club de ${message.author.username}` })
        .setTimestamp();

      // Usar URL CDN directamente si disponible
      if (pack.dir && pack.dir.startsWith('http')) {
        embed.setImage(pack.dir);
      }

      return embed;
    };

    const crearBotones = (index) => {
      const pack = packsDB[index];
      const disableBuy = equipo.dinero < pack.valor;
      const labelCompra = pack.valor === 0 ? 'Obtener Gratis' : `Comprar ($GDS ${formatNumber(pack.valor)})`;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('tienda_prev')
          .setLabel('◀️ Anterior')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(index === 0),
        new ButtonBuilder()
          .setCustomId(`comprar_${index}`)
          .setLabel(labelCompra)
          .setStyle(disableBuy ? ButtonStyle.Danger : ButtonStyle.Success)
          .setDisabled(disableBuy),
        new ButtonBuilder()
          .setCustomId('tienda_next')
          .setLabel('Siguiente ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(index === packsDB.length - 1)
      );
      return row;
    };

    const msg = await message.reply({
      embeds: [crearEmbed(paginaActual)],
      components: [crearBotones(paginaActual)]
    });

    const collector = msg.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 240000
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'tienda_prev') {
        paginaActual = Math.max(0, paginaActual - 1);
        await interaction.update({
          embeds: [crearEmbed(paginaActual)],
          components: [crearBotones(paginaActual)]
        });
      } else if (interaction.customId === 'tienda_next') {
        paginaActual = Math.min(packsDB.length - 1, paginaActual + 1);
        await interaction.update({
          embeds: [crearEmbed(paginaActual)],
          components: [crearBotones(paginaActual)]
        });
      } else if (interaction.customId.startsWith('comprar_')) {
        await interaction.deferUpdate();

        const indexPack = parseInt(interaction.customId.split('_')[1]);
        const packSeleccionado = packsDB[indexPack];

        // Refrescar saldo del usuario por si hizo compras múltiples
        equipo = await Equipo.findOne({ userID: message.author.id });

        if (equipo.dinero < packSeleccionado.valor) {
          return interaction.followUp({
            content: `❌ **No tenés suficientes Godeanos!**\nNecesitás **$GDS ${formatNumber(packSeleccionado.valor)}** y tenés **$GDS ${formatNumber(equipo.dinero)}**.`,
            flags: 64 // 64 = Ephemeral
          });
        }

        // Aplicar la compra
        equipo.dinero -= packSeleccionado.valor;
        const nuevoPackParaInventario = {
          nombre: packSeleccionado.nombre,
          tipo: packSeleccionado.tipo,
          valor: packSeleccionado.valor,
          desc: packSeleccionado.desc
        };

        equipo.packs_dis.push(nuevoPackParaInventario);
        await equipo.save();

        const embedCompra = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ ¡Compra Exitosa!')
          .setDescription(`Compraste el pack **${packSeleccionado.nombre}**.\nTu saldo restante es de **$GDS ${formatNumber(equipo.dinero)}**.`)
          .setFooter({ text: '¿Qué querés hacer con tu nuevo pack?' });

        // Usar URL CDN directamente
        if (packSeleccionado.dir && packSeleccionado.dir.startsWith('http')) {
          embedCompra.setImage(packSeleccionado.dir);
        }

        const btnAbrir = new ButtonBuilder()
          .setCustomId(`abririnstante_${packSeleccionado.nombre}`)
          .setLabel('Abrir al instante')
          .setStyle(ButtonStyle.Success);

        const btnVolver = new ButtonBuilder()
          .setCustomId('volver_tienda')
          .setLabel('Volver a la Tienda')
          .setStyle(ButtonStyle.Secondary);

        const rowBotones = new ActionRowBuilder().addComponents(btnAbrir, btnVolver);

        await interaction.editReply({
          embeds: [embedCompra],
          components: [rowBotones]
        });

      } else if (interaction.customId === 'volver_tienda') {
        await interaction.deferUpdate();
        // Tuvimos que re-consultar el saldo antes
        equipo = await Equipo.findOne({ userID: message.author.id });
        await interaction.editReply({
          embeds: [crearEmbed(paginaActual)],
          components: [crearBotones(paginaActual)]
        });

      } else if (interaction.customId.startsWith('abririnstante_')) {
        await interaction.deferUpdate();
        const packName = interaction.customId.replace('abririnstante_', '');
        
        const canjearCmd = client.commands.get('canjear') || client.commands.find(c => c.aliases && c.aliases.includes('canjear'));
        
        if (canjearCmd) {
          const fakeMessage = {
            author: interaction.user,
            reply: async (opts) => interaction.editReply({ ...opts, components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('volver_tienda')
                  .setLabel('Volver a la Tienda')
                  .setStyle(ButtonStyle.Secondary)
              )
            ] })
          };
          await canjearCmd.run(client, fakeMessage, [packName]);
        } else {
           await interaction.editReply({ 
             content: `✅ El pack ha sido guardado. Usá \`ar!canjear ${packName}\` para abrirlo!`,
             components: [
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setCustomId('volver_tienda')
                    .setLabel('Volver a la Tienda')
                    .setStyle(ButtonStyle.Secondary)
                )
             ], embeds: []
           });
        }
      }
    });

    collector.on('end', async () => {
      try {
        await msg.edit({ components: [] }); // Eliminar botones principales cuando caduque
      } catch (e) { /* expirado */ }
    });
  }
}
