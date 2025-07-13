const { EmbedBuilder } = require('discord.js');
const config = require('../config/config');

async function handleReactions(reaction, user) {
    if (user.bot) return;
    
    try {
        // Fetch the reaction if it's partial
        if (reaction.partial) {
            await reaction.fetch();
        }
        
        // Check if it's a verification reaction
        if (reaction.emoji.name === '✅') {
            const guild = reaction.message.guild;
            const member = guild.members.cache.get(user.id);
            
            if (!member) return;
            
            // Check if user already has verified role
            if (member.roles.cache.has(config.VERIFIED_ROLE_ID)) {
                // Remove the reaction
                await reaction.users.remove(user.id);
                return;
            }
            
            // Add verified role
            await member.roles.add(config.VERIFIED_ROLE_ID);
            
            // Remove the reaction
            await reaction.users.remove(user.id);
            
            // Send confirmation DM
            try {
                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('✅ Verification Successful!')
                    .setDescription(`Welcome to **${guild.name}**!\n\n` +
                        'You now have access to all channels. Feel free to:\n' +
                        '• Browse our trading information\n' +
                        '• Create tickets to buy/sell coins\n' +
                        '• Check out Skyblock account/profile listings\n' +
                        '• Ask questions in our support channels\n\n' +
                        'Thank you for joining David\'s Coins!')
                    .setColor('#00ff00')
                    .setFooter({ text: 'David\'s Coins - Trusted Trading' });
                
                await user.send({ embeds: [welcomeEmbed] });
            } catch (dmError) {
                console.log('Could not send DM to user:', user.username);
            }
        }
    } catch (error) {
        console.error('Reaction add error:', error);
    }
}

module.exports = { handleReactions };
