const config = require('../config/config');

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
        return millions * config.prices.sell;
    } else {
        if (millions >= 1000) {
            return millions * config.prices.buyOver1B;
        } else {
            return millions * config.prices.buyUnder1B;
        }
    }
}

function calculateCoinsForMoney(money) {
    const dollarAmount = parseFloat(money.replace(/[^0-9.]/g, ''));
    if (isNaN(dollarAmount)) return 0;
    
    // Calculate based on over 1B rate first
    const coinsOver1B = dollarAmount / config.prices.buyOver1B;
    if (coinsOver1B >= 1000) {
        return coinsOver1B * 1000000; // Convert to actual coins
    }
    
    // Use under 1B rate
    const coinsUnder1B = dollarAmount / config.prices.buyUnder1B;
    return coinsUnder1B * 1000000; // Convert to actual coins
}

function hasStaffRole(member) {
    return member.roles.cache.has(config.STAFF_ROLE_ID);
}

module.exports = {
    safeDeleteMessage,
    safeReply,
    formatNumber,
    parseAmount,
    calculatePrice,
    calculateCoinsForMoney,
    hasStaffRole
};
