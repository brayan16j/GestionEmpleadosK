import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js"; // siempre anotar con .js el archivo
import { Estado } from "./estado.js";

export const Tarea = sequelize.define('tareas', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fechaCreacion: {
        type: DataTypes.DATE,
        allowNull: false,
        get() {
            const date = this.getDataValue('fechaCreacion');
            return date ? new Date(date).toISOString().substring(0, 10) : null;
        }
    },
    fechaInicioTarea: {
        type: DataTypes.DATE,
        allowNull: false,
        get() {
            const date = this.getDataValue('fechaInicioTarea');
            return date ? new Date(date).toISOString().substring(0, 10) : null;
        }
    },
    fechaFinalizacion: {
        type: DataTypes.DATE,
        allowNull: false,
        get() {
            const date = this.getDataValue('fechaFinalizacion');
            return date ? new Date(date).toISOString().substring(0, 10) : null;
        }
    }
}, {
    timestamps: false
})

Estado.hasMany(Tarea, {
    foreignKey: 'idEstado',
    sourceKey: 'id'
});

Tarea.belongsTo(Estado, {
    foreignKey: 'idEstado',
    targetKey: 'id'
});