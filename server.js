require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');

// Importujemy nasze trasy
const adminRoutes = require('./routes/panel/admin');
const userRoutes = require('./routes/panel/user');
const apiRoutes = require('./routes/api/v1');
const authRoutes = require('./routes/auth');

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

// Nasłuchiwanie na porcie
app.listen(port, () => {
    console.log(`Aplikacja działa na http://localhost:${port}`);
});

// Podpinamy trasy
app.use('/panel/admin', adminRoutes); // Obsługuje trasy administracyjne
app.use('/panel/user', userRoutes);   // Obsługuje trasy użytkowników
app.use('/api/v1', apiRoutes);        // Obsługuje trasy API
app.use('/', authRoutes);             // Obsługuje trasy autoryzacji
