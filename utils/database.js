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
    console.log(`👤 Creating user profile for: ${username} (${userId})`);
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
    console.log(`💼 Creating trade: ${tradeId}`);
    
    return {
        tradeId: tradeId,
        type: tradeData.type, // 'buy' or 'sell' or 'account_purchase'
        buyerId: tradeData.buyerId,
        sellerId: tradeData.sellerId,
        buyerUsername: tradeData.buyerUsername,
        sellerUsername: tradeData.sellerUsername,
        amount: tradeData.amount, // Coin amount or account price
        price: tradeData.price, // USD amount
        paymentMethod: tradeData.paymentMethod,
        status: 'completed',
        timestamp: tradeData.timestamp || new Date().toISOString(),
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
    console.log(`🆕 Creating new user: ${username} (${userId})`);
    const profile = createUserProfile(userId, username);
    tradingDatabase.users.set(userId, profile);
    tradingDatabase.serverStats.totalUsers++;
    
    console.log(`📊 Server stats updated: ${tradingDatabase.serverStats.totalUsers} total users`);
    return profile;
}

function getOrCreateUser(userId, username) {
    let user = getUser(userId);
    if (!user) {
        user = createUser(userId, username);
        console.log(`✅ Created new user profile for ${username}`);
    } else {
        // Update username and last active
        user.username = username;
        user.lastActive = new Date().toISOString();
        console.log(`🔄 Updated existing user: ${username}`);
    }
    return user;
}

function addTrade(tradeData) {
    console.log(`💰 Adding trade to database:`, tradeData);
    
    try {
        const trade = createTrade(tradeData);
        
        // Add to trades array
        tradingDatabase.trades.push(trade);
        console.log(`📝 Trade added to trades array. Total trades: ${tradingDatabase.trades.length}`);
        
        // Update user profiles
        const buyer = getOrCreateUser(tradeData.buyerId, tradeData.buyerUsername);
        const seller = getOrCreateUser(tradeData.sellerId, tradeData.sellerUsername);
        
        console.log(`👥 Updating profiles for buyer: ${buyer.username}, seller: ${seller.username}`);
        
        // Update buyer stats
        buyer.trades.total++;
        buyer.trades.buys++;
        buyer.trades.totalVolume += tradeData.price;
        buyer.history.push(trade.tradeId);
        
        console.log(`🛒 Buyer stats updated: ${buyer.trades.total} total, ${buyer.trades.buys} buys, $${buyer.trades.totalVolume} volume`);
        
        // Update seller stats
        seller.trades.total++;
        seller.trades.sells++;
        seller.trades.totalVolume += tradeData.price;
        seller.history.push(trade.tradeId);
        
        console.log(`🏪 Seller stats updated: ${seller.trades.total} total, ${seller.trades.sells} sells, $${seller.trades.totalVolume} volume`);
        
        // Update server stats
        tradingDatabase.serverStats.totalTrades++;
        tradingDatabase.serverStats.totalRevenue += tradeData.price;
        
        console.log(`📊 Server stats updated: ${tradingDatabase.serverStats.totalTrades} trades, $${tradingDatabase.serverStats.totalRevenue} revenue`);
        
        // Update daily/weekly/monthly stats
        updateTimeStats(tradeData.price);
        
        console.log(`✅ Trade recorded successfully: ${trade.tradeId} - $${tradeData.price}`);
        
        // Log current database state for debugging
        console.log(`📈 Current database state:`);
        console.log(`  - Total trades: ${tradingDatabase.trades.length}`);
        console.log(`  - Total users: ${tradingDatabase.users.size}`);
        console.log(`  - Server revenue: $${tradingDatabase.serverStats.totalRevenue}`);
        
        return trade;
        
    } catch (error) {
        console.error(`❌ Error adding trade to database:`, error);
        throw error;
    }
}

