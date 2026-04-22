import { Estado } from "../modelos/estado.js"

export const getEstados = async (req, res) => {
    try {
        const estados = await Estado.findAll();
        res.json(estados);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const createEstado = async (req, res) => {
    try {
        const { estado, categoria } = req.body;

        const newEstado = await Estado.create({
            estado,
            categoria
        });
        res.json(newEstado);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const estado = await Estado.findByPk(id);
        if (!estado) return res.status(404).json({ message: 'Estado no existe' });
        res.json(estado);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const updateEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const estado = await Estado.findByPk(id);
        estado.set(req.body);
        await estado.save();
        return res.json(estado);

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const deleteEstado = async (req, res) => {
    const { id } = req.params;
    try {

        const result = await Estado.destroy({
            where: { id },
        });
        if (!result) return res.status(404).json({ message: 'Estado no existe' });
        console.log(result);
        return res.sendStatus(204);

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
