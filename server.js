require('dotenv').config();
const {Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');

// Importujemy nasze trasy
const adminRoutes = require('./routes/panel/admin');
const userRoutes = require('./routes/panel/user');
const apiRoutes = require('./routes/api/v1');
const authRoutes = require('./routes/auth');
const createVeryRoutes = require('./routes/createvery')
const homeRoutes = require('./routes/home')

// Tworzymy aplikację Express
const app = express();
const port = process.env.PORT || 3000; // Domyślny port 3000, jeśli nie jest zdefiniowany w .env

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public', {
    maxAge: '1m' // Czas przechowywania pliku w cache przeglądarki na 1 minutę
}));

// Ustawienie silnika szablonów EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Dodanie ścieżki do folderu widoków

// Konfiguracja OAuth2 i inne zmienne środowiskowe
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const GUILD_ID = process.env.GUILD_ID; // Id serwera
const VERIFY_ROLE_ID = '1318671279766900807'; // ID roli, która zostanie przydzielona po weryfikacji

// Przechowywanie tokenów sesji (w prostym obiekcie)
const sessions = {};

// Endpoint do usuwania ciasteczek
app.get('/delete-cookie', (req, res) => {
    // Iterujemy przez wszystkie ciasteczka i usuwamy je
    Object.keys(req.cookies).forEach(cookie => {
        res.clearCookie(cookie);
    });
    
    // Przekierowanie użytkownika po usunięciu ciasteczek
    res.redirect('/');  // Możesz przekierować na stronę główną lub inną
});

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

client.on('messageCreate', async (message) => {
    // Sprawdzamy, czy wiadomość zaczyna się od "!setvery"
    if (message.content.startsWith('!setvery')) {
        // Sprawdzamy, czy użytkownik ma uprawnienia do użycia komendy (np. administrator)
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('Nie masz uprawnień do użycia tej komendy.');
        }

        // Dzielimy komendę na poszczególne argumenty
        const args = message.content.split(' ').slice(1); // Pomija "!setvery"
        
        // Sprawdzamy, czy są podane odpowiednie argumenty (np. tytuł i treść embedu)
        if (args.length < 2) {
            return message.reply('Podaj tytuł oraz treść embedu. Użyj: !setvery [tytuł] [treść]');
        }

        const title = args[0]; // Pierwszy argument jako tytuł
        const content = args.slice(1).join(' '); // Reszta argumentów jako treść

        try {
            // Tworzenie embedu
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(content)
                .setColor('#0099ff')
                .setTimestamp();

            // Tworzenie przycisku linku
            const button = new ButtonBuilder()
                .setLabel('Wejdź teraz na Weryfikację (BETA)')
                .setStyle(ButtonStyle.Link)
                .setURL('https://very.htgmc.pl'); // Link do strony weryfikacji

            // Tworzenie wiersza z przyciskiem
            const actionRow = new ActionRowBuilder().addComponents(button);

            // Wysłanie embedu z przyciskiem na kanał, gdzie komenda została użyta
            await message.channel.send({
                embeds: [embed],
                components: [actionRow]
            });

            message.reply('Embed został pomyślnie wysłany.');
        } catch (error) {
            console.error('Błąd podczas wysyłania embedu:', error);
            message.reply('Wystąpił błąd przy wysyłaniu embedu.');
        }
    }
});

// Nasłuchiwanie na porcie
app.listen(port, () => {
    console.log(`Aplikacja działa na http://localhost:${port}`);
});

// Podpinamy trasy
app.use('/panel/admin', adminRoutes);      // obsługuje wszystkie trasy do panelu zarządzającą weryfikacji (te serwery discord administracje)
app.use('/panel/user', userRoutes);       // obsługuje wszystkie trasy do panelu gracza po weryfikacji (te serwery discord graczów (PO weryfikacji))
app.use('/api/v1', apiRoutes);           // obsługuje wszystkie api trasy (te serwery discord API) - TYLKO POST
app.use('/', authRoutes);               // obsługuje wszystkie trasy początkowe przed weryfikacją (te serwery discord początkowe (PRZED weryfikacji))
//app.use('/create-very/', createVeryRoutes);       // obsługuje wszystkie trasy do tworzenia nowych weryfikacji
//app.use('/', homeRoutes);                        // obsługuje wszystkie trasy strony głównej