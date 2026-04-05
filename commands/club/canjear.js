import Equipo from '../../models/Equipo.js';
import Jugador from '../../models/Jugador.js';
import { EmbedBuilder } from 'discord.js';
import formatNumber from '../../utils/formatNumber.js';

export default {
  name: 'canjear',
  aliases: ['abrir', 'open'],
  desc: 'Canjea un pack disponible en tu club y obtené un jugador',
  run: async (client, message, args) => {
    const nombrePack = args.join(' ').trim();

    if (!nombrePack) {
      return message.reply('❌ **Debes especificar el nombre del pack!**\nUso: `ar!canjear <nombre del pack>`');
    }

    const equipo = await Equipo.findOne({ userID: message.author.id });

    if (!equipo) {
      return message.reply('❌ **No tenés un club registrado!** Usá `ar!registro <nombre>` para crear uno.');
    }

    // Buscar el pack en los packs disponibles del usuario
    const packIndex = equipo.packs_dis.findIndex(
      p => p.nombre.toLowerCase() === nombrePack.toLowerCase()
    );

    if (packIndex === -1) {
      return message.reply(`❌ **No tenés el pack "${nombrePack}" disponible!** Usá \`ar!packs\` para ver tus packs.`);
    }

    const packInfo = equipo.packs_dis[packIndex];

    // Buscar jugadores elegibles según el tipo del pack
    let tipoPack = packInfo.tipo;
    if (!tipoPack) tipoPack = 'normal'; // Compatible con packs viejos sin la propiedad "tipo"

    let jugadoresElegibles;
    if (tipoPack === 'todos') {
      jugadoresElegibles = await Jugador.find({}).lean();
    } else {
      let carpetaMatches = tipoPack;
      switch (tipoPack) {
        case 'normal': carpetaMatches = 'normales'; break;
        case 'especial': carpetaMatches = 'especiales'; break;
        case 'heroe': carpetaMatches = 'heroes'; break;
        case 'icono': carpetaMatches = 'iconos'; break;
        case 'time_warp': carpetaMatches = 'time_warps'; break;
        case 'scream': carpetaMatches = 'scream'; break;
        case 'toty': carpetaMatches = 'toty'; break;
      }
      jugadoresElegibles = await Jugador.find({
        dir: { $regex: new RegExp(`[\\\\/]${carpetaMatches}[\\\\/]`, 'i') }
      }).lean();
    }

    if (!jugadoresElegibles || jugadoresElegibles.length === 0) {
      return message.reply('❌ **No hay jugadores disponibles en este pack!**');
    }

    // Aplicar probabilidades dinámicas según el pack
    const jugadoresConPeso = jugadoresElegibles.map(j => {
      let peso = 0;
      switch (packInfo.nombre) {
        case 'Gordos Comunes':
          if (j.media < 77) peso = 70;
          else if (j.media < 86) peso = 25;
          else peso = 5;
          break;
        case 'Gordos Premium':
          if (j.media >= 86) peso = 30;
          else if (j.media >= 82) peso = 50;
          else if (j.media >= 80) peso = 15;
          else peso = 5;
          break;
        case 'Gordos Especiales':
        case 'Heroes de Argentine':
          if (j.media >= 85) peso = 30;
          else peso = 70;
          break;
        case 'Iconos de Argentine':
        case 'Pack Malvado':
        case 'Pack Olvidado':
        case 'Pack MOTY':
          peso = 100; // Misma probabilidad para todos
          break;
        case 'Pack Godeano de Argentine':
          if (j.media >= 90) peso = 60;
          else if (j.media >= 88) peso = 30;
          else if (j.media >= 86) peso = 10;
          else peso = 0; // Descartados
          break;
        default:
          peso = 10; // Fallback
      }
      return { ...j, peso };
    });

    const jugadoresPosibles = jugadoresConPeso.filter(j => j.peso > 0);

    if (jugadoresPosibles.length === 0) {
      return message.reply(`❌ **No se encontraron jugadores que cumplan los requisitos del pack ${packInfo.nombre}!**`);
    }

    // Seleccionar 1 jugador basado en las probabilidades
    const pesoTotal = jugadoresPosibles.reduce((sum, j) => sum + j.peso, 0);
    let random = Math.random() * pesoTotal;

    let jugadorSeleccionado = jugadoresPosibles[0];
    for (const j of jugadoresPosibles) {
      random -= j.peso;
      if (random <= 0) {
        jugadorSeleccionado = j;
        break;
      }
    }

    // Añadir jugador a la reserva del equipo o descartarlo si ya existe
    const jugadorKey = `${jugadorSeleccionado.nombre}_${jugadorSeleccionado.tipo}`.replace(/[.\s]/g, '_');
    
    let isDuplicado = false;
    let isNuevaVersion = false;
    let compensacion = 0;

    if (equipo.jugadores && equipo.jugadores[jugadorKey]) {
      // Ya tiene al jugador exacto (Nombre + Tipo), se descarta y recibe 50% del valor
      isDuplicado = true;
      compensacion = Math.floor(jugadorSeleccionado.valor / 2);
      equipo.dinero += compensacion;
    } else {
      // Verificar si ya tiene el jugador pero de distinto tipo
      if (equipo.jugadores) {
        const tieneMismoNombre = Object.values(equipo.jugadores).some(j => j.nombre.toLowerCase() === jugadorSeleccionado.nombre.toLowerCase());
        if (tieneMismoNombre) {
          isNuevaVersion = true;
        }
      }

      // Jugador nuevo, se añade a la reserva
      const jugadorData = {
        nombre: jugadorSeleccionado.nombre,
        tipo: jugadorSeleccionado.tipo,
        dir: jugadorSeleccionado.dir,
        media: jugadorSeleccionado.media,
        valor: jugadorSeleccionado.valor
      };
      equipo.jugadores[jugadorKey] = jugadorData;
      equipo.markModified('jugadores');
    }

    // Eliminar solo 1 instancia del pack
    equipo.packs_dis.splice(packIndex, 1);
    equipo.markModified('packs_dis');

    await equipo.save();

    // Determinar rareza basado en media para color del embed
    let embedColor;
    if (jugadorSeleccionado.media > 75) embedColor = '#FFD700'; // Dorado
    else embedColor = '#bebebe'; // Plata

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('🎉 ¡Pack Abierto!')
      .setDescription(`Has obtenido un nuevo jugador del pack **${packInfo.nombre}**!`)
      .addFields(
        { name: '👤 Jugador', value: jugadorSeleccionado.nombre, inline: true },
        { name: '🏷️ Tipo', value: jugadorSeleccionado.tipo, inline: true },
        { name: '⭐ Media', value: `${jugadorSeleccionado.media}`, inline: true },
        { name: '💰 Valor', value: `$GDS ${formatNumber(jugadorSeleccionado.valor)}`, inline: true }
      )
      .setTimestamp();

    if (isDuplicado) {
      embed.addFields({ name: '⚠️ Duplicado', value: `Ya tenías esta carta **exacta**, ha sido descartada automaticamente.\n**Compensación:** +$GDS ${formatNumber(compensacion)} al club.`, inline: false });
      embed.setFooter({ text: `Carta descartada | Equipo: ${equipo.nombreEq} | 💰 Saldo: $GDS ${formatNumber(equipo.dinero)}` });
    } else {
      if (isNuevaVersion) {
        embed.addFields({ name: '✨ ¡Nueva Versión!', value: `Ya tenías a **${jugadorSeleccionado.nombre}** de otro tipo, ¡pero esta versión es nueva! Se añadió a tu reserva.`, inline: false });
      }
      embed.setFooter({ text: `El jugador fue añadido a tu reserva | Club: ${equipo.nombreEq}` });
    }

    // Usar URL CDN directa en el embed (sin subir attachment)
    if (jugadorSeleccionado.dir && jugadorSeleccionado.dir.startsWith('http')) {
      embed.setImage(jugadorSeleccionado.dir);
    }

    return message.reply({ embeds: [embed] });
  }
}
