// notification.js - nasz własny system powiadomień

class Notification {
    constructor() {
        this.notifications = [];
    }

    // Dodajemy powiadomienie do listy
    add(type, message, timeout = 5000) { // Domyślny czas wyświetlania to 5 sekund
        const id = Date.now(); // Unikalny ID dla powiadomienia
        const notification = { id, type, message };

        // Dodajemy powiadomienie do listy
        this.notifications.push(notification);

        // Ustawiamy czas, po którym powiadomienie zniknie
        setTimeout(() => {
            this.remove(id); // Usuwamy powiadomienie po upływie czasu
        }, timeout);
    }

    // Zwracamy powiadomienia
    getNotifications() {
        return this.notifications;
    }

    // Usuwamy powiadomienie na podstawie ID
    remove(id) {
        this.notifications = this.notifications.filter(notification => notification.id !== id);
    }

    // Czyścimy wszystkie powiadomienia
    clear() {
        this.notifications = [];
    }
}

module.exports = new Notification();
