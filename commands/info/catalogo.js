import { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ComponentType } from 'discord.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');

export default {
    name: 'catalogo',
    aliases: ['catalog'],
    desc: 'Muestra un catálogo con distintas imágenes',
    run: async (client, message) => {
        const catalogoJsonPath = join(rootDir, 'assets', 'catalogo.json');
        const catalogoDir = join(rootDir, 'assets', 'catalogo');

        let catalogoMap = {};

        // Intentar cargar desde catalogo.json (generado por el CDN handler)
        if (existsSync(catalogoJsonPath)) {
            try {
                catalogoMap = JSON.parse(readFileSync(catalogoJsonPath, 'utf-8'));
            } catch {
                catalogoMap = {};
            }
        }

        // Si no hay JSON, leer directamente del directorio como fallback
        const keys = Object.keys(catalogoMap);
        let files;

        if (keys.length > 0) {
            files = keys;
        } else {
            try {
                files = readdirSync(catalogoDir).filter(file => file.endsWith('.png'));
            } catch (error) {
                console.error(error);
                return message.reply('❌ **Ocurrió un error al cargar el catálogo.**');
            }
        }

        if (files.length === 0) {
            return message.reply('❌ **No hay imágenes en el catálogo en este momento.**');
        }

        const options = files.slice(0, 25).map(file => {
            const baseName = file.replace(/\.png$/, '');
            let spacedLower = baseName.replace(/_/g, ' ').toLowerCase();
            
            let words = spacedLower.split(' ');
            let labelText = words.map(word => {
                if(word.length === 0) return word;
                return word.charAt(0).toUpperCase() + word.slice(1);
            }).join(' ');

            return {
                label: labelText,
                description: `Mostrar ${labelText}`,
                value: file
            };
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_catalogo')
            .setPlaceholder('Seleccioná una imagen del catálogo')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const msg = await message.reply({
            content: '📖 **Catálogo:** Seleccioná una opción en el menú para buscar la imagen correspondiente.',
            components: [row]
        });

        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: i => i.user.id === message.author.id,
            time: 600000 // 10 minutos de espera máxima
        });

        collector.on('collect', async i => {
            if (i.customId === 'select_catalogo') {
                const selectedFile = i.values[0];
                const cdnUrl = catalogoMap[selectedFile];
                const label = options.find(o => o.value === selectedFile)?.label || selectedFile;

                if (cdnUrl) {
                    // Usar URL CDN directamente en un embed
                    const embed = new EmbedBuilder()
                        .setColor(client.color)
                        .setTitle(`🖼️ ${label}`)
                        .setImage(cdnUrl);

                    await i.update({
                        content: null,
                        embeds: [embed],
                        components: [row]
                    });
                } else {
                    // Fallback: intentar leer del filesystem local
                    try {
                        const { AttachmentBuilder } = await import('discord.js');
                        const imagePath = join(catalogoDir, selectedFile);
                        const attachment = new AttachmentBuilder(imagePath, { name: selectedFile });
                        
                        await i.update({
                            content: `🖼️ **Mostrando:** ${label}`,
                            files: [attachment],
                            embeds: [],
                            components: [row]
                        });
                    } catch {
                        await i.update({
                            content: `❌ **No se pudo cargar la imagen de ${label}.**`,
                            components: [row]
                        });
                    }
                }
            }
        });

        collector.on('end', async () => {
            try {
                await msg.edit({ components: [] });
            } catch (error) {
                // El mensaje pudo haber sido borrado
            }
        });
    }
};
