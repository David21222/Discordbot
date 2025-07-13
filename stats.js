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

module.exports = {
    botStats,
    ticketMessages,
    activeTickets,
    activeListings
};
