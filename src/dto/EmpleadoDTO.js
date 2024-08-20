export class EmpleadoDTO {
    constructor(empleado) {
        this.nombre = empleado.nombre;
        this.fechaIngreso = empleado.fechaIngreso;
        this.salario = empleado.salario;
    }
}