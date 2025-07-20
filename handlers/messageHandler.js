const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { safeDeleteMessage, hasStaffRole } = require('../utils/utils');
const { ticketMessages, botStats } = require('../utils/stats');
const { createInfoEmbed, createCryptoEmbed, createRulesEmbed, createTOSEmbed, createPaymentsEmbed, createHelpEmbed } = require('../utils/embeds');
const { getUser, getOrCreateUser, getTopTraders, getUserHistory, getRecentTrades, getStatsForPeriod, formatCurrency, formatNumber, getServerStats } = require('../utils/database');
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
                .setTitle('<:paypal:1393746529101156383> PayPal Payment Instructions')
                .setDescription('**Follow these steps to complete your PayPal payment:**\n\n' +
                    '**📧 PayPal Email Address:**\n' +
                    '`D.Dovganyuk2409@gmail.com`\n\n' +
                    '**📋 Payment Steps:**\n' +
                    '**1.** Screen Record yourself sending the money to the email address\n' +
                    '**2.** Make sure you send from your PayPal balance (not debit/credit card)\n' +
                    '**3.** Send screenshot of the payment receipt\n\n' +
                    '**⚠️ Important Notes:**\n' +
                    '• Send as **Friends & Family ONLY**\n' +
                    '• Goods & services will not be accepted\n' +
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
                        .setLabel('Copy PayPal')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('1393746529101156383'),
                    new ButtonBuilder()
                        .setLabel('Direct Link')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://paypal.me/David21222565')
                        .setEmoji('🔗')
                );
            
            await message.channel.send({ embeds: [paypalEmbed], components: [paypalButton] });
            botStats.messagesSent++;
            return;
        }
        
        // Stats command
        if (command === 'stats') {
            const serverStats = getServerStats();
            const dailyStats = getStatsForPeriod('daily');
            const weeklyStats = getStatsForPeriod('weekly');
            const monthlyStats = getStatsForPeriod('monthly');
            
            const statsEmbed = new EmbedBuilder()
                .setTitle('📊 Server Trading Statistics')
                .setDescription('**Complete trading overview and analytics**')
                .addFields(
                    { 
                        name: '🏆 Overall Stats', 
                        value: `**Total Trades:** ${formatNumber(serverStats.totalTrades)}\n` +
                               `**Total Revenue:** ${formatCurrency(serverStats.totalRevenue)}\n` +
                               `**Active Traders:** ${formatNumber(serverStats.totalUsers)}\n` +
                               `**Average Trade:** ${formatCurrency(serverStats.totalTrades > 0 ? serverStats.totalRevenue / serverStats.totalTrades : 0)}`,
                        inline: true 
                    },
                    { 
                        name: '📅 Today', 
                        value: `**Trades:** ${dailyStats.trades}\n` +
                               `**Revenue:** ${formatCurrency(dailyStats.revenue)}`,
                        inline: true 
                    },
                    { 
                        name: '📈 This Week', 
                        value: `**Trades:** ${weeklyStats.trades}\n` +
                               `**Revenue:** ${formatCurrency(weeklyStats.revenue)}`,
                        inline: true 
                    },
                    { 
                        name: '📊 This Month', 
                        value: `**Trades:** ${monthlyStats.trades}\n` +
                               `**Revenue:** ${formatCurrency(monthlyStats.revenue)}`,
                        inline: true 
                    },
                    { 
                        name: '🎯 Bot Stats', 
                        value: `**Uptime:** ${Math.floor((Date.now() - botStats.startTime) / 3600000)}h\n` +
                               `**Tickets Created:** ${botStats.ticketsCreated}\n` +
                               `**Messages Sent:** ${botStats.messagesSent}`,
                        inline: true 
                    },
                    { 
                        name: '🔥 Activity', 
                        value: `**Profiles Listed:** ${botStats.profilesListed}\n` +
                               `**Commands Used:** ${formatNumber(botStats.messagesSent)}\n` +
                               `**Server Health:** 🟢 Excellent`,
                        inline: true 
                    }
                )
                .setColor('#00ff00')
                .setFooter({ text: 'David\'s Coins - Trading Analytics' })
                .setTimestamp();
            
            await message.channel.send({ embeds: [statsEmbed] });
            botStats.messagesSent++;
            return;
        }
        
        // Leaderboards command
        if (command === 'leaderboard' || command === 'lb') {
            const type = args[1] || 'volume'; // volume, trades, buys, sells, reputation
            let topTraders = [];
            let title = '';
            let description = '';
            
            switch (type.toLowerCase()) {
                case 'volume':
                    topTraders = getTopTraders('volume', 10);
                    title = '💰 Top Traders by Volume';
                    description = 'Traders ranked by total USD volume traded';
                    break;
                case 'trades':
                    topTraders = getTopTraders('trades', 10);
                    title = '🔄 Top Traders by Count';
                    description = 'Traders ranked by number of completed trades';
                    break;
                case 'buys':
                    topTraders = getTopTraders('buys', 10);
                    title = '🛒 Top Buyers';
                    description = 'Users with the most buy transactions';
                    break;
                case 'sells':
                    topTraders = getTopTraders('sells', 10);
                    title = '🏪 Top Sellers';
                    description = 'Users with the most sell transactions';
                    break;
                case 'reputation':
                    topTraders = getTopTraders('reputation', 10);
                    title = '⭐ Most Trusted Traders';
                    description = 'Traders with the highest reputation ratings';
                    break;
                default:
                    topTraders = getTopTraders('volume', 10);
                    title = '💰 Top Traders by Volume';
                    description = 'Traders ranked by total USD volume traded';
            }
            
            let leaderboardText = '';
            if (topTraders.length === 0) {
                leaderboardText = '*No traders found. Start trading to appear on the leaderboard!*';
            } else {
                topTraders.forEach((trader, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    let statValue = '';
                    
                    switch (type.toLowerCase()) {
                        case 'volume':
                            statValue = formatCurrency(trader.trades.totalVolume);
                            break;
                        case 'trades':
                            statValue = `${trader.trades.total} trades`;
                            break;
                        case 'buys':
                            statValue = `${trader.trades.buys} buys`;
                            break;
                        case 'sells':
                            statValue = `${trader.trades.sells} sells`;
                            break;
                        case 'reputation':
                            statValue = `${trader.reputation.rating.toFixed(1)}⭐ (${trader.reputation.totalRatings} ratings)`;
                            break;
                    }
                    
                    leaderboardText += `${medal} **${trader.username}** - ${statValue}\n`;
                });
            }
            
            const leaderboardEmbed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(`${description}\n\n${leaderboardText}`)
                .setColor('#ffd700')
                .setFooter({ text: 'David\'s Coins - Leaderboards • Use !lb [volume/trades/buys/sells/reputation]' })
                .setTimestamp();
            
            await message.channel.send({ embeds: [leaderboardEmbed] });
            botStats.messagesSent++;
            return;
        }
        
        // Profile command
        if (command === 'profile') {
            let targetUser = message.author;
            
            // Check if user mentioned someone
            if (message.mentions.users.size > 0) {
                targetUser = message.mentions.users.first();
            } else if (args[1]) {
                // Try to find user by ID
                try {
                    targetUser = await message.client.users.fetch(args[1]);
                } catch (error) {
                    await message.channel.send('❌ User not found. Use `!profile @user` or `!profile userID`.').then(msg => {
                        setTimeout(() => safeDeleteMessage(msg), 5000);
                    });
                    return;
                }
            }
            
            const userProfile = getUser(targetUser.id);
            if (!userProfile) {
                await message.channel.send(`❌ No trading profile found for ${targetUser.username}. They need to complete a trade first!`).then(msg => {
                    setTimeout(() => safeDeleteMessage(msg), 5000);
                });
                return;
            }
            
            const joinedDate = new Date(userProfile.joinDate).toLocaleDateString();
            const lastActive = new Date(userProfile.lastActive).toLocaleDateString();
            const avgTradeValue = userProfile.trades.total > 0 ? userProfile.trades.totalVolume / userProfile.trades.total : 0;
            
            const profileEmbed = new EmbedBuilder()
                .setTitle(`👤 ${userProfile.username}'s Trading Profile`)
                .setDescription(`**Trader since ${joinedDate}**`)
                .addFields(
                    {
                        name: '📈 Trading Stats',
                        value: `**Total Trades:** ${userProfile.trades.total}\n` +
                               `**Buys:** ${userProfile.trades.buys}\n` +
                               `**Sells:** ${userProfile.trades.sells}\n` +
                               `**Total Volume:** ${formatCurrency(userProfile.trades.totalVolume)}`,
                        inline: true
                    },
                    {
                        name: '⭐ Reputation',
                        value: `**Rating:** ${userProfile.reputation.rating.toFixed(1)}/5.0 ⭐\n` +
                               `**Total Ratings:** ${userProfile.reputation.totalRatings}\n` +
                               `**Trust Level:** ${userProfile.reputation.rating >= 4.5 ? '🟢 Excellent' : 
                                                  userProfile.reputation.rating >= 4.0 ? '🟡 Good' : 
                                                  userProfile.reputation.rating >= 3.0 ? '🟠 Average' : '🔴 Poor'}`,
                        inline: true
                    },
                    {
                        name: '📊 Analytics',
                        value: `**Avg Trade Value:** ${formatCurrency(avgTradeValue)}\n` +
                               `**Last Active:** ${lastActive}\n` +
                               `**Status:** ${userProfile.isActive ? '🟢 Active' : '🔴 Inactive'}`,
                        inline: true
                    }
                )
                .setColor(userProfile.reputation.rating >= 4.5 ? '#00ff00' : 
                         userProfile.reputation.rating >= 4.0 ? '#ffff00' : 
                         userProfile.reputation.rating >= 3.0 ? '#ff8800' : '#ff0000')
                .setThumbnail(targetUser.displayAvatarURL())
                .setFooter({ text: 'David\'s Coins - Trading Profiles • Use !history to see trade history' })
                .setTimestamp();
            
            await message.channel.send({ embeds: [profileEmbed] });
            botStats.messagesSent++;
            return;
        }
        
        // Trading history command
        if (command === 'history') {
            let targetUser = message.author;
            
            // Check if user mentioned someone
            if (message.mentions.users.size > 0) {
                targetUser = message.mentions.users.first();
            } else if (args[1]) {
                try {
                    targetUser = await message.client.users.fetch(args[1]);
                } catch (error) {
                    await message.channel.send('❌ User not found. Use `!history @user` or `!history userID`.').then(msg => {
                        setTimeout(() => safeDeleteMessage(msg), 5000);
                    });
                    return;
                }
            }
            
            const userHistory = getUserHistory(targetUser.id, 15);
            if (userHistory.length === 0) {
                await message.channel.send(`❌ No trading history found for ${targetUser.username}.`).then(msg => {
                    setTimeout(() => safeDeleteMessage(msg), 5000);
                });
                return;
            }
            
            let historyText = '';
            userHistory.forEach((trade, index) => {
                const date = new Date(trade.timestamp).toLocaleDateString();
                const isUserBuyer = trade.buyerId === targetUser.id;
                const emoji = isUserBuyer ? '🛒' : '🏪';
                const action = isUserBuyer ? 'Bought' : 'Sold';
                const amount = trade.type === 'account_purchase' ? 'Account' : formatNumber(trade.amount);
                
                historyText += `${emoji} **${action}** ${amount} for ${formatCurrency(trade.price)} - *${date}*\n`;
            });
            
            const historyEmbed = new EmbedBuilder()
                .setTitle(`📜 ${targetUser.username}'s Trading History`)
                .setDescription(`**Recent transactions (last 15):**\n\n${historyText}`)
                .setColor('#0099ff')
                .setThumbnail(targetUser.displayAvatarURL())
                .setFooter({ text: 'David\'s Coins - Trading History • 🛒 = Buy | 🏪 = Sell' })
                .setTimestamp();
            
            await message.channel.send({ embeds: [historyEmbed] });
            botStats.messagesSent++;
            return;
        }
        
        // Recent trades command
        if (command === 'recent') {
            const recentTrades = getRecentTrades(10);
            if (recentTrades.length === 0) {
                await message.channel.send('❌ No recent trades found.').then(msg => {
                    setTimeout(() => safeDeleteMessage(msg), 5000);
                });
                return;
            }
            
            let tradesText = '';
            recentTrades.forEach((trade) => {
                const date = new Date(trade.timestamp).toLocaleDateString();
                const emoji = trade.type === 'buy' ? '🛒' : trade.type === 'sell' ? '🏪' : '🏦';
                const amount = trade.type === 'account_purchase' ? 'Account' : formatNumber(trade.amount);
                
                tradesText += `${emoji} ${formatCurrency(trade.price)} - ${amount} - *${date}*\n`;
            });
            
            const recentEmbed = new EmbedBuilder()
                .setTitle('🕒 Recent Trades')
                .setDescription(`**Latest completed transactions:**\n\n${tradesText}`)
                .setColor('#9d4edd')
                .setFooter({ text: 'David\'s Coins - Recent Activity • 🛒 = Buy | 🏪 = Sell | 🏦 = Account' })
                .setTimestamp();
            
            await message.channel.send({ embeds: [recentEmbed] });
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
