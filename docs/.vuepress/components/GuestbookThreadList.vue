<template>
  <section class="lk-gb__list">
    <h2 v-if="title" class="lk-gb__list-title">{{ title }}</h2>
    <p v-if="loading" class="lk-gb__state">{{ loadingText }}</p>
    <p v-else-if="loadError" class="lk-gb__state lk-gb__state--bad">{{ loadError }}</p>
    <p v-else-if="!threads.length" class="lk-gb__state">{{ emptyText }}</p>

    <article v-for="thread in threads" :key="thread.id" class="lk-gb__thread">
      <div class="lk-gb__item">
        <span class="lk-gb__avatar" :class="{ 'lk-gb__avatar--owner': thread.owner }">
          <img
            v-if="avatarOf(thread) && !failedAvatars.has(thread.id)"
            :src="avatarOf(thread)"
            alt=""
            loading="lazy"
            @error="failedAvatars.add(thread.id)"
          />
          <span v-else data-lk-no-translate>{{ initial(thread.nick) }}</span>
        </span>

        <div class="lk-gb__body">
          <header class="lk-gb__meta">
            <component
              :is="thread.site ? 'a' : 'span'"
              class="lk-gb__nick no-external-link-icon"
              :href="thread.site || undefined"
              :target="thread.site ? '_blank' : undefined"
              :rel="thread.site ? 'nofollow noopener noreferrer' : undefined"
              data-lk-no-translate
              >{{ thread.nick }}</component
            >
            <span v-if="thread.owner" class="lk-gb__badge">站长</span>
            <span v-if="thread.verified" class="lk-gb__badge lk-gb__badge--ok">已验证</span>
            <span v-if="thread.private" class="lk-gb__badge lk-gb__badge--quiet">悄悄话</span>
            <span v-if="placeOf(thread)" class="lk-gb__place" data-lk-no-translate>{{ placeOf(thread) }}</span>
            <span class="lk-gb__date" :title="thread.at">{{ formatDate(thread.at) }}</span>
          </header>

          <div v-if="thread.redacted" class="lk-gb__redacted">这是一条悄悄话，只有站长看得到。</div>
          <div v-else class="lk-gb__content" data-lk-no-translate v-html="thread.html" />

          <footer class="lk-gb__actions">
            <span class="lk-gb__reacts">
              <button
                v-for="emoji in REACTIONS"
                :key="emoji"
                class="lk-gb__react"
                :class="{ 'lk-gb__react--on': hasReacted(thread.id, emoji) }"
                type="button"
                @click="$emit('react', thread, emoji)"
              >
                <span aria-hidden="true">{{ emoji }}</span>
                <span v-if="thread.reactions && thread.reactions[emoji]" data-lk-no-translate>{{ thread.reactions[emoji] }}</span>
              </button>
            </span>
            <button class="lk-gb__link-btn" type="button" @click="$emit('reply', thread)">回复</button>
            <button
              v-if="isLoggedIn"
              class="lk-gb__link-btn lk-gb__link-btn--danger"
              type="button"
              @click="$emit('remove', thread)"
            >
              删除
            </button>
            <span v-if="isLoggedIn && thread.contact" class="lk-gb__admin-note" data-lk-no-translate>
              {{ thread.contact }} · {{ thread.device }}
            </span>
          </footer>
        </div>
      </div>

      <div v-for="reply in thread.replies" :key="reply.id" class="lk-gb__item lk-gb__item--reply">
        <span class="lk-gb__avatar" :class="{ 'lk-gb__avatar--owner': reply.owner }">
          <img
            v-if="avatarOf(reply) && !failedAvatars.has(reply.id)"
            :src="avatarOf(reply)"
            alt=""
            loading="lazy"
            @error="failedAvatars.add(reply.id)"
          />
          <span v-else data-lk-no-translate>{{ initial(reply.nick) }}</span>
        </span>
        <div class="lk-gb__body">
          <header class="lk-gb__meta">
            <component
              :is="reply.site ? 'a' : 'span'"
              class="lk-gb__nick no-external-link-icon"
              :href="reply.site || undefined"
              :target="reply.site ? '_blank' : undefined"
              :rel="reply.site ? 'nofollow noopener noreferrer' : undefined"
              data-lk-no-translate
              >{{ reply.nick }}</component
            >
            <span v-if="reply.owner" class="lk-gb__badge">站长</span>
            <span v-if="reply.verified" class="lk-gb__badge lk-gb__badge--ok">已验证</span>
            <span v-if="placeOf(reply)" class="lk-gb__place" data-lk-no-translate>{{ placeOf(reply) }}</span>
            <span class="lk-gb__date" :title="reply.at">{{ formatDate(reply.at) }}</span>
          </header>
          <div v-if="reply.redacted" class="lk-gb__redacted">这是一条悄悄话，只有站长看得到。</div>
          <div v-else class="lk-gb__content" data-lk-no-translate v-html="reply.html" />
          <footer class="lk-gb__actions">
            <span class="lk-gb__reacts">
              <button
                v-for="emoji in REACTIONS"
                :key="emoji"
                class="lk-gb__react"
                :class="{ 'lk-gb__react--on': hasReacted(reply.id, emoji) }"
                type="button"
                @click="$emit('react', reply, emoji)"
              >
                <span aria-hidden="true">{{ emoji }}</span>
                <span v-if="reply.reactions && reply.reactions[emoji]" data-lk-no-translate>{{ reply.reactions[emoji] }}</span>
              </button>
            </span>
            <button class="lk-gb__link-btn" type="button" @click="$emit('reply', thread)">回复</button>
            <button
              v-if="isLoggedIn"
              class="lk-gb__link-btn lk-gb__link-btn--danger"
              type="button"
              @click="$emit('remove', reply)"
            >
              删除
            </button>
          </footer>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
/**
 * 留言列表的纯展示组件。留言板拆成左（悄悄话）右（公开）两栏后，两边共用这一份
 * 渲染逻辑；样式没有搬到这个文件里，仍然在 GuestbookBoard.vue 的不带 scoped
 * 的 <style> 块里，全局选择器，这边的 DOM 一样吃得到，不用再复制一份 CSS。
 */
defineProps({
  title: { type: String, default: '' },
  threads: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  loadError: { type: String, default: '' },
  loadingText: { type: String, default: '正在读取留言…' },
  emptyText: { type: String, default: '' },
  isLoggedIn: { type: Boolean, default: false },
  avatarOf: { type: Function, required: true },
  initial: { type: Function, required: true },
  placeOf: { type: Function, required: true },
  formatDate: { type: Function, required: true },
  hasReacted: { type: Function, required: true },
  failedAvatars: { type: Object, required: true },
})

defineEmits(['react', 'reply', 'remove'])

/** 和服务端 docs/api/guestbook.js 里的 REACTIONS 白名单一一对应，改一边要改两边 */
const REACTIONS = ['👍', '🎉', '🤝', '😂']
</script>
