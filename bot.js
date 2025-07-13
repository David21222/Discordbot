const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
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
const PROFILE_CATEGORY_ID = '1393744189187166279';
const PROFILE_CHANNEL_ID = '1393744763131400323';

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
    USDT: '<:USDT:1387494839855218798>',
    SKYBLOCK: '<:skyblock_level:1393120347427049585>'
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
    messagesSent: 0,
    profilesListed: 0
};

// Ticket message tracking
const ticketMessages = new Map();

// Track active tickets per user
const activeTickets = new Map(); // userId -> channelId

// Track active listings
const activeListings = new Map(); // userId -> listingData

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
            '• `!help` - Show this help message\n' +
            '• `/list` - List Skyblock account or profile for sale\n\n' +
            '**👥 Public Commands:**\n' +
            '• `!crypto` - Show cryptocurrency wallet addresses\n\n' +
            '**📋 How to Use:**\n' +
            '• Most commands require staff role\n' +
            '• Use buttons on embeds for trading\n' +
            '• Contact staff for assistance')
        .setColor('#0099ff')
        .setFooter({ text: 'David\'s Coins - Command Help' });
}

// Register slash commands
async function registerSlashCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('list')
            .setDescription('List a Skyblock account or profile for sale')
    ];

    try {
        console.log('Started refreshing application (/) commands.');
        
        await client.application.commands.set(commands, GUILD_ID);
        
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
}

