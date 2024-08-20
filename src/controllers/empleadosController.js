import { body, validationResult } from "express-validator";
import { Empleado } from "../modelos/empleado.js";
import { Tarea } from "../modelos/tareas.js";
import {EmpleadoDTO} from "../dto/EmpleadoDTO.js"

// export const getEmpleados = async (req, res) => {
//     try {
//       const empleados = await Empleado.findAll();
//       const empleadosDTO = empleados.map(empleado => {
//         return new EmpleadoDTO(empleado.get());
//       });
//       res.json({ empleados: empleadosDTO });
//     } catch (error) {
//       return res.status(500).json({ message: error.message });
//     }
//   };

//   export const getEmpleados = async (req, res) => {
//     try {
//       const empleados = await Empleado.findAll({
//         attributes: {
//           exclude: ["id"],
//         },
//       });
//       res.json(empleados);
//     } catch (error) {
//       return res.status(500).json({ message: error.message });
//     }
//   };

// Empleados con id 

 export const getEmpleados = async (req, res) => {
     try {
         const empleados = await Empleado.findAll();
         //console.log(empleados);
         res.json(empleados);
     } catch (error) {
         return res.status(500).json({ message: error.message });
     }
 };

export const getEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        const empleado = await Empleado.findOne({
            where: { id },
            id
        });
        if (!empleado) return res.status(404).json({ message: 'Empleado no existe' });
        res.json(empleado);
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
};

export const createEmpleado = async (req, res, next) => {
    await body('nombre').isString().trim().escape().run(req);
    await body('fechaIngreso').isISO8601().toDate().run(req);
    await body('salario').isNumeric().toFloat().run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const empleado = await Empleado.create({
            nombre: req.body.nombre,
            fechaIngreso: req.body.fechaIngreso,
            salario: req.body.salario
        });

        res.json(empleado);
    } catch (error) {
        next(error);
    }
};

export const updateEmpleado = async (req, res) => {
    try {

        const { id } = req.params;
        const { nombre, fechaIngreso, salario } = req.body;

        const empleado = await Empleado.findByPk(id);
        empleado.nombre = nombre
        empleado.fechaIngreso = fechaIngreso
        empleado.salario = salario
        await empleado.save();
        res.json(empleado);
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
};

export const deleteEmpleado = async (req, res) => {
    try {
        const { id } = req.params
        const empleado = await Empleado.destroy({
            where: {
                id,
            },
        });
        if (!empleado) return res.status(404).json({ message: 'Empleado no existe' });
        res.sendStatus(204);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getEmpleadoTareas = async (req, res) => {
    try {
        const { id } = req.params;
        const tareas = await Tarea.findAll({
            where: { idEmpleado: id }
        });
        res.json(tareas);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};