import { check } from "express-validator";
import { validateResult } from "../helpers/validateHelper.js";
import moment from "moment";

export const validaTarea = [
    check('nombre')
    .exists()
    .not()
    .isEmpty()
    .isString(),
    check('fechaCreacion')
    .exists()
    .not()
    .isEmpty()
    .custom((value)=>{
        if(moment(value).isBefore(moment().subtract(100, 'years'))){
            throw new Error('La fecha de creacion es demasiado antigua');
        }
        return value;
    })
    .toDate(),
    check('fechaInicioTarea')
    .exists()
    .not()
    .isEmpty()
    .custom((value)=>{
        if(moment(value).isBefore(moment().subtract(100, 'years'))){
            throw new Error('La fecha de inicio de tarea es demasiado antigua');
        }
        return value;
    })
    .toDate(),
    check('fechaFinalizacion')
    .exists()
    .not()
    .isEmpty()
    .custom((value)=>{
        if(moment(value).isBefore(moment().subtract(100, 'years'))){
            throw new Error('La fecha de finalizacion de tarea es demasiado antigua');
        }
        return value;
    })
    .toDate(),
    (req, res, next) =>{
        validateResult(req, res, next)
    }
]