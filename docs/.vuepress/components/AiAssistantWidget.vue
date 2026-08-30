<template>
  <section class="lk-ai-asst" aria-label="AI 问答助手">
    <header class="lk-ai-asst__head">
      <span class="lk-ai-asst__title">🤖 AI 问答助手</span>
    </header>

    <div ref="logRef" class="lk-ai-asst__log">
      <p v-if="!messages.length && configured !== false" class="lk-ai-asst__empty">
        问点什么都行——博客里的文章、这个人是谁，或者别的任何问题。
      </p>
      <p v-if="configured === false" class="lk-ai-asst__empty" data-lk-no-translate>
        AI 助手暂未配置，先留言板见吧。
      </p>

      <div data-lk-no-translate>
        <div
          v-for="(m, i) in messages"
          :key="i"
          class="lk-ai-asst__msg"
          :class="m.role === 'user' ? 'lk-ai-asst__msg--user' : 'lk-ai-asst__msg--bot'"
        >
          <div class="lk-ai-asst__bubble">{{ m.content }}</div>
        </div>

        <div v-if="pending" class="lk-ai-asst__msg lk-ai-asst__msg--bot">
          <div class="lk-ai-asst__bubble lk-ai-asst__bubble--pending" aria-label="正在回答">
            <span class="lk-ai-asst__dot"></span><span class="lk-ai-asst__dot"></span><span class="lk-ai-asst__dot"></span>
          </div>
        </div>

        <p v-if="errorMsg" class="lk-ai-asst__error">{{ errorMsg }}</p>
      </div>
    </div>

    <form class="lk-ai-asst__composer" @submit.prevent="send">
      <textarea
        ref="inputRef"
        v-model="draft"
        class="lk-ai-asst__input"
        rows="1"
        placeholder="问点什么…"
        :disabled="pending || configured === false"
        @keydown.enter.exact.prevent="send"
        @input="autoGrow"
      ></textarea>
      <button
        type="submit"
        class="lk-ai-asst__send"
        :disabled="pending || !draft.trim() || configured === false"
        aria-label="发送"
      >
        ➤
      </button>
    </form>
  </section>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { pageLang } from '../utils/pageTranslate.js'

const messages = ref([])
const draft = ref('')
const pending = ref(false)
const errorMsg = ref('')
/** null = 还没查过，true/false = 已经知道服务端是否配置好了。 */
const configured = ref(null)
const logRef = ref(null)
const inputRef = ref(null)

