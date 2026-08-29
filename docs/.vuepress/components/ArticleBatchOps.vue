<script setup>
import { computed, onMounted, ref } from 'vue'
import { useIsLoggedIn } from '../utils/authGate.js'

const isLoggedIn = useIsLoggedIn()
const batchMode = ref(false)
const selectedItems = ref([])
const message = ref('')
const mounted = ref(false)
const batchOpsTarget = ref(null)
const pendingDeleteCount = ref(0)
const isArticlePage = ref(false)

const selectedCount = computed(() => selectedItems.value.length)

function toggleBatchMode() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) {
    selectedItems.value = []
    updateCheckboxes()
  }
  updateCheckboxVisibility()
}

function toggleItem(slug) {
  const item = document.querySelector(`.lk-blog__item[data-slug="${slug}"]`)
  if (item?.classList.contains('lk-blog__item--preview')) {
    message.value = '预览文章请从待推送列表移除'
    return
  }

  const index = selectedItems.value.indexOf(slug)
  if (index > -1) {
    selectedItems.value.splice(index, 1)
  } else {
    selectedItems.value.push(slug)
  }
  updateCheckboxes()
}

function selectAll() {
  const items = document.querySelectorAll('.lk-blog__item[data-slug]:not(.lk-blog__item--preview)')
  selectedItems.value = []
  items.forEach((item) => {
    const slug = item.getAttribute('data-slug')
    if (slug && !selectedItems.value.includes(slug)) {
      selectedItems.value.push(slug)
    }
  })
  updateCheckboxes()
}

function clearSelection() {
  selectedItems.value = []
  updateCheckboxes()
}

function updateCheckboxes() {
  const items = document.querySelectorAll('.lk-blog__item[data-slug]:not(.lk-blog__item--preview)')
  items.forEach((item) => {
    const slug = item.getAttribute('data-slug')
    const checkbox = item.querySelector('.lk-batch-checkbox')
    if (checkbox && slug) {
      checkbox.checked = selectedItems.value.includes(slug)
    }
  })
}

async function batchDelete() {
  if (selectedCount.value === 0) {
    message.value = '请先选择要删除的文章'
    return
  }

  const slugs = [...selectedItems.value]
  const confirmed = confirm(`将 ${slugs.length} 篇文章标记为待删除？\n\n${slugs.join('\n')}\n\n删除将在推送时生效`)
  if (!confirmed) return

  console.log('[ArticleBatchOps] batchDelete 开始执行')
  console.log('  - 选中的 slugs:', slugs)

  slugs.forEach((slug) => {
    const item = document.querySelector(`.lk-blog__item[data-slug="${slug}"]:not(.lk-blog__item--preview)`)
    if (!item) {
      console.log('  - 跳过:', slug, '(未找到 DOM 元素)')
      return
    }

    const titleEl = item.querySelector('.lk-blog__post-title')
    const title = titleEl?.textContent || slug

    console.log('  - 触发事件 add-pending-delete:', { slug, title })

    const event = new CustomEvent('add-pending-delete', { detail: { slug, title } })
    const dispatched = window.dispatchEvent(event)
    console.log('  - 事件已触发? 返回值:', dispatched)

    item.classList.add('lk-blog__item--pending-delete')

    const checkboxWrapper = item.querySelector('.lk-batch-checkbox-wrapper')
    if (checkboxWrapper) {
      checkboxWrapper.style.display = 'none'
    }

    if (!item.querySelector('.lk-delete-badge')) {
      const badge = document.createElement('span')
      badge.className = 'lk-delete-badge'
      badge.textContent = '即将删除'
      badge.style.cssText = `
        position: absolute;
        top: 8px;
        left: 8px;
        background: #ef4444;
        color: #fff;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
        z-index: 10;
        font-weight: 500;
      `
      item.style.position = 'relative'
      item.insertBefore(badge, item.firstChild)
    }
  })

  console.log('[ArticleBatchOps] batchDelete 完成, pendingDeletes 应该已更新')
  console.log('  - localStorage lk_pending_deletes:', localStorage.getItem('lk_pending_deletes'))

  message.value = `已标记 ${slugs.length} 篇文章为待删除，点击推送按钮完成删除`
  selectedItems.value = []
  batchMode.value = false
  updateCheckboxVisibility()
  updatePendingDeleteCount()
  window.dispatchEvent(new CustomEvent('open-push-sheet'))
}

function cancelAllDeletes() {
  const items = document.querySelectorAll('.lk-blog__item--pending-delete')
  items.forEach((item) => {
    item.classList.remove('lk-blog__item--pending-delete')
    const badge = item.querySelector('.lk-delete-badge')
    if (badge) badge.remove()
  })

  window.dispatchEvent(new CustomEvent('clear-pending-deletes'))
  message.value = '已取消所有待删除文章'
  pendingDeleteCount.value = 0
}

