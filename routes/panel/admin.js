const express = require('express');
const axios = require('axios');
const { decrypt } = require('../../modul/crypto'); // Funkcja do odszyfrowania tokenu sesji
const { fetchGuildRoles } = require('../../modul/discord'); // Funkcja do pobrania ról z Discorda
const client = require('../../server'); // Załóżmy, że masz klienta Discord.js w osobnym pliku
const router = express.Router();

// Przechowywanie tokenów sesji (w prostym obiekcie)
const sessions = {};

// Funkcja pomocnicza do sprawdzenia sesji i autoryzacji
async function checkSession(req, res, userId) {
    const sessionToken = req.cookies.sessionToken;

    if (!sessionToken) {
        return res.redirect('/login'); // Jeśli brak tokenu sesji, przekierowanie do logowania
    }

    const decryptedToken = decrypt(sessionToken, process.env.SECRET_KEY);

    // Sprawdzamy, czy sesja użytkownika istnieje i jest zgodna z tokenem ciasteczka
    const userSession = Object.keys(sessions).find(id => sessions[id].sessionToken === decryptedToken);

    if (!userSession || userSession !== userId) {
        return res.redirect('/'); // Jeśli użytkownik nie jest zalogowany, przekierowanie do logowania
    }

    return decryptedToken;
}

// Funkcja do sprawdzenia, czy użytkownik ma rolę administratora
async function isAdmin(userId) {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(userId);
    return member.roles.cache.some(role => role.id === '1109455318699741184'); // ID roli admina
}

// Panel administratora
router.get('/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        // Sprawdzenie sesji użytkownika
        const decryptedToken = await checkSession(req, res, userId);
        if (!decryptedToken) return;

        // Pobieranie danych o użytkowniku
        const accessToken = sessions[userId]?.sessionToken;
        if (!accessToken) {
            return res.redirect('/'); // Jeśli brak dostępu, przekierowanie do logowania
        }

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        const user = userResponse.data;

        // Sprawdzamy, czy użytkownik jest administratorem
        const isUserAdmin = await isAdmin(userId);
        if (!isUserAdmin) {
            return res.send('Brak dostępu do panelu administratora');
        }

        const roles = userResponse.data.roles || 'Brak ról';

        // Pobranie bannera użytkownika (tylko jeśli ma Nitro)
        let bannerUrl = null;
        if (user.banner) {
            const bannerHash = user.banner;
            bannerUrl = `https://cdn.discordapp.com/banners/${userId}/${bannerHash}.png?size=512`;
        }

        // Renderowanie strony administratora z danymi użytkownika
        res.render('admin/index', {
            username: user.username,
            avatar: `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`,
            id: userId,
            roles: roles,
            banner: bannerUrl
        });
    } catch (error) {
        console.error(error);
        res.send('Wystąpił błąd podczas uzyskiwania danych o użytkowniku.');
    }
});

// Panel ustawień administratora
router.get('/:id/settings', async (req, res) => {
    const userId = req.params.id;

    try {
        // Sprawdzenie sesji użytkownika
        const decryptedToken = await checkSession(req, res, userId);
        if (!decryptedToken) return;

        // Pobieranie danych o użytkowniku
        const accessToken = sessions[userId]?.sessionToken;
        if (!accessToken) {
            return res.redirect('/'); // Jeśli brak dostępu, przekierowanie do logowania
        }

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        const user = userResponse.data;

        // Pobranie ról z serwera
        const guildId = process.env.GUILD_ID;
        const roles = await fetchGuildRoles(guildId);

        // Sprawdzamy, czy użytkownik jest administratorem
        const isUserAdmin = await isAdmin(userId);
        if (!isUserAdmin) {
            return res.send('Brak dostępu do panelu administratora');
        }

        // Pobranie bannera użytkownika (tylko jeśli ma Nitro)
        let bannerUrl = null;
        if (user.banner) {
            const bannerHash = user.banner;
            bannerUrl = `https://cdn.discordapp.com/banners/${userId}/${bannerHash}.png?size=512`;
        }

        // Renderowanie strony ustawień administratora
        res.render('admin/settings', {
            username: user.username,
            guildId: guildId, 
            id: userId,
            roles: roles,
            banner: bannerUrl
        });
    } catch (error) {
        console.error(error);
        res.send('Wystąpił błąd podczas uzyskiwania danych o użytkowniku.');
    }
});

module.exports = router;
