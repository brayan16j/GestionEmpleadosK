import { check } from "express-validator";
import { validateResult } from "../helpers/validateHelper.js";
import moment from "moment";


export const validaCrea = [
    check('nombre')
    .exists()
    .not()
    .isEmpty()
    //.matches(/^[a-zA-Z0-9]+$/)
    .isString(),
    check('fechaIngreso')
    .exists()
    .not()
    .isEmpty()
    .custom((value) =>{
        if(moment(value).isAfter(moment())){
            throw new Error('La fecha de ingreso no puede ser superior al dia actual ');
        }
        if(moment(value).isBefore(moment().subtract(100, 'years'))){
            throw new Error('La fecha de ingreso es demasiado antigua');
        }
        return value;
    })
    .toDate(),
    check('salario')
    .exists()
    .isNumeric()
    .not()
    .isEmpty(),
    (req, res, next) =>{
        validateResult(req, res, next)
    }
]