// Bot ready event
client.once('ready', async () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`🌍 Connected to ${client.guilds.cache.size} servers`);
    console.log(`👥 Serving ${client.users.cache.size} users`);
    
    // Register slash commands
    await registerSlashCommands();
    
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
                            '`!setprice 0.04 0.035 0.018`')
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
                            { name: '📝 Profiles Listed', value: botStats.profilesListed.toString(), inline: true },
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
                    .setTitle('🔒 Close Ticket')
                    .setDescription('Are you sure you want to close this ticket?\n\n' +
                        'This action cannot be undone.')
                    .setColor('#ff0000');
                
                const closeButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('confirm_close')
                            .setLabel('Close Ticket')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒')
                    );
                
                await message.channel.send({ embeds: [closeEmbed], components: [closeButton] });
                botStats.messagesSent++;
                break;
            
            case 'price':
                const priceUpdateEmbed = new EmbedBuilder()
                    .setTitle('💰 Update Prices')
                    .setDescription('**Current Prices:**\n' +
                        `• Buy Under 1B: ${prices.buyUnder1B}/M\n` +
                        `• Buy Over 1B: ${prices.buyOver1B}/M\n` +
                        `• Sell Price: ${prices.sell}/M\n\n` +
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
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
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
                    .setTitle(`${EMOJIS.SKYBLOCK} Create New Listing`)
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
                            .setEmoji(EMOJIS.SKYBLOCK.replace('<:', '').replace('>', '').split(':')[1])
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
                return;
            }
        }
        
        if (interaction.isButton()) {
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
                
                // Create modal for listing details
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
                
                const firstRow = new ActionRowBuilder().addComponents(titleInput);
                const secondRow = new ActionRowBuilder().addComponents(descriptionInput);
                const thirdRow = new ActionRowBuilder().addComponents(priceInput);
                
                detailsModal.addComponents(firstRow, secondRow, thirdRow);
                
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
                    paymentText = `${EMOJIS.LTC}`;
                } else if (interaction.customId === 'payment_paypal') {
                    paymentMethods = ['PayPal'];
                    paymentText = '💳'; // Using generic payment emoji for now
                } else if (interaction.customId === 'payment_both') {
                    paymentMethods = ['LTC', 'PayPal'];
                    paymentText = `${EMOJIS.LTC}💳`;
                }
                
                listingData.paymentMethods = paymentMethods;
                listingData.paymentText = paymentText;
                
                // Create final listing
                await createListing(interaction, listingData);
                return;
            }
            
            // Handle unlist button
            if (interaction.customId.startsWith('unlist_')) {
                const listingId = interaction.customId.split('_')[1];
                
                if (!hasStaffRole(member)) {
                    await safeReply(interaction, {
                        content: '❌ Only the listing creator or staff can unlist items.',
                        ephemeral: true
                    });
                    return;
                }
                
                // Update the listing message to show it's been unlisted
                const embed = new EmbedBuilder()
                    .setTitle('🚫 Listing Removed')
                    .setDescription('This listing has been removed by staff.')
                    .setColor('#ff0000')
                    .setTimestamp();
                
                await interaction.update({
                    embeds: [embed],
                    components: []
                });
                
                await safeReply(interaction, {
                    content: '✅ Listing has been removed successfully.',
                    ephemeral: true
                });
                return;
            }
            
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
                        const transcriptChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL_ID);
                        
                        if (transcriptChannel && messages.length > 0) {
                            // Extract ticket info from first message (the embed)
                            const firstMessage = messages[0];
                            const ticketInfo = firstMessage.embed;
                            const ticketName = channel.name;
                            const createdTime = new Date(channel.createdTimestamp).toLocaleString();
                            const closedTime = new Date().toLocaleString();
                            const closedBy = interaction.user.username;
                            
                            // Extract IGN from ticket info
                            let ign = 'Unknown';
                            let transactionType = 'Unknown';
                            let cost = 'Unknown';
                            let rate = 'Unknown';
                            
                            if (ticketInfo && ticketInfo.description) {
                                const ignMatch = ticketInfo.description.match(/\*\*IGN:\*\* (.+)/);
                                const typeMatch = ticketInfo.description.match(/\*\*Type:\*\* (.+)/);
                                const priceMatch = ticketInfo.description.match(/\*\*Price:\*\* \$(.+) USD/);
                                const rateMatch = ticketInfo.description.match(/\*\*Rate Used:\*\* \$(.+)\/M/);
                                
                                if (ignMatch) ign = ignMatch[1];
                                if (typeMatch) transactionType = typeMatch[1];
                                if (priceMatch) cost = `${priceMatch[1]} at ${rateMatch ? rateMatch[1] : 'unknown'}/M rate`;
                            }
                            
                            // Create transcript header
                            let transcriptText = `TICKET TRANSCRIPT - ${ticketName}\n`;
                            transcriptText += `Created: ${createdTime}\n`;
                            transcriptText += `Ticket Channel ID: ${channel.id}\n`;
                            transcriptText += `Total Messages: ${messages.length}\n\n`;
                            transcriptText += `IGN: ${ign}\n`;
                            transcriptText += `Transaction: ${transactionType}\n`;
                            transcriptText += `Cost: ${cost}\n`;
                            transcriptText += `Customer: ${ticketInfo?.description?.match(/\*\*Customer:\*\* (.+)/)?.[1] || 'Unknown'}\n\n`;
                            transcriptText += `--- CONVERSATION ---\n\n`;
                            
                            // Add all messages to transcript
                            messages.forEach((msg, index) => {
                                const timestamp = new Date(msg.timestamp).toLocaleTimeString();
                                transcriptText += `[${timestamp}] ${msg.author}: `;
                                
                                if (msg.embed) {
                                    transcriptText += `[No text content]\n`;
                                    transcriptText += `    [EMBED] Title: ${msg.embed.title || 'Crypto Purchase'}\n`;
                                    transcriptText += `    [EMBED] Description: ${msg.embed.description ? 'A Seller will reply shortly!' : ''}\n`;
                                    transcriptText += `    [EMBED] IGN: ${ign}\n`;
                                    transcriptText += `    [EMBED] User is ${transactionType.toLowerCase()}: ${ticketInfo?.description?.match(/\*\*Amount:\*\* (.+) coins/)?.[1] || 'Unknown'}\n`;
                                    transcriptText += `    [EMBED] Cost Details: You are ${transactionType.toLowerCase()} ${ticketInfo?.description?.match(/\*\*Amount:\*\* (.+) coins/)?.[1] || 'Unknown'} coins for ${cost}.\n\n`;
                                } else {
                                    transcriptText += `${msg.content}\n\n`;
                                }
                            });
                            
                            transcriptText += `[${new Date().toLocaleTimeString()}] David's Coins [BOT]: Generating transcript and closing ticket in 5 seconds...\n\n`;
                            transcriptText += `--- END TRANSCRIPT ---\n`;
                            transcriptText += `Transcript generated on: ${closedTime}\n`;
                            transcriptText += `David's Coins | Ticket System\n`;
                            
                            // Send transcript embed
                            const transcriptEmbed = new EmbedBuilder()
                                .setTitle('📄 Ticket Transcript')
                                .setDescription(`Transcript for ${ticketName}`)
                                .addFields(
                                    { name: 'Ticket Channel', value: ticketName, inline: true },
                                    { name: 'Closed By', value: closedBy, inline: true },
                                    { name: 'Closed At', value: closedTime, inline: true }
                                )
                                .setColor('#0099ff')
                                .setFooter({ text: 'David\'s Coins | Ticket System' });
                            
                            // Send transcript as file
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
                        
                        // Clear ticket messages from memory and delete channel
                        ticketMessages.delete(channel.id);
                        // Remove user from active tickets tracking
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
        
        if (interaction.isModalSubmit()) {
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
                
                // Validate price
                const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
                if (isNaN(price) || price <= 0) {
                    await safeReply(interaction, {
                        content: '❌ Invalid price. Please enter a valid number (e.g., 150, 250.50).',
                        ephemeral: true
                    });
                    return;
                }
                
                // Store listing data
                listingData.title = title;
                listingData.description = description;
                listingData.price = price;
                listingData.step = 'payment_selection';
                
                // Create payment method selection
                const paymentEmbed = new EmbedBuilder()
                    .setTitle('💳 Select Payment Methods')
                    .setDescription('**Which payment methods do you accept for this listing?**\n\n' +
                        `${EMOJIS.LTC} **Litecoin (LTC)** - Cryptocurrency payment\n` +
                        '💳 **PayPal** - Traditional payment method\n' +
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
                            .setEmoji(EMOJIS.LTC.replace('<:', '').replace('>', '').split(':')[1]),
                        new ButtonBuilder()
                            .setCustomId('payment_paypal')
                            .setLabel('PayPal Only')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('💳'),
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
                        .setTitle(`🎫 ${type === 'buy' ? 'Buy' : 'Sell'} Ticket - ${minecraftUsername}`)
                        .setDescription(`**Transaction Details:**\n\n` +
                            `**Type:** ${type === 'buy' ? 'Buying' : 'Selling'} coins\n` +
                            `**Amount:** ${formattedAmount} coins\n` +
                            `**Price:** ${price.toFixed(2)} USD\n` +
                            `**Payment Method:** ${paymentMethod}\n` +
                            `**Minecraft Username:** ${minecraftUsername}\n` +
                            `**Customer:** ${interaction.user}\n\n` +
                            `**Next Steps:**\n` +
                            `${type === 'buy' ? 
                                '• Customer sends payment\n• Staff delivers coins after payment confirmation' : 
                                '• Customer provides coins in-game\n• Staff sends payment after receiving coins'}\n\n` +
                            `**Rate Used:** ${type === 'sell' ? prices.sell : (parsedAmount >= 1000000000 ? prices.buyOver1B : prices.buyUnder1B)}/M`)
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

// Function to create the final listing
async function createListing(interaction, listingData) {
    try {
        const guild = interaction.guild;
        const profileChannel = guild.channels.cache.get(PROFILE_CHANNEL_ID);
        
        if (!profileChannel) {
            await safeReply(interaction, {
                content: '❌ Profile channel not found. Please contact an administrator.',
                ephemeral: true
            });
            return;
        }
        
        // Create listing embed
        const listingEmbed = new EmbedBuilder()
            .setTitle(`${EMOJIS.SKYBLOCK} ${listingData.title}`)
            .setDescription(`**${listingData.type.charAt(0).toUpperCase() + listingData.type.slice(1)} for Sale**\n\n` +
                `${listingData.description}\n\n` +
                `**💰 Price:** ${listingData.price} USD\n` +
                `**
