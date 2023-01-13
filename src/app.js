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

let time = dayjs()

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

        await database.collection("messages").insertOne({
            from: name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: time.format("HH:mm:ss")
        })

        res.sendStatus(201)
    }

    catch (error) {
        res.status(500).send(error.message)        
    }
})

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body
    const { loggedUser } = req.headers

    try {
        const isUserLogged = await database.collection("messages").findOne({ name: loggedUser})

        if(!isUserLogged) {
            return res.status(422).send("Usuário desconectado!")
        }

        await database.collection("messages").insertOne({
            from: loggedUser,
            to: to,
            text: text,
            type: type,
            time: time.format("HH:mm:ss")
        })

        res.sendStatus(201)
    }

    catch (error) {
        res.status(500).send(error.message)        
    }
})

app.get("/messages", async (req, res) => {
    try {
        database.collection("messages")
        .find()
        .toArray()
        .then(data => {
            return res.send(data)
        })
    }

    catch {
        res.sendStatus(500)
    }
})



const PORT = 5000
app.listen( PORT, () => {
    console.log(`Servidor iniciado na porta: ${PORT}`)
})