const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
const Session = require('../models/Session');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.login(process.env.DISCORD_TOKEN);

router.get('/panel/user/:id', async (req, res) => {
    const { id } = req.params;
    const sessionToken = req.cookies.sessionToken;
    if (!sessionToken) return res.render('notLoggedIn');

    try {
        const decryptedToken = decrypt(sessionToken, process.env.SECRET_KEY);
        const session = await Session.findOne({ sessionToken: decryptedToken }).exec();
        if (!session || session.userId !== id) return res.render('notLoggedIn');

        const user = (await axios.get('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${session.sessionToken}` } })).data;
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        const member = await guild.members.fetch(id);
        const roles = member.roles.cache.map(role => role.name).join(', ');

        const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${user.avatar}.png?size=512`;
        const bannerUrl = user.banner ? `https://cdn.discordapp.com/banners/${id}/${user.banner}.png?size=512` : null;

        res.render('panel', { user, roles, avatar: avatarUrl, banner: bannerUrl, username: user.username, id });
    } catch (err) {
        console.error(err);
        res.send('Błąd panelu.');
    }
});

module.exports = router;
