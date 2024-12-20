// Obsługa żądania POST na endpoint /very-embed/:guildId/:channelId
app.post('/api/v1/very-embed/:guildId/:channelId', (req, res) => {
    const { title, content, channelId } = req.body;
    const guildId = req.params.guildId;  // Pobieranie guildId z parametrów URL
    const channelIdFromUrl = req.params.channelId;  // Pobieranie channelId z URL

    // Sprawdzanie, czy wszystkie dane są poprawne
    if (!title || !content || !channelId) {
        return res.status(400).send('Brak wymaganych danych.');
    }

    // Tworzenie embed (przykład)
    const embed = {
        title: title,
        description: content,
        channelId: channelIdFromUrl,
        guildId: guildId,
        url: `https://discord.com/channels/${guildId}/${channelIdFromUrl}` // Link do kanału
    };

    // Wyślij odpowiedź z embedem
    res.json({
        message: 'Embed został pomyślnie utworzony.',
        embed: embed
    });
});
