// Trading Database System - In-memory storage (in production, use a real database)

// Main trading database
const tradingDatabase = {
    users: new Map(), // userId -> userProfile
    trades: [], // Array of all completed trades
    serverStats: {
        totalTrades: 0,
        totalRevenue: 0,
        totalUsers: 0,
        dailyStats: new Map(), // date -> { trades: 0, revenue: 0 }
        weeklyStats: new Map(), // week -> { trades: 0, revenue: 0 }
        monthlyStats: new Map() // month -> { trades: 0, revenue: 0 }
    }
};

// User profile structure
function createUserProfile(userId, username) {
    return {
        userId: userId,
        username: username,
        joinDate: new Date().toISOString(),
        trades: {
            total: 0,
            buys: 0,
            sells: 0,
            totalVolume: 0 // Total $ amount traded
        },
        reputation: {
            rating: 5.0,
            totalRatings: 0,
            ratingSum: 0
        },
        history: [], // Array of trade IDs
        lastActive: new Date().toISOString(),
        isActive: true
    };
}

// Trade structure
function createTrade(tradeData) {
    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
        tradeId: tradeId,
        type: tradeData.type, // 'buy' or 'sell' or 'account_purchase'
        buyerId: tradeData.buyerId,
        sellerId: tradeData.sellerId,
        amount: tradeData.amount, // Coin amount or account price
        price: tradeData.price, // USD amount
        paymentMethod: tradeData.paymentMethod,
        status: 'completed',
        timestamp: new Date().toISOString(),
        date: new Date().toDateString(),
        channelId: tradeData.channelId || null,
        notes: tradeData.notes || ''
    };
}

// Database functions
function getUser(userId) {
    return tradingDatabase.users.get(userId);
}

function createUser(userId, username) {
    const profile = createUserProfile(userId, username);
    tradingDatabase.users.set(userId, profile);
    tradingDatabase.serverStats.totalUsers++;
    return profile;
}

function getOrCreateUser(userId, username) {
    let user = getUser(userId);
    if (!user) {
        user = createUser(userId, username);
    } else {
        // Update username and last active
        user.username = username;
        user.lastActive = new Date().toISOString();
    }
    return user;
}

function addTrade(tradeData) {
    const trade = createTrade(tradeData);
    
    // Add to trades array
    tradingDatabase.trades.push(trade);
    
    // Update user profiles
    const buyer = getOrCreateUser(tradeData.buyerId, tradeData.buyerUsername);
    const seller = getOrCreateUser(tradeData.sellerId, tradeData.sellerUsername);
    
    // Update buyer stats
    buyer.trades.total++;
    buyer.trades.buys++;
    buyer.trades.totalVolume += tradeData.price;
    buyer.history.push(trade.tradeId);
    
    // Update seller stats
    seller.trades.total++;
    seller.trades.sells++;
    seller.trades.totalVolume += tradeData.price;
    seller.history.push(trade.tradeId);
    
    // Update server stats
    tradingDatabase.serverStats.totalTrades++;
    tradingDatabase.serverStats.totalRevenue += tradeData.price;
    
    // Update daily/weekly/monthly stats
    updateTimeStats(tradeData.price);
    
    console.log(`✅ Trade recorded: ${trade.tradeId} - $${tradeData.price}`);
    return trade;
}

function updateTimeStats(revenue) {
    const now = new Date();
    const dateKey = now.toDateString();
    const weekKey = getWeekKey(now);
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    
    // Daily stats
    if (!tradingDatabase.serverStats.dailyStats.has(dateKey)) {
        tradingDatabase.serverStats.dailyStats.set(dateKey, { trades: 0, revenue: 0 });
    }
    const dailyStats = tradingDatabase.serverStats.dailyStats.get(dateKey);
    dailyStats.trades++;
    dailyStats.revenue += revenue;
    
    // Weekly stats
    if (!tradingDatabase.serverStats.weeklyStats.has(weekKey)) {
        tradingDatabase.serverStats.weeklyStats.set(weekKey, { trades: 0, revenue: 0 });
    }
    const weeklyStats = tradingDatabase.serverStats.weeklyStats.get(weekKey);
    weeklyStats.trades++;
    weeklyStats.revenue += revenue;
    
    // Monthly stats
    if (!tradingDatabase.serverStats.monthlyStats.has(monthKey)) {
        tradingDatabase.serverStats.monthlyStats.set(monthKey, { trades: 0, revenue: 0 });
    }
    const monthlyStats = tradingDatabase.serverStats.monthlyStats.get(monthKey);
    monthlyStats.trades++;
    monthlyStats.revenue += revenue;
}

function getWeekKey(date) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - startOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${weekNumber}`;
}

function addRating(userId, rating) {
    const user = getUser(userId);
    if (!user) return false;
    
    user.reputation.totalRatings++;
    user.reputation.ratingSum += rating;
    user.reputation.rating = user.reputation.ratingSum / user.reputation.totalRatings;
    
    return true;
}

function getTopTraders(type = 'volume', limit = 10) {
    const users = Array.from(tradingDatabase.users.values());
    
    switch (type) {
        case 'volume':
            return users.sort((a, b) => b.trades.totalVolume - a.trades.totalVolume).slice(0, limit);
        case 'trades':
            return users.sort((a, b) => b.trades.total - a.trades.total).slice(0, limit);
        case 'buys':
            return users.sort((a, b) => b.trades.buys - a.trades.buys).slice(0, limit);
        case 'sells':
            return users.sort((a, b) => b.trades.sells - a.trades.sells).slice(0, limit);
        case 'reputation':
            return users.filter(u => u.reputation.totalRatings > 0)
                       .sort((a, b) => b.reputation.rating - a.reputation.rating).slice(0, limit);
        default:
            return users.slice(0, limit);
    }
}

function getUserHistory(userId, limit = 20) {
    const user = getUser(userId);
    if (!user) return [];
    
    return tradingDatabase.trades
        .filter(trade => trade.buyerId === userId || trade.sellerId === userId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
}

function getRecentTrades(limit = 10) {
    return tradingDatabase.trades
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
}

function getStatsForPeriod(period = 'daily') {
    const now = new Date();
    let stats;
    
    switch (period) {
        case 'daily':
            stats = tradingDatabase.serverStats.dailyStats.get(now.toDateString());
            break;
        case 'weekly':
            stats = tradingDatabase.serverStats.weeklyStats.get(getWeekKey(now));
            break;
        case 'monthly':
            const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
            stats = tradingDatabase.serverStats.monthlyStats.get(monthKey);
            break;
        default:
            return null;
    }
    
    return stats || { trades: 0, revenue: 0 };
}

// Utility function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Utility function to format large numbers
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Export all functions
module.exports = {
    tradingDatabase,
    getUser,
    createUser,
    getOrCreateUser,
    addTrade,
    addRating,
    getTopTraders,
    getUserHistory,
    getRecentTrades,
    getStatsForPeriod,
    formatCurrency,
    formatNumber,
    
    // For debugging and admin
    getAllUsers: () => Array.from(tradingDatabase.users.values()),
    getAllTrades: () => tradingDatabase.trades,
    getServerStats: () => tradingDatabase.serverStats
};
