import Equipo from '../../models/Equipo.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  calcularMedia,
  plantillaCompleta,
  calcularProbabilidades,
  calcularBonus
} from '../../utils/calcularMedia.js';
import formatNumber from '../../utils/formatNumber.js';

// Cooldown map: userID → timestamp
const cooldowns = new Map();
const COOLDOWN_MS = 15000; // 15 segundos
const APUESTA_MIN = 500;

// ─── Probabilidad de empate: 5% fijo sacado proporcional de cada lado ───
const PROB_EMPATE = 5;

/**
 * Genera la barra visual con 🔴 🟡 🔵 representando cada zona de probabilidad
 */
function generarBarra(probA, probEmpate, probB) {
  const totalSlots = 20;
  const slotsA = Math.round((probA / 100) * totalSlots);
  const slotsE = Math.max(1, Math.round((probEmpate / 100) * totalSlots));
  const slotsB = Math.max(1, totalSlots - slotsA - slotsE);

  return '🔴'.repeat(slotsA) + '🟡'.repeat(slotsE) + '🔵'.repeat(slotsB);
}

/**
 * Genera el texto de probabilidades con barra
 */
function generarBarraProb(probA, probEmpate, probB, nombreA, nombreB) {
  const barra = generarBarra(probA, probEmpate, probB);
  return (
    `🔴 ${nombreA} (${probA}%) | 🟡 Empate (${probEmpate}%) | 🔵 ${nombreB} (${probB}%)\n` +
    barra
  );
}

/**
 * Animación de ruleta mejorada.
 * Muestra una barra de 20 slots con un puntero ▼ que se desplaza y desacelera
 * hasta detenerse en la posición final según el roll.
 */
async function animarRuleta(msg, probA, probEmpate, probB, nombreA, nombreB, rollFinal) {
  const totalSlots = 20;
  const slotsA = Math.round((probA / 100) * totalSlots);
  const slotsE = Math.max(1, Math.round((probEmpate / 100) * totalSlots));
  // slotsB is the rest

  // Build the bar array
  const barArr = [];
  for (let i = 0; i < totalSlots; i++) {
    if (i < slotsA) barArr.push('🔴');
    else if (i < slotsA + slotsE) barArr.push('🟡');
    else barArr.push('🔵');
  }

  // Determine the final landing slot from the roll
  const finalSlot = Math.min(totalSlots - 1, Math.floor((rollFinal / 100) * totalSlots));

  // Create pointer positions that simulate spinning:
  // Fast pass through the bar multiple times, then slow down and land
  const positions = [];

  // Phase 1: 3 fast laps (step 4) — blur speed
  for (let lap = 0; lap < 3; lap++) {
    for (let i = 0; i < totalSlots; i += 4) {
      positions.push(i);
    }
  }

  // Phase 2: 2 medium laps (step 2) — still fast but readable
  for (let lap = 0; lap < 2; lap++) {
    for (let i = 0; i < totalSlots; i += 2) {
      positions.push(i);
    }
  }

  // Phase 3: slow crawl towards final (step 1, starting well before)
  const approachStart = (finalSlot - 10 + totalSlots) % totalSlots;
  for (let step = 0; step < 12; step++) {
    positions.push((approachStart + step) % totalSlots);
  }

  // Phase 4: dramatic fake-out — overshoot by 1, pause, come back
  const overshoot = (finalSlot + 1) % totalSlots;
  positions.push(overshoot);
  positions.push(finalSlot);

  // Select 12 key frames
  const keyFrameIndices = [];
  const totalPositions = positions.length;

  // Pick 7 evenly spaced frames from the fast/medium spin
  const spinEnd = totalPositions - 14; // where slow approach starts
  for (let i = 0; i < 7; i++) {
    keyFrameIndices.push(Math.floor((i / 7) * spinEnd));
  }
  // 3 slow approach frames
  keyFrameIndices.push(totalPositions - 6);
  keyFrameIndices.push(totalPositions - 4);
  keyFrameIndices.push(totalPositions - 3);
  // fake-out overshoot
  keyFrameIndices.push(totalPositions - 2);
  // final landing
  keyFrameIndices.push(totalPositions - 1);

  //                   fast─────────────────────  slow──────────────  fakeout  final
  const delays = [300, 300, 350, 400, 450, 500, 600, 800, 1000, 1400, 1800, 2000];

  const textos = [
    '🎰 **La ruleta gira a toda velocidad...**',
    '🎰 **¡Está volando!**',
    '🎰 **Sigue girando...**',
    '🌀 **Girando...**',
    '🌀 **Empieza a frenar...**',
    '💫 **Se está frenando...**',
    '💫 **Más lento...**',
    '⚡ **¡Casi se detiene!**',
    '🔥 **¡Se está parando!**',
    '😰 **¡Un poquito más!**',
    '⁉️ **¿¡Ahí se queda!?**',
    '✨ **¡RESULTADO FINAL!**',
  ];

  for (let f = 0; f < keyFrameIndices.length; f++) {
    const pos = positions[keyFrameIndices[f]];

    // Build pointer line: spaces + ▼
    // Each emoji occupies one "slot" visually
    const pointerLine = '⬛'.repeat(pos) + '🔻' + '⬛'.repeat(totalSlots - pos - 1);

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`⚔️ Duelo en curso...`)
      .setDescription(
        `${textos[f]}\n\n` +
        `🔴 **${nombreA}** vs 🔵 **${nombreB}**\n\n` +
        `${pointerLine}\n` +
        `${barArr.join('')}\n\n` +
        generarBarraProb(probA, probEmpate, probB, nombreA, nombreB)
      )
      .setFooter({ text: '¡El destino decidirá!' });

    await msg.edit({ embeds: [embed], components: [] });
    await new Promise(r => setTimeout(r, delays[f]));
  }
}

