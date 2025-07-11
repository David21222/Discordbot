setTimeout(async () => {
                try {
                    await message.channel.delete();
                } catch (error) {
                    console.error('Error deleting channel via !close:', error);
                }
            }, 5000);
            
            safeDeleteMessage(message);
        }
        
        if (message.content === '!price') {
            const tempMessage = await message.reply('Opening price update modal...');
            
            const buttonRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('open_price_modal')
                        .setLabel('💰 Update Prices')
                        .setStyle(ButtonStyle.Primary)
                );
                
            await tempMessage.edit({ content: 'Click the button below to update prices:', components: [buttonRow] });
            safeDeleteMessage(message);
        }
        
    } catch (error) {
        console.error('Error in messageCreate handler:', error);
    }
});

// Member leave event
client.on('guildMemberRemove', async (member) => {
    try {
        if (!member || !member.user) return;
        
        console.log(`Member left: ${member.user.username} (${member.user.id})`);
        
        if (activeTickets.has(member.user.id)) {
            const ticketChannelId = activeTickets.get(member.user.id);
            const ticketChannel = member.guild.channels.cache.get(ticketChannelId);
            
            if (ticketChannel) {
                console.log(`Sending leave message to ticket channel: ${ticketChannel.name}`);
                await ticketChannel.send(`<@&${CONFIG.STAFF_ROLE_ID}> <@${member.user.id}> left server`);
                
                activeTickets.delete(member.user.id);
                console.log(`Removed ${member.user.username} from active tickets`);
            } else {
                console.log(`Ticket channel not found for ${member.user.username}, removing from active tickets`);
                activeTickets.delete(member.user.id);
            }
        } else {
            console.log(`${member.user.username} left but had no active ticket`);
        }
    } catch (error) {
        console.error('Error handling member leave:', error);
    }
});

// Reaction handler for verification
client.on('messageReactionAdd', async (reaction, user) => {
    try {
        if (!reaction || !user) return;
        
        console.log(`Reaction detected: ${reaction.emoji.name} by ${user.username}`);
        
        if (user.bot) {
            console.log('Ignoring bot reaction');
            return;
        }
        
        if (reaction.partial) {
            try {
                await reaction.fetch();
                console.log('Fetched partial reaction');
            } catch (error) {
                console.error('Something went wrong when fetching the reaction:', error);
                return;
            }
        }
        
        if (reaction.emoji.name === '✅') {
            console.log('Checkmark reaction detected');
            const message = reaction.message;
            
            if (message.embeds.length > 0 && message.embeds[0].title === '✅ Server Verification') {
                console.log('This is a verification message');
                const guild = message.guild;
                
                try {
                    const member = await guild.members.fetch({ user: user.id, force: true });
                    console.log(`Fetched member: ${member.user.username}`);
                    console.log(`Member roles: ${member.roles.cache.map(role => role.name).join(', ')}`);
                    
                    if (member.roles.cache.has(CONFIG.VERIFIED_ROLE_ID)) {
                        console.log('User already has verified role');
                        const alreadyVerifiedEmbed = new EmbedBuilder()
                            .setTitle("✅ Already Verified")
                            .setDescription("You are already verified and have access to the server.")
                            .setColor(0x00ff00);
                        
                        const msg = await message.channel.send({ 
                            content: `<@${user.id}>`, 
                            embeds: [alreadyVerifiedEmbed]
                        });
                        
                        setTimeout(() => safeDeleteMessage(msg), 5000);
                        
                        try {
                            await reaction.users.remove(user.id);
                            console.log(`Removed reaction from already verified user ${user.username}`);
                        } catch (reactionError) {
                            console.error('Error removing reaction from already verified user:', reactionError);
                        }
                        return;
                    }
                    
                    console.log(`Attempting to add role ${CONFIG.VERIFIED_ROLE_ID} to user ${user.username}`);
                    await member.roles.add(CONFIG.VERIFIED_ROLE_ID);
                    console.log('Role added successfully');
                    
                    try {
                        await reaction.users.remove(user.id);
                        console.log(`Removed reaction from ${user.username}`);
                    } catch (reactionError) {
                        console.error('Error removing reaction:', reactionError);
                    }
                    
                    const successEmbed = new EmbedBuilder()
                        .setTitle("✅ Verification Successful")
                        .setDescription(`Welcome to **David's Coins**, ${member.displayName}! You now have access to the server.`)
                        .setColor(0x00ff00);
                    
                    const msg = await message.channel.send({ 
                        content: `<@${user.id}>`, 
                        embeds: [successEmbed]
                    });
                    
                    setTimeout(() => safeDeleteMessage(msg), 10000);
                    
                } catch (error) {
                    console.error('Error in verification process:', error);
                    
                    const errorEmbed = new EmbedBuilder()
                        .setTitle("❌ Verification Error")
                        .setDescription(`There was an error during verification: ${error.message}. Please contact staff for assistance.`)
                        .setColor(0xff0000);
                    
                    const msg = await message.channel.send({ 
                        content: `<@${user.id}>`, 
                        embeds: [errorEmbed]
                    });
                    
                    setTimeout(() => safeDeleteMessage(msg), 10000);
                }
            } else {
                console.log('Not a verification message');
            }
        } else {
            console.log(`Different emoji: ${reaction.emoji.name}`);
        }
    } catch (error) {
        console.error('Error in messageReactionAdd handler:', error);
    }
});

