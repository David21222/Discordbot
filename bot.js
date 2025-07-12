const targetUserId = userIdMatch[1];
                const targetUser = message.guild.members.cache.get(targetUserId);
                if (!targetUser) {
                    await message.channel.send('❌ User not found in this server.').then(msg => {
                        setTimeout(() => safeDeleteMessage(msg), 5000);
                    });
                    return;
                }
                
                // Parse amount
                const parsedAmount = parseAmount(amountStr);
                if (parsedAmount <= 0) {
                    await message.channel.send('❌ Invalid amount. Please enter a valid number (e.g., 500M, 1.5B)').then(msg => {
                        setTimeout(() => safeDeleteMessage(msg), 5000);
                    });
                    return;
                }
                
                // Calculate price (assume buy rate)
                const price = calculatePrice(parsedAmount, 'buy');
                const formattedAmount = formatNumber(parsedAmount);
                
                // Add to user's history
                if (!userHistory.has(targetUserId)) {
                    userHistory.set(targetUserId, []);
                }
                
                const trade = {
                    type: 'buy', // Default to buy for manual entries
                    amount: parsedAmount,
                    price: price,
                    date: new Date().toISOString(),
                    addedBy: message.author.username,
                    manual: true
                };
                
                userHistory.get(targetUserId).push(trade);
                
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Trade Added to History')
                    .setDescription(`Successfully added trade to ${targetUser.user.username}'s history!`)
                    .addFields(
                        { name: 'Amount', value: formattedAmount, inline: true },
                        { name: 'Estimated Value', value: `${price.toFixed(2)}`, inline: true },
                        { name: 'Added By', value: message.author.username, inline: true }
                    )
                    .setColor('#00ff00')
                    .setFooter({ text: 'Manual trade entry completed' });
                
                await message.channel.send({ embeds: [successEmbed] });
                botStats.messagesSent++;
                break;
            
            default:
                await message.channel.send('❌ Unknown command. Use `!help` for a list of commands.').then(msg => {
                    setTimeout(() => safeDeleteMessage(msg), 5000);
                });
        }
    } catch (error) {
        console.error('Command error:', error);
        await message.channel.send('❌ An error occurred while processing your command.').then(msg => {
            setTimeout(() => safeDeleteMessage(msg), 5000);
        });
    }
});

