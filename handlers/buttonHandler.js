const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { hasStaffRole, safeReply, parseAmount, calculatePrice, formatNumber } = require('../utils/utils');
const { activeListings, activeTickets, ticketMessages, botStats } = require('../utils/stats');
const { createListingEmbed, createBuyerNotificationEmbed } = require('../utils/embeds');
const config = require('../config/config');

// Store completed listings (in production, use a database)
const completedListings = new Map(); // messageId -> fullListingData

async function handleButtonInteractions(interaction) {
    const member = interaction.guild.members.cache.get(interaction.user.id);
    
    // Handle Toggle Ping button
    if (interaction.customId === 'toggle_ping') {
        await safeReply(interaction, {
            content: '🔔 **Toggle Ping**\n\nYou will be notified if the price drops on this listing!\n\n*This feature is currently in development.*',
            ephemeral: true
        });
        return;
    }
    
    // Handle Extra Information button
    if (interaction.customId === 'extra_information') {
        await safeReply(interaction, {
            content: '📋 **Extra Information**\n\nNone',
            ephemeral: true
        });
        return;
    }
    
    // Handle Pricing button
    if (interaction.customId === 'pricing_info') {
        await safeReply(interaction, {
            content: '💸 **Pricing**\n\nGreat Value!',
            ephemeral: true
        });
        return;
    }
    
    // Handle listing type selection
    if (interaction.customId === 'list_account' || interaction.customId === 'list_profile') {
        let listingData = activeListings.get(interaction.user.id);
        
        // Create new session if doesn't exist
        if (!listingData) {
            console.log(`⚠️ No session found for ${interaction.user.username}, creating new one`);
            listingData = {
                step: 'type_selection',
                userId: interaction.user.id,
                username: interaction.user.username,
                startTime: Date.now()
            };
            activeListings.set(interaction.user.id, listingData);
        }
        
        const listingType = interaction.customId === 'list_account' ? 'account' : 'profile';
        listingData.type = listingType;
        listingData.step = 'details_input';
        
        // Save updated data
        activeListings.set(interaction.user.id, listingData);
        console.log(`✅ ${interaction.user.username} selected ${listingType}, step: details_input`);
        
        // Create modal for listing details with account worth field
        const detailsModal = new ModalBuilder()
            .setCustomId('listing_details')
            .setTitle(`List Skyblock ${listingType.charAt(0).toUpperCase() + listingType.slice(1)}`);
        
        const titleInput = new TextInputBuilder()
            .setCustomId('listing_title')
            .setLabel(`${listingType.charAt(0).toUpperCase() + listingType.slice(1)} Title/Name`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`e.g., ${listingType === 'account' ? 'High Level Skyblock Account' : 'Ironman Profile - Level 180'}`)
            .setRequired(true)
            .setMaxLength(100);
        
        const descriptionInput = new TextInputBuilder()
            .setCustomId('listing_description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe the account/profile features, stats, items, etc.')
            .setRequired(true)
            .setMaxLength(1000);
        
        const priceInput = new TextInputBuilder()
            .setCustomId('listing_price')
            .setLabel('Price (USD)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 150, 250.50')
            .setRequired(true)
            .setMaxLength(10);
        
        const worthInput = new TextInputBuilder()
            .setCustomId('account_worth')
            .setLabel('Account Worth (for channel name)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 1400 (will show as $ 1400 | listing-2 ⭐)')
            .setRequired(true)
            .setMaxLength(20);
        
        const firstRow = new ActionRowBuilder().addComponents(titleInput);
        const secondRow = new ActionRowBuilder().addComponents(descriptionInput);
        const thirdRow = new ActionRowBuilder().addComponents(priceInput);
        const fourthRow = new ActionRowBuilder().addComponents(worthInput);
        
        detailsModal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
        
        await interaction.showModal(detailsModal);
        return;
    }
    
    // Handle payment method selection
    if (interaction.customId === 'payment_ltc' || interaction.customId === 'payment_paypal' || interaction.customId === 'payment_both') {
        let listingData = activeListings.get(interaction.user.id);
        
        if (!listingData) {
            await safeReply(interaction, {
                content: '❌ Session not found. Please use `/list` to start over.',
                ephemeral: true
            });
            return;
        }
        
        console.log(`💳 ${interaction.user.username} selected payment: ${interaction.customId}`);
        
        let paymentMethods = [];
        let paymentText = '';
        
        if (interaction.customId === 'payment_ltc') {
            paymentMethods = ['LTC'];
            paymentText = `${config.EMOJIS.LTC}`;
        } else if (interaction.customId === 'payment_paypal') {
            paymentMethods = ['PayPal'];
            paymentText = `${config.EMOJIS.PAYPAL}`;
        } else if (interaction.customId === 'payment_both') {
            paymentMethods = ['LTC', 'PayPal'];
            paymentText = `${config.EMOJIS.LTC}${config.EMOJIS.PAYPAL}`;
        }
        
        listingData.paymentMethods = paymentMethods;
        listingData.paymentText = paymentText;
        listingData.step = 'owner_selection';
        
        // Save updated data
        activeListings.set(interaction.user.id, listingData);
        console.log(`✅ ${interaction.user.username} payments: ${paymentMethods.join(', ')}, step: owner_selection`);
        
        // Show owner selection modal
        const ownerModal = new ModalBuilder()
            .setCustomId('owner_selection')
            .setTitle('Set Account Owner');
        
        const ownerInput = new TextInputBuilder()
            .setCustomId('account_owner')
            .setLabel('Account Owner (User ID or @mention)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 752590954388783196 or @username')
            .setRequired(true)
            .setMaxLength(100);
        
        const ownerRow = new ActionRowBuilder().addComponents(ownerInput);
        ownerModal.addComponents(ownerRow);
        
        await interaction.showModal(ownerModal);
        return;
    }
    
    // Handle Account Owner button
    if (interaction.customId === 'account_owner') {
        // Try multiple ways to find listing data
        let listingData = completedListings.get(interaction.channel.id) || 
                         completedListings.get(`channel-${interaction.channel.id}`) ||
                         completedListings.get(interaction.message.id) ||
                         completedListings.get(`message-${interaction.message.id}`);
        
        // If still not found, search through all listings
        if (!listingData) {
            for (const [key, data] of completedListings.entries()) {
                if (data.channelId === interaction.channel.id) {
                    listingData = data;
                    break;
                }
            }
        }
        
        console.log(`Account Owner button: Found data: ${!!listingData}, Channel: ${interaction.channel.id}`);
        
        if (!listingData) {
            await safeReply(interaction, {
                content: '❌ Could not find listing data.',
                ephemeral: true
            });
            return;
        }
        
        const ownerEmbed = new EmbedBuilder()
            .setTitle('👤 Account Owner')
            .setDescription(`This account was listed by <@${listingData.ownerId}>`)
            .setColor('#0099ff')
            .setFooter({ text: 'David\'s Coins - Account Information' });
        
        await safeReply(interaction, {
            embeds: [ownerEmbed],
            ephemeral: true
        });
        return;
    }
    
    // Handle Buy button
    if (interaction.customId === 'buy_account') {
        // Try multiple ways to find listing data
        let listingData = completedListings.get(interaction.channel.id) || 
                         completedListings.get(`channel-${interaction.channel.id}`) ||
                         completedListings.get(interaction.message.id) ||
                         completedListings.get(`message-${interaction.message.id}`);
        
        // If still not found, search through all listings
        if (!listingData) {
            for (const [key, data] of completedListings.entries()) {
                if (data.channelId === interaction.channel.id) {
                    listingData = data;
                    break;
                }
            }
        }
        
        console.log(`Buy button: Found data: ${!!listingData}, Channel: ${interaction.channel.id}`);
        
        if (!listingData) {
            await safeReply(interaction, {
                content: '❌ Could not find listing data.',
                ephemeral: true
            });
            return;
        }
        
        const buyModal = new ModalBuilder()
            .setCustomId('buy_account_modal')
            .setTitle('Buy an Account');
        
        const paymentMethodInput = new TextInputBuilder()
            .setCustomId('payment_method')
            .setLabel('Payment Method')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Crypto')
            .setRequired(true)
            .setMaxLength(50);
        
        const paymentRow = new ActionRowBuilder().addComponents(paymentMethodInput);
        buyModal.addComponents(paymentRow);
        
        await interaction.showModal(buyModal);
        return;
    }
    
    // Handle Unlist button (owner only)
    if (interaction.customId === 'unlist_account') {
        console.log(`🔍 Unlist button clicked in channel: ${interaction.channel.id}`);
        console.log(`🔍 Available listing keys:`, Array.from(completedListings.keys()));
        
        // Try multiple ways to find listing data with extensive logging
        let listingData = completedListings.get(interaction.channel.id) || 
                         completedListings.get(`channel-${interaction.channel.id}`) ||
                         completedListings.get(interaction.message.id) ||
                         completedListings.get(`message-${interaction.message.id}`);
        
        // If still not found, search through all listings
        if (!listingData) {
            console.log(`🔍 Searching through all ${completedListings.size} listings...`);
            for (const [key, data] of completedListings.entries()) {
                console.log(`🔍 Checking key: ${key}, channelId: ${data.channelId}`);
                if (data.channelId === interaction.channel.id) {
                    listingData = data;
                    console.log(`✅ Found matching listing by channel ID!`);
                    break;
                }
            }
        }
        
        if (!listingData) {
            console.log(`❌ No listing data found for channel ${interaction.channel.id}`);
            await safeReply(interaction, {
                content: `❌ Could not find listing data.\n\n**Debug Info:**\n- Channel ID: ${interaction.channel.id}\n- Total listings: ${completedListings.size}\n- Available keys: ${Array.from(completedListings.keys()).slice(0, 5).join(', ')}...`,
                ephemeral: true
            });
            return;
        }
        
        console.log(`✅ Found listing data for unlist operation`);
        
        // Check if user is the owner
        if (interaction.user.id !== listingData.ownerId) {
            await safeReply(interaction, {
                content: '❌ Only the account owner can unlist this account.',
                ephemeral: true
            });
            return;
        }
        
        // Show confirmation modal
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Confirm Unlist')
            .setDescription('Are you sure you want to unlist this account?\n\nThis action cannot be undone.')
            .setColor('#ff0000');
        
        const confirmButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_unlist')
                    .setLabel('Yes, Unlist')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
            );
        
        await safeReply(interaction, {
            embeds: [confirmEmbed],
            components: [confirmButton],
            ephemeral: true
        });
        return;
    }
    
    // Handle Confirm Unlist
    if (interaction.customId === 'confirm_unlist') {
        console.log(`🔍 Confirm unlist clicked in channel: ${interaction.channel.id}`);
        
        // Try multiple ways to find listing data with extensive logging
        let listingData = completedListings.get(interaction.channel.id) || 
                         completedListings.get(`channel-${interaction.channel.id}`) ||
                         completedListings.get(interaction.message.id) ||
                         completedListings.get(`message-${interaction.message.id}`);
        
        // If still not found, search through all listings
        if (!listingData) {
            console.log(`🔍 Searching through all ${completedListings.size} listings for confirm unlist...`);
            for (const [key, data] of completedListings.entries()) {
                if (data.channelId === interaction.channel.id) {
                    listingData = data;
                    console.log(`✅ Found matching listing by channel ID for confirm unlist!`);
                    break;
                }
            }
        }
        
        if (!listingData) {
            console.log(`❌ No listing data found for confirm unlist in channel ${interaction.channel.id}`);
            await safeReply(interaction, {
                content: '❌ Could not find listing data for unlisting.',
                ephemeral: true
            });
            return;
        }
        
        console.log(`✅ Found listing data for confirm unlist operation`);
        
        try {
            // Send to unlisted accounts channel
            const unlistedChannel = interaction.client.channels.cache.get(config.UNLISTED_ACCOUNTS_CHANNEL_ID);
            if (unlistedChannel) {
                const unlistedEmbed = new EmbedBuilder()
                    .setTitle(`🗃️ ${listingData.title}`)
                    .setDescription(`**Unlisted Account**\n\n` +
                        `${listingData.description}\n\n` +
                        `**💰 Price:** $${listingData.price} USD\n` +
                        `**💳 Payment Methods:** ${listingData.paymentText}\n` +
                        `**👤 Owner:** <@${listingData.ownerId}>\n` +
                        `**📅 Originally Listed:** ${listingData.listedDate}\n` +
                        `**📅 Unlisted:** ${new Date().toLocaleDateString()}`)
                    .setColor('#808080')
                    .setFooter({ text: 'David\'s Coins - Unlisted Accounts' })
                    .setTimestamp();
                
                const manageButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('relist_account')
                            .setLabel('Relist')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('🔄'),
                        new ButtonBuilder()
                            .setCustomId('configure_account')
                            .setLabel('Configure')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⚙️')
                    );
                
                await unlistedChannel.send({
                    embeds: [unlistedEmbed],
                    components: [manageButtons]
                });
            }
            
            // Update original listing to show it's unlisted
            const unlistedEmbed = new EmbedBuilder()
                .setTitle('🚫 Account Unlisted')
                .setDescription('This account has been removed from the marketplace by the owner.')
                .setColor('#ff0000')
                .setTimestamp();
            
            await interaction.message.edit({
                embeds: [unlistedEmbed],
                components: []
            });
            
            await safeReply(interaction, {
                content: '✅ Account has been unlisted and moved to the management channel.',
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Error unlisting account:', error);
            await safeReply(interaction, {
                content: '❌ Error unlisting account. Please contact an administrator.',
                ephemeral: true
            });
        }
        return;
    }
    
    // PayPal email copy button
    if (interaction.customId === 'copy_paypal_email') {
        await safeReply(interaction, {
            content: `📧 **PAYPAL Wallet Address:**\n\`D.Dovganyuk2409@gmail.com\`\n\n*Select and copy the address above!*`,
            ephemeral: true
        });
        return;
    }
    
    // Crypto copy buttons
    if (interaction.customId.startsWith('copy_')) {
        // Skip if it's the PayPal button (already handled above)
        if (interaction.customId === 'copy_paypal_email') return;
        
        const cryptoType = interaction.customId.split('_')[1].toUpperCase();
        const wallet = config.CRYPTO_WALLETS[cryptoType];
        
        await safeReply(interaction, {
            content: `📋 **${cryptoType} Wallet Address:**\n\`${wallet}\`\n\n*Select and copy the address above!*`,
            ephemeral: true
        });
        return;
    }
    
    // Buy/Sell coins buttons
    if (interaction.customId === 'buy_coins' || interaction.customId === 'sell_coins') {
        const type = interaction.customId === 'buy_coins' ? 'buy' : 'sell';
        const modalTitle = type === 'buy' ? 'Buy Coins' : 'Sell Coins';
        
        const modal = new ModalBuilder()
            .setCustomId(`${type}_modal`)
            .setTitle(modalTitle);
        
        const amountInput = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Amount of coins')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 300M, 500M, 1.5B')
            .setRequired(true);
        
        const paymentInput = new TextInputBuilder()
            .setCustomId('payment_method')
            .setLabel('Payment method')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('PayPal, BTC, ETH, LTC, USDT')
            .setRequired(true);
        
        const usernameInput = new TextInputBuilder()
            .setCustomId('minecraft_username')
            .setLabel('IGN')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Your Minecraft IGN')
            .setRequired(true);
        
        const firstRow = new ActionRowBuilder().addComponents(amountInput);
        const secondRow = new ActionRowBuilder().addComponents(paymentInput);
        const thirdRow = new ActionRowBuilder().addComponents(usernameInput);
        
        modal.addComponents(firstRow, secondRow, thirdRow);
        
        await interaction.showModal(modal);
        return;
    }
    
    // Calculate button
    if (interaction.customId === 'calculate_price') {
        const modal = new ModalBuilder()
            .setCustomId('calculate_modal')
            .setTitle('Price Calculator');
        
        const moneyInput = new TextInputBuilder()
            .setCustomId('money_amount')
            .setLabel('Money amount (USD)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., $100, 50, $25.50')
            .setRequired(true);
        
        const firstRow = new ActionRowBuilder().addComponents(moneyInput);
        modal.addComponents(firstRow);
        
        await interaction.showModal(modal);
        return;
    }
    
    // Price update button
    if (interaction.customId === 'open_price_modal') {
        if (!hasStaffRole(member)) {
            await safeReply(interaction, {
                content: '❌ Only staff members can update prices.',
                ephemeral: true
            });
            return;
        }
        
        const priceModal = new ModalBuilder()
            .setCustomId('update_prices')
            .setTitle('Update Prices');
        
        const under1bInput = new TextInputBuilder()
            .setCustomId('under1b_price')
            .setLabel('Buy Under 1B Price (per million)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('0.04')
            .setValue(config.prices.buyUnder1B.toString())
            .setRequired(true);
        
        const over1bInput = new TextInputBuilder()
            .setCustomId('over1b_price')
            .setLabel('Buy Over 1B Price (per million)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('0.035')
            .setValue(config.prices.buyOver1B.toString())
            .setRequired(true);
        
        const sellInput = new TextInputBuilder()
            .setCustomId('sell_price')
            .setLabel('Sell Price (per million)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('0.02')
            .setValue(config.prices.sell.toString())
            .setRequired(true);
        
        const firstRow = new ActionRowBuilder().addComponents(under1bInput);
        const secondRow = new ActionRowBuilder().addComponents(over1bInput);
        const thirdRow = new ActionRowBuilder().addComponents(sellInput);
        
        priceModal.addComponents(firstRow, secondRow, thirdRow);
        
        await interaction.showModal(priceModal);
        return;
    }
    
    // Close ticket button - UPDATED TO HANDLE ACCOUNT TICKETS
    if (interaction.customId === 'confirm_close') {
        if (!hasStaffRole(member)) {
            await safeReply(interaction, {
                content: '❌ Only staff members can close tickets.',
                ephemeral: true
            });
            return;
        }
        
        const channel = interaction.channel;
        // Updated to handle both ticket- and account-purchase- channels
        if (!channel.name || (!channel.name.startsWith('ticket-') && !channel.name.startsWith('account-purchase-'))) {
            await safeReply(interaction, {
                content: '❌ This can only be used in ticket channels.',
                ephemeral: true
            });
            return;
        }
        
        await safeReply(interaction, {
            content: '🔒 Generating transcript and closing ticket in 5 seconds...',
            ephemeral: true
        });
        
        setTimeout(async () => {
            try {
                // Generate transcript
                const messages = ticketMessages.get(channel.id) || [];
                const transcriptChannel = interaction.client.channels.cache.get(config.TRANSCRIPT_CHANNEL_ID);
                
                if (transcriptChannel && messages.length > 0) {
                    let transcriptText = `TICKET TRANSCRIPT - ${channel.name}\n`;
                    transcriptText += `Created: ${new Date(channel.createdTimestamp).toLocaleString()}\n`;
                    transcriptText += `Channel ID: ${channel.id}\n`;
                    transcriptText += `Total Messages: ${messages.length}\n\n`;
                    transcriptText += `--- CONVERSATION ---\n\n`;
                    
                    messages.forEach((msg) => {
                        const timestamp = new Date(msg.timestamp).toLocaleTimeString();
                        transcriptText += `[${timestamp}] ${msg.author}: ${msg.content}\n\n`;
                    });
                    
                    transcriptText += `--- END TRANSCRIPT ---\n`;
                    transcriptText += `Closed by: ${interaction.user.username}\n`;
                    transcriptText += `Closed on: ${new Date().toLocaleString()}\n`;
                    
                    const buffer = Buffer.from(transcriptText, 'utf-8');
                    const attachment = {
                        attachment: buffer,
                        name: `transcript-${channel.name}.txt`
                    };
                    
                    const transcriptEmbed = new EmbedBuilder()
                        .setTitle('📄 Ticket Transcript')
                        .setDescription(`Transcript for ${channel.name}`)
                        .addFields(
                            { name: 'Closed By', value: interaction.user.username, inline: true },
                            { name: 'Closed At', value: new Date().toLocaleString(), inline: true }
                        )
                        .setColor('#0099ff');
                    
                    await transcriptChannel.send({
                        embeds: [transcriptEmbed],
                        files: [attachment]
                    });
                }
                
                // Clear ticket data and delete channel
                ticketMessages.delete(channel.id);
                for (const [userId, channelId] of activeTickets.entries()) {
                    if (channelId === channel.id) {
                        activeTickets.delete(userId);
                        break;
                    }
                }
                await channel.delete();
            } catch (error) {
                console.error('Error generating transcript or deleting channel:', error);
                try {
                    await channel.delete();
                } catch (deleteError) {
                    console.error('Error deleting ticket channel:', deleteError);
                }
            }
        }, 5000);
        return;
    }
}

// Function to create the final account listing
async function createAccountListing(interaction, listingData) {
    try {
        const guild = interaction.guild;
        
        // Use the correct category ID for listings
        const categoryId = config.PROFILE_CATEGORY_ID; // This should be 1393744189187166279
        
        if (!categoryId) {
            await safeReply(interaction, {
                content: '❌ Listing category not found. Please contact an administrator.',
                ephemeral: true
            });
            return;
        }
        
        // Create the channel name in the format: $ 1500 | listing-2 ⭐ (like your images)
        const randomNumber = Math.floor(Math.random() * 20) + 1;
        const channelName = `$ ${listingData.worth} | listing-${randomNumber} ⭐`;
        
        console.log(`Creating channel: ${channelName} in category: ${categoryId}`);
        
        // Create the listing channel
        const listingChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                {
                    id: guild.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                    deny: [PermissionFlagsBits.SendMessages]
                },
                {
                    id: config.STAFF_ROLE_ID,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
                }
            ]
        });
        
        // Create the main account information embed matching your exact design
        const accountInfoEmbed = new EmbedBuilder()
            .setTitle('Account Information')
            .setDescription('**Rank**\n(VIP+)\n\n' +
                '🎯 **Skill Average**    💀 **Catacombs**\n' +
                '30.12                    31 (5.16M XP)\n\n' +
                '⚔️ **Slayers**                      🌟 **Level**\n' +
                '7/6/6/5/0/0                     132.75\n\n' +
                '💰 **Networth**\n' +
                '51.60M (22.19M + 0.09 Coins)\n' +
                '7.04M Soulbound\n\n' +
                '🏔️ **HOTM**\n' +
                '⛏️ Heart of the Mountain: 0\n' +
                '💎 Mithril Powder: 186.35K\n' +
                '💎 Gemstone Powder: 1.2K\n' +
                '💎 Glacite Powder: 0\n\n' +
                `💰 **Price**\n${listingData.price}$\n\n` +
                `💳 **Payment Method(s)**\n${listingData.paymentText}`)
            .setColor('#9d4edd')
            .setFooter({ text: 'Made by Gulubero' })
            .setThumbnail('https://crafatar.com/avatars/steve?overlay');
        
        // Create action buttons matching your design
        const actionButtons1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('toggle_ping')
                    .setLabel('Toggle Ping')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚠️'),
                new ButtonBuilder()
                    .setCustomId('account_owner')
                    .setLabel('Account Owner')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👤'),
                new ButtonBuilder()
                    .setCustomId('extra_information')
                    .setLabel('Extra Information')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋')
            );
        
        const actionButtons2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('buy_account')
                    .setLabel('Buy')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💰'),
                new ButtonBuilder()
                    .setCustomId('pricing_info')
                    .setLabel('Pricing')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('💸'),
                new ButtonBuilder()
                    .setCustomId('unlist_account')
                    .setLabel('Unlist')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
            );
        
        // Send the main account listing embed
        const listingMessage = await listingChannel.send({
            embeds: [accountInfoEmbed],
            components: [actionButtons1, actionButtons2]
        });
        
        // Store completed listing data with BOTH message ID and channel ID for backup
        const listingDataWithIds = {
            ...listingData,
            messageId: listingMessage.id,
            channelId: listingChannel.id,
            listedDate: new Date().toLocaleDateString(),
            channelName: channelName
        };
        
        // Store by multiple keys for redundancy
        completedListings.set(listingMessage.id, listingDataWithIds);
        completedListings.set(listingChannel.id, listingDataWithIds);
        completedListings.set(`channel-${listingChannel.id}`, listingDataWithIds);
        completedListings.set(`message-${listingMessage.id}`, listingDataWithIds);
        
        console.log(`✅ Stored listing data for channel: ${listingChannel.id} and message: ${listingMessage.id}`);
        console.log(`✅ Total listings stored: ${completedListings.size}`);
        console.log(`✅ Available keys:`, Array.from(completedListings.keys()));
        
        // Clear active listing data
        activeListings.delete(interaction.user.id);
        botStats.profilesListed++;
        botStats.messagesSent++;
        
        // Send confirmation
        const confirmEmbed = new EmbedBuilder()
            .setTitle('✅ Account Listed Successfully!')
            .setDescription(`Your ${listingData.type} has been listed!\n\n` +
                `**Title:** ${listingData.title}\n` +
                `**Price:** ${listingData.price} USD\n` +
                `**Worth:** ${listingData.worth}\n` +
                `**Payment Methods:** ${listingData.paymentMethods.join(', ')}\n` +
                `**Owner:** <@${listingData.ownerId}>\n\n` +
                `**Channel:** ${listingChannel}\n` +
                `**Direct Link:** ${listingMessage.url}`)
            .setColor('#00ff00')
            .setFooter({ text: 'David\'s Coins - Listing Confirmation' });
        
        await safeReply(interaction, {
            embeds: [confirmEmbed],
            ephemeral: true
        });
        
    } catch (error) {
        console.error('Error creating account listing:', error);
        activeListings.delete(interaction.user.id);
        await safeReply(interaction, {
            content: '❌ Error creating listing. Please try again later.',
            ephemeral: true
        });
    }
}

module.exports = { handleButtonInteractions, createAccountListing, completedListings };