// Function to generate transcript
async function generateTranscript(channelId, channelName, ticketInfo = {}) {
    try {
        const messages = ticketMessages.get(channelId) || [];
        
        let transcript = `TICKET TRANSCRIPT - ${channelName}\n`;
        transcript += `Created: ${new Date().toLocaleString()}\n`;
        transcript += `Ticket Channel ID: ${channelId}\n`;
        transcript += `Total Messages: ${messages.length}\n\n`;
        
        if (ticketInfo.ign) {
            transcript += `IGN: ${ticketInfo.ign}\n`;
        }
        if (ticketInfo.transaction) {
            transcript += `Transaction: ${ticketInfo.transaction}\n`;
        }
        if (ticketInfo.cost) {
            transcript += `Cost: ${ticketInfo.cost}\n`;
        }
        if (ticketInfo.user) {
            transcript += `Customer: ${ticketInfo.user}\n`;
        }
        
        transcript += `\n--- CONVERSATION ---\n\n`;
        
        if (messages.length === 0) {
            transcript += `[NO MESSAGES RECORDED]\n`;
            transcript += `Note: Message tracking may have failed or no messages were sent.\n\n`;
        } else {
            for (const msg of messages) {
                const time = msg.timestamp.toLocaleTimeString();
                const author = msg.isBot ? `${msg.author} [BOT]` : msg.author;
                
                transcript += `[${time}] ${author}: `;
                
                if (msg.content) {
                    transcript += `${msg.content}\n`;
                } else {
                    transcript += `[No text content]\n`;
                }
                
                if (msg.embeds && msg.embeds.length > 0) {
                    for (const embed of msg.embeds) {
                        if (embed.title) {
                            transcript += `    [EMBED] Title: ${embed.title}\n`;
                        }
                        if (embed.description) {
                            transcript += `    [EMBED] Description: ${embed.description}\n`;
                        }
                        if (embed.fields && embed.fields.length > 0) {
                            for (const field of embed.fields) {
                                transcript += `    [EMBED] ${field.name}: ${field.value}\n`;
                            }
                        }
                    }
                }
                
                transcript += `\n`;
            }
        }
        
        transcript += `--- END TRANSCRIPT ---\n`;
        transcript += `Transcript generated on: ${new Date().toLocaleString()}\n`;
        transcript += `David's Coins | Ticket System`;
        
        console.log(`Generated transcript for ${channelName} with ${messages.length} messages`);
        
        return transcript;
    } catch (error) {
        console.error('Error generating transcript:', error);
        return `Error generating transcript: ${error.message}`;
    }
}

// Function to update all existing info messages with new prices
async function updateAllInfoMessages(guild) {
    try {
        const newEmbed = new EmbedBuilder()
            .setTitle("David's Coins")
            .setColor(0x5865F2)
            .addFields(
                {
                    name: "Coins Buy Prices:",
                    value: `• ${PRICES.buyUnder1B}/m for 300m-1b (${PRICES.buyUnder1B * 1000} per 1B)\n• ${PRICES.buyOver1B}/m for 1b+ (${PRICES.buyOver1B * 1000} per 1B)`,
                    inline: false
                },
                {
                    name: "Coins Sell Prices:",
                    value: `• ${PRICES.sell}/m for 1b+ (${PRICES.sell * 1000} per 1B)`,
                    inline: false
                },
                {
                    name: "Payment Methods:",
                    value: "<:LTC:1387494812269412372> <:BTC:1387494854497669242> <:ETH:1387494868531675226> <:USDT:1387494839855218798>",
                    inline: false
                }
            );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('buy_coins')
                    .setLabel('Buy')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('sell_coins')
                    .setLabel('Sell')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('calculate_coins')
                    .setLabel('Calculate')
                    .setStyle(ButtonStyle.Success)
            );

        for (const messageId of infoMessages) {
            try {
                for (const channel of guild.channels.cache.values()) {
                    if (channel.isTextBased && channel.isTextBased()) {
                        try {
                            const message = await channel.messages.fetch(messageId);
                            if (message && message.author.id === guild.members.me.id) {
                                await message.edit({ embeds: [newEmbed], components: [row] });
                                console.log(`Updated info message ${messageId} in channel ${channel.name}`);
                            }
                        } catch (error) {
                            // Message not found in this channel, continue
                        }
                    }
                }
            } catch (error) {
                console.error(`Error updating message ${messageId}:`, error);
                infoMessages.delete(messageId);
            }
        }
    } catch (error) {
        console.error('Error in updateAllInfoMessages:', error);
    }
}