function updateTimeStats(revenue) {
    const now = new Date();
    const dateKey = now.toDateString();
    const weekKey = getWeekKey(now);
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    
    console.log(`📅 Updating time stats for ${dateKey}`);
    
    // Daily stats
    if (!tradingDatabase.serverStats.dailyStats.has(dateKey)) {
        tradingDatabase.serverStats.dailyStats.set(dateKey, { trades: 0, revenue: 0 });
    }
    const dailyStats = tradingDatabase.serverStats.dailyStats.get(dateKey);
    dailyStats.trades++;
    dailyStats.revenue += revenue;
    console.log(`📅 Daily stats: ${dailyStats.trades} trades, $${dailyStats.revenue} revenue`);
    
    // Weekly stats
    if (!tradingDatabase.serverStats.weeklyStats.has(weekKey)) {
        tradingDatabase.serverStats.weeklyStats.set(weekKey, { trades: 0, revenue: 0 });
    }
    const weeklyStats = tradingDatabase.serverStats.weeklyStats.get(weekKey);
    weeklyStats.trades++;
    weeklyStats.revenue += revenue;
    console.log(`📅 Weekly stats: ${weeklyStats.trades} trades, $${weeklyStats.revenue} revenue`);
    
    // Monthly stats
    if (!tradingDatabase.serverStats.monthlyStats.has(monthKey)) {
        tradingDatabase.serverStats.monthlyStats.set(monthKey, { trades: 0, revenue: 0 });
    }
    const monthlyStats = tradingDatabase.serverStats.monthlyStats.get(monthKey);
    monthlyStats.trades++;
    monthlyStats.revenue += revenue;
    console.log(`📅 Monthly stats: ${monthlyStats.trades} trades, $${monthlyStats.revenue} revenue`);
}

