import express from "express"
import cors from "cors"
import OpenAI from "openai"

const app = express()

app.use(cors())
app.use(express.json())

console.log("OPENAI API KEY EXISTS:", !!process.env.OPENAI_API_KEY)
console.log("ASSISTANT ID:", process.env.ASSISTANT_ID)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const ASSISTANT_ID = process.env.ASSISTANT_ID

app.post("/chat", async (req, res) => {
  try {
    console.log("NEW REQUEST RECEIVED")

    const { message, threadId } = req.body

    console.log("MESSAGE:", message)
    console.log("THREAD ID FROM FRONTEND:", threadId)

    let currentThreadId = threadId

    if (!currentThreadId) {
      console.log("NO THREAD ID, CREATING NEW THREAD")

      const thread = await openai.beta.threads.create()

      console.log("THREAD RESPONSE:", thread)

      currentThreadId = thread.id

      console.log("NEW THREAD ID:", currentThreadId)
    }

    console.log("ADDING USER MESSAGE TO THREAD")

    const messageResponse =
      await openai.beta.threads.messages.create(
        currentThreadId,
        {
          role: "user",
          content: message,
        }
      )

    console.log("MESSAGE RESPONSE:", messageResponse)

    console.log("CREATING ASSISTANT RUN")

    const run = await openai.beta.threads.runs.create(
      currentThreadId,
      {
        assistant_id: ASSISTANT_ID,
      }
    )

    console.log("RUN RESPONSE:", run)
    console.log("RUN ID:", run.id)

    let runStatus

    do {
      console.log("CHECKING RUN STATUS")

      runStatus =
        await openai.beta.threads.runs.retrieve(
          run.id,
    {
      thread_id: currentThreadId,
    }
        )

      console.log("RUN STATUS:", runStatus.status)

      await new Promise(resolve =>
        setTimeout(resolve, 1000)
      )

    } while (
      runStatus.status !== "completed" &&
      runStatus.status !== "failed" &&
      runStatus.status !== "cancelled" &&
      runStatus.status !== "expired"
    )

    console.log("RUN FINISHED")

    if (runStatus.status !== "completed") {
      console.log("RUN FAILED:", runStatus)

      return res.status(500).json({
        message: "Assistant failed",
        quickReplies: [],
      })
    }

    console.log("FETCHING MESSAGES")

    const messages =
      await openai.beta.threads.messages.list(
        currentThreadId
      )

    console.log("MESSAGES RESPONSE:", messages)

    const latestMessage = messages.data[0]

    console.log("LATEST MESSAGE:", latestMessage)

    const content =
      latestMessage.content[0].text.value

    console.log("RAW CONTENT:", content)

    let parsed

    try {
      const cleaned = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim()

      console.log("CLEANED CONTENT:", cleaned)

      parsed = JSON.parse(cleaned)

      console.log("PARSED JSON:", parsed)

    } catch (parseError) {
      console.log("JSON PARSE FAILED")
      console.log(parseError)

      parsed = {
        message: content,
        quickReplies: [],
      }
    }

    console.log("SENDING RESPONSE TO FRONTEND")

    res.json({
      threadId: currentThreadId,
      message: parsed.message,
      quickReplies: parsed.quickReplies || [],
    })

  } catch (error) {
    console.error("SERVER ERROR:")
    console.error(error)

    res.status(500).json({
      message: "Something went wrong",
      quickReplies: [],
    })
  }
})

export default app
