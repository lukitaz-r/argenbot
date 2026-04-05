import Equipo from '../../models/Equipo.js';
import { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } from 'discord.js';
import nodeHtmlToImage from 'node-html-to-image';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import formatNumber from '../../utils/formatNumber.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/lukitaz-r/assets@main/argenbot';

/**
 * Obtiene la URL de la imagen de una carta.
 * Prioriza CDN URL; si es ruta local, intenta convertir a CDN.
 */
function obtenerImagenUrl(dir) {
  if (!dir) return null;

  // Si ya es una URL CDN, usarla directamente
  if (dir.startsWith('http')) return dir;

  // Intentar convertir ruta local a URL CDN
  // assets/cartas/normales/Aztro_b64.js → cartas/normales/Aztro.png
  let cdnPath = dir
    .replace(/\\/g, '/')
    .replace(/^assets\//, '')
    .replace(/_b64\.js$/, '.png');

  return `${CDN_BASE}/${encodeURI(cdnPath)}`;
}

/**
 * Obtiene la URL del placeholder desde CDN
 */
function obtenerPlaceholderUrl() {
  return `${CDN_BASE}/cartas/placeholder.png`;
}

/**
 * Obtiene la URL del fondo desde CDN o desde fondo.json
 */
function obtenerFondoUrl() {
  const fondoJsonPath = join(rootDir, 'assets', 'fondo.json');
  if (existsSync(fondoJsonPath)) {
    try {
      const fondoMap = JSON.parse(readFileSync(fondoJsonPath, 'utf-8'));
      if (fondoMap['background.png']) return fondoMap['background.png'];
    } catch { /* fallback */ }
  }
  return `${CDN_BASE}/fondo/background.png`;
}

// Posiciones absolutas de las 5 cartas (x, y)
const POSICIONES_CARTAS = [
  { x: 228, y: 0 },
  { x: 366, y: 0 },
  { x: 104, y: 93 },
  { x: 288, y: 185 },
  { x: 490, y: 93 }
];

async function generarImagenPlantilla(equipo) {
  const placeholderUrl = obtenerPlaceholderUrl();
  const fondoUrl = obtenerFondoUrl();

  const cartasHtml = equipo.equipo.map((slot, i) => {
    let imgSrc;
    if (slot.nombre && slot.dir) {
      imgSrc = obtenerImagenUrl(slot.dir) || placeholderUrl;
    } else {
      imgSrc = placeholderUrl;
    }

    const pos = POSICIONES_CARTAS[i];

    return `
      <div class="carta" style="left: ${pos.x}px; top: ${pos.y}px;">
        <img src="${imgSrc}" />
      </div>
    `;
  }).join('');

  const html = `
    <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 0;
          width: 700px;
          height: 357px;
          background: transparent;
        }
        .container {
          width: 700px;
          height: 357px;
          position: relative;
        }
        .carta {
          position: absolute;
        }
        .carta img {
          width: 120px;
          height: 168px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="${fondoUrl}" style="width: 700px; height: 357px;" />
        ${cartasHtml}
      </div>
    </body>
    </html>
  `;

  const image = await nodeHtmlToImage({
    html,
    quality: 100,
    type: 'png',
    transparent: true,
    puppeteerArgs: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  return image;
}

export default {
  name: 'plantilla',
  aliases: ['equipo', 'squad', 'team'],
  desc: 'Ver tu plantilla y cambiar jugadores en las posiciones',
  run: async (client, message) => {
    const equipo = await Equipo.findOne({ userID: message.author.id });

    if (!equipo) {
      return message.reply('❌ **No tenés un club registrado!** Usá `ar!registro <nombre>` para crear uno.');
    }

    await message.channel.sendTyping();

    // Asegurar que el equipo tenga 5 slots
    while (equipo.equipo.length < 5) {
      equipo.equipo.push({
        nombre: undefined,
        tipo: undefined,
        dir: 'https://cdn.jsdelivr.net/gh/lukitaz-r/assets@main/argenbot/cartas/placeholder.png',
        media: undefined,
        valor: undefined
      });
    }

    // Generar imagen de la plantilla
    const imageBuffer = await generarImagenPlantilla(equipo);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'plantilla.png' });

    // Crear botones para cada posición
    const row = new ActionRowBuilder();
    for (let i = 0; i < 5; i++) {
        const slot = equipo.equipo[i];
        const label = (slot && slot.nombre) ? slot.nombre : `Pos ${i + 1}`;
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`pos_${i + 1}`)
            .setLabel(label)
            .setStyle(ButtonStyle.Primary)
        );
    }

    const embed = new EmbedBuilder()
      .setColor(client.color)
      .setTitle(`⚽ Plantilla de ${equipo.nombreEq}`)
      .setDescription('Presioná un botón de posición para cambiar el jugador en esa posición.')
      .setFooter({ text: `Club de ${message.author.username}` })
      .setTimestamp();

    const msg = await message.reply({
      embeds: [embed],
      files: [attachment],
      components: [row]
    });

    const collector = msg.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 120000
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId.startsWith('pos_')) {
        const posicion = parseInt(interaction.customId.split('_')[1]) - 1;

        // Obtener jugadores disponibles en la reserva
        const jugadoresReserva = Object.entries(equipo.jugadores || {});

        if (jugadoresReserva.length === 0) {
          return interaction.reply({
            content: '❌ **No tenés jugadores en la reserva!** Abrí packs con `ar!canjear <pack>` para obtener jugadores.',
            ephemeral: true
          });
        }

        const opciones = jugadoresReserva.slice(0, 25).map(([key, j]) => ({
          label: `${j.nombre} (${j.media})`,
          description: `${j.tipo} | Valor: $GDS ${formatNumber(j.valor)}`,
          value: key
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_pos_${posicion}`)
          .setPlaceholder(`Elegí un jugador para la posición ${posicion + 1}`)
          .addOptions(opciones);

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
          content: `👥 **Seleccioná un jugador para la posición ${posicion + 1}:**`,
          components: [selectRow],
          ephemeral: true
        });

        // Collector para el select menu
        const selectCollector = interaction.channel.createMessageComponentCollector({
          filter: (i) => i.user.id === message.author.id && i.customId === `select_pos_${posicion}`,
          time: 30000,
          max: 1
        });

        selectCollector.on('collect', async (selectInteraction) => {
          await selectInteraction.deferUpdate();

          const jugadorKey = selectInteraction.values[0];
          const jugadorSeleccionado = equipo.jugadores[jugadorKey];

          if (!jugadorSeleccionado) {
            return selectInteraction.editReply({
              content: '❌ **Jugador no encontrado!**',
              components: []
            });
          }

          // Verificar si ya existe un jugador con el mismo nombre en OTRA posición de la plantilla
          if (equipo.equipo.some((slot, index) => index !== posicion && slot.nombre === jugadorSeleccionado.nombre)) {
            return selectInteraction.editReply({
              content: `❌ **No podés tener a ${jugadorSeleccionado.nombre} más de una vez en tu plantilla**`,
              components: []
            });
          }

          // Si la posición actual tiene un jugador (no placeholder), devolverlo a la reserva
          const jugadorActual = equipo.equipo[posicion];
          if (jugadorActual && jugadorActual.nombre) {
            const keyActual = `${jugadorActual.nombre}_${jugadorActual.tipo}`.replace(/[.\s]/g, '_');
            equipo.jugadores[keyActual] = { ...jugadorActual };
          }

          // Poner el nuevo jugador en la posición
          equipo.equipo[posicion] = {
            nombre: jugadorSeleccionado.nombre,
            tipo: jugadorSeleccionado.tipo,
            dir: jugadorSeleccionado.dir,
            media: jugadorSeleccionado.media,
            valor: jugadorSeleccionado.valor
          };

          // Eliminar de la reserva
          delete equipo.jugadores[jugadorKey];

          equipo.markModified('jugadores');
          equipo.markModified('equipo');
          await equipo.save();

          // Regenerar imagen
          const newImageBuffer = await generarImagenPlantilla(equipo);
          const newAttachment = new AttachmentBuilder(newImageBuffer, { name: 'plantilla.png' });

          const newEmbed = new EmbedBuilder()
            .setColor(client.color)
            .setTitle(`⚽ Plantilla de ${equipo.nombreEq}`)
            .setDescription(`✅ **${jugadorSeleccionado.nombre}** fue colocado en la posición ${posicion + 1}!`)
            .setFooter({ text: `Club de ${message.author.username}` })
            .setTimestamp();

          // Regenerar fila de botones de posiciones
          const newRow = new ActionRowBuilder();
          for (let i = 0; i < 5; i++) {
            const slot = equipo.equipo[i];
            const label = (slot && slot.nombre) ? slot.nombre : `Pos ${i + 1}`;
            newRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`pos_${i + 1}`)
                .setLabel(label)
                .setStyle(ButtonStyle.Primary)
            );
          }

          await selectInteraction.editReply({
            content: `✅ **${jugadorSeleccionado.nombre}** colocado en posición ${posicion + 1}!`,
            components: []
          });

          await msg.edit({
            embeds: [newEmbed],
            files: [newAttachment],
            components: [newRow]
          });
        });

        selectCollector.on('end', async (collected) => {
          if (collected.size === 0) {
            try {
              await interaction.editReply({
                content: '⏰ **Tiempo agotado!** No seleccionaste ningún jugador.',
                components: []
              });
            } catch (e) { /* ya expiró */ }
          }
        });
      }
    });

    collector.on('end', async () => {
      try {
        await msg.edit({ components: [] });
      } catch (e) { /* mensaje eliminado */ }
    });
  }
}
