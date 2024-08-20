import app from './app.js'
import { sequelize } from './database/database.js'

async function main() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        await sequelize.sync({ force: false });
        app.listen(4000);
        console.log('Servidor corriendo en puerto 4000');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}

main();