import express from "express"
import cors from "cors"
import OpenAI from "openai"

const app = express()

app.use(cors())
app.use(express.json())

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const ASSISTANT_ID = process.env.ASSISTANT_ID

app.post("/chat", async (req, res) => {
  try {
    const { message, threadId } = req.body

    let currentThreadId = threadId

    if (!currentThreadId) {
      const thread = await openai.beta.threads.create()
      currentThreadId = thread.id
    }

    await openai.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: message,
    })

    const run = await openai.beta.threads.runs.create(currentThreadId, {
      assistant_id: ASSISTANT_ID,
    })

    let runStatus

    do {
      runStatus = await openai.beta.threads.runs.retrieve(
        currentThreadId,
        run.id
      )
    } while (runStatus.status !== "completed")

    const messages = await openai.beta.threads.messages.list(currentThreadId)

    const latestMessage = messages.data[0]

    const content = latestMessage.content[0].text.value

    let parsed

    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = {
        message: content,
        quickReplies: [],
      }
    }

    res.json({
      threadId: currentThreadId,
      message: parsed.message,
      quickReplies: parsed.quickReplies || [],
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: "Something went wrong",
      quickReplies: [],
    })
  }
})

export default app
