const mongoose = require('mongoose');

function connect() {
    const MONGO_HOST = "localhost";
    const MONGO_DB = "botis";

    const URI = `mongodb://${MONGO_HOST}/${MONGO_DB}`;
    mongoose.connect(URI, { useNewUrlParser: true, useUnifiedTopology: true });

    const db = mongoose.connection;

    db.on('error', console.error.bind(console, 'Error de conexión a MongoDB:'));
    db.once('open', () => {
        console.log('Conexión a MongoDB establecida');
    });

    process.on('SIGINT', () => {
        db.close(() => {
            console.log('Conexión a MongoDB cerrada por finalización del proceso');
            process.exit(0);
        });
    });
}

module.exports = connect;