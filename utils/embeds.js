const { EmbedBuilder } = require('discord.js');
const config = require('../config/config');

function createInfoEmbed() {
    return new EmbedBuilder()
        .setTitle('David\'s Coins')
        .setDescription('**Coins Buy Prices:**\n' +
            `• 0.04/M for 300M-1B (40 per 1B)\n` +
            `• 0.035/M for 1B+ (35 per 1B)\n\n` +
            '**Coins Sell Prices:**\n' +
            `• 0.02/M for 1B+ (20 per 1B)\n\n` +
            '**Payment Methods:**\n' +
            `${config.EMOJIS.LTC}${config.EMOJIS.BTC}${config.EMOJIS.ETH}${config.EMOJIS.USDT}`)
        .setColor('#0099ff');
}

function createCryptoEmbed() {
    return new EmbedBuilder()
        .setTitle('🔗 Cryptocurrency Wallet Addresses')
        .setDescription('**Copy the wallet address for your preferred cryptocurrency:**\n\n' +
            `${config.EMOJIS.BTC} **Bitcoin (BTC)**\n` +
            `\`${config.CRYPTO_WALLETS.BTC}\`\n\n` +
            `${config.EMOJIS.ETH} **Ethereum (ETH)**\n` +
            `\`${config.CRYPTO_WALLETS.ETH}\`\n\n` +
            `${config.EMOJIS.LTC} **Litecoin (LTC)**\n` +
            `\`${config.CRYPTO_WALLETS.LTC}\`\n\n` +
            `${config.EMOJIS.USDT} **Tether (USDT)**\n` +
            `\`${config.CRYPTO_WALLETS.USDT}\``)
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
            `${config.EMOJIS.BTC} **Bitcoin (BTC)**\n` +
            `${config.EMOJIS.ETH} **Ethereum (ETH)**\n` +
            `${config.EMOJIS.LTC} **Litecoin (LTC)**\n` +
            `${config.EMOJIS.USDT} **Tether (USDT)**\n\n` +
            '**💳 Traditional Payments**\n' +
            `${config.EMOJIS.PAYPAL} **PayPal** - Secure online payments\n\n` +
            '**⚡ Why These Methods?**\n' +
            '• **Fast transactions** - Nearly instant transfers\n' +
            '• **Low fees** - Minimal processing costs\n' +
            '• **Secure** - Verified and trusted platforms\n' +
            '• **Global** - Available worldwide 24/7\n\n' +
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

function createListingEmbed(listingData, user) {
    return new EmbedBuilder()
        .setTitle(`${config.EMOJIS.SKYBLOCK} ${listingData.title}`)
        .setDescription(`**${listingData.type.charAt(0).toUpperCase() + listingData.type.slice(1)} for Sale**\n\n` +
            `${listingData.description}\n\n` +
            `**💰 Price:** $${listingData.price} USD\n` +
            `**💳 Payment Methods:** ${listingData.paymentText}\n` +
            `**👤 Seller:** ${user}\n` +
            `**📅 Listed:** ${new Date().toLocaleDateString()}`)
        .setColor('#9d4edd')
        .setFooter({ text: 'David\'s Coins - Skyblock Marketplace' })
        .setTimestamp();
}

function createBuyerNotificationEmbed(listingTitle, buyer, contactInfo, message) {
    return new EmbedBuilder()
        .setTitle('🛒 New Purchase Interest!')
        .setDescription(`Someone is interested in buying your listing!\n\n` +
            `**Listing:** ${listingTitle}\n` +
            `**Potential Buyer:** ${buyer}\n` +
            `**Contact Info:** ${contactInfo}\n` +
            `**Message:** ${message}\n\n` +
            `Please contact the buyer to arrange the transaction.`)
        .setColor('#00ff00')
        .setTimestamp();
}

function createAccountInfoEmbed(listingData) {
    return new EmbedBuilder()
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
        .setFooter({ text: 'Made by noemi | https://noemi.dev' })
        .setThumbnail('https://crafatar.com/avatars/steve?overlay');
}

module.exports = {
    createInfoEmbed,
    createCryptoEmbed,
    createRulesEmbed,
    createTOSEmbed,
    createPaymentsEmbed,
    createHelpEmbed,
    createListingEmbed,
    createBuyerNotificationEmbed,
    createAccountInfoEmbed
};