function autoGrow() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`
}

async function scrollToBottom() {
  await nextTick()
  const el = logRef.value
  if (el) el.scrollTop = el.scrollHeight
}

onMounted(async () => {
  try {
    const res = await fetch('/api/assistant')
    const data = await res.json()
    configured.value = Boolean(data && data.ok && data.configured)
  } catch {
    configured.value = false
  }
})

async function send() {
  const text = draft.value.trim()
  if (!text || pending.value || configured.value === false) return

  const history = messages.value.map((m) => ({ role: m.role, content: m.content }))
  messages.value.push({ role: 'user', content: text })
  draft.value = ''
  pending.value = true
  errorMsg.value = ''
  await scrollToBottom()
  await nextTick()
  autoGrow()

  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history, lang: pageLang.value === 'zh' ? 'zh' : 'en' }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      if (data && data.needsConfig) configured.value = false
      throw new Error((data && data.error) || '助手暂时无法回答')
    }
    messages.value.push({ role: 'assistant', content: data.reply })
  } catch (err) {
    errorMsg.value = String((err && err.message) || err)
  } finally {
    pending.value = false
    await scrollToBottom()
  }
}
</script>

<style scoped>
.lk-ai-asst {
  display: flex;
  flex-direction: column;
  min-height: 260px;
  /* 四个用它的页面都把这张卡放在「sticky 侧栏、最后一张卡 flex:1 1 auto 填满」
     的位置里，height:100% 是让它跟着侧栏一起伸展、别在侧栏和主内容之间留出
     裸的页面背景。卡片本身不再封顶（以前在这儿设过 max-height:460px）——
     那样一来卡片矮了侧栏就会比主栏矮一截，露出下面的页面背景，跟「侧栏最后
     一张卡填满剩余高度」这条约定直接打架。上限改放到下面 __log（对话区）
     上：屏幕越高，多出来的空间就变成卡片底部一小段留白（卡片自己的背景，
     不是裸背景），而不是把空对话区拉得异常长。 */
  height: 100%;
  padding: 12px 14px 14px;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  color: #0f172a;
}

.lk-ai-asst__head {
  flex: none;
  margin: 0 0 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.35);
}

.lk-ai-asst__title {
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.lk-ai-asst__log {
  flex: 1 1 auto;
  min-height: 80px;
  /* 卡片本身不封顶了，这个上限接住原来的意图：对话区（尤其是没消息时的空
     占位）不会因为侧栏被撑得很高就跟着变成一大片空白。 */
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.lk-ai-asst__empty {
  margin: 4px 0;
  font-size: 0.74rem;
  line-height: 1.5;
  color: #64748b;
}

.lk-ai-asst__msg {
  display: flex;
}

.lk-ai-asst__msg--user {
  justify-content: flex-end;
}

.lk-ai-asst__msg--bot {
  justify-content: flex-start;
}

.lk-ai-asst__bubble {
  max-width: 88%;
  padding: 7px 11px;
  border-radius: 14px;
  font-size: 0.78rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.lk-ai-asst__msg--user .lk-ai-asst__bubble {
  background: var(--lk-accent-strong, #111827);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.lk-ai-asst__msg--bot .lk-ai-asst__bubble {
  background: rgba(148, 163, 184, 0.18);
  color: #1e293b;
  border-bottom-left-radius: 4px;
}

.lk-ai-asst__bubble--pending {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
}

.lk-ai-asst__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.55;
  animation: lk-ai-asst-blink 1.1s infinite ease-in-out;
}

.lk-ai-asst__dot:nth-child(2) {
  animation-delay: 0.15s;
}

.lk-ai-asst__dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes lk-ai-asst-blink {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  40% {
    opacity: 0.9;
    transform: translateY(-2px);
  }
}

.lk-ai-asst__error {
  margin: 2px 0 0;
  font-size: 0.72rem;
  color: #dc2626;
}

.lk-ai-asst__composer {
  flex: none;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(148, 163, 184, 0.3);
}

.lk-ai-asst__input {
  flex: 1 1 auto;
  min-width: 0;
  resize: none;
  max-height: 140px;
  padding: 7px 10px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(255, 255, 255, 0.85);
  color: #0f172a;
  font: inherit;
  font-size: 0.78rem;
  line-height: 1.4;
}

.lk-ai-asst__input:focus {
  outline: none;
  border-color: var(--lk-accent-strong, #111827);
}

.lk-ai-asst__input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.lk-ai-asst__send {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: none;
  background: var(--lk-accent-strong, #111827);
  color: #fff;
  font-size: 0.9rem;
  cursor: pointer;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.lk-ai-asst__send:hover:not(:disabled) {
  transform: translateY(-1px);
}

.lk-ai-asst__send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

[data-theme='dark'] .lk-ai-asst {
  background: rgba(15, 23, 42, 0.62) !important;
  border: 1px solid rgba(148, 163, 184, 0.22) !important;
  box-shadow: 0 2px 18px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
  color: rgba(226, 232, 240, 0.98) !important;
}

[data-theme='dark'] .lk-ai-asst__head {
  border-bottom-color: rgba(148, 163, 184, 0.35) !important;
}

[data-theme='dark'] .lk-ai-asst__empty {
  color: rgba(148, 163, 184, 0.98) !important;
}

[data-theme='dark'] .lk-ai-asst__msg--bot .lk-ai-asst__bubble {
  background: rgba(148, 163, 184, 0.22) !important;
  color: rgba(226, 232, 240, 0.98) !important;
}

[data-theme='dark'] .lk-ai-asst__composer {
  border-top-color: rgba(148, 163, 184, 0.3) !important;
}

[data-theme='dark'] .lk-ai-asst__input {
  background: rgba(15, 23, 42, 0.5) !important;
  border-color: rgba(148, 163, 184, 0.35) !important;
  color: rgba(226, 232, 240, 0.98) !important;
}
</style>
