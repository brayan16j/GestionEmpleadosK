import { check } from "express-validator";
import { validateResult } from "../helpers/validateHelper.js";

export const validaEstado = [
    check('estado')
    .exists()
    .not()
    .isEmpty()
    .isString(),
    check('categoria')
    .exists()
    .not()
    .isEmpty()
    .isString(),
    (req, res, next) =>{
        validateResult(req, res, next)
    }
]