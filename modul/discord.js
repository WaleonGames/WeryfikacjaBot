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

module.exports = { fetchGuildRoles, fetchUserRoles };