function batchPrint() {
  if (selectedCount.value === 0) {
    message.value = '请先选择要打印的文章'
    return
  }

  const slugs = [...selectedItems.value]
  slugs.forEach((slug, index) => {
    setTimeout(() => {
      const win = window.open(`/article/${slug}.html`, '_blank')
      if (win) {
        win.onload = () => {
          win.print()
        }
      }
    }, index * 500)
  })
}

function injectCheckboxes() {
  const items = document.querySelectorAll('.lk-blog__item:not(.lk-blog__item--preview)')
  items.forEach((item) => {
    if (item.querySelector('.lk-batch-checkbox')) return

    const link = item.querySelector('a.lk-blog__card')
    if (!link) return

    const href = link.getAttribute('href') || ''
    const match = href.match(/\/(article|tech)\/(.+)\.html/)
    if (!match) return

    const slug = match[2]
    item.setAttribute('data-slug', slug)

    const checkboxWrapper = document.createElement('div')
    checkboxWrapper.className = 'lk-batch-checkbox-wrapper'
    checkboxWrapper.style.cssText = `
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 20;
      display: ${batchMode.value ? 'flex' : 'none'};
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    `

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.className = 'lk-batch-checkbox'
    checkbox.style.cssText = `
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: #4a90d9;
    `
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation()
      toggleItem(slug)
    })

    checkboxWrapper.appendChild(checkbox)
    item.style.position = 'relative'
    item.insertBefore(checkboxWrapper, item.firstChild)

    item.addEventListener(
      'click',
      (e) => {
        if (batchMode.value && !item.classList.contains('lk-blog__item--pending-delete')) {
          e.preventDefault()
          e.stopPropagation()
          toggleItem(slug)
        }
      },
      true,
    )
  })
}

function updateCheckboxVisibility() {
  const wrappers = document.querySelectorAll('.lk-batch-checkbox-wrapper')
  wrappers.forEach((wrapper) => {
    wrapper.style.display = batchMode.value ? 'flex' : 'none'
  })
}

function updatePendingDeleteCount() {
  try {
    const saved = localStorage.getItem('lk_pending_deletes')
    if (saved) {
      const deletes = JSON.parse(saved)
      pendingDeleteCount.value = Array.isArray(deletes) ? deletes.length : 0
    } else {
      pendingDeleteCount.value = 0
    }
  } catch {
    pendingDeleteCount.value = 0
  }
}

function resolveBatchOpsTarget() {
  if (typeof document === 'undefined') return

  batchOpsTarget.value =
    document.querySelector('.lk-blog__sidebar') ||
    document.querySelector('.lk-blog__right-sidebar') ||
    document.querySelector('.theme-hope-content') ||
    document.querySelector('.vp-page') ||
    document.body
}

function checkPage() {
  if (typeof window === 'undefined') return
  const path = window.location.pathname
  isArticlePage.value = path === '/article/' || path === '/article' || path.startsWith('/article/')

  if (isArticlePage.value) {
    resolveBatchOpsTarget()
  } else {
    batchOpsTarget.value = null
  }
}

onMounted(() => {
  resolveBatchOpsTarget()
  mounted.value = true
  checkPage()
  updatePendingDeleteCount()
  setTimeout(injectCheckboxes, 500)
  setTimeout(resolveBatchOpsTarget, 500)
  setInterval(checkPage, 1000)
  // 定期更新待删除计数
  setInterval(updatePendingDeleteCount, 2000)

  const observer = new MutationObserver(() => {
    injectCheckboxes()
    resolveBatchOpsTarget()
  })
  observer.observe(document.body, { childList: true, subtree: true })

  window.addEventListener('publish-push-finished', () => {
    message.value = ''
    updatePendingDeleteCount()
  })
})
</script>

