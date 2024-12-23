const express = require('express');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, Events } = require('discord.js');
const router = express.Router();
const { decrypt } = require('../../modul/crypto'); // Funkcja do odszyfrowania tokenu sesji
const { getSession } = require('../../modul/sessions'); // Funkcje do zarządzania sesjami
const { Client, GatewayIntentBits } = require('discord.js'); // Importujemy Discord.js

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
client.once('ready', () => {
    console.log('Client is ready!');
});

// Funkcja do weryfikacji danych wejściowych
function validateInput(title, content, guildId, channelId) {
    if (!title || !content || !guildId || !channelId) {
        return { status: 400, message: 'Brak wymaganych danych.' };
    }

    if (isNaN(channelId)) {
        return { status: 400, message: 'ID kanału musi być liczbą.' };
    }

    return null;
}

// Endpoint do wysyłania embedów z przyciskiem
router.post('/very-embed/:guildId/:channelId', async (req, res) => {
    const { title, content } = req.body;
    const { guildId, channelId } = req.params;

    // Walidacja danych wejściowych
    const validationError = validateInput(title, content, guildId, channelId);
    if (validationError) {
        return res.status(validationError.status).send(validationError.message);
    }

    try {
        // Pobranie serwera (guild) i kanału (channel)
        const guild = await client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(channelId);

        // Sprawdzenie uprawnień bota do wysyłania wiadomości
        if (!channel.permissionsFor(client.user).has('SEND_MESSAGES')) {
            return res.status(403).send('Bot nie ma uprawnień do wysyłania wiadomości w tym kanale.');
        }

        // Tworzenie embedu
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(content)
            .setColor('#0099ff')  // Kolor embedu
            .setTimestamp();      // Dodanie znacznika czasowego

        // Tworzenie przycisku linku
        const button = new ButtonBuilder()
            .setLabel('Wejdź teraz na Weryfikację (BETA)')
            .setStyle(ButtonStyle.Link)
            .setURL('https://very.htgmc.pl'); // Link do strony weryfikacji

        // Tworzenie wiersza z przyciskiem
        const actionRow = new ActionRowBuilder().addComponents(button);

        // Wysłanie embedu z przyciskiem do kanału
        await channel.send({
            embeds: [embed],
            components: [actionRow]
        });

        // Odpowiedź API o sukcesie
        res.json({
            message: 'Embed został pomyślnie utworzony i wysłany.',
            embed: {
                title: embed.title,
                description: embed.description
            }
        });
    } catch (error) {
        console.error('Błąd podczas wysyłania embedu:', error);
        res.status(500).send('Wystąpił błąd przy wysyłaniu embedu.');
    }
});

// Stałe ID roli i kanału (do wbudowania w kodzie)
const ROLE_ID = '1180196032693407866';  // Zastąp 'YOUR_ROLE_ID' ID roli, którą chcesz nadać
const FINALY_ROLE_ID = '1298749906533744781';
const CHANNEL_ID = '1193211170069418014';  // Zastąp 'YOUR_CHANNEL_ID' ID kanału, na którym wyślesz embed

