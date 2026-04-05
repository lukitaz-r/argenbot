import Equipo from '../../models/Equipo.js';
import { EmbedBuilder } from 'discord.js';
import formatNumber from '../../utils/formatNumber.js';

const workMessages = [
  (amount) => `Limpiaste baños públicos. Ganas **$GDS ${amount}**`,
  (amount) => `Vendiste choripanes en una marcha de sindicalistas. Ganas **$GDS ${amount}**`,
  (amount) => `Vendiste cromos de steam. Ganas **$GDS ${amount}**`,
  (amount) => `Te encontraste **$GDS ${amount}** en la calle.`,
  (amount) => `Trabajaste medio turno en la verduleria de tu vieja. Ganas **$GDS ${amount}**`,
  (amount) => `Tu viejo pago la pensión alimenticia. Ganas **$GDS ${amount}**`,
  (amount) => `Te pagaron el progresar. Ganas **$GDS ${amount}**`,
  (amount) => `Destruiste una maquina de moneditas en un arcade. Ganas **$GDS ${amount}**`,
  (amount) => `Vendiste tus datos biometricos. Ganas **$GDS ${amount}**`,
  (amount) => `Te compraron uno de tus órganos en mal estado. Ganas **$GDS ${amount}**`,
  (amount) => `Le vendiste a un gordito un disco que ponía "Cáncer Severo". Ganas **$GDS ${amount}**`,
  (amount) => `Vendiste información de terceros a un chileno. Ganas **$GDS ${amount}**`,
  (amount) => `Vendiste a tu hermana. Ganas **$GDS ${amount}**`,
  (amount) => `Le cortaste el pelo al vecino. Ganas **$GDS ${amount}**`,
  (amount) => `Se murió tu tío. Recibes la herencia **$GDS ${amount}**`,
  (amount) => `Vendiste un Kilo de sexo. Ganas **$GDS ${amount}**`,
  (amount) => `Recibiste una llamada de Big Yahu. Ganas **$GDS ${amount}**`,
  (amount) => `Laburaste medio turno en Big Nigga Burgers. Te pagaron **$GDS ${amount}**`,
  (amount) => `Pusiste un stand de llaveros hechos con ia en la fuwa. Ganas **$GDS ${amount}**`,
  (amount) => `Cobraste por el verificado de twitter. Ganas **$GDS ${amount}**`,
  (amount) => `Cobraste pauta por esparcir misinformation en redes. Ganas **$GDS ${amount}**`,
];

export default {
  name: 'work',
  aliases: ['trabajar'],
  desc: 'Trabajá honradamente para ganar Godeanos (100% de éxito, ganancia baja)',
  run: async (client, message, args) => {
    const equipo = await Equipo.findOne({ userID: message.author.id });

    if (!equipo) {
      return message.reply('❌ **No tenés un club registrado!** Usá `ar!registro <nombre>` para crear uno.');
    }

    const now = new Date();
    const cooldownAmount = 10 * 60 * 1000; // 10 minutes in ms

    if (equipo.ultimoWork && (now.getTime() - equipo.ultimoWork.getTime()) < cooldownAmount) {
      const timeLeft = cooldownAmount - (now.getTime() - equipo.ultimoWork.getTime());
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      return message.reply(`⏳ **Estás muy cansado para trabajar!** Podés volver a hacerlo en **${hours}h ${minutes}m**.`);
    }

    // Calcula recompensa aleatoria entre 500 y 2500
    const recompensa = Math.floor(Math.random() * (2500 - 500 + 1)) + 500;
    
    equipo.dinero += recompensa;
    equipo.ultimoWork = now;

    await equipo.save();

    const msg = workMessages[Math.floor(Math.random() * workMessages.length)](formatNumber(recompensa));

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('💼 ¡Día de Trabajo Completado!')
      .setDescription(`${msg}\n\n💵 **Nuevo saldo:** $GDS ${formatNumber(equipo.dinero)}`)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};
