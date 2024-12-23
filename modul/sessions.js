// modul/sessions.js

const sessions = {};

// Funkcja dodająca nową sesję
function addSession(userId, sessionToken) {
    sessions[userId] = { sessionToken };
}

// Funkcja pobierająca sesję na podstawie userId
function getSession(userId) {
    return sessions[userId] || null;
}

// Funkcja usuwająca sesję
function removeSession(userId) {
    delete sessions[userId];
}

module.exports = {
    addSession,
    getSession,
    removeSession
};
