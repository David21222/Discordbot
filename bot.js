const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { handleSlashCommands } = require('./handlers/slashCommands');
const { handleButtonInteractions } = require('./handlers/buttonHandler');
const { handleModalSubmissions } = require('./handlers/modalHandler');
const { handleMessageCommands } = require('./handlers/messageHandler');
const { handleReactions } = require('./handlers/reactionHandler');
const config = require('./config/config');
const { botStats } = require('./utils/stats');

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

// Register slash commands
async function registerSlashCommands() {
    const { SlashCommandBuilder } = require('discord.js');
    
    const commands = [
        new SlashCommandBuilder()
            .setName('list')
            .setDescription('List a Skyblock account or profile for sale')
    ];

    try {
        console.log('Started refreshing application (/) commands.');
        await client.application.commands.set(commands, config.GUILD_ID);
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
}

// Message handler
client.on('messageCreate', async (message) => {
    await handleMessageCommands(client, message);
});

// Interaction handler
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            await handleSlashCommands(interaction);
        } else if (interaction.isButton()) {
            await handleButtonInteractions(interaction);
        } else if (interaction.isModalSubmit()) {
            await handleModalSubmissions(interaction);
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

// Reaction handler
client.on('messageReactionAdd', async (reaction, user) => {
    await handleReactions(reaction, user);
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

client.on('warn', warning => {
    console.warn('Discord client warning:', warning);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Graceful shutdown for Railway
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

// Login
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});
