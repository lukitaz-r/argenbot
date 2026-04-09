import Equipo from '../../models/Equipo.js';
import Mercado from '../../models/Mercado.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import formatNumber from '../../utils/formatNumber.js';

export default {
  name: 'mercado',
  aliases: ['market'],
  desc: 'Mercado de transferencias de cartas (ver, publicar, comprar)',
  run: async (client, message, args) => {
    const accion = args[0] ? args[0].toLowerCase() : null;

    if (!accion || !['ver', 'publicar', 'vender', 'comprar'].includes(accion)) {
      return message.reply(`❌ **Uso incorrecto!** Opciones válidas:
\`ar!mercado ver\` - Ver jugadores en venta
\`ar!mercado publicar <nombre> <precio>\` - Vender un jugador (alias: \`vender\`)
\`ar!mercado comprar <nombre>\` - Comprar el jugador más barato con ese nombre`);
    }

    if (accion === 'ver') {
      const enVenta = await Mercado.find({}).sort({ precio: 1 });
      if (enVenta.length === 0) {
        return message.reply('📉 **El mercado está vacío en este momento.**');
      }

      const elementosPorPagina = 10;
      let paginaActual = 0;
      const paginasTotal = Math.ceil(enVenta.length / elementosPorPagina);

      const crearEmbed = (pagina) => {
        const inicio = pagina * elementosPorPagina;
        const fin = inicio + elementosPorPagina;
        const lista = enVenta.slice(inicio, fin);

        const embed = new EmbedBuilder()
          .setColor(client.color)
          .setTitle('🏪 Mercado de Jugadores')
          .setDescription('Jugadores actualmente a la venta:')
          .setFooter({ text: `Página ${pagina + 1} de ${paginasTotal} | Total: ${enVenta.length} cartas` })
          .setTimestamp();

        let desc = '';
        lista.forEach((item, index) => {
          desc += `**${inicio + index + 1}. ${item.jugadorData.nombre}** (${item.jugadorData.tipo}) | ${item.jugadorData.media}\n`;
          desc += `💰 Precio: $GDS ${formatNumber(item.precio)} | 👤 Vendedor: ${item.vendedorUserN}\n\n`;
        });
        embed.setDescription(desc);

        return embed;
      };

      const crearBotones = (pagina) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('mercado_prev')
            .setLabel('◀️ Anterior')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina === 0),
          new ButtonBuilder()
            .setCustomId('mercado_next')
            .setLabel('Siguiente ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina === paginasTotal - 1)
        );
      };

      const msg = await message.reply({
        embeds: [crearEmbed(paginaActual)],
        components: paginasTotal > 1 ? [crearBotones(paginaActual)] : []
      });

      if (paginasTotal <= 1) return;

      const collector = msg.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 60000
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'mercado_prev') {
          paginaActual = Math.max(0, paginaActual - 1);
        } else if (i.customId === 'mercado_next') {
          paginaActual = Math.min(paginasTotal - 1, paginaActual + 1);
        }
        await i.update({
          embeds: [crearEmbed(paginaActual)],
          components: [crearBotones(paginaActual)]
        });
      });

      collector.on('end', async () => {
        try { await msg.edit({ components: [] }); } catch (e) { }
      });

    } else if (accion === 'publicar' || accion === 'vender') {
      const precioStr = args.pop();
      const precio = parseInt(precioStr);
      const nombreInput = args.slice(1).join(' ').trim().toLowerCase();

      if (!nombreInput || isNaN(precio) || precio <= 0) {
        return message.reply('❌ **Uso incorrecto!** Debe ser: `ar!mercado publicar <nombre_del_jugador> <precio>`\nEjemplo: `ar!mercado publicar tako 5000`');
      }

      const equipo = await Equipo.findOne({ userID: message.author.id });
      if (!equipo) return message.reply('❌ **No tenés un club registrado!**');
      if (!equipo.jugadores || Object.keys(equipo.jugadores).length === 0) {
        return message.reply('❌ **No tenés jugadores en tu reserva para vender!**');
      }

      // Buscar TODOS los jugadores que coincidan con el nombre
      const matches = [];
      for (const [key, jugador] of Object.entries(equipo.jugadores)) {
        if (jugador.nombre.toLowerCase() === nombreInput) {
          matches.push({ key, ...jugador });
        }
      }

      if (matches.length === 0) {
        return message.reply(`❌ **No tenés a "${nombreInput}" en tu reserva!**`);
      }

      const procesarVenta = async (jugadorKey, jugadorData, targetMsg = message) => {
        // Remover del equipo y poner en mercado
        const nuevaPublicacion = new Mercado({
          vendedorID: equipo.userID,
          vendedorUserN: equipo.userN,
          jugadorKey: jugadorKey,
          jugadorData: jugadorData,
          precio: precio
        });

        const equipoUpdate = await Equipo.findOne({ userID: message.author.id });
        if (!equipoUpdate || !equipoUpdate.jugadores[jugadorKey]) {
          return targetMsg.reply('❌ **Hubo un error al procesar la venta. El jugador ya no está en tu reserva.**');
        }

        delete equipoUpdate.jugadores[jugadorKey];
        equipoUpdate.markModified('jugadores');

        await nuevaPublicacion.save();
        await equipoUpdate.save();

        const successMsg = `✅ **Has publicado a ${jugadorData.nombre} (${jugadorData.tipo}) por $GDS ${formatNumber(precio)} en el mercado!**`;
        if (targetMsg === message) {
          return message.reply(successMsg);
        } else {
          return targetMsg.editReply({ content: successMsg, components: [], embeds: [] });
        }
      };

      if (matches.length === 1) {
        return procesarVenta(matches[0].key, matches[0]);
      } else {
        // Múltiples versiones encontradas
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('vender_select')
            .setPlaceholder('Seleccioná qué versión querés vender')
            .addOptions(matches.map(m => ({
              label: `${m.nombre} (${m.media})`,
              description: `${m.tipo} | Valor: $GDS ${formatNumber(m.valor)}`,
              value: m.key
            })))
        );

        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🤔 Múltiples versiones encontradas')
          .setDescription(`Tenés ${matches.length} versiones de **${matches[0].nombre}**. Seleccioná cuál querés poner a la venta por **$GDS ${formatNumber(precio)}**:`)
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
          await procesarVenta(seleccionadaKey, match, i);
        });

        collector.on('end', async (collected) => {
          if (collected.size === 0) {
            try { await msgMenu.edit({ content: '❌ **Tiempo agotado.** Venta cancelada.', components: [], embeds: [] }); } catch (e) {}
          }
        });
      }

    } else if (accion === 'comprar') {
      const nombreInput = args.slice(1).join(' ').trim().toLowerCase();

      if (!nombreInput) {
        return message.reply('❌ **Debes especificar el nombre del jugador que querés comprar!**\nUso: `ar!mercado comprar <nombre_del_jugador>`');
      }

      const comprador = await Equipo.findOne({ userID: message.author.id });
      if (!comprador) return message.reply('❌ **No tenés un club registrado!**');

      // Buscar todos los jugadores con ese nombre en el mercado
      const todasLasPublicaciones = await Mercado.find({}).sort({ precio: 1 });
      const matches = todasLasPublicaciones.filter(p => p.jugadorData.nombre.toLowerCase() === nombreInput);

      if (matches.length === 0) {
        return message.reply(`❌ **No hay ningún jugador llamado "${nombreInput}" en venta!**`);
      }

      const procesarCompra = async (publicacion, targetMsg = message) => {
        if (publicacion.vendedorID === message.author.id) {
          const errMsg = '❌ **No podés comprar tu propia publicación!** Para retirarla, este comando aún no lo soporta directamente, pedile a un admin o vende más barato.';
          return targetMsg === message ? message.reply(errMsg) : targetMsg.editReply({ content: errMsg, components: [], embeds: [] });
        }

        const compradorActualizado = await Equipo.findOne({ userID: message.author.id });
        if (compradorActualizado.dinero < publicacion.precio) {
          const errMsg = `❌ **No tenés suficientes Godeanos!** Cuesta $GDS ${formatNumber(publicacion.precio)} y vos tenés $GDS ${formatNumber(compradorActualizado.dinero)}.`;
          return targetMsg === message ? message.reply(errMsg) : targetMsg.editReply({ content: errMsg, components: [], embeds: [] });
        }

        if (compradorActualizado.jugadores && compradorActualizado.jugadores[publicacion.jugadorKey]) {
          const errMsg = `❌ **Ya tenés a ${publicacion.jugadorData.nombre} (${publicacion.jugadorData.tipo}) en tu reserva!**`;
          return targetMsg === message ? message.reply(errMsg) : targetMsg.editReply({ content: errMsg, components: [], embeds: [] });
        }

        const vendedor = await Equipo.findOne({ userID: publicacion.vendedorID });
        if (vendedor) {
          vendedor.dinero += publicacion.precio;
          await vendedor.save();
        }

        // Transferir carta e intercambiar dinero
        compradorActualizado.dinero -= publicacion.precio;
        if (!compradorActualizado.jugadores) compradorActualizado.jugadores = {};
        compradorActualizado.jugadores[publicacion.jugadorKey] = publicacion.jugadorData;
        compradorActualizado.markModified('jugadores');

        await Mercado.findByIdAndDelete(publicacion._id);
        await compradorActualizado.save();

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('🤝 ¡Traspaso Completado!')
          .setDescription(`Has comprado a **${publicacion.jugadorData.nombre}** por $GDS ${formatNumber(publicacion.precio)}.`)
          .addFields(
            { name: 'Vendedor', value: publicacion.vendedorUserN, inline: true },
            { name: 'Tipo', value: publicacion.jugadorData.tipo, inline: true },
            { name: 'Media', value: `${publicacion.jugadorData.media}`, inline: true }
          )
          .setFooter({ text: `Club: ${compradorActualizado.nombreEq} | Nuevo saldo: $GDS ${formatNumber(compradorActualizado.dinero)}` })
          .setTimestamp();

        if (targetMsg === message) {
          return message.reply({ embeds: [embed] });
        } else {
          return targetMsg.editReply({ embeds: [embed], components: [], content: null });
        }
      };

      if (matches.length === 1) {
        return procesarCompra(matches[0]);
      } else {
        // Múltiples opciones encontradas
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('comprar_select')
            .setPlaceholder('Elegí cuál querés comprar')
            .addOptions(matches.slice(0, 25).map(m => ({
              label: `${m.jugadorData.nombre} (${m.jugadorData.media}) - $GDS ${formatNumber(m.precio)}`,
              description: `Tipo: ${m.jugadorData.tipo} | Vendedor: ${m.vendedorUserN}`,
              value: m._id.toString()
            })))
        );

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('🛒 Múltiples ofertas encontradas')
          .setDescription(`Hay ${matches.length} publicaciones de **${matches[0].jugadorData.nombre}**. Seleccioná cuál querés comprar:`)
          .setFooter({ text: 'Tenés 30 segundos para elegir.' });

        const msgMenu = await message.reply({ embeds: [embed], components: [row] });

        const collector = msgMenu.createMessageComponentCollector({
          filter: (i) => i.user.id === message.author.id,
          time: 30000,
          max: 1
        });

        collector.on('collect', async (i) => {
          await i.deferUpdate();
          const publicacionId = i.values[0];
          const seleccionada = matches.find(m => m._id.toString() === publicacionId);
          if (!seleccionada) {
            return i.editReply({ content: '❌ **Error: Publicación no encontrada.** Puede que ya haya sido vendida.', components: [], embeds: [] });
          }
          await procesarCompra(seleccionada, i);
        });

        collector.on('end', async (collected) => {
          if (collected.size === 0) {
            try { await msgMenu.edit({ content: '❌ **Tiempo agotado.** Compra cancelada.', components: [], embeds: [] }); } catch (e) {}
          }
        });
      }
    }
  }
};
