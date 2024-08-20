import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";
import { Tarea } from "./tareas.js";

export const Empleado = sequelize.define('empleado', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,

    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fechaIngreso: {
        type: DataTypes.DATE,
        allowNull: false,
        get() {
            const date = this.getDataValue('fechaIngreso');
            return date ? new Date(date).toISOString().substring(0, 10) : null;
        }
    },
    salario: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
}, {
    timestamps: true
});

//Relacion con tareas
Empleado.hasMany(Tarea, {
    foreignKey: 'idEmpleado',
    sourceKey: 'id'
});

// La tarea o muchas pertenecen a empleado
Tarea.belongsTo(Empleado, {
    foreignKey: 'idEmpleado',
    targetId: 'id'
});