import { useEffect, useRef, useState } from 'react'
import { Bot, MessageCircle, RotateCcw, Send, Sparkles, Trash2, X } from 'lucide-react'
import { sendChatbotMessage, type ChatbotHistoryMessage } from '../api'
import { useAuth } from '../context/AuthContext'
import './ChatbotWidget.css'

type Message = ChatbotHistoryMessage & {
  id: string
  isWelcome?: boolean
  privateData?: boolean
}

let messageSequence = 0

function nextMessageId() {
  messageSequence += 1
  return `${Date.now()}-${messageSequence}`
}

const suggestions = [
  'What services can I book?',
  'How do I find a provider?',
  'How do I book a service?',
  'How do I manage a booking?',
  'What do booking statuses mean?',
  'How do payments work?',
  'How do I check a payment?',
  'Can I get a refund?',
  'How do I create an account?',
  'How do I join as a provider?',
]

function welcomeMessage(): Message {
  return {
    id: nextMessageId(),
    role: 'assistant',
    content: 'Hi! I’m your Service Hub AI Assistant. I can help you explore services, understand bookings, and answer questions about payments.',
    isWelcome: true,
  }
}

function responseMessage(error: unknown) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message || 'I could not connect just now. Please try again in a moment.'
}

export function ChatbotWidget() {
  const { user } = useAuth()
  return <ChatbotConversation key={user?.id ?? 'guest'} />
}

function ChatbotConversation() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([welcomeMessage()])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const conversationRef = useRef(0)
  const showSuggestions = !pending && (
    (messages.length === 1 && messages[0].isWelcome)
    || messages[messages.length - 1]?.role === 'assistant'
  )

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending, open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const submitMessage = async (value = draft) => {
    const message = value.trim()
    if (!message || pending) return

    const history = messages
      .filter((item) => !item.isWelcome && !item.privateData)
      .slice(-10)
      .map(({ role, content, privateData }) => ({ role, content, privateData }))
    const conversation = conversationRef.current
    const userMessage: Message = {
      id: nextMessageId(),
      role: 'user',
      content: message,
      privateData: /\b(my|mine|existing|current|check|find|show|details|status of|where is|where are)\b/i.test(message)
        && /\b(booking|bookings|appointment|appointments|payment|payments|transaction|transactions)\b/i.test(message),
    }
    setMessages((current) => [...current, userMessage])
    setDraft('')
    setPending(true)

    try {
      const result = await sendChatbotMessage(message, history)
      if (conversation === conversationRef.current) {
        setMessages((current) => [
          ...current.map((item) => item.id === userMessage.id ? { ...item, privateData: result.privateData } : item),
          { id: nextMessageId(), role: 'assistant', content: result.reply, privateData: result.privateData },
        ])
      }
    } catch (error) {
      if (conversation === conversationRef.current) {
        setMessages((current) => [...current, { id: nextMessageId(), role: 'assistant', content: responseMessage(error) }])
      }
    } finally {
      if (conversation === conversationRef.current) {
        setPending(false)
        inputRef.current?.focus()
      }
    }
  }

  const startNewConversation = () => {
    conversationRef.current += 1
    setMessages([welcomeMessage()])
    setDraft('')
    setPending(false)
    inputRef.current?.focus()
  }

  const clearConversation = () => {
    conversationRef.current += 1
    setMessages([])
    setDraft('')
    setPending(false)
    inputRef.current?.focus()
  }

  return (
    <div className="chatbot-widget">
      {open && (
        <section className="chatbot-window" aria-label="Service Hub AI Assistant">
          <header className="chatbot-header">
            <div className="chatbot-brand-icon" aria-hidden="true"><Bot size={20} /></div>
            <div className="chatbot-header-copy">
              <strong>Service Hub AI Assistant</strong>
              <span><i aria-hidden="true" /> Online</span>
            </div>
            <div className="chatbot-header-actions">
              <button type="button" onClick={startNewConversation} aria-label="Start a new conversation" title="New conversation">
                <RotateCcw size={17} />
              </button>
              <button type="button" onClick={clearConversation} aria-label="Clear chat" title="Clear chat">
                <Trash2 size={17} />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">
                <X size={20} />
              </button>
            </div>
          </header>

          <div className="chatbot-messages" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Chat messages">
            {messages.length === 0 && (
              <div className="chatbot-empty-state">
                <Sparkles size={20} aria-hidden="true" />
                <p>Chat cleared. What can I help you with?</p>
              </div>
            )}
            {messages.map((message) => (
              <div className={`chatbot-message chatbot-message-${message.role}`} key={message.id}>
                {message.role === 'assistant' && <span className="chatbot-avatar" aria-hidden="true"><Bot size={15} /></span>}
                <p>{message.content}</p>
              </div>
            ))}
            {showSuggestions && (
              <div className="chatbot-suggestions" aria-label="Suggested questions">
                {suggestions.map((suggestion) => (
                  <button type="button" key={suggestion} onClick={() => void submitMessage(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {pending && (
              <div className="chatbot-message chatbot-message-assistant">
                <span className="chatbot-avatar" aria-hidden="true"><Bot size={15} /></span>
                <p className="chatbot-typing" aria-label="Assistant is typing"><i /><i /><i /></p>
              </div>
            )}
            <div ref={messageEndRef} />
          </div>

          <form className="chatbot-composer" onSubmit={(event) => { event.preventDefault(); void submitMessage() }}>
            <label className="chatbot-sr-only" htmlFor="chatbot-message">Your message</label>
            <textarea
              id="chatbot-message"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void submitMessage()
                }
              }}
              placeholder="Ask me anything..."
              rows={1}
              maxLength={2000}
              disabled={pending}
            />
            <button type="submit" aria-label="Send message" disabled={pending || !draft.trim()}>
              <Send size={17} />
            </button>
            <span className="chatbot-sr-only">Press Enter to send. Press Shift and Enter for a new line.</span>
          </form>
          <p className="chatbot-disclaimer">AI responses can make mistakes. Check important details in your account.</p>
        </section>
      )}

      <button
        type="button"
        className={`chatbot-launcher ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Close Service Hub AI Assistant' : 'Open Service Hub AI Assistant'}
        aria-expanded={open}
      >
        {open ? <X size={23} /> : <MessageCircle size={23} />}
      </button>
    </div>
  )
}
