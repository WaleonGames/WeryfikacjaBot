// /modul/discord.js
const axios = require('axios');

// Funkcja pobierająca role z serwera Discord
async function fetchGuildRoles(guildId) {
    try {
        const response = await axios.get(`https://discord.com/api/v10/guilds/1109447947575373866/roles`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_TOKEN}` // Token bota
            }
        });

        // Lista ukrytych ID ról
        const hiddenRoleIds = ['1320785648713601055', '1320786025513091163', '1320785952515424337', '1109447947575373866', '1180790043376361502', '1312736353339047946', '1312736706344255498', '1298749906533744781', '1180196032693407866', '1181157318105256076', '1181156723281625088']; 

        // Filtrujemy role, aby pominąć te, które mają uprawnienia administracyjne oraz te z ukrytą listą ID
        const addosroles = response.data.filter(role => !(role.permissions & 8) && !hiddenRoleIds.includes(role.id)); // 8 to maska uprawnienia ADMINISTRATOR
        return addosroles;
    } catch (error) {
        console.error('Błąd podczas uzyskiwania ról:', error);
        return [];
    }
}

async function fetchUserRoles(guildId, userId) {
    try {
        const response = await fetch(`http://localhost:4000/api/${guildId}/roles/${userId}`);
        const data = await response.json();
        console.log('Roles:', data.role);
        console.log('Release info:', data.release);

        // Zmapowanie danych ról na tablicę nazw
        if (data.role && typeof data.role === 'object') {
            const rolesArray = Object.values(data.role);  // Zakładam, że data.role to obiekt ról
            return rolesArray.join(', ');  // Łączenie ról w string
        }

        return 'Brak ról';  // Zwrócenie wartości domyślnej w przypadku braku ról
    } catch (error) {
        console.error('Błąd przy pobieraniu danych o rolach:', error);
        return 'Błąd podczas pobierania ról';  // Zwrócenie komunikatu o błędzie
    }
}

// Pobieranie danych o kanałach z API serwera
async function fetchChannelsId(guildId, channelId) {
    console.log(`Pobieranie danych o kanale dla serwera: ${guildId}, kanał: ${channelId}`);
    
    try {
        // Wysyłanie żądania do API, aby pobrać dane o kanałach
        const response = await fetch(`http://localhost:4000/api/${guildId}/channel/tekst/${channelId}`);
        
        if (!response.ok) {
            console.error(`Błąd odpowiedzi z API dla kanału ${channelId}`);
            throw new Error('Błąd podczas pobierania danych z API');
        }

        const data = await response.json();
        
        console.log('Dane kanału:', data);

        // Jeśli dane zawierają listę kanałów tekstowych
        if (data && data.textChannels && Array.isArray(data.textChannels)) {
            // Mapowanie kanałów na tablicę nazw
            const channelsArray = data.textChannels.map(channel => channel.name);
            console.log('Kanały tekstowe:', channelsArray);

            return channelsArray.join(', ');  // Łączenie kanałów w string
        }

        return 'Brak dostępnych kanałów';  // Zwrócenie komunikatu, jeśli nie znaleziono kanałów
    } catch (error) {
        console.error('Błąd przy pobieraniu danych o kanałach:', error);
        return 'Błąd podczas pobierania kanałów';  // Zwrócenie komunikatu o błędzie
    }
}

// Pobieranie wszystkich kanałów dla serwera
async function fetchChannelAll(guildId) {
    try {
        // Wysyłanie żądania do API, aby pobrać dane o kanałach
        const response = await fetch(`http://localhost:4000/api/${guildId}/channel/tekst/`);
        
        if (!response.ok) {
            throw new Error('Błąd podczas pobierania danych z API');
        }

        const data = await response.json();
        
        console.log('Dane kanałów:', data);

        // Jeśli dane zawierają listę kanałów tekstowych
        if (data && data.textChannels && Array.isArray(data.textChannels)) {
            // Mapowanie kanałów na tablicę nazw
            const channelsArray = data.textChannels.map(channel => channel.name);
            console.log('Kanały tekstowe:', channelsArray);

            return channelsArray.join(', ');  // Łączenie kanałów w string
        }

        return 'Brak dostępnych kanałów';  // Zwrócenie komunikatu, jeśli nie znaleziono kanałów
    } catch (error) {
        console.error('Błąd przy pobieraniu danych o kanałach:', error);
        return 'Błąd podczas pobierania kanałów';  // Zwrócenie komunikatu o błędzie
    }
}

module.exports = { fetchGuildRoles, fetchUserRoles, fetchChannelsId, fetchChannelAll };
