require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { encrypt, decrypt } = require('../modul/crypto');  // Importowanie funkcji z modułu
const { addSession, getSession, removeSession } = require('../modul/sessions'); // Importowanie funkcji sesji
const router = express.Router();

// Callback po zalogowaniu przez OAuth2
router.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        console.error('Brak kodu w zapytaniu.');
        return res.send('Nie udało się uzyskać kodu.');
    }

    try {
        // Uzyskiwanie tokenu dostępowego od Discorda
        const response = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.REDIRECT_URI
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const accessToken = response.data.access_token;

        // Uzyskiwanie danych o użytkowniku
        const userDataResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const userData = userDataResponse.data;

        // Dodawanie sesji na podstawie userId
        addSession(userData.id, accessToken);

        // Szyfrowanie tokenu sesji
        const encryptedToken = encrypt(accessToken, process.env.SECRET_KEY);

        // Ustawienie ciasteczka z tokenem sesji
        res.cookie('sessionToken', encryptedToken, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });

        // Przekierowanie do odpowiedniego panelu
        return res.redirect(`/panel/user/${userData.id}`);

    } catch (error) {
        console.error('Błąd podczas weryfikacji OAuth2:', error);
        res.send('Wystąpił błąd podczas weryfikacji.');
    }
});

router.get('/', (req, res) => {
    const sessionToken = req.cookies.sessionToken;

    if (sessionToken) {
        // Logowanie ciasteczka sesji
        console.log('Znaleziono ciasteczko sesji:', sessionToken);

        // Odszyfrowanie tokenu sesji
        const decryptedToken = decrypt(sessionToken, process.env.SECRET_KEY);

        // Sprawdź, czy użytkownik jest zalogowany na podstawie sesji
        if (decryptedToken) {
            // Uzyskiwanie danych użytkownika na podstawie tokenu sesji
            axios.get('https://discord.com/api/users/@me', {
                headers: {
                    Authorization: `Bearer ${decryptedToken}`
                }
            }).then(userDataResponse => {
                const userData = userDataResponse.data;

                // Jeśli użytkownik jest zalogowany, przekieruj go do jego panelu
                return res.redirect(`/panel/user/${userData.id}`);
            }).catch(error => {
                console.error('Błąd podczas uzyskiwania danych użytkownika:', error);
                return res.send('Wystąpił błąd przy uzyskiwaniu danych użytkownika.');
            });
        } else {
            return res.redirect('/');
        }
    } else {
        // Jeśli nie ma sesji, pokaż link do weryfikacji przez Discord
        res.render('very', {
            loginUrl: `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&scope=guilds.join`
        });
    }
});

// Wylogowanie
router.get('/panel/logout', (req, res) => {
    res.clearCookie('sessionToken');
    res.redirect('/');
});

module.exports = router;
