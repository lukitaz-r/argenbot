import * as Discord from "discord.js";
import { readdirSync } from "fs";
import colors from "colors";
import dotenv from "dotenv";

dotenv.config();
colors.enable();

const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.GuildMessageReactions,
    Discord.GatewayIntentBits.GuildExpressions
  ],
  partials: [
    Discord.Partials.Channel,
    Discord.Partials.Message,
    Discord.Partials.GuildMember,
    Discord.Partials.Reaction,
  ],
});

client.commands = new Discord.Collection();
client.aliases = new Discord.Collection();
client.color = "#ff0000";

const init = async () => {
  const handlers = readdirSync('./handlers').filter(f => f.endsWith('.js'));
  for (const handler of handlers) {
    try {
      const handlerModule = await import(`./handlers/${handler}`);
      await handlerModule.default(client);
    } catch (e) {
      console.log(`ERROR EN EL HANDLER ${handler}`.red);
      console.log(e);
    }
  }

  client.login(process.env.BOT_TOKEN).catch((error) => console.error(`-[X]- NO HAS ESPECIFICADO UN TOKEN VALIDO O TE FALTAN INTENTOS -[X]-\n [-] ACTIVA LOS INTENTOS EN https://discord.dev`.red, error));
};

init();