import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type FormEvent
} from 'react'
import { Send, Loader2 } from 'lucide-react'
import { useDeepseekStore } from '@/stores/deepseekStore'
import { searchWeb, formatSearchContext } from './api/tavily'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function ChatSidebar(): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const webSearchEnabled = useDeepseekStore((s) => s.webSearchEnabled)
  const setWebSearchEnabled = useDeepseekStore((s) => s.setWebSearchEnabled)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [messages])

  const handleSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || isStreaming) return

    const { apiKey, webSearchEnabled } = useDeepseekStore.getState()
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: '请先在设置中配置 DeepSeek API Key'
        }
      ])
      return
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)

    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' }
    setMessages((prev) => [...prev, assistantMsg])

    let searchContext = ''
    if (webSearchEnabled) {
      try {
        const results = await searchWeb(text)
        searchContext = formatSearchContext(results)
      } catch (e) {
        console.error('[Chat] Web search failed:', e)
      }
    }

    try {
      const model = (await window.api.settings.get('deepseekModel')) as string
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model || 'deepseek-v4-flash',
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: searchContext ? text + '\n\n' + searchContext : text }
          ],
          stream: true
        })
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                content += delta
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, content }
                  }
                  return updated
                })
              }
            } catch {
              // skip malformed JSON lines
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last && last.role === 'assistant') {
          updated[updated.length - 1] = {
            ...last,
            content: '请求失败，请检查网络连接和 API Key 配置'
          }
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 flex flex-col">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">发送消息与 AI 开始对话</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

            {/* Web Search Toggle */}
      <div className="px-4 pt-2 pb-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={webSearchEnabled}
            onChange={(e) => setWebSearchEnabled(e.target.checked)}
            className="peer sr-only"
          />
          <div className="relative w-8 h-4.5 bg-muted-foreground/25 rounded-full
                          peer-checked:bg-primary transition-colors duration-200">
            <div className="absolute left-0.5 top-0.5 w-3.5 h-3.5 bg-white rounded-full
                            peer-checked:translate-x-3.5 transition-transform duration-200" />
          </div>
          <span className="text-xs text-muted-foreground select-none">
            ????{webSearchEnabled ? ' ? ???' : ''}
          </span>
        </label>
      </div>

{/* Input */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={1}
            className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm
                       placeholder:text-muted-foreground
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Send"
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatSidebar
