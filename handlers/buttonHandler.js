const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { hasStaffRole, safeReply, parseAmount, calculatePrice, formatNumber } = require('../utils/utils');
const { activeListings, activeTickets, ticketMessages, botStats } = require('../utils/stats');
const { createListingEmbed, createBuyerNotificationEmbed } = require('../utils/embeds');
const config = require('../config/config');

// Store completed listings (in production, use a database)
const completedListings = new Map(); // messageId -> fullListingData

async function handleButtonInteractions(interaction) {
    const member = interaction.guild.members.cache.get(interaction.user.id);
    
    // Handle listing type selection
    if (interaction.customId === 'list_account' || interaction.customId === 'list_profile') {
        const listingData = activeListings.get(interaction.user.id);
        if (!listingData) {
            await safeReply(interaction, {
                content: '❌ Listing session expired. Please use `/list` again.',
                ephemeral: true
            });
            return;
        }
        
        const listingType = interaction.customId === 'list_account' ? 'account' : 'profile';
        listingData.type = listingType;
        listingData.step = 'details_input';
        
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
            .setPlaceholder('e.g., 1400 (will show as $ 1400 | account-4 ⭐)')
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
        const listingData = activeListings.get(interaction.user.id);
        if (!listingData || listingData.step !== 'payment_selection') {
            await safeReply(interaction, {
                content: '❌ Listing session expired. Please use `/list` again.',
                ephemeral: true
            });
            return;
        }
        
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
        const listingData = completedListings.get(interaction.message.id);
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
        const listingData = completedListings.get(interaction.message.id);
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
        const listingData = completedListings.get(interaction.message.id);
        if (!listingData) {
            await safeReply(interaction, {
                content: '❌ Could not find listing data.',
                ephemeral: true
            });
            return;
        }
        
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
        const listingData = completedListings.get(interaction.message.id);
        if (!listingData) {
            await safeReply(interaction, {
                content: '❌ Could not find listing data.',
                ephemeral: true
            });
            return;
        }
        
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
    
    // Handle Buy Now button for listings
    if (interaction.customId === 'buy_listing') {
        const buyModal = new ModalBuilder()
            .setCustomId('buy_listing_modal')
            .setTitle('Purchase Listing');
        
        const contactInput = new TextInputBuilder()
            .setCustomId('contact_info')
            .setLabel('Contact Information')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Discord username, email, or preferred contact method')
            .setRequired(true)
            .setMaxLength(100);
        
        const messageInput = new TextInputBuilder()
            .setCustomId('buyer_message')
            .setLabel('Message to Seller (Optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Any questions or additional information...')
            .setRequired(false)
            .setMaxLength(500);
        
        const firstRow = new ActionRowBuilder().addComponents(contactInput);
        const secondRow = new ActionRowBuilder().addComponents(messageInput);
        
        buyModal.addComponents(firstRow, secondRow);
        
        await interaction.showModal(buyModal);
        return;
    }
    
    // Handle unlist button
    if (interaction.customId.startsWith('unlist_')) {
        if (!hasStaffRole(member)) {
            await safeReply(interaction, {
                content: '❌ Only staff can remove listings.',
                ephemeral: true
            });
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🚫 Listing Removed')
            .setDescription('This listing has been removed by staff.')
            .setColor('#ff0000')
            .setTimestamp();
        
        await interaction.update({
            embeds: [embed],
            components: []
        });
        return;
    }
    
    // Crypto copy buttons
    if (interaction.customId.startsWith('copy_')) {
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
    
    // Close ticket button
    if (interaction.customId === 'confirm_close') {
        if (!hasStaffRole(member)) {
            await safeReply(interaction, {
                content: '❌ Only staff members can close tickets.',
                ephemeral: true
            });
            return;
        }
        
        const channel = interaction.channel;
        if (!channel.name || !channel.name.startsWith('ticket-')) {
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
        const profileChannel = guild.channels.cache.get(config.PROFILE_CHANNEL_ID);
        
        if (!profileChannel) {
            await safeReply(interaction, {
                content: '❌ Profile channel not found. Please contact an administrator.',
                ephemeral: true
            });
            return;
        }
        
        // Create the channel name in the format: $ 1400 | account-4 ⭐
        const channelName = `$ ${listingData.worth} | account-${Math.floor(Math.random() * 10)} ⭐`;
        
        // Create the listing channel
        const listingChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: config.PROFILE_CATEGORY_ID,
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
        
        // Create listing embed
        const listingEmbed = new EmbedBuilder()
            .setTitle(`${config.EMOJIS.SKYBLOCK} ${listingData.title}`)
            .setDescription(`**${listingData.type.charAt(0).toUpperCase() + listingData.type.slice(1)} for Sale**\n\n` +
                `${listingData.description}\n\n` +
                `**💰 Price:** $${listingData.price} USD\n` +
                `**💳 Payment Methods:** ${listingData.paymentText}\n` +
                `**📅 Listed:** ${new Date().toLocaleDateString()}`)
            .setColor('#9d4edd')
            .setFooter({ text: 'David\'s Coins - Skyblock Marketplace' })
            .setTimestamp();
        
        // Create action buttons with Account Owner button
        const listingButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('account_owner')
                    .setLabel('Account Owner')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👤'),
                new ButtonBuilder()
                    .setCustomId('buy_account')
                    .setLabel('Buy')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💰'),
                new ButtonBuilder()
                    .setCustomId('unlist_account')
                    .setLabel('Unlist')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
            );
        
        // Send listing to the new channel
        const listingMessage = await listingChannel.send({
            embeds: [listingEmbed],
            components: [listingButtons]
        });
        
        // Store completed listing data
        completedListings.set(listingMessage.id, {
            ...listingData,
            messageId: listingMessage.id,
            channelId: listingChannel.id,
            listedDate: new Date().toLocaleDateString()
        });
        
        // Clear active listing data
        activeListings.delete(interaction.user.id);
        botStats.profilesListed++;
        botStats.messagesSent++;
        
        // Send confirmation
        const confirmEmbed = new EmbedBuilder()
            .setTitle('✅ Account Listed Successfully!')
            .setDescription(`Your ${listingData.type} has been listed!\n\n` +
                `**Title:** ${listingData.title}\n` +
                `**Price:** $${listingData.price} USD\n` +
                `**Worth:** $${listingData.worth}\n` +
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
