const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios'); // Import axios do wysyłania żądań HTTP
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, Events } = require('discord.js');
const router = express.Router();
const { decrypt } = require('../../modul/crypto'); // Funkcja do odszyfrowania tokenu sesji
const { getSession } = require('../../modul/sessions'); // Funkcje do zarządzania sesjami
const notification = require('../../modul/notification'); // Importujemy nasz moduł powiadomień
const { fetchUserRoles } = require('../../modul/discord'); // Funkcja do pobierania roli użytkownika
const { Client, GatewayIntentBits } = require('discord.js'); // Importujemy Discord.js

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

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

// Twój URL webhooka z Discorda
const discordWebhookURL = 'https://discord.com/api/webhooks/1323380594540937277/mGp2VPFkbSi83fvmeYUpCwSa094Gw02bh4gnEdjUlCeM9TpF6PU7kkmcPF53yuyHLu4F';

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
        notification.add('error', 'Brak sesji!'); // Dodajemy powiadomienie o błędzie
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
            .setCustomId(`accept-${userId}`)  // Dodajemy ID użytkownika do CustomId
            .setLabel('Zatwierdź')
            .setStyle(ButtonStyle.Success);

        const denybutton = new ButtonBuilder()
            .setCustomId(`deny-${userId}`)  // Dodajemy ID użytkownika do CustomId
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
                notification.add('succes', `Rola ${role.name} została przypisana do użytkownika.`);
            } else {
                notification.add('warning', `Rola ${roleId} nie została znaleziona.`);
            }
        } else {
            return res.redirect(`/panel/user/${userId}?very=false`);  // Przekierowanie, gdy nie znaleziono roli
        }

        // Przekierowanie po udanej weryfikacji
        notification.add('succes', 'Zostało wiadomość wysyła do administracji i prosimy czekać')
        res.redirect(`/panel/user/${userId}?very=true`);
    } catch (err) {
        notification.add('error', 'Wystąpił błąd podczas przypisywania ról.');
        res.redirect(`/panel/user/${userId}?very=false`);  // Przekierowanie przy błędzie serwera
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;  // Sprawdzamy, czy interakcja pochodzi od przycisku

    const [action, userId] = interaction.customId.split('-');  // Rozdzielamy customId na akcję i ID użytkownika

    const member = await interaction.guild.members.fetch(userId);  // Pobieramy członka serwera na podstawie userId

    if (action === 'accept') {
        // Akcja zatwierdzenia
        try {
            const delrole = interaction.guild.roles.cache.get(ROLE_ID);  // Pobieramy rolę do usunięcia
            const addrole = interaction.guild.roles.cache.get(FINALY_ROLE_ID);  // Pobieramy rolę do dodania
    
            if (delrole && addrole) {  // Sprawdzamy, czy obie role istnieją
                await member.roles.remove(delrole);  // Usuwamy starą rolę użytkownikowi
                await member.roles.add(addrole);  // Dodajemy nową rolę użytkownikowi
                await interaction.reply({ content: `Zatwierdzono weryfikację użytkownika: ${member.user.tag}`, ephemeral: true });
                console.log(`Dodano nową rolę dla ${member.user.tag} i usunięto starą.`);
    
                // Tworzenie wiadomości embed dla użytkownika
                const verificationEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Weryfikacja zakończona pomyślnie!')
                    .setDescription('Twoja weryfikacja została zatwierdzona. Kliknij poniżej, aby odebrać swoją rolę.')
                    .addFields(
                        { name: 'Strona:', value: `[Kliknij tutaj, aby odebrać rolę](http://localhost:3000/panel/user/${member.user.id})` }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Gratulacje!' });
    
                // Wysyłamy wiadomość embed do użytkownika
                await member.send({ embeds: [verificationEmbed] });
                console.log(`Wysłano wiadomość embed do użytkownika: ${member.user.tag}`);
    
            } else {
                await interaction.reply({ content: 'Nie znaleziono jednej z ról.', ephemeral: true });
                console.error('Nie znaleziono jednej z ról: delrole lub addrole.');
            }
        } catch (err) {
            console.error('Błąd podczas nadawania/usuwania roli:', err);
            await interaction.reply({ content: 'Wystąpił błąd podczas nadawania/usuwania roli.', ephemeral: true });
        }
    } else if (action === 'deny') {
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

// Endpoint do synchronizacji ról
router.post('/role/add/:guildID/:userID', async (req, res) => {
    const guildId = req.params.guildID;
    const userId = req.params.userID;
    const rolesFromWebsite = req.body.roles; // Role z bazy danych strony (tablica pełnych ID lub nazw)
    const sessionToken = req.cookies.sessionToken;
    const roleToCheckId = '1298749906533744781'; // ID roli, którą chcemy sprawdzić
    const roleToCheckName = 'Nowy gracz'; // Nazwa roli, którą chcemy sprawdzić jako alternatywę

    if (!sessionToken) {
        notification.add('error', 'Brak sesji!');
        return res.redirect(`/panel/user/${userId}?very=false`);
    }

    try {
        const decryptedToken = decrypt(sessionToken, process.env.SECRET_KEY);
        const userSession = getSession(userId);

        if (!userSession || userSession.sessionToken !== decryptedToken) {
            notification.add('error', 'Sesja użytkownika nie jest ważna lub wygasła.');
            return res.render('notLoggedIn');
        }

        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
            notification.add('error', 'Serwer nie znaleziony.');
            return res.redirect(`/panel/user/${userId}`);
        }

        let userRoles = await fetchUserRoles(guildId, userId);

        if (typeof userRoles === 'string') {
            userRoles = userRoles.split(',').map(role => role.trim());
        }

        if (!Array.isArray(userRoles)) {
            console.error('Błąd: userRoles nie jest tablicą:', userRoles);
            return res.redirect(`/panel/user/${userId}?error=Błąd podczas sprawdzania ról użytkownika.`);
        }

        // Sprawdzamy, czy użytkownik posiada rolę po ID
        let hasRole = userRoles.includes(roleToCheckId);

        // Jeśli użytkownik nie ma roli po ID, sprawdzamy po nazwie
        if (!hasRole) {
            const roleByName = userRoles.find(role => role === roleToCheckName);
            if (roleByName) {
                hasRole = true;
            }
        }

        if (hasRole) {
            notification.add('success', `Użytkownik ${userId} posiada rolę o ID ${roleToCheckId} lub nazwie ${roleToCheckName}.`);
            console.log(`Użytkownik ${userId} posiada rolę o ID ${roleToCheckId} lub nazwie ${roleToCheckName}.`);
        } else {
            notification.add('error', `Użytkownik ${userId} nie posiada wymaganej roli.`);
            return res.redirect(`/panel/user/${userId}?error=Użytkownik nie posiada wymaganej roli.`);
        }

        const member = await guild.members.fetch(userId);
        if (!member) {
            notification.add('error', 'Użytkownik nie znaleziony.');
            return res.redirect(`/panel/user/${userId}`);
        }

        // Sprawdzamy, które role dodać
        const currentRolesOnDiscord = member.roles.cache.map(role => role.id);

        // Rozdziel role do dodania na podstawie ID i nazwy
        const rolesToAdd = rolesFromWebsite.filter(role => {
            const isId = /^\d+$/.test(role); // Sprawdzamy, czy jest to ID (liczba)
            if (isId) {
                // Jeśli to ID, sprawdzamy, czy użytkownik już jej nie posiada
                return !currentRolesOnDiscord.includes(role);
            } else {
                // Jeśli to nazwa, znajdź rolę po nazwie i sprawdź, czy użytkownik już jej nie posiada
                const roleByName = guild.roles.cache.find(r => r.name === role);
                return roleByName && !currentRolesOnDiscord.includes(roleByName.id);
            }
        });

        const botMember = await guild.members.fetch(client.user.id);
        for (const role of rolesToAdd) {
            const isId = /^\d+$/.test(role); // Sprawdzamy, czy to ID
            let discordRole;

            if (isId) {
                discordRole = guild.roles.cache.get(role); // Pobieramy rolę po ID
            } else {
                discordRole = guild.roles.cache.find(r => r.name === role); // Pobieramy rolę po nazwie
            }

            if (discordRole) {
                if (botMember.roles.highest.position > discordRole.position) {
                    await member.roles.add(discordRole);
                    notification.add('success', `Rola ${discordRole.name} została przypisana do ${member.user.tag}`);
                    console.log(`Rola ${discordRole.name} została przypisana do ${member.user.tag}`);
                } else {
                    notification.add('error', `Bot nie może przypisać roli ${discordRole.name}, ponieważ jest wyżej w hierarchii.`);
                    console.error(`Bot nie może przypisać roli ${discordRole.name}, ponieważ jest wyżej w hierarchii.`);
                }
            } else {
                notification.add('warning', `Rola o ID lub nazwie ${role} nie została znaleziona.`);
                console.log(`Rola o ID lub nazwie ${role} nie została znaleziona`);
            }
        }

        notification.add('success', 'Role zostały poprawnie zsynchronizowane.');
        return res.redirect(`/panel/user/${userId}?success=Role zostały poprawnie zsynchronizowane.`);

    } catch (error) {
        notification.add('error', 'Wystąpił błąd podczas synchronizacji ról.');
        console.error('Wystąpił błąd podczas synchronizacji ról:', error);
        return res.redirect(`/panel/user/${userId}?error=Wystąpił błąd podczas synchronizacji ról.`);
    }
});

router.post('/send/feedback', async (req, res) => {
    const { title, content, id, username } = req.body;

    // Walidacja danych
    if (!title || !content || !id || !username) {
        return res.status(400).json({ message: 'Proszę podać zarówno tytuł, jak i treść, oraz ID użytkownika.' });
    }

    // Logowanie na serwerze
    console.log('Otrzymano feedback:', { title, content, id, username });

    // Przygotowanie danych do wysłania na Discorda
    const discordMessage = {
        content: `**Nowy Wiadomość (Feedback)!**\n**Tytuł:** ${title}\n**Treść:** ${content}\n**Autor Wiadomości:** ${id}/${username}`
    };

    try {
        // Wysłanie wiadomości do Discorda za pomocą webhooka
        await axios.post(discordWebhookURL, discordMessage);

        // Odpowiedź dla użytkownika
        res.redirect(`/panel/user/${id}/thanks-you`);
    } catch (error) {
        console.error('Błąd przy wysyłaniu do Discorda:', error);
        res.status(500).json({ message: 'Wystąpił błąd przy wysyłaniu wiadomości.' });
    }
});

module.exports = router;