// Endpoint do weryfikacji użytkownika
router.post('/verify/:guildID/:userID', async (req, res) => {
    const guildId = req.params.guildID;
    const userId = req.params.userID;
    const sessionToken = req.cookies.sessionToken;

    // Sprawdzanie, czy token sesji istnieje w ciasteczku
    if (!sessionToken) {
        return res.redirect(`/panel/user/${userId}?very=false`);  // Przekierowanie na stronę z nieudaną weryfikacją
    }

    // Odszyfrowanie tokenu sesji
    const decryptedToken = decrypt(sessionToken, process.env.SECRET_KEY);

    // Weryfikacja sesji użytkownika na podstawie userId
    const userSession = getSession(userId);  // Pobieramy sesję z pliku sessions.js
    if (!userSession || userSession.sessionToken !== decryptedToken) {
        return res.redirect(`/panel/user/${userId}?very=false`);  // Jeśli sesja nie istnieje lub token się nie zgadza
    }

    const { name, year, youfound, mikrofon } = req.body;

    // Walidacja danych wejściowych
    if (!name || !year || !youfound || !mikrofon) {
        return res.redirect(`/panel/user/${userId}?very=false`);  // Przekierowanie przy błędnej walidacji
    }

    if (isNaN(year) || year < 10 || year > 100) {
        return res.redirect(`/panel/user/${userId}?very=false`);  // Przekierowanie przy błędnym wieku
    }

    if (!['TAK', 'NIE'].includes(mikrofon.toUpperCase())) {
        return res.redirect(`/panel/user/${userId}?very=false`);  // Przekierowanie przy błędnej wartości mikrofonu
    }

    try {
        // Pobieramy serwer (guild) z Discorda
        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
            return res.redirect(`/panel/user/${userId}?very=false`);  // Przekierowanie, gdy nie znaleziono serwera
        }

        // Pobieramy członka serwera (user) z Discorda
        const member = await guild.members.fetch(userId);
        if (!member) {
            return res.redirect(`/panel/user/${userId}?very=false`);  // Przekierowanie, gdy nie znaleziono użytkownika
        }

        // Pobieramy kanał, na który wyślemy wiadomość
        const channel = await guild.channels.fetch(CHANNEL_ID);
        if (!channel || !channel.isTextBased()) {
            return res.redirect(`/panel/user/${userId}?very=false`);  // Przekierowanie, gdy nie znaleziono kanału
        }

        // Tworzymy embed z informacjami o użytkowniku
        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('Nowa weryfikacja użytkownika')
            .addFields(
                { name: 'Imię:', value: name },
                { name: 'Wiek:', value: year },
                { name: 'Jak znalazł nasz?', value: youfound },
                { name: 'Czy ma mikrofon?', value: mikrofon }
            )
            .setTimestamp()
            .setFooter({ text: `ID użytkownika: ${userId}` });
        
        // Tworzymy przyciski
        const acceptbutton = new ButtonBuilder()
            .setCustomId('accept')
            .setLabel('Zatwierdź')
            .setStyle(ButtonStyle.Success);

        const denybutton = new ButtonBuilder()
            .setCustomId('deny')
            .setLabel('Odrzuć')
            .setStyle(ButtonStyle.Danger);

        // Tworzymy wiersz akcji, który będzie zawierał przyciski
        const actionRow = new ActionRowBuilder()
            .addComponents(acceptbutton, denybutton);
        
        // Wysyłamy wiadomość embed do kanału
        await channel.send({ embeds: [embed], components: [actionRow] });
        console.log(`Wysłano wiadomość do kanału: ${channel.id}`);

        // Nadawanie roli weryfikacyjnej
        const role = guild.roles.cache.get(ROLE_ID);
        if (role) {
            if (!member.roles.cache.has(ROLE_ID)) {
                await member.roles.add(role);
                console.log(`Dodano rolę weryfikacyjną dla ${member.user.tag}`);
            } else {
                console.log(`Użytkownik ${member.user.tag} już ma rolę weryfikacyjną.`);
            }
        } else {
            return res.redirect(`/panel/user/${userId}?very=false`);  // Przekierowanie, gdy nie znaleziono roli
        }

        // Przekierowanie po udanej weryfikacji
        res.redirect(`/panel/user/${userId}?very=true`);
    } catch (err) {
        console.error('Wystąpił problem:', err);
        res.redirect(`/panel/user/${userId}?very=false`);  // Przekierowanie przy błędzie serwera
    }
});

// Nasłuchiwanie na interakcje (przyciski)
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return; // Sprawdzamy, czy interakcja jest przyciskiem

    const member = interaction.member;

    if (interaction.customId === 'accept') {
        // Akcja zatwierdzenia
        try {
            const delrole = interaction.guild.roles.cache.get(ROLE_ID); // Pobieramy rolę do usunięcia
            const addrole = interaction.guild.roles.cache.get(FINALY_ROLE_ID); // Pobieramy rolę do dodania

            if (delrole && addrole) {  // Sprawdzamy, czy obie role istnieją
                await member.roles.remove(delrole); // Usuwamy starą rolę użytkownikowi
                await member.roles.add(addrole); // Dodajemy nową rolę użytkownikowi
                await interaction.reply({ content: `Zatwierdzono weryfikację użytkownika: ${member.user.tag}`, ephemeral: true });
                console.log(`Dodano nową rolę dla ${member.user.tag} i usunięto starą.`);
            } else {
                await interaction.reply({ content: 'Nie znaleziono jednej z ról.', ephemeral: true });
                console.error('Nie znaleziono jednej z ról: delrole lub addrole.');
            }
        } catch (err) {
            console.error('Błąd podczas nadawania/usuwania roli:', err);
            await interaction.reply({ content: 'Wystąpił błąd podczas nadawania/usuwania roli.', ephemeral: true });
        }
    } else if (interaction.customId === 'deny') {
        // Akcja odrzucenia
        try {
            await interaction.reply({ content: `Odrzucono weryfikację użytkownika: ${member.user.tag}`, ephemeral: true });
            console.log(`Odrzucono weryfikację dla ${member.user.tag}`);
        } catch (err) {
            console.error('Błąd podczas odrzucania weryfikacji:', err);
            await interaction.reply({ content: 'Wystąpił błąd podczas odrzucania weryfikacji.', ephemeral: true });
        }
    }
});

module.exports = router;
