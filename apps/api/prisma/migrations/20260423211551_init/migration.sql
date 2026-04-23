-- CreateTable
CREATE TABLE "empleado" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_ingreso" DATE NOT NULL,
    "salario" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estado" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "cambios_permitidos" TEXT,

    CONSTRAINT "estado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_creacion" DATE NOT NULL,
    "fecha_inicio_tarea" DATE NOT NULL,
    "fecha_finalizacion" DATE NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "id_estado" INTEGER NOT NULL,

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estado_nombre_key" ON "estado"("nombre");

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