export default {
  name: 'duelo',
  aliases: ['duel', 'apostar', 'desafiar'],
  desc: 'Desafiá a otro club a un duelo con apuesta. Uso: ar!duelo @rival <apuesta>',
  run: async (client, message, args) => {
    // ─── Cooldown ───
    const ahora = Date.now();
    const cooldownHasta = cooldowns.get(message.author.id);
    if (cooldownHasta && ahora < cooldownHasta) {
      const restante = Math.ceil((cooldownHasta - ahora) / 1000);
      return message.reply(`⏳ **Esperá ${restante}s antes de duelear de nuevo!**`);
    }

    // ─── Validar argumentos ───
    const mencionado = message.mentions.users.first();
    if (!mencionado) {
      return message.reply('❌ **Uso incorrecto!** Debés mencionar a un rival.\nUso: `ar!duelo @rival <apuesta>`');
    }

    if (mencionado.id === message.author.id) {
      return message.reply('❌ **No podés duelarte a vos mismo!**');
    }

    if (mencionado.bot) {
      return message.reply('❌ **No podés duelear contra un bot!**');
    }

    const apuestaStr = args.find(a => !a.startsWith('<@'));
    const apuesta = parseInt(apuestaStr);

    if (!apuesta || isNaN(apuesta) || apuesta < APUESTA_MIN) {
      return message.reply(`❌ **Apuesta inválida!** La apuesta mínima es de **$GDS ${formatNumber(APUESTA_MIN)}**.`);
    }

    // ─── Buscar equipos ───
    const equipoEmisor = await Equipo.findOne({ userID: message.author.id });
    if (!equipoEmisor) {
      return message.reply('❌ **No tenés un club registrado!** Usá `ar!registro <nombre>` para crear uno.');
    }

    const equipoRival = await Equipo.findOne({ userID: mencionado.id });
    if (!equipoRival) {
      return message.reply(`❌ **${mencionado.username} no tiene un club registrado!**`);
    }

    // ─── Verificar plantillas completas ───
    if (!plantillaCompleta(equipoEmisor.equipo)) {
      return message.reply('❌ **Tu plantilla no está completa!** Necesitás 4 jugadores en campo para duelear.');
    }

    if (!plantillaCompleta(equipoRival.equipo)) {
      return message.reply(`❌ **La plantilla de ${equipoRival.nombreEq} no está completa!** Necesitan 4 jugadores en campo.`);
    }

    // ─── Verificar dinero ───
    const maxApuesta = Math.min(equipoEmisor.dinero, equipoRival.dinero);

    if (apuesta > maxApuesta) {
      if (equipoEmisor.dinero < apuesta) {
        return message.reply(`❌ **No tenés suficientes Godeanos!** Tenés **$GDS ${formatNumber(equipoEmisor.dinero)}** y querés apostar **$GDS ${formatNumber(apuesta)}**.`);
      }
      return message.reply(`❌ **${equipoRival.nombreEq} no tiene suficientes Godeanos!** Tienen **$GDS ${formatNumber(equipoRival.dinero)}** y la apuesta es **$GDS ${formatNumber(apuesta)}**.`);
    }

    // ─── Calcular medias y probabilidades (con zona de empate) ───
    const mediaEmisor = calcularMedia(equipoEmisor.equipo);
    const mediaRival = calcularMedia(equipoRival.equipo);
    const { probA: rawProbA, probB: rawProbB } = calcularProbabilidades(mediaEmisor, mediaRival);

    // Reservar PROB_EMPATE sacando proporcional de cada lado
    const probEmpate = PROB_EMPATE;
    const probA = Math.round((rawProbA * (100 - probEmpate) / 100) * 10) / 10;
    const probB = Math.round((100 - probEmpate - probA) * 10) / 10;

    // ─── Embed de solicitud ───
    const embedSolicitud = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('⚔️ ¡Desafío de Duelo!')
      .setDescription(
        `**${equipoEmisor.nombreEq}** desafía a **${equipoRival.nombreEq}** a un duelo!\n\n` +
        `🔴 **${equipoEmisor.nombreEq}** — Media: ⭐ **${mediaEmisor}** — Prob: **${probA}%**\n` +
        `🟡 **Empate** — Prob: **${probEmpate}%**\n` +
        `🔵 **${equipoRival.nombreEq}** — Media: ⭐ **${mediaRival}** — Prob: **${probB}%**\n\n` +
        `💰 **Apuesta: $GDS ${formatNumber(apuesta)}**\n` +
        `🏆 **Premio al ganar:** $GDS ${formatNumber(apuesta * 2)} + posible bonus underdog\n` +
        `🤝 **Empate:** ambos recuperan su apuesta + bonus underdog\n\n` +
        generarBarraProb(probA, probEmpate, probB, equipoEmisor.nombreEq, equipoRival.nombreEq) + '\n\n' +
        `<@${mencionado.id}> ¿Aceptás el duelo?`
      )
      .setFooter({ text: 'Tenés 60 segundos para responder.' })
      .setTimestamp();

    const botones = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('duelo_aceptar')
        .setLabel('✅ Aceptar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('duelo_rechazar')
        .setLabel('❌ Rechazar')
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await message.reply({ embeds: [embedSolicitud], components: [botones] });

    // ─── Collector para respuesta del rival ───
    const collector = msg.createMessageComponentCollector({
      filter: (i) => i.user.id === mencionado.id,
      time: 60000,
      max: 1
    });

    collector.on('collect', async (interaction) => {
      await interaction.deferUpdate();

      if (interaction.customId === 'duelo_rechazar') {
        const embedRechazado = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Duelo Rechazado')
          .setDescription(`**${equipoRival.nombreEq}** rechazó el duelo contra **${equipoEmisor.nombreEq}**.`)
          .setTimestamp();

        return msg.edit({ embeds: [embedRechazado], components: [] });
      }

      // ─── ACEPTADO: verificar dinero de nuevo ───
      const emisorActualizado = await Equipo.findOne({ userID: message.author.id });
      const rivalActualizado = await Equipo.findOne({ userID: mencionado.id });

      if (!emisorActualizado || emisorActualizado.dinero < apuesta) {
        const embedError = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Duelo Cancelado')
          .setDescription(`**${equipoEmisor.nombreEq}** ya no tiene suficientes Godeanos para la apuesta.`)
          .setTimestamp();
        return msg.edit({ embeds: [embedError], components: [] });
      }

      if (!rivalActualizado || rivalActualizado.dinero < apuesta) {
        const embedError = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Duelo Cancelado')
          .setDescription(`**${equipoRival.nombreEq}** ya no tiene suficientes Godeanos para la apuesta.`)
          .setTimestamp();
        return msg.edit({ embeds: [embedError], components: [] });
      }

      // ─── Descontar dinero de ambos ───
      emisorActualizado.dinero -= apuesta;
      rivalActualizado.dinero -= apuesta;
      await emisorActualizado.save();
      await rivalActualizado.save();

      // ─── Aplicar cooldown a ambos ───
      cooldowns.set(message.author.id, Date.now() + COOLDOWN_MS);
      cooldowns.set(mencionado.id, Date.now() + COOLDOWN_MS);

      // ─── Determinar resultado con el roll ───
      const roll = Math.random() * 100;

      // Zonas: [0, probA) = gana A | [probA, probA+probEmpate) = empate | [probA+probEmpate, 100] = gana B
      let resultado; // 'A' | 'empate' | 'B'
      if (roll < probA) {
        resultado = 'A';
      } else if (roll < probA + probEmpate) {
        resultado = 'empate';
      } else {
        resultado = 'B';
      }

      // ─── Animación de ruleta ───
      await animarRuleta(msg, probA, probEmpate, probB, equipoEmisor.nombreEq, equipoRival.nombreEq, roll);

      // ─── Resolver resultado ───
      if (resultado === 'empate') {
        // ── EMPATE: ambos recuperan su apuesta ──
        emisorActualizado.dinero += apuesta;
        rivalActualizado.dinero += apuesta;

        // Bonus underdog para el de menor media
        let bonusTexto = '';
        if (mediaEmisor !== mediaRival) {
          const esEmisorUnderdog = mediaEmisor < mediaRival;
          const underdogEquipo = esEmisorUnderdog ? emisorActualizado : rivalActualizado;
          const underdogNombre = esEmisorUnderdog ? equipoEmisor.nombreEq : equipoRival.nombreEq;
          const underdogProb = esEmisorUnderdog ? probA : probB;
          const bonus = calcularBonus(underdogProb, apuesta);

          if (bonus > 0) {
            underdogEquipo.dinero += bonus;
            bonusTexto = `\n🌟 **Bonus underdog por empate:** +$GDS ${formatNumber(bonus)} para **${underdogNombre}** (tenía ${underdogProb}% de chances)`;
          }
        }

        await emisorActualizado.save();
        await rivalActualizado.save();

        const embedEmpate = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🤝 ¡Empate!')
          .setDescription(
            `**¡El duelo terminó en empate!**\n\n` +
            `🔴 **${equipoEmisor.nombreEq}** — Media: ⭐ ${mediaEmisor} — ${probA}%\n` +
            `🔵 **${equipoRival.nombreEq}** — Media: ⭐ ${mediaRival} — ${probB}%\n\n` +
            generarBarraProb(probA, probEmpate, probB, equipoEmisor.nombreEq, equipoRival.nombreEq) + '\n\n' +
            `🎲 **Resultado del roll:** ${roll.toFixed(1)} → 🟡 **Empate**\n\n` +
            `───────────────────\n` +
            `💰 **Apuesta devuelta:** $GDS ${formatNumber(apuesta)} para cada uno` +
            bonusTexto + `\n\n` +
            `💼 **${equipoEmisor.nombreEq}** → $GDS ${formatNumber(emisorActualizado.dinero)}\n` +
            `💼 **${equipoRival.nombreEq}** → $GDS ${formatNumber(rivalActualizado.dinero)}`
          )
          .setFooter({ text: `Roll: ${roll.toFixed(2)} | Zona empate: ${probA}% – ${(probA + probEmpate).toFixed(1)}%` })
          .setTimestamp();

        await msg.edit({ embeds: [embedEmpate], components: [] });
      } else {
        // ── VICTORIA ──
        const ganaEmisor = resultado === 'A';
        const ganadorEquipo = ganaEmisor ? emisorActualizado : rivalActualizado;
        const perdedorEquipo = ganaEmisor ? rivalActualizado : emisorActualizado;
        const ganadorNombre = ganaEmisor ? equipoEmisor.nombreEq : equipoRival.nombreEq;
        const perdedorNombre = ganaEmisor ? equipoRival.nombreEq : equipoEmisor.nombreEq;
        const ganadorProb = ganaEmisor ? probA : probB;

        // Premio base (ambas apuestas)
        let premio = apuesta * 2;
        const bonus = calcularBonus(ganadorProb, apuesta);
        const premioTotal = premio + bonus;

        // Acreditar al ganador
        ganadorEquipo.dinero += premioTotal;
        await ganadorEquipo.save();

        const esUpset = ganadorProb < 50;

        const embedResultado = new EmbedBuilder()
          .setColor(esUpset ? '#FF00FF' : '#00FF00')
          .setTitle(esUpset ? '🤯 ¡UPSET! ¡Victoria inesperada!' : '🏆 ¡Duelo Finalizado!')
          .setDescription(
            `**¡${ganadorNombre} gana el duelo!**\n\n` +
            `🔴 **${equipoEmisor.nombreEq}** — Media: ⭐ ${mediaEmisor} — ${probA}%\n` +
            `🔵 **${equipoRival.nombreEq}** — Media: ⭐ ${mediaRival} — ${probB}%\n\n` +
            generarBarraProb(probA, probEmpate, probB, equipoEmisor.nombreEq, equipoRival.nombreEq) + '\n\n' +
            `🎲 **Resultado del roll:** ${roll.toFixed(1)} → ${ganaEmisor ? '🔴' : '🔵'} **${ganadorNombre}**\n\n` +
            `───────────────────\n` +
            `💰 **Apuesta:** $GDS ${formatNumber(apuesta)}\n` +
            `🏆 **Premio base:** $GDS ${formatNumber(premio)}\n` +
            (bonus > 0
              ? `🌟 **Bonus underdog:** +$GDS ${formatNumber(bonus)} (tenía solo ${ganadorProb}% de chances)\n` +
                `💎 **Premio total:** $GDS ${formatNumber(premioTotal)}\n`
              : '') +
            `\n` +
            `✅ **${ganadorNombre}** → $GDS ${formatNumber(ganadorEquipo.dinero)}\n` +
            `❌ **${perdedorNombre}** → $GDS ${formatNumber(perdedorEquipo.dinero)}`
          )
          .setFooter({ text: `Roll: ${roll.toFixed(2)} | Umbral A: ${probA}% | Empate: ${probA}%–${(probA + probEmpate).toFixed(1)}%` })
          .setTimestamp();

        await msg.edit({ embeds: [embedResultado], components: [] });
      }
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        const embedTimeout = new EmbedBuilder()
          .setColor('#808080')
          .setTitle('⏰ Duelo Expirado')
          .setDescription(`**${equipoRival.nombreEq}** no respondió al desafío de **${equipoEmisor.nombreEq}**.`)
          .setTimestamp();

        try {
          await msg.edit({ embeds: [embedTimeout], components: [] });
        } catch (e) { /* mensaje eliminado */ }
      }
    });
  }
};
