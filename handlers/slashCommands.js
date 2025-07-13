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
        
        // Check if user already has an active listing and clear if expired
        const existingListing = activeListings.get(interaction.user.id);
        if (existingListing) {
            // Check if listing is older than 30 minutes
            const now = Date.now();
            const listingAge = now - (existingListing.timestamp || 0);
            const thirtyMinutes = 30 * 60 * 1000;
            
            if (listingAge > thirtyMinutes) {
                // Clear expired listing
                activeListings.delete(interaction.user.id);
                console.log(`Cleared expired listing for user ${interaction.user.id}`);
            } else {
                // Still active
                await safeReply(interaction, {
                    content: '❌ You already have an active listing. Please finish or cancel your current listing first.\n\n*If you believe this is an error, please wait a few minutes and try again.*',
                    ephemeral: true
                });
                return;
            }
        }
        
        // Create listing type selection embed
        const listingEmbed = new EmbedBuilder()
            .setTitle(`${config.EMOJIS.SKYBLOCK} Create New Listing`)
            .setDescription('**What would you like to list for sale?**\n\n' +
                '**Account** - Complete Skyblock account with all profiles\n' +
                '**Profile** - Single Skyblock profile on an account\n\n' +
                'Select the type of listing you want to create:')
            .setColor('#0099ff')
            .setFooter({ text: 'David\'s Coins - Skyblock Listings • Session expires in 30 minutes' });
        
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
        
        // Store initial listing data with extended timeout and better tracking
        const listingData = {
            step: 'type_selection',
            userId: interaction.user.id,
            username: interaction.user.username,
            timestamp: Date.now(),
            interactionId: interaction.id,
            channelId: interaction.channelId
        };
        
        activeListings.set(interaction.user.id, listingData);
        console.log(`Created new listing session for user ${interaction.user.id} at step: type_selection`);
        
        // Clear listing after 30 minutes (backup cleanup)
        setTimeout(() => {
            const currentListing = activeListings.get(interaction.user.id);
            if (currentListing && currentListing.interactionId === interaction.id) {
                activeListings.delete(interaction.user.id);
                console.log(`Auto-cleared listing session for user ${interaction.user.id} after 30 minutes`);
            }
        }, 30 * 60 * 1000); // 30 minutes
    }
}

module.exports = { handleSlashCommands };
