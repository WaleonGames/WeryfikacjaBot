require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const { Client, GatewayIntentBits } = require('discord.js');
const crypto = require('crypto');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const app = express();
const port = process.env.PORT;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));  // Dodanie obsługi plików statycznych
app.set('view engine', 'ejs');
app.use(cookieParser());

// Połączenie z Discordem
client.login(process.env.DISCORD_TOKEN);

// Konfiguracja OAuth2
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const GUILD_ID = '1109447947575373866';
const VERIFY_ROLE_ID = '1318671279766900807'; // ID roli, która zostanie przydzielona po weryfikacji

// Przechowywanie tokenów sesji (w prostym obiekcie)
const sessions = {};

// Funkcja do tworzenia klucza o odpowiedniej długości (32 bajty)
function getKeyFromSecret(secretKey) {
    return crypto.createHash('sha256').update(secretKey).digest(); // Zwraca 32-bajtowy klucz
}

// Funkcja do szyfrowania
function encrypt(text, secretKey) {
    const iv = crypto.randomBytes(16); // Wygenerowanie losowego wektora inicjującego (IV)
    const key = getKeyFromSecret(secretKey); // Tworzenie klucza o długości 32 bajtów
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Zwracamy IV oraz zaszyfrowany tekst jako ciąg hex
    return iv.toString('hex') + ':' + encrypted;
}

// Funkcja do deszyfrowania
function decrypt(encryptedText, secretKey) {
    const [ivHex, encrypted] = encryptedText.split(':'); // Rozdzielamy IV i zaszyfrowany tekst
    const iv = Buffer.from(ivHex, 'hex'); // Konwertujemy IV z formatu hex na Buffer
    const key = getKeyFromSecret(secretKey); // Tworzenie klucza o długości 32 bajtów
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Funkcja do zapisywania danych do pliku
function saveStats(online, offline) {
    const today = new Date().toISOString().slice(0, 10);  // Data w formacie YYYY-MM-DD
    let stats = {};

    // Odczyt istniejących statystyk
    if (fs.existsSync('stats.json')) {
        stats = JSON.parse(fs.readFileSync('stats.json', 'utf-8'));
    }

    // Dodanie dzisiejszych statystyk
    stats[today] = { online, offline };

    // Zapis do pliku
    fs.writeFileSync('stats.json', JSON.stringify(stats, null, 2));
}

// Funkcja do pobrania i zapisania liczby online i offline
async function updateDailyStats() {
    const { online, offline } = await getOnlineOfflineCount();
    saveStats(online, offline);
}

// Zapis statystyk codziennie o północy (albo po restarcie serwera)
setInterval(updateDailyStats, 24 * 60 * 60 * 1000);

// Główna strona aplikacji
app.get('/', (req, res) => {
    const sessionToken = req.cookies.sessionToken;

    if (sessionToken) {
        // Logowanie ciasteczka sesji
        console.log('Znaleziono ciasteczko sesji:', sessionToken);

        // Odszyfrowanie tokenu sesji
        const decryptedToken = decrypt(sessionToken, process.env.SECRET_KEY);

        // Sprawdź, czy użytkownik jest zalogowany na podstawie sesji
        const userId = Object.keys(sessions).find(id => sessions[id].sessionToken === decryptedToken);
        
        if (userId) {
            // Jeśli użytkownik jest zalogowany, przekieruj go do jego panelu
            return res.redirect(`/panel/user/${userId}`);
        }
    }

    // Jeśli nie ma sesji, pokaż link do weryfikacji przez Discord
    res.render('index', {
        loginUrl: `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=guilds.join`
    });
});

// Callback po zalogowaniu przez OAuth2
app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.send('Nie udało się uzyskać kodu.');
    }

    try {
        // Uzyskiwanie tokenu dostępowego od Discorda
        const response = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI
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

        // Uzyskiwanie informacji o członkostwie użytkownika na serwerze
        const guildId = '1109447947575373866'; // Zamień na ID swojego serwera
        const memberResponse = await axios.get(`https://discord.com/api/guilds/${guildId}/members/${userData.id}`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_TOKEN}`  // Token bota Discorda
            }
        });

        const memberData = memberResponse.data;

        // Sprawdzanie, czy użytkownik posiada rolę administratora
        const isAdmin = memberData.roles.includes('1109455318699741184'); // ID roli administratora

        // Logowanie, aby sprawdzić dane użytkownika i token sesji
        console.log('Token sesji:', accessToken);

        // Dodajemy dane użytkownika oraz rolę do sesji
        sessions[userData.id] = { sessionToken: accessToken, isAdmin: isAdmin };

        // Szyfrowanie tokenu sesji
        const encryptedToken = encrypt(accessToken, process.env.SECRET_KEY);

        // Ustawienie ciasteczka z tokenem sesji
        res.cookie('sessionToken', encryptedToken, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });

        // Przekierowanie do panelu użytkownika
        if (isAdmin) {
            res.redirect(`/panel/admin/${userData.id}`);
        } else {
            res.redirect(`/panel/user/${userData.id}`);
        }

    } catch (error) {
        console.error(error);
        res.send('Wystąpił błąd podczas weryfikacji.');
    }
});

// Panel użytkownika
app.get('/panel/user/:id', async (req, res) => {
    const userId = req.params.id;
    const sessionToken = req.cookies.sessionToken;

    // Sprawdzenie, czy token sesji istnieje w ciasteczku
    if (!sessionToken) {
        return res.render('notLoggedIn');  // Wyświetlenie strony, jeśli użytkownik nie jest zalogowany
    }

    // Odszyfrowanie tokenu sesji
    const decryptedToken = decrypt(sessionToken, process.env.SECRET_KEY);

    // Sprawdzenie, czy sesja użytkownika istnieje i jest zgodna z tokenem ciasteczka
    const userSession = Object.keys(sessions).find(id => sessions[id].sessionToken === decryptedToken);
    
    if (!userSession || userSession !== userId) {
        return res.render('notLoggedIn');  // Wyświetlenie strony, jeśli użytkownik nie jest zalogowany
    }

    try {
        const accessToken = sessions[userId]?.sessionToken;

        if (!accessToken) {
            return res.render('notLoggedIn');  // Wyświetlenie strony, jeśli użytkownik nie jest zalogowany
        }

        // Pobieranie danych o użytkowniku
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const user = userResponse.data;

        // Pobieranie danych o użytkowniku na serwerze (role, nick, itd.)
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);

        const roles = member.roles.cache.map(role => role.name).join(', ');

        // Pobranie bannera użytkownika (tylko jeśli ma Nitro)
        let bannerUrl = null;
        if (user.banner) {
            const bannerHash = user.banner;
            bannerUrl = `https://cdn.discordapp.com/banners/${userId}/${bannerHash}.png?size=512`;
        }

        // Renderowanie strony z danymi użytkownika
        res.render('panel', {
            username: user.username,
            avatar: `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`,
            id: userId,
            roles: roles || 'Brak ról',
            banner: bannerUrl
        });
    } catch (error) {
        console.error(error);
        res.send('Wystąpił błąd podczas uzyskiwania danych o użytkowniku.');
    }
});

