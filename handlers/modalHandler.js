const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { hasStaffRole, safeReply, parseAmount, calculatePrice, formatNumber, calculateCoinsForMoney } = require('../utils/utils');
const { activeListings, activeTickets, ticketMessages, botStats } = require('../utils/stats');
const { createBuyerNotificationEmbed } = require('../utils/embeds');
const { addTrade, getOrCreateUser } = require('../utils/database');
const config = require('../config/config');

async function handleModalSubmissions(interaction) {
    console.log(`🎭 Modal submitted: ${interaction.customId}`);
    
    // Handle buy account modal
    if (interaction.customId === 'buy_account_modal') {
        const { completedListings } = require('./buttonHandler');
        
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
        
        if (!listingData) {
            await safeReply(interaction, {
                content: '❌ Could not find listing data.',
                ephemeral: true
            });
            return;
        }
        
        const paymentMethod = interaction.fields.getTextInputValue('payment_method');
        
        // Create private ticket with owner and buyer
        const guild = interaction.guild;
        const category = guild.channels.cache.get(config.TICKET_CATEGORY_ID);
        
        const channelName = `account-purchase-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}${Date.now().toString().slice(-4)}`;
        
        try {
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: listingData.ownerId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: config.OWNER_USER_ID,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
                    }
                ]
            });
            
            const purchaseEmbed = new EmbedBuilder()
                .setTitle('🛒 Account Purchase Request')
                .setDescription(`**Account:** ${listingData.title}\n` +
                    `**Price:** $${listingData.price} USD\n` +
                    `**Payment Method:** ${paymentMethod}\n` +
                    `**Buyer:** ${interaction.user}\n` +
                    `**Seller:** <@${listingData.ownerId}>\n\n` +
                    `**Next Steps:**\n` +
                    `• Seller and buyer discuss transaction details\n` +
                    `• Payment is processed\n` +
                    `• Account access is transferred\n\n` +
                    `**Purchase request created at ${new Date().toLocaleString()}**`)
                .setColor('#00ff00')
                .setFooter({ text: 'David\'s Coins - Account Purchase' });
            
            const closeButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_close')
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );
            
            await ticketChannel.send({
                content: `${interaction.user} <@${listingData.ownerId}> <@${config.OWNER_USER_ID}>`,
                embeds: [purchaseEmbed],
                components: [closeButton]
            });
            
            // Initialize ticket message tracking
            ticketMessages.set(ticketChannel.id, [{
                author: 'David\'s Coins [BOT]',
                content: `Purchase request for ${listingData.title}`,
                timestamp: new Date().toISOString()
            }]);
            
            botStats.ticketsCreated++;
            botStats.messagesSent++;
            
            await safeReply(interaction, {
                content: `✅ Purchase request created! Please check ${ticketChannel} to discuss with the seller.`,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Error creating purchase ticket:', error);
            await safeReply(interaction, {
                content: '❌ Error creating purchase ticket. Please contact an administrator.',
                ephemeral: true
            });
        }
        return;
    }
    
    // Handle owner selection modal
    if (interaction.customId === 'owner_selection') {
        const listingData = activeListings.get(interaction.user.id);
        if (!listingData) {
            await safeReply(interaction, {
                content: '❌ Listing session expired. Please use `/list` again.',
                ephemeral: true
            });
            return;
        }
        
        const ownerInput = interaction.fields.getTextInputValue('account_owner');
        
        // Extract user ID from mention or direct ID
        let ownerId = ownerInput.replace(/[<@!>]/g, '');
        
        // Validate user exists
        try {
            const owner = await interaction.client.users.fetch(ownerId);
            listingData.ownerId = ownerId;
            listingData.ownerUsername = owner.username;
            
            // Create final listing
            const { createAccountListing } = require('./buttonHandler');
            await createAccountListing(interaction, listingData);
        } catch (error) {
            await safeReply(interaction, {
                content: '❌ Invalid user ID or mention. Please provide a valid Discord user.',
                ephemeral: true
            });
        }
        return;
    }
    
    // Listing details modal submission
    if (interaction.customId === 'listing_details') {
        const listingData = activeListings.get(interaction.user.id);
        if (!listingData) {
            await safeReply(interaction, {
                content: '❌ Listing session expired. Please use `/list` again.',
                ephemeral: true
            });
            return;
        }
        
        const title = interaction.fields.getTextInputValue('listing_title');
        const description = interaction.fields.getTextInputValue('listing_description');
        const priceText = interaction.fields.getTextInputValue('listing_price');
        const worthText = interaction.fields.getTextInputValue('account_worth');
        
        // Validate price
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (isNaN(price) || price <= 0) {
            await safeReply(interaction, {
                content: '❌ Invalid price. Please enter a valid number (e.g., 150, 250.50).',
                ephemeral: true
            });
            return;
        }
        
        // Validate worth
        const worth = parseFloat(worthText.replace(/[^0-9.]/g, ''));
        if (isNaN(worth) || worth <= 0) {
            await safeReply(interaction, {
                content: '❌ Invalid account worth. Please enter a valid number (e.g., 1400).',
                ephemeral: true
            });
            return;
        }
        
        // Store listing data
        listingData.title = title;
        listingData.description = description;
        listingData.price = price;
        listingData.worth = worth;
        listingData.step = 'payment_selection';
        
        // Create payment method selection
        const paymentEmbed = new EmbedBuilder()
            .setTitle('💳 Select Payment Methods')
            .setDescription('**Which payment methods do you accept for this listing?**\n\n' +
                `${config.EMOJIS.LTC} **Litecoin (LTC)** - Cryptocurrency payment\n` +
                `${config.EMOJIS.PAYPAL} **PayPal** - Traditional payment method\n` +
                '🔄 **Both** - Accept both LTC and PayPal\n\n' +
                'Choose your preferred payment option:')
            .setColor('#00ff00')
            .setFooter({ text: 'David\'s Coins - Payment Selection' });
        
        const paymentButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('payment_ltc')
                    .setLabel('LTC Only')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('1387494812269412372'),
                new ButtonBuilder()
                    .setCustomId('payment_paypal')
                    .setLabel('PayPal Only')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('1393746529101156383'),
                new ButtonBuilder()
                    .setCustomId('payment_both')
                    .setLabel('Both')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔄')
            );
        
        await safeReply(interaction, {
            embeds: [paymentEmbed],
            components: [paymentButtons],
            ephemeral: true
        });
        return;
    }
    
    // 🔥 COMPLETELY FIXED TICKET CONFIGURE CLOSE MODAL 🔥
    if (interaction.customId === 'ticket_configure_close') {
        console.log(`🔧 Processing ticket configure close modal`);
        
        const coinsText = interaction.fields.getTextInputValue('trade_coins');
        const priceText = interaction.fields.getTextInputValue('trade_price');
        const buyerText = interaction.fields.getTextInputValue('trade_buyer');
        const sellerText = interaction.fields.getTextInputValue('trade_seller');
        const paymentMethod = interaction.fields.getTextInputValue('trade_payment');
        
        console.log(`📝 Modal inputs:`, { coinsText, priceText, buyerText, sellerText, paymentMethod });
        
        // Parse and validate inputs
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (isNaN(price) || price <= 0) {
            await safeReply(interaction, {
                content: '❌ Invalid price. Please enter a valid number.',
                ephemeral: true
            });
            return;
        }
        
        // Parse buyer ID
        let buyerId = buyerText.replace(/[<@!>]/g, '');
        
        // Parse seller ID
        let sellerId = sellerText.replace(/[<@!>]/g, '');
        
        // Handle "David's Coins" as seller
        if (sellerText.toLowerCase().includes('david') || sellerText.toLowerCase().includes('coins')) {
            sellerId = config.OWNER_USER_ID;
        }
        
        try {
            // Validate buyer exists
            const buyer = await interaction.client.users.fetch(buyerId);
            
            // Validate seller exists or is David
            let seller;
            if (sellerId === config.OWNER_USER_ID) {
                seller = { username: 'David\'s Coins', id: config.OWNER_USER_ID };
            } else {
                seller = await interaction.client.users.fetch(sellerId);
            }
            
            // Determine trade type based on participants
            let tradeType = 'buy'; // Default
            if (coinsText.toLowerCase().includes('account')) {
                tradeType = 'account_purchase';
            } else if (buyerId === config.OWNER_USER_ID) {
                tradeType = 'sell'; // David is buying, so customer is selling
            } else if (sellerId === config.OWNER_USER_ID) {
                tradeType = 'buy'; // David is selling, so customer is buying
            }
            
            // Record the trade
            const tradeData = {
                type: tradeType,
                amount: coinsText,
                price: price,
                buyerId: buyerId,
                sellerId: sellerId,
                buyerUsername: buyer.username,
                sellerUsername: seller.username,
                paymentMethod: paymentMethod,
                channelId: interaction.channel.id,
                notes: `Configured trade - Channel: ${interaction.channel.name}`
            };
            
            console.log(`📊 Recording configured trade:`, tradeData);
            
            // Add trade to database
            const recordedTrade = addTrade(tradeData);
            console.log(`✅ Trade recorded successfully: ${recordedTrade.tradeId}`);
            
            // Show success message
            await safeReply(interaction, {
                content: `✅ Trade configured and recorded successfully!\n\n**Details:**\n• Type: ${tradeData.type.toUpperCase()}\n• Amount: ${tradeData.amount}\n• Price: ${tradeData.price}\n• Buyer: ${buyer.username}\n• Seller: ${seller.username}\n• Payment: ${paymentMethod}\n\nClosing ticket...`,
                ephemeral: true
            });
            
            // Close the ticket after short delay
            setTimeout(async () => {
                const { finalizeTicketClosure } = require('./buttonHandler');
                await finalizeTicketClosure(interaction, tradeData);
            }, 2000);
            
        } catch (error) {
            console.error('❌ Error processing configured trade:', error);
            await safeReply(interaction, {
                content: '❌ Error processing trade. Please check the user IDs and try again.',
                ephemeral: true
            });
        }
        return;
    }
    
    // Handle manual history configuration
    if (interaction.customId === 'manual_history_configure') {
        console.log(`📜 Processing manual history configuration`);
        
        const userIdText = interaction.fields.getTextInputValue('user_id');
        const tradesText = interaction.fields.getTextInputValue('trade_history');
        
        let userId = userIdText.replace(/[<@!>]/g, '');
        
        try {
            const user = await interaction.client.users.fetch(userId);
            console.log(`👤 Adding manual history for: ${user.username} (${userId})`);
            
            // Parse trade history
            const trades = tradesText.split('\n').filter(line => line.trim());
            console.log(`📝 Processing ${trades.length} trade lines`);
            
            let successCount = 0;
            for (const tradeLine of trades) {
                try {
                    // Parse each trade line
                    // Expected format: "buy 500M $20 PayPal 2024-01-15" or "sell 1B $35 BTC 2024-01-10"
                    const parts = tradeLine.trim().split(' ');
                    if (parts.length >= 4) {
                        const type = parts[0].toLowerCase();
                        const amount = parts[1];
                        const priceStr = parts[2].replace(/[^0-9.]/g, '');
                        const price = parseFloat(priceStr);
                        const paymentMethod = parts[3];
                        const date = parts[4] || new Date().toISOString();
                        
                        console.log(`💰 Parsing trade: ${type} ${amount} ${price} ${paymentMethod}`);
                        
                        if ((type === 'buy' || type === 'sell' || type === 'account') && !isNaN(price) && price > 0) {
                            const tradeData = {
                                type: type === 'account' ? 'account_purchase' : type,
                                amount: type === 'account' ? 'Account' : amount,
                                price: price,
                                buyerId: type === 'buy' ? userId : config.OWNER_USER_ID,
                                sellerId: type === 'sell' ? userId : config.OWNER_USER_ID,
                                buyerUsername: type === 'buy' ? user.username : 'David\'s Coins',
                                sellerUsername: type === 'sell' ? user.username : 'David\'s Coins',
                                paymentMethod: paymentMethod,
                                notes: 'Manual history entry',
                                timestamp: date
                            };
                            
                            console.log(`✅ Adding trade to database:`, tradeData);
                            addTrade(tradeData);
                            successCount++;
                        } else {
                            console.log(`❌ Invalid trade format: ${tradeLine}`);
                        }
                    } else {
                        console.log(`❌ Insufficient parts in trade line: ${tradeLine}`);
                    }
                } catch (tradeError) {
                    console.error('❌ Error parsing trade:', tradeLine, tradeError);
                }
            }
            
            console.log(`📊 Manual history complete: ${successCount}/${trades.length} trades added`);
            
            await safeReply(interaction, {
                content: `✅ Successfully added ${successCount} trades to ${user.username}'s history!\n\n**Summary:**\n• Total lines processed: ${trades.length}\n• Successful trades: ${successCount}\n• Failed trades: ${trades.length - successCount}\n\nUse \`!profile @${user.username}\` to verify the data.`,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('❌ Error in manual history configuration:', error);
            await safeReply(interaction, {
                content: '❌ Invalid user ID. Please check and try again.',
                ephemeral: true
            });
        }
        return;
    }
    
    // Buy/Sell modal submissions
    if (interaction.customId === 'buy_modal' || interaction.customId === 'sell_modal') {
        const type = interaction.customId === 'buy_modal' ? 'buy' : 'sell';
        const amount = interaction.fields.getTextInputValue('amount');
        const paymentMethod = interaction.fields.getTextInputValue('payment_method');
        const minecraftUsername = interaction.fields.getTextInputValue('minecraft_username');
        
        console.log(`🎫 Creating ${type} ticket for ${minecraftUsername}`);
        
        // Check if user already has an active ticket
        if (activeTickets.has(interaction.user.id)) {
            const existingChannelId = activeTickets.get(interaction.user.id);
            const existingChannel = interaction.guild.channels.cache.get(existingChannelId);
            
            if (existingChannel) {
                await safeReply(interaction, {
                    content: `❌ You already have an active ticket: ${existingChannel}. Please close your current ticket before opening a new one.`,
                    ephemeral: true
                });
                return;
            } else {
                activeTickets.delete(interaction.user.id);
            }
        }
        
        // Parse amount
        const parsedAmount = parseAmount(amount);
        if (parsedAmount <= 0) {
            await safeReply(interaction, {
                content: '❌ Invalid amount. Please enter a valid number (e.g., 500M, 1.5B).',
                ephemeral: true
            });
            return;
        }
        
        // Calculate price
        const price = calculatePrice(parsedAmount, type);
        const formattedAmount = formatNumber(parsedAmount);
        
        console.log(`💰 Calculated: ${formattedAmount} = ${price.toFixed(2)}`);
        
        // Create ticket channel
        const guild = interaction.guild;
        const category = guild.channels.cache.get(config.TICKET_CATEGORY_ID);
        
        const channelName = `ticket-${minecraftUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}${Date.now().toString().slice(-4)}`;
        
        try {
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: config.STAFF_ROLE_ID,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
                    }
                ]
            });
            
            // Add user to active tickets tracking
            activeTickets.set(interaction.user.id, ticketChannel.id);
            
            // Create ticket embed
            const ticketEmbed = new EmbedBuilder()
                .setTitle(`🎫 ${type === 'buy' ? 'Buy' : 'Sell'} Ticket - ${minecraftUsername}`)
                .setDescription(`**Transaction Details:**\n\n` +
                    `**Type:** ${type === 'buy' ? 'Buying' : 'Selling'} coins\n` +
                    `**Amount:** ${formattedAmount} coins\n` +
                    `**Price:** ${price.toFixed(2)} USD\n` +
                    `**Payment Method:** ${paymentMethod}\n` +
                    `**IGN:** ${minecraftUsername}\n` +
                    `**Customer:** ${interaction.user}\n\n` +
                    `**Rate Used:** ${type === 'sell' ? config.prices.sell : (parsedAmount >= 1000000000 ? config.prices.buyOver1B : config.prices.buyUnder1B)}/M`)
                .setColor(type === 'buy' ? '#00ff00' : '#ff6600')
                .setFooter({ text: `Ticket created at ${new Date().toLocaleString()}` });
            
            const closeButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_close')
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );
            
            await ticketChannel.send({
                content: `${interaction.user} <@&${config.STAFF_ROLE_ID}>`,
                embeds: [ticketEmbed],
                components: [closeButton]
            });
            
            // Initialize ticket message tracking
            ticketMessages.set(ticketChannel.id, [{
                author: 'David\'s Coins [BOT]',
                content: `Ticket created for ${type === 'buy' ? 'buying' : 'selling'} ${formattedAmount} coins for ${price.toFixed(2)} via ${paymentMethod}`,
                timestamp: new Date().toISOString()
            }]);
            
            botStats.ticketsCreated++;
            botStats.messagesSent++;
            
            console.log(`✅ Ticket created: ${ticketChannel.name}`);
            
            await safeReply(interaction, {
                content: `✅ Ticket created! Please check ${ticketChannel} to continue your transaction.`,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('❌ Error creating ticket channel:', error);
            await safeReply(interaction, {
                content: '❌ Error creating ticket. Please contact an administrator.',
                ephemeral: true
            });
        }
        return;
    }
    
    // Calculate modal submission
    if (interaction.customId === 'calculate_modal') {
        const moneyAmount = interaction.fields.getTextInputValue('money_amount');
        const coins = calculateCoinsForMoney(moneyAmount);
        
        console.log(`🧮 Calculate: ${moneyAmount} = ${coins} coins`);
        
        if (coins <= 0) {
            await safeReply(interaction, {
                content: '❌ Invalid money amount. Please enter a valid dollar amount (e.g., $100, 50).',
                ephemeral: true
            });
            return;
        }
        
        const formattedCoins = formatNumber(coins);
        const cleanMoney = moneyAmount.replace(/[^0-9.]/g, '');
        const rate = coins >= 1000000000 ? config.prices.buyOver1B : config.prices.buyUnder1B;
        
        const calculateEmbed = new EmbedBuilder()
            .setTitle('🧮 Price Calculation')
            .setDescription(`**For ${cleanMoney} USD, you can buy:**\n\n` +
                `**${formattedCoins} coins**\n\n` +
                `**Rate used:** ${rate}/M\n` +
                `**Calculation:** ${cleanMoney} ÷ ${rate} = ${(coins / 1000000).toFixed(0)}M coins\n\n` +
                `*Use the Buy button on the main info message to start your transaction!*`)
            .setColor('#0099ff')
            .setFooter({ text: 'Prices may change without notice' });
        
        await safeReply(interaction, {
            embeds: [calculateEmbed],
            ephemeral: true
        });
        return;
    }
    
    // Update prices modal
    if (interaction.customId === 'update_prices') {
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (!hasStaffRole(member)) {
            await safeReply(interaction, {
                content: '❌ Only staff members can update prices.',
                ephemeral: true
            });
            return;
        }
        
        const under1b = parseFloat(interaction.fields.getTextInputValue('under1b_price'));
        const over1b = parseFloat(interaction.fields.getTextInputValue('over1b_price'));
        const sell = parseFloat(interaction.fields.getTextInputValue('sell_price'));
        
        console.log(`💰 Updating prices: ${under1b}, ${over1b}, ${sell}`);
        
        if (isNaN(under1b) || isNaN(over1b) || isNaN(sell)) {
            await safeReply(interaction, {
                content: '❌ Invalid price values. Please enter valid decimal numbers.',
                ephemeral: true
            });
            return;
        }
        
        config.prices.buyUnder1B = under1b;
        config.prices.buyOver1B = over1b;
        config.prices.sell = sell;
        
        const updateEmbed = new EmbedBuilder()
            .setTitle('✅ Prices Updated Successfully')
            .addFields(
                { name: 'Buy Under 1B', value: `${under1b}/M`, inline: true },
                { name: 'Buy Over 1B', value: `${over1b}/M`, inline: true },
                { name: 'Sell Price', value: `${sell}/M`, inline: true }
            )
            .setColor('#00ff00')
            .setFooter({ text: `Updated by ${interaction.user.username}` });
        
        await safeReply(interaction, {
            embeds: [updateEmbed],
            ephemeral: true
        });
        
        console.log(`✅ Prices updated by ${interaction.user.username}`);
        return;
    }
    
    // Handle any unrecognized modal
    console.log(`⚠️ Unhandled modal submission: ${interaction.customId}`);
    await safeReply(interaction, {
        content: '❌ Unknown modal submission. Please try again.',
        ephemeral: true
    });
}

module.exports = { handleModalSubmissions };