// Interaction handler
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isButton()) {
            const member = interaction.guild.members.cache.get(interaction.user.id);
            
            // Crypto copy buttons
            if (interaction.customId.startsWith('copy_')) {
                const cryptoType = interaction.customId.split('_')[1].toUpperCase();
                const wallet = CRYPTO_WALLETS[cryptoType];
                
                await safeReply(interaction, {
                    content: `📋 **${cryptoType} Wallet Address:**\n\`${wallet}\`\n\n*Select and copy the address above!*`,
                    ephemeral: true
                });
                return;
            }
            
            // Buy/Sell buttons
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
                    .setValue(prices.buyUnder1B.toString())
                    .setRequired(true);
                
                const over1bInput = new TextInputBuilder()
                    .setCustomId('over1b_price')
                    .setLabel('Buy Over 1B Price (per million)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('0.035')
                    .setValue(prices.buyOver1B.toString())
                    .setRequired(true);
                
                const sellInput = new TextInputBuilder()
                    .setCustomId('sell_price')
                    .setLabel('Sell Price (per million)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('0.02')
                    .setValue(prices.sell.toString())
                    .setRequired(true);
                
                const firstRow = new ActionRowBuilder().addComponents(under1bInput);
                const secondRow = new ActionRowBuilder().addComponents(over1bInput);
                const thirdRow = new ActionRowBuilder().addComponents(sellInput);
                
                priceModal.addComponents(firstRow, secondRow, thirdRow);
                
                await interaction.showModal(priceModal);
                return;
            }
            
            // Order completion buttons (staff only)
            if (interaction.customId === 'order_filled' || interaction.customId === 'order_not_filled' || interaction.customId === 'configure_amount') {
                if (!hasStaffRole(member)) {
                    await safeReply(interaction, {
                        content: '❌ Only staff members can manage order completion.',
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
                
                if (interaction.customId === 'configure_amount') {
                    const configModal = new ModalBuilder()
                        .setCustomId('configure_trade_amount')
                        .setTitle('Configure Trade Amount');
                    
                    const amountInput = new TextInputBuilder()
                        .setCustomId('actual_amount')
                        .setLabel('Actual amount traded')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g., 800M, 1.2B (actual coins traded)')
                        .setRequired(true);
                    
                    const priceInput = new TextInputBuilder()
                        .setCustomId('actual_price')
                        .setLabel('Actual price (USD)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g., 32.00 (actual amount paid)')
                        .setRequired(true);
                    
                    const notesInput = new TextInputBuilder()
                        .setCustomId('trade_notes')
                        .setLabel('Additional notes (optional)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Any special notes about this trade...')
                        .setRequired(false);
                    
                    const firstRow = new ActionRowBuilder().addComponents(amountInput);
                    const secondRow = new ActionRowBuilder().addComponents(priceInput);
                    const thirdRow = new ActionRowBuilder().addComponents(notesInput);
                    
                    configModal.addComponents(firstRow, secondRow, thirdRow);
                    await interaction.showModal(configModal);
                    return;
                }
                
                // Handle filled/not filled
                const filled = interaction.customId === 'order_filled';
                
                if (filled) {
                    // Extract ticket info and add to history
                    const messages = ticketMessages.get(channel.id) || [];
                    if (messages.length > 0) {
                        const firstMessage = messages[0];
                        if (firstMessage.embed) {
                            const ticketInfo = firstMessage.embed;
                            
                            // Extract customer info from channel permissions
                            const customerPermission = channel.permissionOverwrites.cache.find(overwrite => 
                                overwrite.type === 1 && overwrite.allow.has(PermissionFlagsBits.ViewChannel) && overwrite.id !== STAFF_ROLE_ID
                            );
                            
                            if (customerPermission && ticketInfo.description) {
                                const amountMatch = ticketInfo.description.match(/\*\*Amount\*\*\n(.+)/);
                                const priceMatch = ticketInfo.description.match(/\*\*Price\*\*\n\$(.+)/);
                                const typeMatch = ticketInfo.title.includes('buy') ? 'buy' : 'sell';
                                
                                if (amountMatch && priceMatch) {
                                    const amount = parseAmount(amountMatch[1]);
                                    const price = parseFloat(priceMatch[1]);
                                    
                                    if (!userHistory.has(customerPermission.id)) {
                                        userHistory.set(customerPermission.id, []);
                                    }
                                    
                                    const trade = {
                                        type: typeMatch,
                                        amount: amount,
                                        price: price,
                                        date: new Date().toISOString(),
                                        completedBy: interaction.user.username,
                                        ticketChannel: channel.name
                                    };
                                    
                                    userHistory.get(customerPermission.id).push(trade);
                                }
                            }
                        }
                    }
                }
                
                await safeReply(interaction, {
                    content: `${filled ? '✅ Order marked as filled and added to trade history' : '❌ Order marked as not filled - no history entry created'}. Generating transcript and closing ticket in 5 seconds...`,
                    ephemeral: true
                });
                
                setTimeout(async () => {
                    try {
                        // Generate transcript
                        const messages = ticketMessages.get(channel.id) || [];
                        const transcriptChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL_ID);
                        
                        if (transcriptChannel && messages.length > 0) {
                            const firstMessage = messages[0];
                            const ticketInfo = firstMessage.embed;
                            const ticketName = channel.name;
                            const createdTime = new Date(channel.createdTimestamp).toLocaleString();
                            const closedTime = new Date().toLocaleString();
                            const closedBy = interaction.user.username;
                            
                            let ign = 'Unknown';
                            let transactionType = 'Unknown';
                            let cost = 'Unknown';
                            let rate = 'Unknown';
                            
                            if (ticketInfo && ticketInfo.description) {
                                const ignMatch = ticketInfo.description.match(/\*\*Username:\*\* (.+)/);
                                const typeMatch = ticketInfo.title.includes('buy') ? 'Buying' : 'Selling';
                                const priceMatch = ticketInfo.description.match(/\*\*Price\*\*\n\$(.+)/);
                                const amountMatch = ticketInfo.description.match(/\*\*Amount\*\*\n(.+)/);
                                
                                if (ignMatch) ign = ignMatch[1];
                                transactionType = typeMatch;
                                if (priceMatch && amountMatch) cost = `${priceMatch[1]} for ${amountMatch[1]}`;
                            }
                            
                            let transcriptText = `TICKET TRANSCRIPT - ${ticketName}\n`;
                            transcriptText += `Created: ${createdTime}\n`;
                            transcriptText += `Ticket Channel ID: ${channel.id}\n`;
                            transcriptText += `Total Messages: ${messages.length}\n\n`;
                            transcriptText += `IGN: ${ign}\n`;
                            transcriptText += `Transaction: ${transactionType}\n`;
                            transcriptText += `Cost: ${cost}\n`;
                            transcriptText += `Status: ${filled ? 'FILLED' : 'NOT FILLED'}\n`;
                            transcriptText += `Customer: ${ticketInfo?.title?.split(' ')[0] || 'Unknown'}\n\n`;
                            transcriptText += `--- CONVERSATION ---\n\n`;
                            
                            messages.forEach((msg) => {
                                const timestamp = new Date(msg.timestamp).toLocaleTimeString();
                                transcriptText += `[${timestamp}] ${msg.author}: ${msg.content || '[Embed/System Message]'}\n\n`;
                            });
                            
                            transcriptText += `[${new Date().toLocaleTimeString()}] David's Coins [BOT]: ${filled ? 'Order marked as filled and added to trade history' : 'Order marked as not filled - no history entry created'}. Generating transcript and closing ticket in 5 seconds...\n\n`;
                            transcriptText += `--- END TRANSCRIPT ---\n`;
                            transcriptText += `Transcript generated on: ${closedTime}\n`;
                            transcriptText += `David's Coins | Ticket System\n`;
                            
                            const transcriptEmbed = new EmbedBuilder()
                                .setTitle('📄 Ticket Transcript')
                                .setDescription(`Transcript for ${ticketName}`)
                                .addFields(
                                    { name: 'Ticket Channel', value: ticketName, inline: true },
                                    { name: 'Closed By', value: closedBy, inline: true },
                                    { name: 'Status', value: filled ? '✅ Filled' : '❌ Not Filled', inline: true },
                                    { name: 'Closed At', value: closedTime, inline: false }
                                )
                                .setColor(filled ? '#00ff00' : '#ff0000')
                                .setFooter({ text: 'David\'s Coins | Ticket System' });
                            
                            const buffer = Buffer.from(transcriptText, 'utf-8');
                            const attachment = {
                                attachment: buffer,
                                name: `transcript-${ticketName}.txt`
                            };
                            
                            await transcriptChannel.send({
                                embeds: [transcriptEmbed],
                                files: [attachment]
                            });
                        }
                        
                        // Clear tracking and delete channel
                        ticketMessages.delete(channel.id);
                        for (const [userId, channelId] of activeTickets.entries()) {
                            if (channelId === channel.id) {
                                activeTickets.delete(userId);
                                break;
                            }
                        }
                        await channel.delete();
                    } catch (error) {
                        console.error('Error in ticket completion:', error);
                        try {
                            await channel.delete();
                        } catch (deleteError) {
                            console.error('Error deleting ticket channel:', deleteError);
                        }
                    }
                }, 5000);
                return;
            }
            
            // Close ticket button (legacy - keeping for compatibility)
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
                        ticketMessages.delete(channel.id);
                        for (const [userId, channelId] of activeTickets.entries()) {
                            if (channelId === channel.id) {
                                activeTickets.delete(userId);
                                break;
                            }
                        }
                        await channel.delete();
                    } catch (error) {
                        console.error('Error deleting ticket channel:', error);
                    }
                }, 5000);
                return;
            }
        }
        
        if (interaction.isModalSubmit()) {
            // Buy/Sell modal submissions
            if (interaction.customId === 'buy_modal' || interaction.customId === 'sell_modal') {
                const type = interaction.customId === 'buy_modal' ? 'buy' : 'sell';
                const amount = interaction.fields.getTextInputValue('amount');
                const paymentMethod = interaction.fields.getTextInputValue('payment_method');
                const minecraftUsername = interaction.fields.getTextInputValue('minecraft_username');
                
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
                        // Channel doesn't exist anymore, remove from tracking
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
                
                // Create ticket channel
                const guild = interaction.guild;
                const category = guild.channels.cache.get(TICKET_CATEGORY_ID);
                
                const channelName = `ticket-${minecraftUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
                
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
                                id: STAFF_ROLE_ID,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
                            }
                        ]
                    });
                    
                    // Add user to active tickets tracking
                    activeTickets.set(interaction.user.id, ticketChannel.id);
                    
                    // Create ticket embed
                    const ticketEmbed = new EmbedBuilder()
                        .setTitle(`@${interaction.user.username} wants to ${type} ${formattedAmount} coins.`)
                        .setDescription('**Ticket Created**\n\n' +
                            'Your ticket has been created. Please wait for a staff member to respond.\n\n' +
                            `<:skylvl:1393120347427049585> **Skyblock Level:** 256.83\n` +
                            `**Username:** ${minecraftUsername}\n\n` +
                            '**Amount**\n' +
                            `${formattedAmount}\n\n` +
                            '**Price**\n' +
                            `${price.toFixed(2)}\n\n` +
                            '**Payment Method**\n' +
                            `${paymentMethod}`)
                        .setColor('#36393f');
                    
                    const closeButton = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('confirm_close')
                                .setLabel('Close Ticket')
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji('🔒')
                        );
                    
                    await ticketChannel.send({
                        content: `${interaction.user} <@&${STAFF_ROLE_ID}>`,
                        embeds: [ticketEmbed],
                        components: [closeButton]
                    });
                    
                    // Initialize ticket message tracking with initial ticket info
                    ticketMessages.set(ticketChannel.id, [{
                        author: 'David\'s Coins [BOT]',
                        content: `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}> is ${type === 'buy' ? 'buying' : 'selling'} "${formattedAmount}"!`,
                        timestamp: new Date().toISOString(),
                        embed: ticketEmbed.toJSON()
                    }]);
                    botStats.ticketsCreated++;
                    botStats.messagesSent++;
                    
                    await safeReply(interaction, {
                        content: `✅ Ticket created! Please check ${ticketChannel} to continue your transaction.`,
                        ephemeral: true
                    });
                    
                } catch (error) {
                    console.error('Error creating ticket channel:', error);
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
                
                if (coins <= 0) {
                    await safeReply(interaction, {
                        content: '❌ Invalid money amount. Please enter a valid dollar amount (e.g., $100, 50).',
                        ephemeral: true
                    });
                    return;
                }
                
                const formattedCoins = formatNumber(coins);
                const cleanMoney = moneyAmount.replace(/[^0-9.]/g, '');
                const rate = coins >= 1000000000 ? prices.buyOver1B : prices.buyUnder1B;
                
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
            
            // Configure trade amount modal
            if (interaction.customId === 'configure_trade_amount') {
                const member = interaction.guild.members.cache.get(interaction.user.id);
                if (!hasStaffRole(member)) {
                    await safeReply(interaction, {
                        content: '❌ Only staff members can configure trade amounts.',
                        ephemeral: true
                    });
                    return;
                }
                
                const actualAmount = interaction.fields.getTextInputValue('actual_amount');
                const actualPrice = interaction.fields.getTextInputValue('actual_price');
                const tradeNotes = interaction.fields.getTextInputValue('trade_notes') || 'No additional notes';
                
                const parsedAmount = parseAmount(actualAmount);
                const parsedPrice = parseFloat(actualPrice);
                
                if (parsedAmount <= 0 || isNaN(parsedPrice) || parsedPrice <= 0) {
                    await safeReply(interaction, {
                        content: '❌ Invalid amount or price. Please enter valid numbers.',
                        ephemeral: true
                    });
                    return;
                }
                
                const channel = interaction.channel;
                
                // Find customer from channel permissions
                const customerPermission = channel.permissionOverwrites.cache.find(overwrite => 
                    overwrite.type === 1 && overwrite.allow.has(PermissionFlagsBits.ViewChannel) && overwrite.id !== STAFF_ROLE_ID
                );
                
                if (customerPermission) {
                    const customerId = customerPermission.id;
                    const customer = interaction.guild.members.cache.get(customerId);
                    
                    if (!userHistory.has(customerId)) {
                        userHistory.set(customerId, []);
                    }
                    
                    const trade = {
                        type: channel.name.includes('buy') ? 'buy' : 'sell',
                        amount: parsedAmount,
                        price: parsedPrice,
                        date: new Date().toISOString(),
                        completedBy: interaction.user.username,
                        ticketChannel: channel.name,
                        notes: tradeNotes,
                        configured: true
                    };
                    
                    userHistory.get(customerId).push(trade);
                    
                    const configEmbed = new EmbedBuilder()
                        .setTitle('✅ Trade Configured & Added to History')
                        .setDescription(`Successfully configured and added custom trade for ${customer ? customer.user.username : 'Unknown User'}`)
                        .addFields(
                            { name: 'Actual Amount', value: formatNumber(parsedAmount), inline: true },
                            { name: 'Actual Price', value: `${parsedPrice.toFixed(2)}`, inline: true },
                            { name: 'Configured By', value: interaction.user.username, inline: true },
                            { name: 'Notes', value: tradeNotes, inline: false }
                        )
                        .setColor('#00ff00')
                        .setFooter({ text: 'Custom trade entry completed - Closing ticket in 5 seconds...' });
                    
                    await safeReply(interaction, {
                        embeds: [configEmbed]
                    });
                    
                    // Close ticket after 5 seconds
                    setTimeout(async () => {
                        try {
                            // Generate transcript with configured status
                            const messages = ticketMessages.get(channel.id) || [];
                            const transcriptChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL_ID);
                            
                            if (transcriptChannel) {
                                const ticketName = channel.name;
                                const createdTime = new Date(channel.createdTimestamp).toLocaleString();
                                const closedTime = new Date().toLocaleString();
                                
                                let transcriptText = `TICKET TRANSCRIPT - ${ticketName}\n`;
                                transcriptText += `Created: ${createdTime}\n`;
                                transcriptText += `Ticket Channel ID: ${channel.id}\n`;
                                transcriptText += `Total Messages: ${messages.length}\n\n`;
                                transcriptText += `Status: CONFIGURED & FILLED\n`;
                                transcriptText += `Actual Amount: ${formatNumber(parsedAmount)}\n`;
                                transcriptText += `Actual Price: ${parsedPrice.toFixed(2)}\n`;
                                transcriptText += `Configured By: ${interaction.user.username}\n`;
                                transcriptText += `Notes: ${tradeNotes}\n\n`;
                                transcriptText += `--- CONVERSATION ---\n\n`;
                                
                                messages.forEach((msg) => {
                                    const timestamp = new Date(msg.timestamp).toLocaleTimeString();
                                    transcriptText += `[${timestamp}] ${msg.author}: ${msg.content || '[Embed/System Message]'}\n\n`;
                                });
                                
                                transcriptText += `--- END TRANSCRIPT ---\n`;
                                transcriptText += `Transcript generated on: ${closedTime}\n`;
                                transcriptText += `David's Coins | Ticket System\n`;
                                
                                const transcriptEmbed = new EmbedBuilder()
                                    .setTitle('📄 Ticket Transcript')
                                    .setDescription(`Transcript for ${ticketName}`)
                                    .addFields(
                                        { name: 'Ticket Channel', value: ticketName, inline: true },
                                        { name: 'Closed By', value: interaction.user.username, inline: true },
                                        { name: 'Status', value: '⚙️ Configured & Filled', inline: true },
                                        { name: 'Final Amount', value: formatNumber(parsedAmount), inline: true },
                                        { name: 'Final Price', value: `${parsedPrice.toFixed(2)}`, inline: true },
                                        { name: 'Closed At', value: closedTime, inline: false }
                                    )
                                    .setColor('#0099ff')
                                    .setFooter({ text: 'David\'s Coins | Ticket System' });
                                
                                const buffer = Buffer.from(transcriptText, 'utf-8');
                                const attachment = {
                                    attachment: buffer,
                                    name: `transcript-${ticketName}.txt`
                                };
                                
                                await transcriptChannel.send({
                                    embeds: [transcriptEmbed],
                                    files: [attachment]
                                });
                            }
                            
                            // Clear tracking and delete channel
                            ticketMessages.delete(channel.id);
                            for (const [userId, channelId] of activeTickets.entries()) {
                                if (channelId === channel.id) {
                                    activeTickets.delete(userId);
                                    break;
                                }
                            }
                            await channel.delete();
                        } catch (error) {
                            console.error('Error in configured ticket completion:', error);
                            try {
                                await channel.delete();
                            } catch (deleteError) {
                                console.error('Error deleting ticket channel:', deleteError);
                            }
                        }
                    }, 5000);
                } else {
                    await safeReply(interaction, {
                        content: '❌ Could not find customer information for this ticket.',
                        ephemeral: true
                    });
                }
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
                
                if (isNaN(under1b) || isNaN(over1b) || isNaN(sell)) {
                    await safeReply(interaction, {
                        content: '❌ Invalid price values. Please enter valid decimal numbers.',
                        ephemeral: true
                    });
                    return;
                }
                
                prices.buyUnder1B = under1b;
                prices.buyOver1B = over1b;
                prices.sell = sell;
                
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
                return;
            }
        }
        
    } catch (error) {
        console.error('Interaction error:', error);
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({
                    content: '❌ An error occurred while processing your request.',
                    ephemeral: true
                });
            } catch (replyError) {
                console.error('Error sending error message:', replyError);
            }
        }
    }
});

