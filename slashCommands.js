const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { hasStaffRole, safeReply } = require('../utils/utils');
const { activeListings } = require('../utils/stats');
const config = require('../config/config');

async function handleSlashCommands(interaction) {
    if (interaction.commandName === 'list') {
        const member = interaction.guild.members.cache.get(interaction.user.id);
        
        if (!hasStaffRole(member)) {
            await safeReply(interaction, {
                content: '❌ Only staff members can create listings.',
                ephemeral: true
            });
            return;
        }
        
        // Check if user already has an active listing
        if (activeListings.has(interaction.user.id)) {
            await safeReply(interaction, {
                content: '❌ You already have an active listing. Please finish or cancel your current listing first.',
                ephemeral: true
            });
            return;
        }
        
        // Create listing type selection embed
        const listingEmbed = new EmbedBuilder()
            .setTitle(`${config.EMOJIS.SKYBLOCK} Create New Listing`)
            .setDescription('**What would you like to list for sale?**\n\n' +
                '**Account** - Complete Skyblock account with all profiles\n' +
                '**Profile** - Single Skyblock profile on an account\n\n' +
                'Select the type of listing you want to create:')
            .setColor('#0099ff')
            .setFooter({ text: 'David\'s Coins - Skyblock Listings' });
        
        const typeButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('list_account')
                    .setLabel('List Account')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👤'),
                new ButtonBuilder()
                    .setCustomId('list_profile')
                    .setLabel('List Profile')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('1393120347427049585')
            );
        
        await safeReply(interaction, {
            embeds: [listingEmbed],
            components: [typeButtons],
            ephemeral: true
        });
        
        // Store initial listing data
        activeListings.set(interaction.user.id, {
            step: 'type_selection',
            userId: interaction.user.id,
            username: interaction.user.username
        });
    }
}

module.exports = { handleSlashCommands };