app.get('/panel/logout', (req, res) => {
    // Usuwanie ciasteczka sesji
    res.clearCookie('sessionToken', { path: '/' });

    // Przekierowanie na stronę główną po wylogowaniu
    res.redirect('/');
});

// Panel administratora
app.get('/panel/admin/:id', async (req, res) => {
    const userId = req.params.id;
    const sessionToken = req.cookies.sessionToken;

    // Sprawdzenie, czy token sesji istnieje w ciasteczku
    if (!sessionToken) {
        return res.redirect('/login'); // Jeśli brak tokenu sesji, przekierowanie do logowania
    }

    // Odszyfrowanie tokenu sesji
    const decryptedToken = decrypt(sessionToken, process.env.SECRET_KEY);

    // Sprawdzenie, czy sesja użytkownika istnieje i jest zgodna z tokenem ciasteczka
    const userSession = Object.keys(sessions).find(id => sessions[id].sessionToken === decryptedToken);
    
    if (!userSession || userSession !== userId) {
        return res.redirect('/'); // Jeśli użytkownik nie jest zalogowany, przekierowanie do logowania
    }

    try {
        const accessToken = sessions[userId]?.sessionToken;

        if (!accessToken) {
            return res.redirect('/'); // Jeśli brak dostępu, przekierowanie do logowania
        }

        // Pobieranie danych o użytkowniku
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const user = userResponse.data;

        // Pobranie danych o użytkowniku na serwerze (role, nick, itd.)
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);

        // Sprawdzanie, czy użytkownik jest administratorem
        const isAdmin = member.roles.cache.some(role => role.id === '1109455318699741184'); // ID roli admina

        if (!isAdmin) {
            return res.send('Brak dostępu do panelu administratora');
        }

        const roles = member.roles.cache.map(role => role.name).join(', ');

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
            roles: roles || 'Brak ról',
            banner: bannerUrl
        });
    } catch (error) {
        console.error(error);
        res.send('Wystąpił błąd podczas uzyskiwania danych o użytkowniku.');
    }
});

// Nasłuchiwanie na porcie
app.listen(port, () => {
    console.log(`Aplikacja działa na http://localhost:${port}`);
});