// Interaction handler
client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction) return;
        
        if (interaction.isButton()) {
            if (interaction.customId === 'open_price_modal') {
                if (!interaction.member || !interaction.member.roles || !interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) {
                    return await safeReply(interaction, {
                        content: 'Only staff members can update prices.',
                        ephemeral: true
                    });
                }
                
                const modal = new ModalBuilder()
                    .setCustomId('price_modal')
                    .setTitle('Update Coin Prices');

                const buyUnder1BInput = new TextInputBuilder()
                    .setCustomId('buy_under_1b_input')
                    .setLabel('Buy Price Under 1B (per million)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(PRICES.buyUnder1B.toString())
                    .setPlaceholder('e.g., 0.04');

                const buyOver1BInput = new TextInputBuilder()
                    .setCustomId('buy_over_1b_input')
                    .setLabel('Buy Price 1B+ (per million)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(PRICES.buyOver1B.toString())
                    .setPlaceholder('e.g., 0.035');

                const sellInput = new TextInputBuilder()
                    .setCustomId('sell_input')
                    .setLabel('Sell Price (per million)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(PRICES.sell.toString())
                    .setPlaceholder('e.g., 0.018');

                const firstRow = new ActionRowBuilder().addComponents(buyUnder1BInput);
                const secondRow = new ActionRowBuilder().addComponents(buyOver1BInput);
                const thirdRow = new ActionRowBuilder().addComponents(sellInput);

                modal.addComponents(firstRow, secondRow, thirdRow);
                
                await interaction.showModal(modal);
                return;
            }
            
            if (interaction.customId.startsWith('copy_')) {
                const walletAddresses = {
                    'copy_ltc': 'MKJxhQMSg6oAhEXwLukRJvzsWpgQuokf43',
                    'copy_btc': '3PAfW9MqE5xkHrAwE2HmTPgzRziotiugNu', 
                    'copy_eth': '0x753488DE45f33047806ac23B2693d87167829E08',
                    'copy_usdt': '0xC41199c503C615554fA97803db6a688685e567D5'
                };
                
                const address = walletAddresses[interaction.customId];
                const cryptoName = interaction.customId.replace('copy_', '').toUpperCase();
                
                if (address) {
                    await safeReply(interaction, {
                        content: `**${cryptoName} Address:**\n\`${address}\``,
                        ephemeral: true
                    });
                } else {
                    await safeReply(interaction, {
                        content: 'Error: Address not found.',
                        ephemeral: true
                    });
                }
                return;
            }
            
            if (interaction.customId === 'buy_coins' || interaction.customId === 'sell_coins') {
                if (activeTickets.has(interaction.user.id)) {
                    return await safeReply(interaction, {
                        content: 'You already have an active ticket open. Please complete your current transaction before opening a new one.',
                        ephemeral: true
                    });
                }

                const isBuying = interaction.customId === 'buy_coins';
                const action = isBuying ? '🪙 Buy Coins' : '🪙 Sell Coins';
                
                const modal = new ModalBuilder()
                    .setCustomId(isBuying ? 'buy_modal' : 'sell_modal')
                    .setTitle(action);

                const amountInput = new TextInputBuilder()
                    .setCustomId('amount_input')
                    .setLabel('Amount Of Coins')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('1b')
                    .setMaxLength(15);

                const paymentInput = new TextInputBuilder()
                    .setCustomId('payment_input')
                    .setLabel('Payment Method')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('PayPal')
                    .setMaxLength(50);

                const usernameInput = new TextInputBuilder()
                    .setCustomId('username_input')
                    .setLabel('Minecraft Username')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('56ms')
                    .setMinLength(3)
                    .setMaxLength(16);

                const firstRow = new ActionRowBuilder().addComponents(amountInput);
                const secondRow = new ActionRowBuilder().addComponents(paymentInput);
                const thirdRow = new ActionRowBuilder().addComponents(usernameInput);

                modal.addComponents(firstRow, secondRow, thirdRow);
                await interaction.showModal(modal);
            }
            
            if (interaction.customId === 'calculate_coins') {
                const modal = new ModalBuilder()
                    .setCustomId('calculate_modal')
                    .setTitle('💰 Calculate Coins');

                const moneyInput = new TextInputBuilder()
                    .setCustomId('money_input')
                    .setLabel('How Much Money Do You Want To Spend?')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('100')
                    .setMaxLength(10);

                const firstRow = new ActionRowBuilder().addComponents(moneyInput);
                modal.addComponents(firstRow);
                
                await interaction.showModal(modal);
            }

            if (interaction.customId === 'close_ticket') {
                const channel = interaction.channel;
                const member = interaction.member;
                
                if (!member || !member.roles || !member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) {
                    return await safeReply(interaction, {
                        content: 'Only staff members can close tickets.',
                        ephemeral: true
                    });
                }
                
                await safeReply(interaction, 'Generating transcript and closing ticket in 5 seconds...');
                
                try {
                    const transcriptContent = await generateTranscript(
                        channel.id, 
                        channel.name,
                        channel.ticketInfo || {}
                    );
                    
                    const transcriptBuffer = Buffer.from(transcriptContent, 'utf-8');
                    const attachment = new AttachmentBuilder(transcriptBuffer, { 
                        name: `transcript-${channel.name}.txt` 
                    });
                    
                    const transcriptChannel = interaction.guild.channels.cache.get(CONFIG.TRANSCRIPT_CHANNEL_ID);
                    if (transcriptChannel) {
                        const transcriptEmbed = new EmbedBuilder()
                            .setTitle('📄 Ticket Transcript')
                            .setDescription(`Transcript for ${channel.name}`)
                            .addFields(
                                { name: 'Ticket Channel', value: channel.name, inline: true },
                                { name: 'Closed By', value: member.user.username, inline: true },
                                { name: 'Closed At', value: new Date().toLocaleString(), inline: true }
                            )
                            .setColor(0x2ecc71)
                            .setFooter({ text: 'David\'s Coins | Ticket System' });
                        
                        await transcriptChannel.send({ 
                            embeds: [transcriptEmbed], 
                            files: [attachment] 
                        });
                        
                        console.log(`Transcript sent to channel ${CONFIG.TRANSCRIPT_CHANNEL_ID} for ticket ${channel.name}`);
                    } else {
                        console.error(`Transcript channel ${CONFIG.TRANSCRIPT_CHANNEL_ID} not found!`);
                    }
                } catch (error) {
                    console.error('Error generating transcript:', error);
                }
                
                for (const [userId, channelId] of activeTickets) {
                    if (channelId === channel.id) {
                        activeTickets.delete(userId);
                        break;
                    }
                }
                
                ticketMessages.delete(channel.id);

                setTimeout(async () => {
                    try {
                        await channel.delete();
                    } catch (error) {
                        console.error('Error deleting channel:', error);
                    }
                }, 5000);
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'calculate_modal') {
                const moneyInput = interaction.fields.getTextInputValue('money_input');
                const cleanMoney = moneyInput.replace(/[^0-9.]/g, '');
                const moneyAmount = parseFloat(cleanMoney);
                
                if (isNaN(moneyAmount) || moneyAmount <= 0) {
                    return await safeReply(interaction, {
                        content: '❌ Please enter a valid money amount (e.g., 100)',
                        ephemeral: true
                    });
                }
                
                let coinsFromMoney = 0;
                
                if (moneyAmount <= 300 * PRICES.buyUnder1B) {
                    coinsFromMoney = moneyAmount / PRICES.buyUnder1B;
                } else {
                    coinsFromMoney = moneyAmount / PRICES.buyOver1B;
                }
                
                let coinDisplay = '';
                if (coinsFromMoney >= 1000) {
                    coinDisplay = `${(coinsFromMoney / 1000).toFixed(1)}B`;
                } else {
                    coinDisplay = `${Math.round(coinsFromMoney)}M`;
                }
                
                const calculationMessage = `🧮 **David's Coins** Buy and Sell Coins, Exotics, And Skins. See **our-prices** for bulk pricing as well as prices for skins and exotics.\n\nFor ${moneyAmount}, you can buy ${coinDisplay} coins.`;
                
                await safeReply(interaction, {
                    content: calculationMessage,
                    ephemeral: false
                });
                
                return;
            }
            
            if (interaction.customId === 'price_modal') {
                const newBuyUnder1B = parseFloat(interaction.fields.getTextInputValue('buy_under_1b_input'));
                const newBuyOver1B = parseFloat(interaction.fields.getTextInputValue('buy_over_1b_input'));
                const newSell = parseFloat(interaction.fields.getTextInputValue('sell_input'));
                
                if (isNaN(newBuyUnder1B) || isNaN(newBuyOver1B) || isNaN(newSell)) {
                    return await safeReply(interaction, {
                        content: '❌ Invalid price format. Please enter valid numbers (e.g., 0.04)',
                        ephemeral: true
                    });
                }
                
                if (newBuyUnder1B <= 0 || newBuyOver1B <= 0 || newSell <= 0) {
                    return await safeReply(interaction, {
                        content: '❌ Prices must be greater than 0.',
                        ephemeral: true
                    });
                }
                
                PRICES.buyUnder1B = newBuyUnder1B;
                PRICES.buyOver1B = newBuyOver1B;
                PRICES.sell = newSell;
                
                await updateAllInfoMessages(interaction.guild);
                
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('✅ Prices Updated Successfully')
                    .setColor(0x00ff00)
                    .addFields(
                        { name: 'Buy Under 1B', value: `${PRICES.buyUnder1B}/m (${PRICES.buyUnder1B * 1000} per 1B)`, inline: true },
                        { name: 'Buy 1B+', value: `${PRICES.buyOver1B}/m (${PRICES.buyOver1B * 1000} per 1B)`, inline: true },
                        { name: 'Sell Price', value: `${PRICES.sell}/m (${PRICES.sell * 1000} per 1B)`, inline: true }
                    )
                    .setFooter({ text: 'All existing price displays have been updated automatically' });
                    
                await safeReply(interaction, { embeds: [confirmEmbed], ephemeral: true });
                
                console.log(`Prices updated by ${interaction.user.username}: Buy<1B: ${PRICES.buyUnder1B}, Buy1B+: ${PRICES.buyOver1B}, Sell: ${PRICES.sell}`);
                return;
            }
            
            if (interaction.customId === 'buy_modal' || interaction.customId === 'sell_modal') {
                const isBuying = interaction.customId === 'buy_modal';
                const ign = interaction.fields.getTextInputValue('username_input');
                const amount = interaction.fields.getTextInputValue('amount_input');

                const guild = interaction.guild;
                const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
                
                try {
                    const ticketChannel = await guild.channels.create({
                        name: `ticket-${username}`,
                        type: ChannelType.GuildText,
                        parent: CONFIG.TICKET_CATEGORY_ID,
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone.id,
                                deny: [PermissionFlagsBits.ViewChannel]
                            },
                            {
                                id: interaction.user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            },
                            {
                                id: CONFIG.STAFF_ROLE_ID,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.ManageChannels
                                ]
                            }
                        ]
                    });

                    activeTickets.set(interaction.user.id, ticketChannel.id);
                    ticketMessages.set(ticketChannel.id, []);

                    let rate = 0;
                    let totalPrice = 0;
                    
                    if (isBuying) {
                        const cleanAmount = amount.toLowerCase().replace(/[^0-9.]/g, '');
                        const numericAmount = parseFloat(cleanAmount);
                        
                        if (amount.toLowerCase().includes('b')) {
                            const amountInM = numericAmount * 1000;
                            rate = PRICES.buyOver1B;
                            totalPrice = amountInM * rate;
                        } else {
                            if (numericAmount >= 1000) {
                                rate = PRICES.buyOver1B;
                            } else if (numericAmount >= 300) {
                                rate = PRICES.buyUnder1B;
                            } else {
                                rate = PRICES.buyUnder1B;
                            }
                            totalPrice = numericAmount * rate;
                        }
                    } else {
                        const cleanAmount = amount.toLowerCase().replace(/[^0-9.]/g, '');
                        const numericAmount = parseFloat(cleanAmount);
                        const amountInM = amount.toLowerCase().includes('b') ? numericAmount * 1000 : numericAmount;
                        rate = PRICES.sell;
                        totalPrice = amountInM * rate;
                    }

                    const transactionEmbed = new EmbedBuilder()
                        .setTitle(isBuying ? 'Crypto Purchase' : 'Crypto Sale')
                        .setColor(0x00ff00)
                        .setDescription('A Seller will reply shortly!')
                        .addFields(
                            { name: 'IGN:', value: ign, inline: true },
                            { name: `User is ${isBuying ? 'buying' : 'selling'}:`, value: amount, inline: true }
                        );

                    if (totalPrice > 0) {
                        transactionEmbed.addFields(
                            { name: 'Cost Details:', value: `You are ${isBuying ? 'buying' : 'selling'} ${amount} coins for ${totalPrice.toFixed(2)} at a rate of ${rate}/m.`, inline: false }
                        );
                    }

                    transactionEmbed.setFooter({ text: `David's Coins | Made by David • Today at ${new Date().toLocaleTimeString()}` });

                    const ticketInfo = {
                        ign: ign,
                        transaction: `${isBuying ? 'Buying' : 'Selling'} ${amount}`,
                        cost: totalPrice > 0 ? `${totalPrice.toFixed(2)} at ${rate}/m rate` : 'Price not calculated',
                        user: interaction.user.username,
                        userId: interaction.user.id
                    };

                    ticketChannel.ticketInfo = ticketInfo;

                    const closeRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('close_ticket')
                                .setLabel('🔒 Close Ticket')
                                .setStyle(ButtonStyle.Danger)
                        );

                    await ticketChannel.send(`<@&${CONFIG.STAFF_ROLE_ID}> <@${interaction.user.id}> is ${isBuying ? 'buying' : 'selling'} "${amount}"!`);
                    await ticketChannel.send({ embeds: [transactionEmbed], components: [closeRow] });

                    await safeReply(interaction, {
                        content: `✅ Ticket created successfully! ${ticketChannel}`,
                        ephemeral: true
                    });
                    
                } catch (error) {
                    console.error('Error creating ticket channel:', error);
                    await safeReply(interaction, {
                        content: '❌ Failed to create ticket. Please try again.',
                        ephemeral: true
                    });
                }
            }
        }

    } catch (error) {
        console.error('Error handling interaction:', error);
        
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Something went wrong. Please try again.',
                    ephemeral: true
                });
            }
        } catch (replyError) {
            console.error('Error sending error response:', replyError);
        }
    }
});

