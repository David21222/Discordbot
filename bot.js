// Load environment variables
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

// Configuration
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

// Validate environment variables
console.log('🔍 Checking environment variables...');
if (!CONFIG.TOKEN) {
    console.error('❌ DISCORD_TOKEN is missing!');
    process.exit(1);
}
console.log('✅ Environment variables loaded');

// Create client
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

// Data storage
const activeTickets = new Map();
const ticketMessages = new Map();
const infoMessages = new Set();

let PRICES = {
    buyUnder1B: 0.045,
    buyOver1B: 0.04,
    sell: 0.012
};

// Helper functions
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

// Bot ready
client.once('ready', () => {
    console.log(`🤖 Bot ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} guilds`);
});

// Message handler
client.on('messageCreate', async (message) => {
    try {
        if (!message || !message.author) return;
        
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
        
        if (message.author.bot) return;
        
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
                        { name: '!prices', value: 'Show prices', inline: false }
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
            
            return message.reply('Use !dmhelp for commands');
        }
        
        // Server commands
        const isStaff = message.member && message.member.roles && message.member.roles.cache.has(CONFIG.STAFF_ROLE_ID);
        
        // Crypto command (everyone)
        if (message.content === '!crypto') {
            const embed = new EmbedBuilder()
                .setTitle("🪙 Crypto Addresses")
                .setColor(0xf39c12)
                .addFields(
                    { name: "Bitcoin", value: "```3PAfW9MqE5xkHrAwE2HmTPgzRziotiugNu```", inline: false },
                    { name: "Ethereum", value: "```0x753488DE45f33047806ac23B2693d87167829E08```", inline: false },
                    { name: "Litecoin", value: "```MKJxhQMSg6oAhEXwLukRJvzsWpgQuokf43```", inline: false }
                );
            
            await message.reply({ embeds: [embed] });
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
                    { name: "Buy Prices", value: `• ${PRICES.buyUnder1B}/m for <1B\n• ${PRICES.buyOver1B}/m for 1B+`, inline: false },
                    { name: "Sell Price", value: `• ${PRICES.sell}/m for 1B+`, inline: false }
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
                    { name: "!close", value: "Close ticket (in ticket channels)", inline: false }
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

// Reaction handler
client.on('messageReactionAdd', async (reaction, user) => {
    try {
        if (user.bot) return;
        
        if (reaction.partial) {
            await reaction.fetch();
        }
        
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

// Interaction handler
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isButton()) {
            
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

                    const embed = new EmbedBuilder()
                        .setTitle(isBuying ? 'Purchase Request' : 'Sale Request')
                        .setColor(0x00ff00)
                        .addFields(
                            { name: 'IGN', value: ign, inline: true },
                            { name: 'Amount', value: amount, inline: true }
                        );

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

        if (interaction.isButton() && interaction.customId === 'close_ticket') {
            if (!interaction.member || !interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) {
                return safeReply(interaction, {
                    content: 'Only staff can close tickets',
                    ephemeral: true
                });
            }
            
            await safeReply(interaction, 'Closing ticket...');
            
            // Cleanup
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
client.on('error', error => {
    console.error('Client error:', error);
});

client.on('warn', warning => {
    console.warn('Client warning:', warning);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

// Graceful shutdown
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

// Login
console.log('🚀 Starting bot...');
client.login(CONFIG.TOKEN)
    .then(() => console.log('✅ Login successful'))
    .catch(error => {
        console.error('❌ Login failed:', error);
        process.exit(1);
    });
