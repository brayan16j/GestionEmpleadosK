import express from "express";
import cors from "cors"; 
import EmpleadosRouter from "./routes/EmpleadosRouter.js";
import TareasRouter from "./routes/TareasRouter.js";
import EstadoRouter from "./routes/EstadoRouter.js";

const whiteList = 'http://localhost:3000'
const app = express();
app.disable("x-powered-by");
app.use(cors({origin: whiteList}));
// middlewares permite que cada vez que envien un dato en json el servidor pueda interpretarlo 
app.use(express.json());

app.use(EmpleadosRouter);
app.use(TareasRouter);
app.use(EstadoRouter);

export default app;