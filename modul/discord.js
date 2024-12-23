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
        const hiddenRoleIds = ['1109447947575373866', '1180790043376361502', '1312736353339047946', '1312736706344255498', '1298749906533744781', '1180196032693407866', '1181157318105256076', '1181156723281625088']; 

        // Filtrujemy role, aby pominąć te, które mają uprawnienia administracyjne oraz te z ukrytą listą ID
        const addosroles = response.data.filter(role => !(role.permissions & 8) && !hiddenRoleIds.includes(role.id)); // 8 to maska uprawnienia ADMINISTRATOR

        console.log('Dostępne role na serwerze:', addosroles);
        return addosroles;
    } catch (error) {
        console.error('Błąd podczas uzyskiwania ról:', error);
        return [];
    }
}

module.exports = { fetchGuildRoles };