// Error handling for better Railway stability
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

client.on('warn', (warning) => {
    console.warn('Discord client warning:', warning);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

// Graceful shutdown for Railway
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

// Login to Discord with better error handling
console.log('🚀 Starting bot...');
client.login(CONFIG.TOKEN).then(() => {
    console.log('✅ Bot login successful!');
}).catch((error) => {
    console.error('❌ Bot login failed:', error);
    process.exit(1);
});// Load environment variables
require('dotenv').config();

const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelType, 
    PermissionFlagsBits, 
    AttachmentBuilder 
} = require('discord.js');

// Configuration using environment variables (safer than hardcoding)
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID,
    TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID,
    STAFF_ROLE_ID: process.env.STAFF_ROLE_ID,
    VERIFIED_ROLE_ID: process.env.VERIFIED_ROLE_ID,
    TRANSCRIPT_CHANNEL_ID: '1387582544278585487',
    OWNER_USER_ID: '752590954388783196'
};

// Check if all required variables are loaded
console.log('🔍 Checking environment variables...');
if (!CONFIG.TOKEN) {
    console.error('❌ DISCORD_TOKEN is missing!');
    process.exit(1);
}
console.log('✅ Environment variables loaded successfully');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: ['CHANNEL']
});

// Track active tickets to prevent duplicates and store messages
const activeTickets = new Map();
const ticketMessages = new Map();

