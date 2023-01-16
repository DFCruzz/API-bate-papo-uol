import express, { text } from "express"
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


app.get("/participants", async (req, res) => {

    try {
        const onlineUsers = await database.collection("participants").find().toArray()
        return res.send(onlineUsers) 
    }
    
    catch (error) {
        res.status(500).send(error.message)
    }
})

app.post("/participants", async (req, res) => {
    const user = req.body
    const time = dayjs().format("HH:mm:ss")

    const nameSchema = joi.object({
        name: joi.string().required()
    })

    const validation = nameSchema.validate(user, { abortEarly: false })

    if (validation.error) {
        const errors = validation.error.details.map((error) => error.message)
        return res.status(422).send(errors)
    }

    try {
        const isUserAvailable = await database.collection("participants").findOne({ name: user.name })

        if (isUserAvailable) {
            return res.status(409).send("Usuário Indisponível")
        }

        await database.collection("participants").insertOne({
            name: user.name,
            lastStatus: Date.now()
        })



        await database.collection("messages").insertOne({
            from: user.name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: time
        })

        res.sendStatus(201)
    }

    catch (error) {
        res.status(500).send(error.message)
    }
})

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body
    const { user }  = req.headers
    const time = dayjs().format("HH:mm:ss")

    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.valid("private_message", "message").required()
    })

    const validation = messageSchema.validate({ to, text, type }, { abortEarly: false })

    if (validation.error) {
        const errors = validation.error.details.map((error) => error.message)
        return res.status(422).send(errors)
    }

    const isUserLogged = await database.collection("participants").findOne({ name: user })

        if (!isUserLogged) {
            return res.status(422).send("Usuário desconectado!")
        }


    try {
        await database.collection("messages").insertOne({
            from: user,
            to,
            text,
            type,
            time: time
        })

        res.sendStatus(201)
    }

    catch (error) {
        res.status(500).send(error.message)
    }
})


app.get("/messages", async (req, res) => {
    const { limit } = req.query
    const user = req.headers.user

    if (limit) {
        if (limit <= 0 || isNaN(limit) === true) {
            return res.sendStatus(422)
        }
    }
    try {
        const messages = await database.collection("messages")
            .find({
                $or: [
                    {
                        from: user,
                        type: "private_message"
                    },
                    {
                        to: user,
                        type: "private_message"
                    },
                    {
                        type: "status"
                    },
                    {
                        type: "message"
                    }
                ]
            })
            .toArray()

        if (limit) {
            return res.send(messages.slice(limit * -1).reverse())
        }

        else {
            return res.send(messages)
        }
    }

    catch {
        res.sendStatus(500)
    }
})

app.post("/status", async (req, res) => {
    const user = req.headers.user

    try {
        const isUserOnline = await database.collection("participants").findOne({ name: user })

        if (!isUserOnline) {
            return res.sendStatus(404)
        }

        database.collection("participants").updateOne({ name: user, lastStatus: Date.now() })

        res.sendStatus(200)
    }

    catch (error) {
        res.status(500).send(error.message)
    }
})

setInterval(
    async () => {
        const isUserActive = await database.collection("/participants").find().toArray()
        const time = dayjs().format("hh:mm:ss")

        try {
            isUserActive.filter(async (e) => {
                if (Date.now() - 10000 >= e.lastStatus) {
                    await database.collection("participants").deleteOne({ name: e.name })
                    const exitMessage = {
                        from: e.name,
                        to: "Todos",
                        text: "entra na sala...",
                        type: "status",
                        time: time
                    }

                    await database.collection("messages").insertOne(exitMessage)
                }
            })
        }

        catch (error) {
            res.status(500).send(error.message)
        }
    }
, 15000)



const PORT = 5000
app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta: ${PORT}`)
})