// Reaction handler for verification
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    
    try {
        // Fetch the reaction if it's partial
        if (reaction.partial) {
            await reaction.fetch();
        }
        
        // Check if it's a verification reaction
        if (reaction.emoji.name === '✅') {
            const guild = reaction.message.guild;
            const member = guild.members.cache.get(user.id);
            
            if (!member) return;
            
            // Check if user already has verified role
            if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
                // Remove the reaction
                await reaction.users.remove(user.id);
                return;
            }
            
            // Add verified role
            await member.roles.add(VERIFIED_ROLE_ID);
            
            // Remove the reaction
            await reaction.users.remove(user.id);
            
            // Send confirmation DM
            try {
                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('✅ Verification Successful!')
                    .setDescription(`Welcome to **${guild.name}**!\n\n` +
                        'You now have access to all channels. Feel free to:\n' +
                        '• Browse our trading information\n' +
                        '• Create tickets to buy/sell coins\n' +
                        '• Ask questions in our support channels\n\n' +
                        'Thank you for joining David\'s Coins!')
                    .setColor('#00ff00')
                    .setFooter({ text: 'David\'s Coins - Trusted Trading' });
                
                await user.send({ embeds: [welcomeEmbed] });
            } catch (dmError) {
                console.log('Could not send DM to user:', user.username);
            }
        }
    } catch (error) {
        console.error('Reaction add error:', error);
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

client.on('warn', warning => {
    console.warn('Discord client warning:', warning);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Graceful shutdown for Railway
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

// Login
client.login(TOKEN).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

// Bot configuration
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

// Environment variables
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;

// Hard-coded IDs
const TRANSCRIPT_CHANNEL_ID = '1387582544278585487';
const OWNER_USER_ID = '752590954388783196';

// Cryptocurrency wallet addresses
const CRYPTO_WALLETS = {
    BTC: '3PAfW9MqE5xkHrAwE2HmTPgzRziotiugNu',
    ETH: '0x753488DE45f33047806ac23B2693d87167829E08',
    LTC: 'MKJxhQMSg6oAhEXwLukRJvzsWpgQuokf43',
    USDT: '0xC41199c503C615554fA97803db6a688685e567D5'
};

// Custom emoji IDs
const EMOJIS = {
    LTC: '<:LTC:1387494812269412372>',
    BTC: '<:BTC:1387494854497669242>',
    ETH: '<:ETH:1387494868531675226>',
    USDT: '<:USDT:1387494839855218798>'
};

// Pricing structure
let prices = {
    buyUnder1B: 0.04,
    buyOver1B: 0.035,
    sell: 0.02
};

// Bot statistics
const botStats = {
    startTime: Date.now(),
    ticketsCreated: 0,
    messagesSent: 0
};

// Ticket message tracking
const ticketMessages = new Map();

// Track active tickets per user
const activeTickets = new Map(); // userId -> channelId

// User trade history tracking
const userHistory = new Map(); // userId -> array of trades

// Helper functions
function safeDeleteMessage(message) {
    try {
        if (message && message.deletable) {
            message.delete().catch(() => {});
        }
    } catch (error) {
        console.error('Error deleting message:', error);
    }
}

function safeReply(interaction, content) {
    try {
        if (interaction.replied || interaction.deferred) {
            return interaction.followUp(content).catch(() => {});
        } else {
            return interaction.reply(content).catch(() => {});
        }
    } catch (error) {
        console.error('Error replying to interaction:', error);
    }
}

function formatNumber(num) {
    if (num >= 1000000000) {
        const billions = num / 1000000000;
        if (billions === Math.floor(billions)) {
            return billions + 'B';
        } else {
            return billions.toFixed(1) + 'B';
        }
    } else if (num >= 1000000) {
        const millions = num / 1000000;
        if (millions === Math.floor(millions)) {
            return millions + 'M';
        } else {
            return millions.toFixed(0) + 'M';
        }
    }
    return num.toString();
}

function parseAmount(input) {
    const cleanInput = input.toLowerCase().replace(/[^0-9.bkmgt]/g, '');
    let multiplier = 1;
    
    if (cleanInput.includes('b')) {
        multiplier = 1000000000;
    } else if (cleanInput.includes('m')) {
        multiplier = 1000000;
    } else if (cleanInput.includes('k')) {
        multiplier = 1000;
    } else if (cleanInput.includes('t')) {
        multiplier = 1000000000000;
    }
    
    const number = parseFloat(cleanInput.replace(/[bkmgt]/g, ''));
    return isNaN(number) ? 0 : number * multiplier;
}

function calculatePrice(amount, type) {
    const millions = amount / 1000000;
    
    if (type === 'sell') {
        return millions * prices.sell;
    } else {
        if (millions >= 1000) {
            return millions * prices.buyOver1B;
        } else {
            return millions * prices.buyUnder1B;
        }
    }
}

function calculateCoinsForMoney(money) {
    const dollarAmount = parseFloat(money.replace(/[^0-9.]/g, ''));
    if (isNaN(dollarAmount)) return 0;
    
    // Calculate based on over 1B rate first
    const coinsOver1B = dollarAmount / prices.buyOver1B;
    if (coinsOver1B >= 1000) {
        return coinsOver1B * 1000000; // Convert to actual coins
    }
    
    // Use under 1B rate
    const coinsUnder1B = dollarAmount / prices.buyUnder1B;
    return coinsUnder1B * 1000000; // Convert to actual coins
}

function hasStaffRole(member) {
    return member.roles.cache.has(STAFF_ROLE_ID);
}

function createInfoEmbed() {
    return new EmbedBuilder()
        .setTitle('David\'s Coins')
        .setDescription('**Coins Buy Prices:**\n' +
            `• 0.04/M for 300M-1B (40 per 1B)\n` +
            `• 0.035/M for 1B+ (35 per 1B)\n\n` +
            '**Coins Sell Prices:**\n' +
            `• 0.02/M for 1B+ (20 per 1B)\n\n` +
            '**Payment Methods:**\n' +
            '<:LTC:1387494812269412372><:BTC:1387494854497669242><:ETH:1387494868531675226><:USDT:1387494839855218798>')
        .setColor('#0099ff');
}

function createCryptoEmbed() {
    return new EmbedBuilder()
        .setTitle('🔗 Cryptocurrency Wallet Addresses')
        .setDescription('**Copy the wallet address for your preferred cryptocurrency:**\n\n' +
            `${EMOJIS.BTC} **Bitcoin (BTC)**\n` +
            `\`${CRYPTO_WALLETS.BTC}\`\n\n` +
            `${EMOJIS.ETH} **Ethereum (ETH)**\n` +
            `\`${CRYPTO_WALLETS.ETH}\`\n\n` +
            `${EMOJIS.LTC} **Litecoin (LTC)**\n` +
            `\`${CRYPTO_WALLETS.LTC}\`\n\n` +
            `${EMOJIS.USDT} **Tether (USDT)**\n` +
            `\`${CRYPTO_WALLETS.USDT}\``)
        .setColor('#ffa500')
        .setFooter({ text: 'Always double-check addresses before sending!' });
}

function createRulesEmbed() {
    return new EmbedBuilder()
        .setTitle('📋 Server Rules')
        .setDescription('**Please follow these rules to ensure a safe and professional trading environment:**\n\n' +
            '**1. Have basic human decency**\n' +
            'Treat all members with respect and courtesy.\n\n' +
            '**2. Don\'t advertise in chat or in DMs**\n' +
            'No promotion of other services or unsolicited messages.\n\n' +
            '**3. Don\'t attempt to scam**\n' +
            'Any fraudulent activity will result in immediate ban.\n\n' +
            '**4. Don\'t spam the ticket system**\n' +
            'Only create tickets for legitimate transactions.\n\n' +
            '**5. Don\'t leak other players\' IGNs**\n' +
            'Respect privacy and keep player information confidential.\n\n' +
            '**6. Communicate through English**\n' +
            'All communication must be in English for clarity.\n\n' +
            'Violation of these rules may result in warnings, mutes, or permanent bans.')
        .setColor('#ff0000')
        .setFooter({ text: 'Thank you for helping keep our community safe!' });
}

function createTOSEmbed() {
    return new EmbedBuilder()
        .setTitle('📜 Terms of Service')
        .setDescription('Once you join David\'s Coins, you\'re automatically agreeing to the following terms:\n\n' +
            '**1. No Refunds**\n' +
            'There are no refunds once the transaction has taken place.\n\n' +
            '**2. Chargeback Policy**\n' +
            'Any and all chargebacks will result in a permanent ban from our discord server.\n\n' +
            '**3. Payment Verification**\n' +
            'By purchasing any goods from us you acknowledge that the money is totally yours.\n\n' +
            '**4. Ban Rights**\n' +
            'We reserve the right to ban anyone from our discord server at any point in time for any reason, any paid for and not received items will get refunded.\n\n' +
            '**5. Service Refusal**\n' +
            'We reserve the right to refuse service to anyone at anytime.\n\n' +
            '**6. Server Protection**\n' +
            'If any damage is caused onto our server by you, we reserve the right to ban you without a refund.\n\n' +
            '**7. Terms Changes**\n' +
            'These terms are subject to change at any time without notice to the client.\n\n' +
            '**8. Price Changes**\n' +
            'We reserve the right to change the price of our products at any time we want.\n\n' +
            'By using our services, you agree to these terms and conditions.')
        .setColor('#0099ff')
        .setFooter({ text: 'David\'s Coins - Professional Trading Service' });
}

function createPaymentsEmbed() {
    return new EmbedBuilder()
        .setTitle('💳 Payment Methods')
        .setDescription('David\'s Coins accepts the following secure payment methods for all transactions:\n\n' +
            '**🪙 Primary Cryptocurrencies**\n' +
            '<:BTC:1387494854497669242> **Bitcoin (BTC)**\n' +
            '<:ETH:1387494868531675226> **Ethereum (ETH)**\n' +
            '<:LTC:1387494812269412372> **Litecoin (LTC)**\n' +
            '<:USDT:1387494839855218798> **Tether (USDT)**\n\n' +
            '**⚡ Why Cryptocurrency?**\n' +
            '• **Fast transactions** - Nearly instant transfers\n' +
            '• **Low fees** - Minimal processing costs\n' +
            '• **Secure** - Blockchain-verified transactions\n' +
            '• **Global** - Available worldwide 24/7\n\n' +
            '**Additional Payment Options**\n' +
            'We may accept other payment methods on a case-by-case basis. Please contact our staff through a ticket to discuss alternative payment arrangements.\n\n' +
            'David\'s Coins • Secure & Professional Trading • All transactions are final')
        .setColor('#00ff00')
        .setFooter({ text: 'All payments are processed securely' });
}

function createHelpEmbed() {
    return new EmbedBuilder()
        .setTitle('❓ Command Help')
        .setDescription('**Available Commands:**\n\n' +
            '**🔧 Staff Commands:**\n' +
            '• `!info` - Display trading information with buttons\n' +
            '• `!rules` - Show server rules\n' +
            '• `!tos` - Display terms of service\n' +
            '• `!payments` - Show payment methods\n' +
            '• `!verify` - Create verification message\n' +
            '• `!close` - Close ticket (ticket channels only)\n' +
            '• `!price` - Update prices via modal\n' +
            '• `!historyedit @user <amount>` - Add to user\'s trade history\n' +
            '• `!help` - Show this help message\n\n' +
            '**👥 Public Commands:**\n' +
            '• `!crypto` - Show cryptocurrency wallet addresses\n' +
            '• `!history` - View your trade history\n\n' +
            '**📋 How to Use:**\n' +
            '• Most commands require staff role\n' +
            '• Use buttons on embeds for trading\n' +
            '• Contact staff for assistance')
        .setColor('#0099ff')
        .setFooter({ text: 'David\'s Coins - Command Help' });
}

// Bot ready event
client.once('ready', () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`🌍 Connected to ${client.guilds.cache.size} servers`);
    console.log(`👥 Serving ${client.users.cache.size} users`);
    
    // Set bot activity
    client.user.setActivity('David\'s Coins | !help', { type: 'WATCHING' });
});

// Message handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Track messages in tickets
    if (message.channel.name && message.channel.name.startsWith('ticket-')) {
        if (!ticketMessages.has(message.channel.id)) {
            ticketMessages.set(message.channel.id, []);
        }
        ticketMessages.get(message.channel.id).push({
            author: message.author.username,
            content: message.content || '[No text content]',
            timestamp: new Date().toISOString(),
            authorId: message.author.id,
            messageId: message.id
        });
    }
    
    // Handle DM commands (owner only)
    if (message.channel.type === ChannelType.DM) {
        if (message.author.id !== OWNER_USER_ID) return;
        
        const args = message.content.slice(1).split(' ');
        const command = args[0].toLowerCase();
        
        try {
            switch (command) {
                case 'dmhelp':
                    const dmHelpEmbed = new EmbedBuilder()
                        .setTitle('🔧 DM Commands Help')
                        .setDescription('**Available DM Commands:**\n\n' +
                            '• `!dmhelp` - Show this help message\n' +
                            '• `!servers` - List all servers bot is in\n' +
                            '• `!stats` - Show bot statistics\n' +
                            '• `!prices` - Show current prices\n' +
                            '• `!setprice <under1b> <over1b> <sell>` - Update prices\n\n' +
                            '**Example:**\n' +
                            '`!setprice 0.04 0.035 0.02`')
                        .setColor('#0099ff');
                    await message.reply({ embeds: [dmHelpEmbed] });
                    break;
                
                case 'servers':
                    const serverList = client.guilds.cache.map(guild => 
                        `• ${guild.name} (${guild.memberCount} members)`
                    ).join('\n');
                    
                    const serversEmbed = new EmbedBuilder()
                        .setTitle('🌍 Server List')
                        .setDescription(serverList || 'No servers found')
                        .setColor('#00ff00');
                    await message.reply({ embeds: [serversEmbed] });
                    break;
                
                case 'stats':
                    const uptime = Date.now() - botStats.startTime;
                    const days = Math.floor(uptime / 86400000);
                    const hours = Math.floor((uptime % 86400000) / 3600000);
                    const minutes = Math.floor((uptime % 3600000) / 60000);
                    
                    const statsEmbed = new EmbedBuilder()
                        .setTitle('📊 Bot Statistics')
                        .addFields(
                            { name: '⏱️ Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
                            { name: '🌍 Servers', value: client.guilds.cache.size.toString(), inline: true },
                            { name: '👥 Users', value: client.users.cache.size.toString(), inline: true },
                            { name: '🎫 Tickets Created', value: botStats.ticketsCreated.toString(), inline: true },
                            { name: '💬 Messages Sent', value: botStats.messagesSent.toString(), inline: true },
                            { name: '💾 Memory Usage', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`, inline: true }
                        )
                        .setColor('#0099ff');
                    await message.reply({ embeds: [statsEmbed] });
                    break;
                
                case 'prices':
                    const pricesEmbed = new EmbedBuilder()
                        .setTitle('💰 Current Prices')
                        .addFields(
                            { name: 'Buy Under 1B', value: `$${prices.buyUnder1B}/M`, inline: true },
                            { name: 'Buy Over 1B', value: `$${prices.buyOver1B}/M`, inline: true },
                            { name: 'Sell Price', value: `$${prices.sell}/M`, inline: true }
                        )
                        .setColor('#00ff00');
                    await message.reply({ embeds: [pricesEmbed] });
                    break;
                
                case 'setprice':
                    if (args.length !== 4) {
                        await message.reply('❌ Usage: `!setprice <under1b> <over1b> <sell>`\nExample: `!setprice 0.04 0.035 0.02`');
                        return;
                    }
                    
                    const [, under1b, over1b, sellPrice] = args;
                    const newUnder1B = parseFloat(under1b);
                    const newOver1B = parseFloat(over1b);
                    const newSell = parseFloat(sellPrice);
                    
                    if (isNaN(newUnder1B) || isNaN(newOver1B) || isNaN(newSell)) {
                        await message.reply('❌ Invalid price values. Please use decimal numbers.');
                        return;
                    }
                    
                    prices.buyUnder1B = newUnder1B;
                    prices.buyOver1B = newOver1B;
                    prices.sell = newSell;
                    
                    await message.reply(`✅ Prices updated!\n• Buy Under 1B: $${newUnder1B}/M\n• Buy Over 1B: $${newOver1B}/M\n• Sell: $${newSell}/M`);
                    break;
            }
        } catch (error) {
            console.error('DM command error:', error);
            await message.reply('❌ An error occurred while processing your command.');
        }
        return;
    }
    
    // Handle guild commands
    if (!message.content.startsWith('!')) return;
    
    const args = message.content.slice(1).split(' ');
    const command = args[0].toLowerCase();
    
    // Delete command message
    safeDeleteMessage(message);
    
    try {
        const member = message.guild.members.cache.get(message.author.id);
        
        // Public commands
        if (command === 'crypto') {
            const cryptoEmbed = createCryptoEmbed();
            const cryptoButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('copy_btc')
                        .setLabel('Copy BTC')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔗'),
                    new ButtonBuilder()
                        .setCustomId('copy_eth')
                        .setLabel('Copy ETH')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔗'),
                    new ButtonBuilder()
                        .setCustomId('copy_ltc')
                        .setLabel('Copy LTC')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔗'),
                    new ButtonBuilder()
                        .setCustomId('copy_usdt')
                        .setLabel('Copy USDT')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔗')
                );
            
            await message.channel.send({ embeds: [cryptoEmbed], components: [cryptoButtons] });
            botStats.messagesSent++;
            return;
        }
        
        if (command === 'history') {
            const userTrades = userHistory.get(message.author.id) || [];
            
            if (userTrades.length === 0) {
                const noHistoryEmbed = new EmbedBuilder()
                    .setTitle('📊 Trade History')
                    .setDescription('You haven\'t completed any trades yet!\n\nStart trading by using the `!info` command.')
                    .setColor('#ff6600')
                    .setFooter({ text: 'David\'s Coins - Trade History' });
                
                await message.channel.send({ embeds: [noHistoryEmbed] });
                botStats.messagesSent++;
                return;
            }
            
            // Calculate total volume and trades
            const totalVolume = userTrades.reduce((sum, trade) => sum + trade.amount, 0);
            const totalSpent = userTrades.reduce((sum, trade) => sum + trade.price, 0);
            
            // Create history embed
            const historyEmbed = new EmbedBuilder()
                .setTitle('📊 Trade History')
                .setDescription(`**${message.author.username}'s Trading Summary**\n\n` +
                    `**Total Trades:** ${userTrades.length}\n` +
                    `**Total Volume:** ${formatNumber(totalVolume)} coins\n` +
                    `**Total Spent:** $${totalSpent.toFixed(2)}\n` +
                    `**Average Trade:** ${formatNumber(totalVolume / userTrades.length)} coins\n\n` +
                    '**Recent Transactions:**')
                .setColor('#00ff00')
                .setFooter({ text: `David's Coins - ${userTrades.length} completed trades` });
            
            // Add recent trades (last 10)
            const recentTrades = userTrades.slice(-10).reverse();
            recentTrades.forEach((trade, index) => {
                const tradeDate = new Date(trade.date).toLocaleDateString();
                historyEmbed.addFields({
                    name: `${index + 1}. ${trade.type === 'buy' ? '🟢 Bought' : '🔴 Sold'} ${formatNumber(trade.amount)}`,
                    value: `💰 $${trade.price.toFixed(2)} • 📅 ${tradeDate}`,
                    inline: true
                });
            });
            
            if (userTrades.length > 10) {
                historyEmbed.setDescription(historyEmbed.data.description + `\n*Showing 10 most recent trades*`);
            }
            
            await message.channel.send({ embeds: [historyEmbed] });
            botStats.messagesSent++;
            return;
        }
        
        // Staff-only commands
        if (!hasStaffRole(member)) {
            await message.channel.send('❌ This command requires staff permissions.').then(msg => {
                setTimeout(() => safeDeleteMessage(msg), 5000);
            });
            return;
        }
        
        switch (command) {
            case 'info':
                const infoEmbed = createInfoEmbed();
                const infoButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('buy_coins')
                            .setLabel('Buy')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('sell_coins')
                            .setLabel('Sell')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('calculate_price')
                            .setLabel('Calculate')
                            .setStyle(ButtonStyle.Success)
                    );
                
                await message.channel.send({ embeds: [infoEmbed], components: [infoButtons] });
                botStats.messagesSent++;
                break;
            
            case 'rules':
                const rulesEmbed = createRulesEmbed();
                await message.channel.send({ embeds: [rulesEmbed] });
                botStats.messagesSent++;
                break;
            
            case 'tos':
                const tosEmbed = createTOSEmbed();
                await message.channel.send({ embeds: [tosEmbed] });
                botStats.messagesSent++;
                break;
            
            case 'payments':
                const paymentsEmbed = createPaymentsEmbed();
                await message.channel.send({ embeds: [paymentsEmbed] });
                botStats.messagesSent++;
                break;
            
            case 'verify':
                const verifyEmbed = new EmbedBuilder()
                    .setTitle('✅ Verification')
                    .setDescription('**React with ✅ to get verified and access all channels!**\n\n' +
                        'Verification helps us maintain a safe trading environment.')
                    .setColor('#00ff00')
                    .setFooter({ text: 'Click the reaction below to verify' });
                
                const verifyMessage = await message.channel.send({ embeds: [verifyEmbed] });
                await verifyMessage.react('✅');
                botStats.messagesSent++;
                break;
            
            case 'help':
                const helpEmbed = createHelpEmbed();
                await message.channel.send({ embeds: [helpEmbed] });
                botStats.messagesSent++;
                break;
            
            case 'close':
                if (!message.channel.name || !message.channel.name.startsWith('ticket-')) {
                    await message.channel.send('❌ This command can only be used in ticket channels.').then(msg => {
                        setTimeout(() => safeDeleteMessage(msg), 5000);
                    });
                    return;
                }
                
                const closeEmbed = new EmbedBuilder()
                    .setTitle('🔒 Complete Ticket')
                    .setDescription('**Order Status**\n\n' +
                        'Was this order successfully completed?\n\n' +
                        '• **Filled** - Order completed successfully (adds to trade history)\n' +
                        '• **Not Filled** - Order cancelled/incomplete (no history entry)')
                    .setColor('#0099ff')
                    .setFooter({ text: 'Choose the appropriate status for this ticket' });
                
                const statusButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('order_filled')
                            .setLabel('Filled')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅'),
                        new ButtonBuilder()
                            .setCustomId('order_not_filled')
                            .setLabel('Not Filled')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌'),
                        new ButtonBuilder()
                            .setCustomId('configure_amount')
                            .setLabel('Configure Amount')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('⚙️')
                    );
                
                await message.channel.send({ embeds: [closeEmbed], components: [statusButtons] });
                botStats.messagesSent++;
                break;
            
            case 'price':
                const priceUpdateEmbed = new EmbedBuilder()
                    .setTitle('💰 Update Prices')
                    .setDescription('**Current Prices:**\n' +
                        `• Buy Under 1B: $${prices.buyUnder1B}/M\n` +
                        `• Buy Over 1B: $${prices.buyOver1B}/M\n` +
                        `• Sell Price: $${prices.sell}/M\n\n` +
                        'Click the button below to update prices.')
                    .setColor('#0099ff');
                
                const updatePriceButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('open_price_modal')
                            .setLabel('Update Prices')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('💰')
                    );
                
                await message.channel.send({ embeds: [priceUpdateEmbed], components: [updatePriceButton] });
                botStats.messagesSent++;
                break;
            
            case 'historyedit':
                if (args.length < 3) {
                    await message.channel.send('❌ Usage: `!historyedit @user <amount>`\nExample: `!historyedit @john123 1.5B`').then(msg => {
                        setTimeout(() => safeDeleteMessage(msg), 5000);
                    });
                    return;
                }
                
                const userMention = args[1];
                const amountStr = args.slice(2).join(' ');
                
                // Parse user mention
                const userIdMatch = userMention.match(/^<@!?(\d+)>$/);
                if (!userIdMatch) {
                    await message.channel.send('❌ Please mention a valid user. Example: `!historyedit @user 1B`').then(msg => {
                        setTimeout(() => safeDeleteMessage(msg), 5000);
                    });
                    return;
                }
                
                const targetUserId = userIdMatch[1];
                const targetUser = message.guild.members.cache.get(targetUserId);
                if (!targetUser) {
                    await message.channel.send('❌ User not found in this server.
