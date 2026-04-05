import { EmbedBuilder } from 'discord.js';

const prefix = 'ar!'; // Prefijo del bot por defecto

export default {
  name: 'help',
  aliases: ['ayuda', 'h', 'comandos'],
  desc: 'Muestra la lista de todos los comandos disponibles, junto con sus descripciones, aliases y permisos.',
  permisos: [],
  run: async (client, message, args) => {
    // Array de comandos
    const commandsArray = Array.from(client.commands.values());
    
    // Ordenar comandos alfabéticamente
    commandsArray.sort((a, b) => a.name.localeCompare(b.name));

    // Formatear cada comando
    const commandStrings = commandsArray.map(cmd => {
      let text = `📜 **\`${prefix}${cmd.name}\`**\n`;
      text += `🔹 *Desc:* ${cmd.desc || 'Sin descripción específica.'}\n`;
      
      if (cmd.aliases && cmd.aliases.length > 0) {
        text += `🔹 *Aliases:* \`${cmd.aliases.join('\`, \`')}\`\n`;
      }
      
      if (cmd.permisos && cmd.permisos.length > 0) {
        text += `🔹 *Permisos requeridos:* \`${cmd.permisos.join(', ')}\`\n`;
      } else {
        text += `🔹 *Permisos requeridos:* \`Cualquiera\`\n`;
      }

      return text;
    });

    // Dividir en embeds si son muchos comandos (limite de descripcion es 4096)
    const embeds = [];
    let currentEmbed = new EmbedBuilder()
      .setColor(client.color || '#0099ff')
      .setTitle('📚 Lista de Comandos de ArgenBot')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp();
      
    let currentDesc = `Aquí tienes la lista completa de comandos disponibles. El prefijo del bot es **\`${prefix}\`**.\n\n`;
    
    for (const str of commandStrings) {
      if (currentDesc.length + str.length > 3900) {
        currentEmbed.setDescription(currentDesc);
        embeds.push(currentEmbed);
        currentEmbed = new EmbedBuilder().setColor(client.color || '#0099ff').setTimestamp();
        currentDesc = "";
      }
      currentDesc += str + '\n';
    }
    
    if (currentDesc.length > 0) {
      currentEmbed.setDescription(currentDesc);
      embeds.push(currentEmbed);
    }

    message.reply({ embeds });
  }
};
