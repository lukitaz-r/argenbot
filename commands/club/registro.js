import Equipo from '../../models/Equipo.js';
import { EmbedBuilder } from 'discord.js';
import formatNumber from '../../utils/formatNumber.js';

export default {
  name: 'registro',
  aliases: ['registrar', 'crear'],
  desc: 'Registra tu club con un nombre personalizado',
  run: async (client, message, args) => {
    const nombreEq = args.join(' ').trim();

    if (!nombreEq) {
      return message.reply('❌ **Debes especificar un nombre para tu club!**\nUso: `ar!registro <nombre del club>`');
    }

    if (nombreEq.length > 30) {
      return message.reply('❌ **El nombre del club no puede superar los 30 caracteres!**');
    }

    // Verificar si el usuario ya tiene un club
    const existente = await Equipo.findOne({ userID: message.author.id });
    if (existente) {
      return message.reply(`❌ **Ya tenés un club registrado!** Tu club es: **${existente.nombreEq}**`);
    }

    const defaultPlaceholder = {
      nombre: undefined,
      tipo: undefined,
      dir: './assets/cartas/placeholder_b64.js',
      media: undefined,
      valor: undefined
    };

    const packGordosComunes = {
      nombre: 'Gordos Comunes',
      tipo: 'normal',
      valor: 0,
      desc: 'Contiene jugadores normales. Si el jugador tiene <77 de media → 70% de probabilidad. Si tiene <86 → 25%. Si tiene >=86 → 5%.'
    };

    const nuevoEquipo = new Equipo({
      nombreEq,
      userN: message.author.username,
      userID: message.author.id,
      jugadores: {},
      equipo: [
        { ...defaultPlaceholder },
        { ...defaultPlaceholder },
        { ...defaultPlaceholder },
        { ...defaultPlaceholder }
      ],
      dinero: 10000,
      packs_dis: [packGordosComunes, packGordosComunes]
    });

    await nuevoEquipo.save();

    const embed = new EmbedBuilder()
      .setColor(client.color)
      .setTitle('⚽ Club Registrado!')
      .setDescription(`Tu club **${nombreEq}** ha sido creado exitosamente!`)
      .addFields(
        { name: '💰 Balance', value: `$GDS ${formatNumber(10000)}`, inline: true },
        { name: '📦 Pack Inicial', value: 'Gordos Comunes x2', inline: true },
        { name: '👥 Jugadores', value: 'Ninguno aún', inline: true }
      )
      .setFooter({ text: `Club de ${message.author.username}` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
}