function getWeekKey(date) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - startOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${weekNumber}`;
}

function addRating(userId, rating) {
    const user = getUser(userId);
    if (!user) {
        console.log(`❌ User not found for rating: ${userId}`);
        return false;
    }
    
    user.reputation.totalRatings++;
    user.reputation.ratingSum += rating;
    user.reputation.rating = user.reputation.ratingSum / user.reputation.totalRatings;
    
    console.log(`⭐ Rating added for ${user.username}: ${rating} (new average: ${user.reputation.rating})`);
    return true;
}

function getTopTraders(type = 'volume', limit = 10) {
    console.log(`🏆 Getting top traders by ${type}, limit: ${limit}`);
    const users = Array.from(tradingDatabase.users.values());
    
    let sortedUsers;
    switch (type) {
        case 'volume':
            sortedUsers = users.sort((a, b) => b.trades.totalVolume - a.trades.totalVolume);
            break;
        case 'trades':
            sortedUsers = users.sort((a, b) => b.trades.total - a.trades.total);
            break;
        case 'buys':
            sortedUsers = users.sort((a, b) => b.trades.buys - a.trades.buys);
            break;
        case 'sells':
            sortedUsers = users.sort((a, b) => b.trades.sells - a.trades.sells);
            break;
        case 'reputation':
            sortedUsers = users.filter(u => u.reputation.totalRatings > 0)
                       .sort((a, b) => b.reputation.rating - a.reputation.rating);
            break;
        default:
            sortedUsers = users;
    }
    
    const result = sortedUsers.slice(0, limit);
    console.log(`🏆 Found ${result.length} top traders`);
    return result;
}

function getUserHistory(userId, limit = 20) {
    console.log(`📜 Getting history for user: ${userId}, limit: ${limit}`);
    const user = getUser(userId);
    if (!user) {
        console.log(`❌ User not found: ${userId}`);
        return [];
    }
    
    const userTrades = tradingDatabase.trades
        .filter(trade => trade.buyerId === userId || trade.sellerId === userId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    
    console.log(`📜 Found ${userTrades.length} trades for ${user.username}`);
    return userTrades;
}

function getRecentTrades(limit = 10) {
    console.log(`🕒 Getting ${limit} recent trades`);
    const recentTrades = tradingDatabase.trades
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    
    console.log(`🕒 Found ${recentTrades.length} recent trades`);
    return recentTrades;
}

function getStatsForPeriod(period = 'daily') {
    console.log(`📊 Getting stats for period: ${period}`);
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
            console.log(`❌ Invalid period: ${period}`);
            return { trades: 0, revenue: 0 };
    }
    
    const result = stats || { trades: 0, revenue: 0 };
    console.log(`📊 ${period} stats: ${result.trades} trades, $${result.revenue} revenue`);
    return result;
}

function getServerStats() {
    console.log(`🌍 Getting server stats`);
    const stats = {
        totalTrades: tradingDatabase.serverStats.totalTrades,
        totalRevenue: tradingDatabase.serverStats.totalRevenue,
        totalUsers: tradingDatabase.users.size
    };
    
    console.log(`🌍 Server stats:`, stats);
    return stats;
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
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Debug function to log database state
function logDatabaseState() {
    console.log(`\n🔍 === DATABASE STATE DEBUG ===`);
    console.log(`📊 Total trades in database: ${tradingDatabase.trades.length}`);
    console.log(`👥 Total users in database: ${tradingDatabase.users.size}`);
    console.log(`💰 Total server revenue: ${tradingDatabase.serverStats.totalRevenue}`);
    console.log(`📈 Server stats:`, tradingDatabase.serverStats);
    
    // Log recent trades
    if (tradingDatabase.trades.length > 0) {
        console.log(`🕒 Recent trades:`);
        tradingDatabase.trades.slice(-5).forEach(trade => {
            console.log(`  - ${trade.tradeId}: ${trade.type} ${trade.price} (${trade.buyerUsername} <- ${trade.sellerUsername})`);
        });
    }
    
    // Log users with trades
    console.log(`👤 Users with trading activity:`);
    Array.from(tradingDatabase.users.values()).forEach(user => {
        if (user.trades.total > 0) {
            console.log(`  - ${user.username}: ${user.trades.total} trades, ${user.trades.totalVolume} volume`);
        }
    });
    
    console.log(`🔍 === END DATABASE DEBUG ===\n`);
}

// Function to add sample data for testing
function addSampleData() {
    console.log(`🧪 Adding sample trading data for testing...`);
    
    const sampleTrades = [
        {
            type: 'buy',
            amount: '1B',
            price: 35.00,
            buyerId: '123456789',
            sellerId: '752590954388783196',
            buyerUsername: 'TestCustomer1',
            sellerUsername: 'David\'s Coins',
            paymentMethod: 'PayPal',
            notes: 'Sample trade 1'
        },
        {
            type: 'sell',
            amount: '500M',
            price: 10.00,
            buyerId: '752590954388783196',
            sellerId: '987654321',
            buyerUsername: 'David\'s Coins',
            sellerUsername: 'TestCustomer2',
            paymentMethod: 'LTC',
            notes: 'Sample trade 2'
        },
        {
            type: 'account_purchase',
            amount: 'Account',
            price: 150.00,
            buyerId: '555666777',
            sellerId: '888999000',
            buyerUsername: 'TestBuyer',
            sellerUsername: 'TestSeller',
            paymentMethod: 'BTC',
            notes: 'Sample account purchase'
        }
    ];
    
    sampleTrades.forEach(tradeData => {
        addTrade(tradeData);
    });
    
    console.log(`✅ Sample data added successfully!`);
    logDatabaseState();
}

// Function to reset database (for testing)
function resetDatabase() {
    console.log(`🔄 Resetting database...`);
    tradingDatabase.users.clear();
    tradingDatabase.trades.length = 0;
    tradingDatabase.serverStats = {
        totalTrades: 0,
        totalRevenue: 0,
        totalUsers: 0,
        dailyStats: new Map(),
        weeklyStats: new Map(),
        monthlyStats: new Map()
    };
    console.log(`✅ Database reset complete`);
}

// Export all functions
module.exports = {
    // Core database functions
    tradingDatabase,
    getUser,
    createUser,
    getOrCreateUser,
    addTrade,
    addRating,
    
    // Query functions
    getTopTraders,
    getUserHistory,
    getRecentTrades,
    getStatsForPeriod,
    getServerStats,
    
    // Utility functions
    formatCurrency,
    formatNumber,
    
    // Debug functions
    logDatabaseState,
    addSampleData,
    resetDatabase,
    
    // For debugging and admin
    getAllUsers: () => Array.from(tradingDatabase.users.values()),
    getAllTrades: () => tradingDatabase.trades,
    getDatabaseStats: () => ({
        totalTrades: tradingDatabase.trades.length,
        totalUsers: tradingDatabase.users.size,
        totalRevenue: tradingDatabase.serverStats.totalRevenue
    })
};