// Dynamic pricing system - UPDATED PRICES
let PRICES = {
    buyUnder1B: 0.04,   // Price per million for under 1B
    buyOver1B: 0.035,   // Price per million for 1B+
    sell: 0.018         // Price per million for selling
};

// Store info messages
const infoMessages = new Set();

// Helper functions for safety
function safeReply(interaction, content) {
    try {
        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply(content);
        }
    } catch (error) {
        console.error('Error replying to interaction:', error);
    }
}

function safeDeleteMessage(message) {
    try {
        if (message && message.delete) {
            message.delete();
        }
    } catch (error) {
        console.error('Error deleting message:', error);
    }
}

// Deploy commands function (placeholder)
async function deployCommands() {
    console.log('📝 Commands deployment not implemented yet');
}

// Bot ready event
client.once('ready', async () => {
    console.log(`🤖 Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} guild(s)`);
    
    try {
        await deployCommands();
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
});

// Message handler
client.on('messageCreate', async (message) => {
    try {
        if (!message || !message.author) return;
        
        // Track messages in ticket channels
        if (message.channel && message.channel.name && message.channel.name.startsWith('ticket-')) {
            if (!ticketMessages.has(message.channel.id)) {
                ticketMessages.set(message.channel.id, []);
            }
            
            const messageData = {
                timestamp: new Date(),
                author: message.author.username,
                authorId: message.author.id,
                content: message.content,
                embeds: message.embeds.map(embed => ({
                    title: embed.title,
                    description: embed.description,
                    fields: embed.fields
                })),
                isBot: message.author.bot
            };
            
            ticketMessages.get(message.channel.id).push(messageData);
            console.log(`Tracked message in ${message.channel.name}: ${message.author.username}: ${message.content.substring(0, 50)}...`);
        }
        
        if (message.author.bot) return;
        
        // Handle DM commands (only for bot owner)
        if (message.channel.type === 1) {
            if (message.author.id !== CONFIG.OWNER_USER_ID) {
                return await message.reply('❌ This bot only responds to its owner in DMs.');
            }
            
            if (message.content === '!dmhelp') {
                const dmHelpEmbed = new EmbedBuilder()
                    .setTitle('🔧 Bot Owner DM Commands')
                    .setColor(0x7289da)
                    .addFields(
                        { name: '!servers', value: 'List all servers the bot is in', inline: false },
                        { name: '!stats', value: 'Show bot statistics', inline: false },
                        { name: '!prices', value: 'Show current coin prices', inline: false },
                        { name: '!setprice <under1b> <over1b> <sell>', value: 'Update prices via DM', inline: false },
                        { name: '!dmhelp', value: 'Show this help menu', inline: false }
                    )
                    .setFooter({ text: 'David\'s Coins | Owner Commands' });
                
                return await message.reply({ embeds: [dmHelpEmbed] });
            }
            
            if (message.content === '!servers') {
                const servers = client.guilds.cache.map(guild => 
                    `**${guild.name}** (${guild.id}) - ${guild.memberCount} members`
                ).join('\n') || 'No servers';
                
                const serverEmbed = new EmbedBuilder()
                    .setTitle('🌐 Bot Servers')
                    .setDescription(servers)
                    .setColor(0x00ff00)
                    .setFooter({ text: `Total: ${client.guilds.cache.size} servers` });
                
                return await message.reply({ embeds: [serverEmbed] });
            }
            
            if (message.content === '!stats') {
                const uptime = process.uptime();
                const days = Math.floor(uptime / 86400);
                const hours = Math.floor(uptime / 3600) % 24;
                const minutes = Math.floor(uptime / 60) % 60;
                
                const statsEmbed = new EmbedBuilder()
                    .setTitle('📊 Bot Statistics')
                    .setColor(0x5865f2)
                    .addFields(
                        { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
                        { name: 'Active Tickets', value: activeTickets.size.toString(), inline: true },
                        { name: 'Tracked Messages', value: Array.from(ticketMessages.values()).reduce((total, msgs) => total + msgs.length, 0).toString(), inline: true },
                        { name: 'Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
                        { name: 'Memory Usage', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
                        { name: 'Ping', value: `${client.ws.ping}ms`, inline: true }
                    )
                    .setFooter({ text: 'David\'s Coins | Bot Stats' });
                
                return await message.reply({ embeds: [statsEmbed] });
            }
            
            if (message.content === '!prices') {
                const pricesEmbed = new EmbedBuilder()
                    .setTitle('💰 Current Coin Prices')
                    .setColor(0xf39c12)
                    .addFields(
                        { name: 'Buy Under 1B', value: `${PRICES.buyUnder1B}/m (${PRICES.buyUnder1B * 1000} per 1B)`, inline: false },
                        { name: 'Buy 1B+', value: `${PRICES.buyOver1B}/m (${PRICES.buyOver1B * 1000} per 1B)`, inline: false },
                        { name: 'Sell Price', value: `${PRICES.sell}/m (${PRICES.sell * 1000} per 1B)`, inline: false }
                    )
                    .setFooter({ text: 'David\'s Coins | Current Pricing' });
                
                return await message.reply({ embeds: [pricesEmbed] });
            }
            
            if (message.content.startsWith('!setprice ')) {
                const args = message.content.split(' ').slice(1);
                if (args.length !== 3) {
                    return await message.reply('❌ Usage: `!setprice <under1b> <over1b> <sell>`\nExample: `!setprice 0.04 0.035 0.018`');
                }
                
                const [newBuyUnder1B, newBuyOver1B, newSell] = args.map(parseFloat);
                
                if (isNaN(newBuyUnder1B) || isNaN(newBuyOver1B) || isNaN(newSell)) {
                    return await message.reply('❌ All prices must be valid numbers.');
                }
                
                if (newBuyUnder1B <= 0 || newBuyOver1B <= 0 || newSell <= 0) {
                    return await message.reply('❌ All prices must be greater than 0.');
                }
                
                // Update prices
                PRICES.buyUnder1B = newBuyUnder1B;
                PRICES.buyOver1B = newBuyOver1B;
                PRICES.sell = newSell;
                
                // Update all info messages in all servers
                for (const guild of client.guilds.cache.values()) {
                    try {
                        await updateAllInfoMessages(guild);
                    } catch (error) {
                        console.error(`Error updating prices in guild ${guild.name}:`, error);
                    }
                }
                
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('✅ Prices Updated Successfully')
                    .setColor(0x00ff00)
                    .addFields(
                        { name: 'Buy Under 1B', value: `${PRICES.buyUnder1B}/m (${PRICES.buyUnder1B * 1000} per 1B)`, inline: true },
                        { name: 'Buy 1B+', value: `${PRICES.buyOver1B}/m (${PRICES.buyOver1B * 1000} per 1B)`, inline: true },
                        { name: 'Sell Price', value: `${PRICES.sell}/m (${PRICES.sell * 1000} per 1B)`, inline: true }
                    )
                    .setFooter({ text: 'All servers have been updated automatically' });
                
                return await message.reply({ embeds: [confirmEmbed] });
            }
            
            return await message.reply('❓ Unknown command. Use `!dmhelp` to see available commands.');
        }
        
        // Server commands
        const isStaff = message.member && message.member.roles && message.member.roles.cache.has(CONFIG.STAFF_ROLE_ID);
        
        // !crypto - Available to everyone
        if (message.content === '!crypto') {
            const cryptoEmbed = new EmbedBuilder()
                .setTitle("🪙 Cryptocurrency Wallet Addresses")
                .setColor(0xf39c12)
                .setDescription("**Send payments to the addresses below:**")
                .addFields(
                    {
                        name: "<:LTC:1387494812269412372> **Litecoin (LTC)**",
                        value: "```MKJxhQMSg6oAhEXwLukRJvzsWpgQuokf43```",
                        inline: false
                    },
                    {
                        name: "<:BTC:1387494854497669242> **Bitcoin (BTC)**",
                        value: "```3PAfW9MqE5xkHrAwE2HmTPgzRziotiugNu```",
                        inline: false
                    },
                    {
                        name: "<:ETH:1387494868531675226> **Ethereum (ETH)**",
                        value: "```0x753488DE45f33047806ac23B2693d87167829E08```",
                        inline: false
                    },
                    {
                        name: "<:USDT:1387494839855218798> **Tether (USDT)**",
                        value: "```0xC41199c503C615554fA97803db6a688685e567D5```",
                        inline: false
                    }
                )
                .setFooter({ text: "David's Coins • Always verify addresses before sending • Transactions are irreversible" });

            const cryptoButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('copy_ltc')
                        .setLabel('Copy LTC')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('1387494812269412372'),
                    new ButtonBuilder()
                        .setCustomId('copy_btc')
                        .setLabel('Copy BTC')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('1387494854497669242'),
                    new ButtonBuilder()
                        .setCustomId('copy_eth')
                        .setLabel('Copy ETH')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('1387494868531675226'),
                    new ButtonBuilder()
                        .setCustomId('copy_usdt')
                        .setLabel('Copy USDT')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('1387494839855218798')
                );

            await message.reply({ embeds: [cryptoEmbed], components: [cryptoButtons] });
            safeDeleteMessage(message);
            return;
        }
        
        // Staff only commands
        if (!isStaff && message.content.startsWith('!')) return;
        
        if (message.content === '!info') {
            const embed = new EmbedBuilder()
                .setTitle("David's Coins")
                .setColor(0x5865F2)
                .addFields(
                    {
                        name: "Coins Buy Prices:",
                        value: `• ${PRICES.buyUnder1B}/m for 300m-1b (${PRICES.buyUnder1B * 1000} per 1B)\n• ${PRICES.buyOver1B}/m for 1b+ (${PRICES.buyOver1B * 1000} per 1B)`,
                        inline: false
                    },
                    {
                        name: "Coins Sell Prices:",
                        value: `• ${PRICES.sell}/m for 1b+ (${PRICES.sell * 1000} per 1B)`,
                        inline: false
                    },
                    {
                        name: "Payment Methods:",
                        value: "<:LTC:1387494812269412372> <:BTC:1387494854497669242> <:ETH:1387494868531675226> <:USDT:1387494839855218798>",
                        inline: false
                    }
                );

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('buy_coins')
                        .setLabel('Buy')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('sell_coins')
                        .setLabel('Sell')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('calculate_coins')
                        .setLabel('Calculate')
                        .setStyle(ButtonStyle.Success)
                );

            const infoMessage = await message.reply({ embeds: [embed], components: [row] });
            infoMessages.add(infoMessage.id);
            safeDeleteMessage(message);
        }
        
        if (message.content === '!rules') {
            const rulesEmbed = new EmbedBuilder()
                .setTitle("📋 Server Rules")
                .setColor(0xff6b6b)
                .setDescription("Please follow these rules to ensure a safe and professional trading environment:")
                .addFields(
                    { name: "**1. Have basic human decency**", value: "Treat all members with respect and courtesy.", inline: false },
                    { name: "**2. Don't advertise in chat or in DMs**", value: "No promotion of other services or unsolicited messages.", inline: false },
                    { name: "**3. Don't attempt to scam**", value: "Any fraudulent activity will result in immediate ban.", inline: false },
                    { name: "**4. Don't spam the ticket system**", value: "Only create tickets for legitimate transactions.", inline: false },
                    { name: "**5. Don't leak other players' IGNs**", value: "Respect privacy and keep player information confidential.", inline: false },
                    { name: "**6. Communicate through English**", value: "All communication must be in English for clarity.", inline: false }
                )
                .setFooter({ text: "Violation of these rules may result in warnings, mutes, or permanent bans." });

            await message.reply({ embeds: [rulesEmbed] });
            safeDeleteMessage(message);
        }
        
        if (message.content === '!tos') {
            const tosEmbed = new EmbedBuilder()
                .setTitle("📜 Terms of Service")
                .setColor(0xffa500)
                .setDescription("**Once you join David's Coins, you're automatically agreeing to the following terms:**")
                .addFields(
                    { name: "1. No Refunds", value: "There are no refunds once the transaction has taken place.", inline: false },
                    { name: "2. Chargeback Policy", value: "Any and all chargebacks will result in a permanent ban from our discord server.", inline: false },
                    { name: "3. Payment Verification", value: "By purchasing any goods from us you acknowledge that the money is totally yours.", inline: false },
                    { name: "4. Ban Rights", value: "We reserve the right to ban anyone from our discord server at any point in time for any reason, any paid for and not received items will get refunded.", inline: false },
                    { name: "5. Service Refusal", value: "We reserve the right to refuse service to anyone at anytime.", inline: false },
                    { name: "6. Server Protection", value: "If any damage is caused onto our server by you, we reserve the right to ban you without a refund.", inline: false },
                    { name: "7. Terms Changes", value: "These terms are subject to change at any time without notice to the client.", inline: false },
                    { name: "8. Price Changes", value: "We reserve the right to change the price of our products at any time we want.", inline: false }
                )
                .setFooter({ text: "By using our services, you agree to these terms and conditions." });

            await message.reply({ embeds: [tosEmbed] });
            safeDeleteMessage(message);
        }
        
        if (message.content === '!verify') {
            const verifyEmbed = new EmbedBuilder()
                .setTitle("✅ Server Verification")
                .setColor(0x00ff00)
                .setDescription("Welcome to **David's Coins**!\n\nClick the ✅ reaction below to verify yourself and gain access to the server.");

            const verifyMessage = await message.reply({ embeds: [verifyEmbed] });
            await verifyMessage.react('✅');
            safeDeleteMessage(message);
        }
        
        if (message.content === '!payments') {
            const paymentsEmbed = new EmbedBuilder()
                .setTitle("💳 Payment Methods")
                .setColor(0x2ecc71)
                .setDescription("**David's Coins** accepts the following secure payment methods for all transactions:")
                .addFields(
                    {
                        name: "🪙 **Primary Cryptocurrencies**",
                        value: "<:BTC:1387494854497669242> **Bitcoin (BTC)**\n<:ETH:1387494868531675226> **Ethereum (ETH)**\n<:LTC:1387494812269412372> **Litecoin (LTC)**\n<:USDT:1387494839855218798> **Tether (USDT)**",
                        inline: false
                    },
                    {
                        name: "⚡ **Why Cryptocurrency?**",
                        value: "• **Fast transactions** - Nearly instant transfers\n• **Low fees** - Minimal processing costs\n• **Secure** - Blockchain-verified transactions\n• **Global** - Available worldwide 24/7",
                        inline: false
                    },
                    {
                        name: "**Additional Payment Options**",
                        value: "We may accept other payment methods on a case-by-case basis. Please contact our staff through a ticket to discuss alternative payment arrangements.",
                        inline: false
                    }
                )
                .setFooter({ text: "David's Coins • Secure & Professional Trading • All transactions are final" });

            await message.reply({ embeds: [paymentsEmbed] });
            safeDeleteMessage(message);
        }
        
        if (message.content === '!help') {
            const helpEmbed = new EmbedBuilder()
                .setTitle("📚 Available Commands")
                .setColor(0x7289da)
                .setDescription("Here are all the available commands for **David's Coins**:")
                .addFields(
                    { name: "🛒 **!info**", value: "View shop information, prices, and payment methods with Buy/Sell buttons", inline: false },
                    { name: "📋 **!rules**", value: "Display server rules and guidelines for a safe trading environment", inline: false },
                    { name: "📜 **!tos**", value: "View our Terms of Service and important legal information", inline: false },
                    { name: "💳 **!payments**", value: "View accepted payment methods and transaction information", inline: false },
                    { name: "🪙 **!crypto**", value: "Display cryptocurrency wallet addresses for payments", inline: false },
                    { name: "✅ **!verify**", value: "Verify yourself to gain access to the server (react with ✅)", inline: false },
                    { name: "📚 **!help**", value: "Show this help menu with all available commands", inline: false },
                    { name: "🔒 **!close**", value: "Close a ticket (staff only, must be used in ticket channels)", inline: false },
                    { name: "💰 **!price**", value: "Update coin prices (staff only, updates all existing price displays)", inline: false }
                )
                .setFooter({ text: "David's Coins • Professional Skyblock Trading" });

            await message.reply({ embeds: [helpEmbed] });
            safeDeleteMessage(message);
        }
        
        if (message.content === '!close') {
            if (!message.channel.name || !message.channel.name.startsWith('ticket-')) {
                return await message.reply('This command can only be used in ticket channels.');
            }
            
            await message.reply('Generating transcript and closing ticket in 5 seconds...');
            
            try {
                const transcriptContent = await generateTranscript(
                    message.channel.id, 
                    message.channel.name,
                    message.channel.ticketInfo || {}
                );
                
                const transcriptBuffer = Buffer.from(transcriptContent, 'utf-8');
                const attachment = new AttachmentBuilder(transcriptBuffer, { 
                    name: `transcript-${message.channel.name}.txt` 
                });
                
                const transcriptChannel = message.guild.channels.cache.get(CONFIG.TRANSCRIPT_CHANNEL_ID);
                if (transcriptChannel) {
                    const transcriptEmbed = new EmbedBuilder()
                        .setTitle('📄 Ticket Transcript')
                        .setDescription(`Transcript for ${message.channel.name}`)
                        .addFields(
                            { name: 'Ticket Channel', value: message.channel.name, inline: true },
                            { name: 'Closed By', value: message.author.username, inline: true },
                            { name: 'Closed At', value: new Date().toLocaleString(), inline: true }
                        )
                        .setColor(0x2ecc71)
                        .setFooter({ text: 'David\'s Coins | Ticket System' });
                    
                    await transcriptChannel.send({ 
                        embeds: [transcriptEmbed], 
                        files: [attachment] 
                    });
                    
                    console.log(`Transcript sent via !close command for ticket ${message.channel.name}`);
                } else {
                    console.error(`Transcript channel ${CONFIG.TRANSCRIPT_CHANNEL_ID} not found!`);
                }
            } catch (error) {
                console.error('Error generating transcript via !close:', error);
            }
            
            for (const [userId, channelId] of activeTickets) {
                if (channelId === message.channel.id) {
                    activeTickets.delete(userId);
                    break;
                }
            }
            
            ticketMessages.delete(message.channel.id);

            setTimeout(async ()
