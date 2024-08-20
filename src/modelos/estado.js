import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

export const Estado = sequelize.define('estado', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    categoria: {
        type: DataTypes.STRING,
        allowNull: false
    },
    cambiosPermitidos: {
        type: DataTypes.STRING,
        allowNull: true
    },
}, {
    timestamps: false
});