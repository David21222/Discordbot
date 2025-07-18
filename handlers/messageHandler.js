const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { safeDeleteMessage, hasStaffRole } = require('../utils/utils');
const { ticketMessages, botStats } = require('../utils/stats');
const { createInfoEmbed, createCryptoEmbed, createRulesEmbed, createTOSEmbed, createPaymentsEmbed, createHelpEmbed } = require('../utils/embeds');
const config = require('../config/config');

async function handleMessageCommands(client, message) {
    if (message.author.bot) return;
    
    // Track messages in tickets AND account-purchase channels
    if (message.channel.name && 
        (message.channel.name.startsWith('ticket-') || message.channel.name.startsWith('account-purchase-'))) {
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
        if (message.author.id !== config.OWNER_USER_ID) return;
        
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
                            { name: 'Buy Under 1B', value: `${config.prices.buyUnder1B}/M`, inline: true },
                            { name: 'Buy Over 1B', value: `${config.prices.buyOver1B}/M`, inline: true },
                            { name: 'Sell Price', value: `${config.prices.sell}/M`, inline: true }
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
                    
                    config.prices.buyUnder1B = newUnder1B;
                    config.prices.buyOver1B = newOver1B;
                    config.prices.sell = newSell;
                    
                    await message.reply(`✅ Prices updated!\n• Buy Under 1B: ${newUnder1B}/M\n• Buy Over 1B: ${newOver1B}/M\n• Sell: ${newSell}/M`);
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
        
        if (command === 'pp') {
            const paypalEmbed = new EmbedBuilder()
                .setTitle('💳 PayPal Payment Instructions')
                .setDescription('**Follow these steps to complete your PayPal payment:**\n\n' +
                    '**📧 PayPal Email Address:**\n' +
                    '`D.Dovganyuk2409@gmail.com`\n\n' +
                    '**📋 Payment Steps:**\n' +
                    '**1.** 📹 Record yourself sending the money to the email address\n' +
                    '**2.** 💰 Make sure you send from your PayPal balance (not debit/credit card)\n' +
                    '**3.** 📸 Send screenshot of the payment receipt\n\n' +
                    '**⚠️ Important Notes:**\n' +
                    '• Send as **Friends & Family** to avoid fees\n' +
                    '• Include your Discord username in the payment note\n' +
                    '• Wait for payment confirmation before expecting delivery\n\n' +
                    '**Need Help?** Contact our support team if you have any questions!')
                .setColor('#0070ba')
                .setFooter({ text: 'David\'s Coins - Secure PayPal Payments' })
                .setThumbnail('https://i.imgur.com/Cq8JdC5.png') // PayPal logo
                .setTimestamp();
            
            const paypalButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('copy_paypal_email')
                        .setLabel('Copy PayPal Email')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📧')
                );
            
            await message.channel.send({ embeds: [paypalEmbed], components: [paypalButton] });
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
                // Updated to handle both ticket- and account-purchase- channels
                if (!message.channel.name || (!message.channel.name.startsWith('ticket-') && !message.channel.name.startsWith('account-purchase-'))) {
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
                        `• Buy Under 1B: ${config.prices.buyUnder1B}/M\n` +
                        `• Buy Over 1B: ${config.prices.buyOver1B}/M\n` +
                        `• Sell Price: ${config.prices.sell}/M\n\n` +
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
}

module.exports = { handleMessageCommands };
