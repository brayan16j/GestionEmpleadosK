import { Tarea } from "../modelos/tareas.js"
import { Estado } from "../modelos/estado.js";
import { Empleado } from "../modelos/empleado.js"
import { Op } from 'sequelize';
import { sequelize } from "../database/database.js";

export const getTareas = async (req, res) => {
    try {
        const tareas = await Tarea.findAll({
            include: [{
                model: Estado,
                attributes: ['nombre']
            }, {
                model: Empleado,
                attributes: ['nombre'] // Obtener solo el campo "nombre" de la tabla Empleado
            }],
            attributes: ['id', 'nombre', 'fechaCreacion', 'fechaInicioTarea', 'fechaFinalizacion', 'idEmpleado', 'idEstado'],
            order: [['id', 'ASC']]
        });
        // const tareasDTO = tareas.map(tarea => {
        //     return {
        //         id: tarea.id,
        //         nombre: tarea.nombre,
        //         fechaCreacion: tarea.fechaCreacion,
        //         fechaInicioTarea: tarea.fechaInicioTarea,
        //         fechaFinalizacion: tarea.fechaFinalizacion,
        //         estado: tarea.estado.nombre,
        //         nombreEmpleado: tarea.empleado.nombre
        //     }
        // });

        //res.json(tareasDTO);
        res.json(tareas);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const createTareas = async (req, res) => {
    try {
        const { nombre, fechaCreacion, fechaInicioTarea, fechaFinalizacion, idEmpleado } = req.body;
        const estado = await Estado.findOne({ where: { nombre: 'Emitida' } });
        const newTarea = await Tarea.create({
            nombre,
            fechaCreacion,
            fechaInicioTarea,
            fechaFinalizacion,
            idEmpleado,
            idEstado: estado.id,
        });
        res.json(newTarea);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getTarea = async (req, res) => {
    try {
        const { id } = req.params;
        const tarea = await Tarea.findByPk(id);
        if (!tarea) return res.status(404).json({ message: 'Tarea no existe' });
        res.json(tarea);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const updateTarea = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, fechaCreacion, fechaInicioTarea, fechaFinalizacion, idEmpleado } = req.body;

        const tarea = await Tarea.findByPk(id);
        tarea.nombre = nombre
        tarea.fechaCreacion = fechaCreacion
        tarea.fechaInicioTarea = fechaInicioTarea
        tarea.fechaFinalizacion = fechaFinalizacion
        tarea.idEmpleado = idEmpleado
        await tarea.save();
        console.log(tarea);
        res.json(tarea);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const updateTareaEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { idEstado } = req.body;
        console.log(('hola'), idEstado); // verifico que si me llegue el id que estoy enviando por body

        const tarea = await Tarea.findByPk(id); // obtengo la tarea por id 

        if (!tarea) {
            return res.status(404).json({ message: "Tarea no encontrada" });
        }

        const estadoNuevo = await Estado.findByPk(idEstado);
        console.log(('propiedad nueva ->'), estadoNuevo.id); // Verifico la propiedad deseada con .estado veo el campo
        console.log(('holassss'), estadoNuevo); // verifico el objeto completo

        if (!estadoNuevo || !estadoNuevo.nombre) {
            return res.status(400).json({ message: "Estado invalido" });
        }
        console.log(('hola antes idestado tarea  de funcion'), tarea.idEstado); // verifico que mi idEstado de tarea venga como lo quiero antes de pasar a validarCambioEstado
        const esCambioEstadoValido = validarCambioEstado(tarea.idEstado, estadoNuevo.id);

        if (!esCambioEstadoValido) {
            return res.status(400).json({ message: "El cambio de estado no es valido" });
        }

        tarea.idEstado = estadoNuevo.id;
        tarea.estado = estadoNuevo.nombre;
        await tarea.save();

        res.json(tarea);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const estados = {
    1: 'Emitida',
    2: 'Iniciada',
    3: 'Aceptada',
    4: 'En proceso',
    5: 'QA',
    6: 'Pruebas Usuario',
    7: 'Pruebas Aceptadas',
    8: 'Validada',
    9: 'QA Erroneo',
    10: 'Pruebas Erroneas',
    11: 'Validacion Erronea',
    12: 'Resolucion de Dudas',
}

const validarCambioEstado = (estadoActual, nuevoEstado) => {
    const estadoActualTexto = estados[estadoActual];
    const nuevoEstadoTexto = estados[nuevoEstado];

    console.log(`Estado actual: ${estadoActualTexto}`);
    console.log(`Nuevo estado: ${nuevoEstadoTexto}`);

    if (!estadoActualTexto || !nuevoEstadoTexto) {
        return false;
    }

    switch (estadoActualTexto) {
        case "Emitida":
            return nuevoEstadoTexto === "Iniciada";
        case "Iniciada":
            return nuevoEstadoTexto === "Aceptada" || nuevoEstadoTexto === "Resolucion de Dudas";
        case "Resolucion de Dudas":
            return nuevoEstadoTexto === "Aceptada";
        case "Aceptada":
            return nuevoEstadoTexto === "En proceso" || nuevoEstadoTexto === "Resolucion de Dudas";
        case "En proceso":
            return nuevoEstadoTexto === "QA" || nuevoEstadoTexto === "Resolucion de Dudas";
        case "QA":
            return nuevoEstadoTexto === "QA Erroneo" || nuevoEstadoTexto === "Pruebas Usuario";
        case "QA Erroneo":
            return nuevoEstadoTexto === "Aceptada";
        case "Pruebas Usuario":
            return nuevoEstadoTexto === "Pruebas Aceptadas" || nuevoEstadoTexto === "Pruebas Erroneas" || nuevoEstadoTexto === "Resolucion de Dudas";
        case "Pruebas Erroneas":
            return nuevoEstadoTexto === "Aceptada";
        case "Pruebas Aceptadas":
            return nuevoEstadoTexto === "Pendiente valoracion" || nuevoEstadoTexto === "Resolucion de Dudas";
        case "Pendiente valoracion":
            return nuevoEstadoTexto === "Validada" || nuevoEstadoTexto === "Validacion Erronea" || nuevoEstadoTexto === "Resolucion de Dudas";
        default:
            return false;
    }
};

export const deleteTarea = async (req, res) => {

    try {
        const { id } = req.params;
        const resultado = await Tarea.destroy({
            where: { id },
        });
        if (!resultado) return res.status(404).json({ message: 'Tarea no existe' });
        console.log(resultado);
        return res.sendStatus(204);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getTareasByCategoria = async (req, res) => {
    try {
        const categoria = req.params.categoria;
        const estado = await Estado.findOne({ where: { categoria } });
        console.log(categoria);
        //console.log(estado);

        if (!estado) {
            return res.status(404).json({ error: `No se encontraron tareas para la categoría ${categoria}` });
        }

        const tareas = await Tarea.findAll({
            where: {
                idEstado: {
                    [Op.in]: sequelize.literal(`(SELECT id FROM estados WHERE categoria = '${categoria}')`)
                }
            }
        });
        res.json(tareas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const cambiarEstadoTarea = async (req, res) => {
    try {
        const { id } = req.params;
        const { idEstado } = req.body;

        console.log(id);
        console.log(('Id ingresado ->', idEstado));

        const tarea = await Tarea.findByPk(id);
        const estadoActual = await Estado.findByPk(tarea.idEstado);

        console.log(('Estado Actual ->'), estadoActual);

        const cambiosPermitidos = estadoActual.cambiosPermitidos;
        console.log(('cambios permitidos'), cambiosPermitidos);
        console.log(('estado actual'), tarea.idEstado);

        // Si no include idEstado cambios permitidos = ERROR
        if (!cambiosPermitidos.split(',').includes(idEstado.toString())) {
            return res.status(400).json({ message: 'No se puede actualizar al estado deseado' });
        }
        // Actualizar el campo idEstado con el valor del id del nuevo estado
        tarea.idEstado = idEstado;
        await tarea.save();

        return res.status(200).json({ message: 'El estado de la tarea se actualizo correctamente' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
