const express = require('express');
const axios = require('axios');
const { decrypt } = require('../../modul/crypto'); // Funkcja do odszyfrowania tokenu sesji
const { getSession } = require('../../modul/sessions'); // Funkcje do zarządzania sesjami
const { fetchGuildRoles } = require('../../modul/discord');
const router = express.Router();

router.get('/:id', (req, res) => {
    const userId = req.params.id;
    const sessionToken = req.cookies.sessionToken;

    // Sprawdzanie, czy token sesji istnieje w ciasteczku
    if (!sessionToken) {
        return res.render('notLoggedIn');  // Jeśli użytkownik nie jest zalogowany
    }

    // Odszyfrowanie tokenu sesji
    const decryptedToken = decrypt(sessionToken, process.env.SECRET_KEY);

    // Weryfikacja sesji użytkownika na podstawie userId
    const userSession = getSession(userId);  // Pobieramy sesję z pliku sessions.js
    if (!userSession || userSession.sessionToken !== decryptedToken) {
        return res.render('notLoggedIn');  // Jeśli sesja nie istnieje lub token się nie zgadza
    }

    axios.get('https://discord.com/api/users/@me', {
        headers: {
            Authorization: `Bearer ${decryptedToken}`
        }
    }).then(userDataResponse => {
        const userData = userDataResponse.data;
    
        // Pobieranie ról użytkownika
        fetchGuildRoles(userId).then(userRoles => {
            // Przekazanie danych do szablonu
            res.render('panel', {
                username: userData.username,
                id: userData.id,  // Przekazanie ID użytkownika
                avatar: `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`,
                roles: userRoles, // Również przekazanie ról
                banner: `https://cdn.discordapp.com/banners/${userData.id}/${userData.banner}.png`,
                guildId: process.env.GUILD_ID,  // Przekazanie ID serwera (guilda), zapewne zapisane w ENV lub pobierane w inny sposób
                aroles: userRoles // Zakładając, że są dostępne role, które mają być wyświetlane w formularzu
            });
        }).catch(error => {
            console.error('Błąd podczas pobierania ról użytkownika:', error);
            res.send('Wystąpił błąd podczas uzyskiwania danych ról użytkownika.');
        });
    
    }).catch(error => {
        console.error('Błąd podczas uzyskiwania danych użytkownika:', error);
        res.send('Wystąpił błąd podczas uzyskiwania danych użytkownika.');
    });    
});

module.exports = router;
