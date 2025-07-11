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

console.log('🔍 Checking environment variables...');
if (!CONFIG.TOKEN) {
    console.error('❌ DISCORD_TOKEN is missing!');
    process.exit(1);
}
console.log('✅ Environment variables loaded successfully');

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

const activeTickets = new Map();
const ticketMessages = new Map();
const infoMessages = new Set();

let PRICES = {
    buyUnder1B: 0.04,
    buyOver1B: 0.035,
    sell: 0.018
};

function safeReply(interaction, content) {
    try {
        if (interaction && !interaction.replied && !interaction.deferred) {
            return interaction.reply(content);
        }
    } catch (error) {
        console.error('Error replying to interaction:', error);
    }
}

function safeDeleteMessage(message) {
    try {
        if (message && typeof message.delete === 'function') {
            message.delete().catch(() => {});
        }
    } catch (error) {
        console.error('Error deleting message:', error);
    }
}

client.once('ready', () => {
    console.log(`🤖 Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} guild(s)`);
});

client.on('messageCreate', async (message) => {
    try {
        if (!message || !message.author || message.author.bot) return;
        
        // Track ticket messages
        if (message.channel && message.channel.name && message.channel.name.startsWith('ticket-')) {
            if (!ticketMessages.has(message.channel.id)) {
                ticketMessages.set(message.channel.id, []);
            }
            
            ticketMessages.get(message.channel.id).push({
                timestamp: new Date(),
                author: message.author.username,
                authorId: message.author.id,
                content: message.content,
                isBot: message.author.bot
            });
        }
        
        // DM commands for owner
        if (message.channel.type === 1) {
            if (message.author.id !== CONFIG.OWNER_USER_ID) {
                return message.reply('❌ This bot only responds to its owner in DMs.');
            }
            
            if (message.content === '!dmhelp') {
                const embed = new EmbedBuilder()
                    .setTitle('🔧 Bot Owner Commands')
                    .setColor(0x7289da)
                    .addFields(
                        { name: '!servers', value: 'List servers', inline: false },
                        { name: '!stats', value: 'Show stats', inline: false },
                        { name: '!prices', value: 'Show prices', inline: false },
                        { name: '!setprice <under1b> <over1b> <sell>', value: 'Update prices', inline: false }
                    );
                return message.reply({ embeds: [embed] });
            }
            
            if (message.content === '!servers') {
                const servers = client.guilds.cache.map(g => `${g.name} (${g.memberCount})`).join('\n') || 'None';
                return message.reply(`**Servers:**\n${servers}`);
            }
            
            if (message.content === '!stats') {
                const uptime = Math.floor(process.uptime() / 60);
                const embed = new EmbedBuilder()
                    .setTitle('📊 Stats')
                    .addFields(
                        { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
                        { name: 'Uptime', value: `${uptime}m`, inline: true },
                        { name: 'Tickets', value: activeTickets.size.toString(), inline: true }
                    );
                return message.reply({ embeds: [embed] });
            }
            
            if (message.content === '!prices') {
                const embed = new EmbedBuilder()
                    .setTitle('💰 Current Prices')
                    .addFields(
                        { name: 'Buy <1B', value: `${PRICES.buyUnder1B}/m`, inline: true },
                        { name: 'Buy 1B+', value: `${PRICES.buyOver1B}/m`, inline: true },
                        { name: 'Sell', value: `${PRICES.sell}/m`, inline: true }
                    );
                return message.reply({ embeds: [embed] });
            }
            
            if (message.content.startsWith('!setprice ')) {
                const args = message.content.split(' ').slice(1);
                if (args.length !== 3) {
                    return message.reply('❌ Usage: `!setprice <under1b> <over1b> <sell>`');
                }
                
                const [newBuyUnder1B, newBuyOver1B, newSell] = args.map(parseFloat);
                
                if (isNaN(newBuyUnder1B) || isNaN(newBuyOver1B) || isNaN(newSell)) {
                    return message.reply('❌ All prices must be valid numbers.');
                }
                
                if (newBuyUnder1B <= 0 || newBuyOver1B <= 0 || newSell <= 0) {
                    return message.reply('❌ All prices must be greater than 0.');
                }
                
                PRICES.buyUnder1B = newBuyUnder1B;
                PRICES.buyOver1B = newBuyOver1B;
                PRICES.sell = newSell;
                
                const embed = new EmbedBuilder()
                    .setTitle('✅ Prices Updated')
                    .setColor(0x00ff00)
                    .addFields(
                        { name: 'Buy <1B', value: `${PRICES.buyUnder1B}/m`, inline: true },
                        { name: 'Buy 1B+', value: `${PRICES.buyOver1B}/m`, inline: true },
                        { name: 'Sell', value: `${PRICES.sell}/m`, inline: true }
                    );
                
                return message.reply({ embeds: [embed] });
            }
            
            return message.reply('Use !dmhelp for commands');
        }
        
        // Server commands
        const isStaff = message.member && message.member.roles && message.member.roles.cache.has(CONFIG.STAFF_ROLE_ID);
        
        if (message.content === '!crypto') {
            const embed = new EmbedBuilder()
                .setTitle("🪙 Crypto Addresses")
                .setColor(0xf39c12)
                .addFields(
                    { name: "Bitcoin", value: "```3PAfW9MqE5xkHrAwE2HmTPgzRziotiugNu```", inline: false },
                    { name: "Ethereum", value: "```0x753488DE45f33047806ac23B2693d87167829E08```", inline: false },
                    { name: "Litecoin", value: "```MKJxhQMSg6oAhEXwLukRJvzsWpgQuokf43```", inline: false },
                    { name: "USDT", value: "```0xC41199c503C615554fA97803db6a688685e567D5```", inline: false }
                );
            
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('copy_btc').setLabel('Copy BTC').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('copy_eth').setLabel('Copy ETH').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('copy_ltc').setLabel('Copy LTC').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('copy_usdt').setLabel('Copy USDT').setStyle(ButtonStyle.Secondary)
                );
            
            await message.reply({ embeds: [embed], components: [buttons] });
            safeDeleteMessage(message);
            return;
        }
        
        if (!isStaff && message.content.startsWith('!')) return;
        
        if (message.content === '!info') {
            const embed = new EmbedBuilder()
                .setTitle("David's Coins")
                .setColor(0x5865F2)
                .addFields(
                    { name: "Buy Prices", value: `• ${PRICES.buyUnder1B}/m for <1B (${PRICES.buyUnder1B * 1000} per 1B)\n• ${PRICES.buyOver1B}/m for 1B+ (${PRICES.buyOver1B * 1000} per 1B)`, inline: false },
                    { name: "Sell Price", value: `• ${PRICES.sell}/m for 1B+ (${PRICES.sell * 1000} per 1B)`, inline: false }
                );

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('buy_coins').setLabel('Buy').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('sell_coins').setLabel('Sell').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('calculate_coins').setLabel('Calculate').setStyle(ButtonStyle.Success)
                );

            const msg = await message.reply({ embeds: [embed], components: [row] });
            infoMessages.add(msg.id);
            safeDeleteMessage(message);
        }
        
        if (message.content === '!help') {
            const embed = new EmbedBuilder()
                .setTitle("📚 Commands")
                .setColor(0x7289da)
                .addFields(
                    { name: "!info", value: "Show prices and buy/sell buttons", inline: false },
                    { name: "!crypto", value: "Show wallet addresses", inline: false },
                    { name: "!verify", value: "Create verification message", inline: false },
                    { name: "!rules", value: "Show server rules", inline: false },
                    { name: "!tos", value: "Show terms of service", inline: false },
                    { name: "!payments", value: "Show payment methods", inline: false },
                    { name: "!close", value: "Close ticket (in ticket channels)", inline: false }
                );
            
            await message.reply({ embeds: [embed] });
            safeDeleteMessage(message);
        }
        
        if (message.content === '!rules') {
            const embed = new EmbedBuilder()
                .setTitle("📋 Server Rules")
                .setColor(0xff6b6b)
                .addFields(
                    { name: "1. Have basic human decency", value: "Treat all members with respect.", inline: false },
                    { name: "2. Don't advertise", value: "No promotion of other services.", inline: false },
                    { name: "3. Don't scam", value: "Any fraud results in immediate ban.", inline: false },
                    { name: "4. Don't spam tickets", value: "Only create legitimate tickets.", inline: false },
                    { name: "5. Don't leak IGNs", value: "Respect privacy.", inline: false },
                    { name: "6. English only", value: "All communication in English.", inline: false }
                );
            
            await message.reply({ embeds: [embed] });
            safeDeleteMessage(message);
        }
        
        if (message.content === '!tos') {
            const embed = new EmbedBuilder()
                .setTitle("📜 Terms of Service")
                .setColor(0xffa500)
                .addFields(
                    { name: "1. No Refunds", value: "No refunds after transaction.", inline: false },
                    { name: "2. Chargeback Policy", value: "Chargebacks result in permanent ban.", inline: false },
                    { name: "3. Payment Verification", value: "Money must be totally yours.", inline: false },
                    { name: "4. Ban Rights", value: "We reserve right to ban anyone.", inline: false }
                );
            
            await message.reply({ embeds: [embed] });
            safeDeleteMessage(message);
        }
        
        if (message.content === '!payments') {
            const embed = new EmbedBuilder()
                .setTitle("💳 Payment Methods")
                .setColor(0x2ecc71)
                .addFields(
                    { name: "Cryptocurrencies", value: "Bitcoin, Ethereum, Litecoin, USDT", inline: false },
                    { name: "Why Crypto?", value: "Fast, secure, low fees, global", inline: false }
                );
            
            await message.reply({ embeds: [embed] });
            safeDeleteMessage(message);
        }
        
        if (message.content === '!verify') {
            const embed = new EmbedBuilder()
                .setTitle("✅ Verification")
                .setDescription("React with ✅ to verify")
                .setColor(0x00ff00);
            
            const msg = await message.reply({ embeds: [embed] });
            await msg.react('✅');
            safeDeleteMessage(message);
        }
        
        if (message.content === '!close') {
            if (!message.channel.name || !message.channel.name.startsWith('ticket-')) {
                return message.reply('Only works in ticket channels');
            }
            
            await message.reply('Closing in 5 seconds...');
            
            // Remove from tracking
            for (const [userId, channelId] of activeTickets) {
                if (channelId === message.channel.id) {
                    activeTickets.delete(userId);
                    break;
                }
            }
            ticketMessages.delete(message.channel.id);
            
            setTimeout(() => {
                try {
                    message.channel.delete();
                } catch (error) {
                    console.error('Error deleting channel:', error);
                }
            }, 5000);
        }
        
    } catch (error) {
        console.error('Error in messageCreate:', error);
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    try {
        if (user.bot) return;
        
        if (reaction.partial) await reaction.fetch();
        
        if (reaction.emoji.name === '✅') {
            const message = reaction.message;
            if (message.embeds.length > 0 && message.embeds[0].title === '✅ Verification') {
                const guild = message.guild;
                const member = await guild.members.fetch(user.id);
                
                if (member.roles.cache.has(CONFIG.VERIFIED_ROLE_ID)) {
                    await reaction.users.remove(user.id);
                    return;
                }
                
                await member.roles.add(CONFIG.VERIFIED_ROLE_ID);
                await reaction.users.remove(user.id);
                
                const successMsg = await message.channel.send(`✅ ${user} verified!`);
                setTimeout(() => safeDeleteMessage(successMsg), 5000);
            }
        }
    } catch (error) {
        console.error('Error in reaction handler:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction) return;
        
        if (interaction.isButton()) {
            
            if (interaction.customId.startsWith('copy_')) {
                const addresses = {
                    'copy_btc': '3PAfW9MqE5xkHrAwE2HmTPgzRziotiugNu',
                    'copy_eth': '0x753488DE45f33047806ac23B2693d87167829E08',
                    'copy_ltc': 'MKJxhQMSg6oAhEXwLukRJvzsWpgQuokf43',
                    'copy_usdt': '0xC41199c503C615554fA97803db6a688685e567D5'
                };
                
                const address = addresses[interaction.customId];
                const cryptoName = interaction.customId.replace('copy_', '').toUpperCase();
                
                if (address) {
                    await safeReply(interaction, {
                        content: `**${cryptoName} Address:**\n\`${address}\``,
                        ephemeral: true
                    });
                }
                return;
            }
            
            if (interaction.customId === 'buy_coins' || interaction.customId === 'sell_coins') {
                if (activeTickets.has(interaction.user.id)) {
                    return safeReply(interaction, {
                        content: 'You already have an active ticket!',
                        ephemeral: true
                    });
                }

                const isBuying = interaction.customId === 'buy_coins';
                const modal = new ModalBuilder()
                    .setCustomId(isBuying ? 'buy_modal' : 'sell_modal')
                    .setTitle(isBuying ? 'Buy Coins' : 'Sell Coins');

                const amountInput = new TextInputBuilder()
                    .setCustomId('amount_input')
                    .setLabel('Amount')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('1b');

                const usernameInput = new TextInputBuilder()
                    .setCustomId('username_input')
                    .setLabel('Minecraft Username')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('username');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(amountInput),
                    new ActionRowBuilder().addComponents(usernameInput)
                );

                await interaction.showModal(modal);
            }
            
            if (interaction.customId === 'calculate_coins') {
                const modal = new ModalBuilder()
                    .setCustomId('calculate_modal')
                    .setTitle('Calculate Coins');

                const moneyInput = new TextInputBuilder()
                    .setCustomId('money_input')
                    .setLabel('Money Amount')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('100');

                modal.addComponents(new ActionRowBuilder().addComponents(moneyInput));
                await interaction.showModal(modal);
            }

            if (interaction.customId === 'close_ticket') {
                if (!interaction.member || !interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) {
                    return safeReply(interaction, {
                        content: 'Only staff can close tickets',
                        ephemeral: true
                    });
                }
                
                await safeReply(interaction, 'Closing ticket...');
                
                for (const [userId, channelId] of activeTickets) {
                    if (channelId === interaction.channel.id) {
                        activeTickets.delete(userId);
                        break;
                    }
                }
                ticketMessages.delete(interaction.channel.id);
                
                setTimeout(() => {
                    try {
                        interaction.channel.delete();
                    } catch (error) {
                        console.error('Error deleting channel:', error);
                    }
                }, 3000);
            }
        }

        if (interaction.isModalSubmit()) {
            
            if (interaction.customId === 'calculate_modal') {
                const moneyInput = interaction.fields.getTextInputValue('money_input');
                const money = parseFloat(moneyInput.replace(/[^0-9.]/g, ''));
                
                if (isNaN(money) || money <= 0) {
                    return safeReply(interaction, {
                        content: '❌ Invalid amount',
                        ephemeral: true
                    });
                }
                
                const coins = money <= 300 * PRICES.buyUnder1B ? 
                    money / PRICES.buyUnder1B : 
                    money / PRICES.buyOver1B;
                    
                const display = coins >= 1000 ? `${(coins/1000).toFixed(1)}B` : `${Math.round(coins)}M`;
                
                return safeReply(interaction, {
                    content: `💰 For $${money}, you can buy ${display} coins.`,
                    ephemeral: false
                });
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
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                            },
                            {
                                id: CONFIG.STAFF_ROLE_ID,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
                            }
                        ]
                    });

                    activeTickets.set(interaction.user.id, ticketChannel.id);
                    ticketMessages.set(ticketChannel.id, []);

                    // Calculate price
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

                    const embed = new EmbedBuilder()
                        .setTitle(isBuying ? 'Purchase Request' : 'Sale Request')
                        .setColor(0x00ff00)
                        .addFields(
                            { name: 'IGN', value: ign, inline: true },
                            { name: 'Amount', value: amount, inline: true }
                        );

                    if (totalPrice > 0) {
                        embed.addFields(
                            { name: 'Cost', value: `$${totalPrice.toFixed(2)} at ${rate}/m`, inline: false }
                        );
                    }

                    const closeButton = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('close_ticket')
                                .setLabel('🔒 Close')
                                .setStyle(ButtonStyle.Danger)
                        );

                    await ticketChannel.send(`<@&${CONFIG.STAFF_ROLE_ID}> New ${isBuying ? 'purchase' : 'sale'} request!`);
                    await ticketChannel.send({ embeds: [embed], components: [closeButton] });

                    return safeReply(interaction, {
                        content: `✅ Ticket created: ${ticketChannel}`,
                        ephemeral: true
                    });
                    
                } catch (error) {
                    console.error('Error creating ticket:', error);
                    return safeReply(interaction, {
                        content: '❌ Failed to create ticket',
                        ephemeral: true
                    });
                }
            }
        }
        
    } catch (error) {
        console.error('Error in interaction handler:', error);
        try {
            if (!interaction.replied) {
                await interaction.reply({ content: 'An error occurred', ephemeral: true });
            }
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
    }
});

// Error handlers
client.on('error', error => console.error('Client error:', error));
client.on('warn', warning => console.warn('Client warning:', warning));

process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    client.destroy();
    process.exit(0);
});

console.log('🚀 Starting bot...');
client.login(CONFIG.TOKEN)
    .then(() => console.log('✅ Login successful'))
    .catch(error => {
        console.error('❌ Login failed:', error);
        process.exit(1);
    });
