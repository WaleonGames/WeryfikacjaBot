const express = require('express');
const axios = require('axios');
const { decrypt } = require('../../modul/crypto'); // Funkcja do odszyfrowania tokenu sesji
const { getSession } = require('../../modul/sessions'); // Funkcje do zarządzania sesjami
const { fetchGuildRoles, fetchUserRoles } = require('../../modul/discord');
const notification = require('../../modul/notification'); // Importujemy nasz moduł powiadomień
const { Client, GatewayIntentBits } = require('discord.js'); // Importujemy Discord.js
const router = express.Router();

// Inicjalizacja klienta Discorda
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,             // Dostęp do serwerów
        GatewayIntentBits.GuildMessages,      // Dostęp do wiadomości
        GatewayIntentBits.MessageContent      // Dostęp do treści wiadomości
    ]
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('Błąd logowania do Discorda:', error);
    process.exit(1); // Zakończenie procesu w przypadku błędu logowania
});

// Inicjalizacja klienta w server.js
client.once('ready', () => {});

// Zmienna do przechowywania daty ostatniej aktualizacji
let lastUpdate = new Date();

// Funkcja do formatowania daty (godzina:minecraft - dzień)
function formatLastUpdate() {
    const hours = lastUpdate.getHours().toString().padStart(2, '0');
    const minutes = lastUpdate.getMinutes().toString().padStart(2, '0');
    const day = lastUpdate.toLocaleString('pl-PL', { weekday: 'long' });
    return `${hours}:${minutes} - ${day}`;
}

router.get('/last-update', (req, res) => {
    res.json({ lastUpdate: formatLastUpdate() });
});

router.get('/:id', (req, res) => {
    const userId = req.params.id;
    const sessionToken = req.cookies.sessionToken;

    // Sprawdzanie, czy użytkownik jest zalogowany
    if (!sessionToken) {
        return res.render('notLoggedIn');
    }

    // Dekodowanie tokena sesji
    const decryptedToken = decrypt(sessionToken, process.env.SECRET_KEY);
    const userSession = getSession(userId);
    if (!userSession || userSession.sessionToken !== decryptedToken) {
        return res.render('notLoggedIn');
    }

    // Inicjalizacja klienta Discord, jeżeli nie jest zainicjowany
    const GUILD_ID = process.env.GUILD_ID;

    // Pobieranie danych użytkownika z Discorda za pomocą tokena
    axios.get('https://discord.com/api/users/@me', {
        headers: {
            Authorization: `Bearer ${decryptedToken}`
        }
    }).then(userDataResponse => {
        const userData = userDataResponse.data;

        // Pobieranie ról użytkownika
        fetchUserRoles(GUILD_ID, userId).then(userRoles => {
            // Upewniamy się, że userRoles to ciąg tekstowy
            const userRolesString = userRoles ? userRoles : 'Brak ról';

            // Pobieranie dostępnych ról z serwera
            fetchGuildRoles(GUILD_ID).then(guildRoles => {
                // Zamiana obiektu ról na tablicę nazw ról
                const roleNames = Object.values(guildRoles).map(role => role.name); // Zakładamy, że role mają nazwę 'name'
                
                // Zapewniamy, że aroles jest zawsze tablicą
                const aroles = userSession ? userSession.roles : [];

                // Przekazujemy dane do widoku
                res.render('panel', {
                    username: userData.username,
                    id: userData.id,
                    avatar: `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`,
                    roles: userRolesString, // Róle przypisane użytkownikowi
                    banner: userData.banner ? `https://cdn.discordapp.com/banners/${userData.id}/${userData.banner}.png` : null,
                    guildId: GUILD_ID,
                    notifications: notification.getNotifications(),
                    aroles: roleNames, // Dostępne role na serwerze jako tablica
                    lastUpdate: formatLastUpdate() // Przekaż ostatnią aktualizację
                });
            }).catch(error => {
                console.error('Błąd podczas pobierania dostępnych ról z serwera:', error);
                res.send('Wystąpił błąd podczas uzyskiwania dostępnych ról z serwera.');
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