<template>
  <Teleport v-if="mounted && isArticlePage && isLoggedIn" :to="batchOpsTarget">
    <div class="lk-batch-sidebar-card">
      <div class="lk-batch-card">
        <div class="lk-batch-card__head">
          <span class="lk-batch-card__title">批量操作</span>
          <span v-if="batchMode" class="lk-batch-card__count">已选 {{ selectedCount }} 篇</span>
        </div>

        <div class="lk-batch-card__buttons">
          <button
            v-if="!batchMode"
            type="button"
            class="lk-batch-card__btn lk-batch-card__btn--primary"
            @click="toggleBatchMode"
          >
            选择文章
          </button>

          <template v-else>
            <button type="button" class="lk-batch-card__btn lk-batch-card__btn--small" @click="selectAll">全选</button>
            <button type="button" class="lk-batch-card__btn lk-batch-card__btn--small" @click="clearSelection">清空</button>
            <button
              type="button"
              class="lk-batch-card__btn lk-batch-card__btn--delete"
              :disabled="selectedCount === 0"
              @click="batchDelete"
            >
              删除 ({{ selectedCount }})
            </button>
            <button type="button" class="lk-batch-card__btn lk-batch-card__btn--cancel" @click="toggleBatchMode">
              取消
            </button>
          </template>

          <button
            v-if="!batchMode && pendingDeleteCount > 0"
            type="button"
            class="lk-batch-card__btn lk-batch-card__btn--warn"
            @click="cancelAllDeletes"
          >
            取消删除 ({{ pendingDeleteCount }})
          </button>
        </div>

        <p v-if="message" class="lk-batch-card__msg">{{ message }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.lk-batch-sidebar-card {
  list-style: none;
  margin: 1rem 0;
  padding: 0;
}

.lk-batch-card {
  background: #f6f8fa;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0.75rem;
  font-size: 0.85rem;
}

[data-theme='dark'] .lk-batch-card {
  background: #1e293b;
  border-color: #64748b;
}

.lk-batch-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #d1d5db;
}

[data-theme='dark'] .lk-batch-card__head {
  border-bottom-color: #64748b;
}

.lk-batch-card__title {
  font-weight: 600;
  color: #1f2937;
}

[data-theme='dark'] .lk-batch-card__title {
  color: #f1f5f9;
}

.lk-batch-card__count {
  font-size: 0.75rem;
  color: #374151;
  background: #e5e7eb;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

[data-theme='dark'] .lk-batch-card__count {
  background: #475569;
  color: #e2e8f0;
}

.lk-batch-card__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.lk-batch-card__single {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lk-batch-card__actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.lk-batch-card__row {
  display: flex;
  gap: 0.4rem;
}

.lk-batch-card__btn {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  border: 1px solid #9ca3af;
  background: #fff;
  color: #1f2937;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}

[data-theme='dark'] .lk-batch-card__btn {
  background: #334155;
  border-color: #64748b;
  color: #f1f5f9;
}

.lk-batch-card__btn:hover:not(:disabled) {
  background: #f3f4f6;
}

[data-theme='dark'] .lk-batch-card__btn:hover:not(:disabled) {
  background: #475569;
}

.lk-batch-card__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lk-batch-card__btn--primary {
  background: #4a90d9;
  border-color: #4a90d9;
  color: #fff;
}

[data-theme='dark'] .lk-batch-card__btn--primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

.lk-batch-card__btn--primary:hover {
  background: #357abd;
}

[data-theme='dark'] .lk-batch-card__btn--primary:hover {
  background: #2563eb;
}

.lk-batch-card__btn--warn {
  background: #fef3c7;
  border-color: #fcd34d;
  color: #92400e;
  margin-top: 0.5rem;
}

[data-theme='dark'] .lk-batch-card__btn--warn {
  background: #78350f;
  border-color: #fbbf24;
  color: #fef3c7;
}

.lk-batch-card__btn--warn:hover {
  background: #fde68a;
}

[data-theme='dark'] .lk-batch-card__btn--warn:hover {
  background: #92400e;
}

.lk-batch-card__btn--small {
  padding: 0.3rem 0.5rem;
  font-size: 0.75rem;
}

.lk-batch-card__btn--delete {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

[data-theme='dark'] .lk-batch-card__btn--delete {
  background: #7f1d1d;
  border-color: #f87171;
  color: #fca5a5;
}

.lk-batch-card__btn--delete:hover:not(:disabled) {
  background: #fecaca;
}

[data-theme='dark'] .lk-batch-card__btn--delete:hover:not(:disabled) {
  background: #991b1b;
}

.lk-batch-card__btn--print {
  background: #dbeafe;
  border-color: #93c5fd;
  color: #2563eb;
}

[data-theme='dark'] .lk-batch-card__btn--print {
  background: #1e3a5f;
  border-color: #60a5fa;
  color: #93c5fd;
}

.lk-batch-card__btn--print:hover:not(:disabled) {
  background: #bfdbfe;
}

[data-theme='dark'] .lk-batch-card__btn--print:hover:not(:disabled) {
  background: #1e40af;
}

.lk-batch-card__btn--cancel {
  margin-top: 0.2rem;
  font-size: 0.75rem;
}

.lk-batch-card__msg {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: #6b7280;
}

[data-theme='dark'] .lk-batch-card__msg {
  color: #9ca3af;
}
</style>
