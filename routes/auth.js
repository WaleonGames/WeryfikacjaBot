const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();
const Session = require('../models/Session');

// Funkcja szyfrująca token sesji
const encrypt = (text, secretKey) => {
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    return iv.toString('hex') + ':' + cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
};

// Funkcja deszyfrująca token sesji
const decrypt = (encryptedText, secretKey) => {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
};

// Logowanie przez Discord
router.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Nie udało się uzyskać kodu.');

    try {
        const { data } = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.REDIRECT_URI
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userData = (await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${data.access_token}` } })).data;
        const encryptedToken = encrypt(data.access_token, process.env.SECRET_KEY);

        // Zapisanie sesji do MongoDB
        const newSession = new Session({ userId: userData.id, sessionToken: data.access_token });
        await newSession.save();

        // Zapisanie tokenu w cookies
        res.cookie('sessionToken', encryptedToken, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'Strict' });
        res.redirect(`/panel/user/${userData.id}`);
    } catch (err) {
        console.error(err);
        res.send('Błąd weryfikacji.');
    }
});

// Logowanie (strona główna)
router.get('/', (req, res) => {
    const sessionToken = req.cookies.sessionToken;
    if (sessionToken) {
        try {
            const decryptedToken = decrypt(sessionToken, process.env.SECRET_KEY);
            Session.findOne({ sessionToken: decryptedToken }).then(session => {
                if (session) return res.redirect(`/panel/user/${session.userId}`);
                res.send('Nie znaleziono użytkownika.');
            });
        } catch (err) {
            console.error('Błąd przy wczytywaniu sesji:', err);
            return res.send('Błąd sesji.');
        }
    } else {
        res.render('index', { loginUrl: `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&scope=guilds.join` });
    }
});

// Wylogowanie
router.get('/panel/logout', (req, res) => {
    res.clearCookie('sessionToken');
    res.redirect('/');
});

module.exports = router;
