import type { NextFunction, Request, Response } from 'express'
import { ChatbotProviderError, generateChatReply, getGuideReply, getPrivateAccountReply, getUnavailableAiReply, type ChatHistoryMessage } from '../services/chatbotService.js'

const maxHistoryMessages = 10
const maxHistoryCharacters = 8000

function validHistory(value: unknown): value is ChatHistoryMessage[] {
  return Array.isArray(value)
    && value.length <= maxHistoryMessages
    && value.every((item) => (
      typeof item === 'object'
      && item !== null
      && 'role' in item
      && (item.role === 'user' || item.role === 'assistant')
      && 'content' in item
      && typeof item.content === 'string'
      && item.content.trim().length > 0
      && item.content.length <= 1500
      && (!('privateData' in item) || typeof item.privateData === 'boolean')
    ))
}

export async function postChatMessage(request: Request, response: Response, next: NextFunction) {
  const { message, history = [] } = request.body || {}

  if (typeof message !== 'string' || !message.trim()) {
    return response.status(400).json({ success: false, message: 'Enter a message to continue.' })
  }
  if (message.length > 2000) {
    return response.status(400).json({ success: false, message: 'Messages must be 2,000 characters or fewer.' })
  }
  if (!validHistory(history) || history.reduce((total, item) => total + item.content.length, 0) > maxHistoryCharacters) {
    return response.status(400).json({ success: false, message: 'Conversation history is invalid or too long. Start a new conversation and try again.' })
  }
  try {
    const privateReply = await getPrivateAccountReply(message.trim(), request.user)
    if (privateReply !== null) return response.json({ success: true, reply: privateReply, privateData: true })

    const guideReply = await getGuideReply(message.trim())
    if (guideReply !== null) return response.json({ success: true, reply: guideReply, privateData: false })

    if (!process.env.GEMINI_API_KEY) {
      return response.json({ success: true, reply: getUnavailableAiReply(), privateData: false })
    }
    const reply = await generateChatReply(message.trim(), history)
    response.json({ success: true, reply, privateData: false })
  } catch (error) {
    if (error instanceof ChatbotProviderError) {
      if (error.status === 429) {
        return response.status(503).json({ success: false, message: 'The assistant is busy right now. Please try again in a moment.' })
      }
      if (error.status === 408 || error.status === 504) {
        return response.status(504).json({ success: false, message: 'The assistant took too long to respond. Please try again.' })
      }
      console.error('Chatbot AI provider request failed')
      return response.status(502).json({ success: false, message: 'The assistant could not respond right now. Please try again later.' })
    }
    next(error)
  }
}
