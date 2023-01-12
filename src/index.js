import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import dayjs from "dayjs"
import joi from "joi"

dotenv.config()

const mongoClient = new MongoClient(process.env.DATABASE_URL)

try {
    await mongoClient.connect()
    console.log("API conectada!")
}
catch (err) {
    console.log(err.message)
}

const database = mongoClient.db()


const app = express()
app.use(express.json())
app.use(cors())

app.get("/participants", (req, res) => {
    database.collection("participants")
        .find()
        .toArray()
        .then(data => {
            return res.send(data)
        })

        .catch(() => {
            res.sendStatus(500)
        })
})

app.post("/participants", async (req, res) => {
    const { name } = req.body

    try {
        const isUserAvailable = await database.collection("participants").findOne({ name: name })

        if(isUserAvailable) {
            return res.status(409).send("Usuário Indisponível")
        }

        await database.collection("participants").insertOne({
            name: name,
            lastStatus: Date.now()
        })

        res.sendStatus(201)
    }

    catch (error) {
        res.status(500).send(error.message)        
    }
})



const PORT = process.env.PORT
app.listen( PORT, () => {
    console.log(`Servidor iniciado na porta: ${PORT}`)
})