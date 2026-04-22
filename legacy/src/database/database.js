import Sequelize from 'sequelize'

export const sequelize = new Sequelize('actividad1k', 'postgres', '12345678', {
    host: 'localhost',
    dialect: 'postgres',
    dialectOptions: {
      dateStrings: true,
      dateformat: 'YYYY-MM-DD'
    }
  });