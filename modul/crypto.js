const crypto = require('crypto');

// Funkcja do generowania klucza z secret
function getKeyFromSecret(secret) {
    if (typeof secret !== 'string') {
        throw new Error('Sekretny klucz musi być typu string.');
    }

    const hash = crypto.createHash('sha256');
    hash.update(secret);
    return hash.digest(); // Zwracamy klucz jako Buffer, aby uzyskać 32 bajty
}

// Funkcja szyfrująca
function encrypt(data, secret) {
    if (!data || typeof data !== 'string') {
        throw new Error('Dane do zaszyfrowania muszą być typu string.');
    }

    if (!secret || typeof secret !== 'string') {
        throw new Error('Sekretny klucz musi być typu string.');
    }

    const key = getKeyFromSecret(secret);
    const iv = crypto.randomBytes(16); // Generowanie losowego wektora inicjalizacyjnego
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Zwracamy iv oraz zaszyfrowany tekst oddzielone dwukropkiem
    return iv.toString('hex') + ':' + encrypted;
}

// Funkcja deszyfrująca
function decrypt(encryptedText, secretKey) {
    if (!secretKey || typeof secretKey !== 'string') {
        throw new Error('Sekretny klucz musi być typu string.');
    }

    const [ivHex, encrypted] = encryptedText.split(':'); // Rozdzielamy iv i zaszyfrowany tekst
    const iv = Buffer.from(ivHex, 'hex');
    const key = getKeyFromSecret(secretKey); // Tworzymy klucz z secretKey

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

module.exports = { encrypt, decrypt };
