const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI); // Usunięcie przestarzałych opcji
        console.log('Połączenie z MongoDB udane!');
    } catch (error) {
        console.error('Błąd połączenia z MongoDB:', error);
        process.exit(1); // Zakończenie procesu w przypadku błędu
    }
};

module.exports = connectDB;
