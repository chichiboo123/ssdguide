import express from 'express'
import cors from 'cors'
import groqRouter from './groq-router.js'

const app = express()
const PORT = Number(process.env.PORT) || 3001

// Allow origins: Vite dev server + any CORS_ORIGIN override (for production)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : []),
]

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no Origin header (e.g. same-origin nginx proxy, curl)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error(`CORS: origin ${origin} not allowed`))
    },
    methods: ['GET', 'POST'],
  })
)

app.use(express.json({ limit: '256kb' }))

app.use('/api/groq', groqRouter)

app.get('/healthz', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.info(`[server] API server listening on port ${PORT}`)
  if (!process.env.GROQ_API_KEY) {
    console.warn('[server] WARNING: GROQ_API_KEY is not set — AI endpoints will return 503')
  }
})
