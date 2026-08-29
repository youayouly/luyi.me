import { ref } from 'vue'

/**
 * 留言正文草稿：只存内存，不进 localStorage。
 * 站内切页面（Vue Router 不刷新整页）时这个模块只加载一次，草稿还在；
 * 整页刷新会重新执行模块顶层代码，草稿随之清空——这是用户要的行为，
 * 和 GuestbookBoard 里靠 localStorage 长期记住的昵称/邮箱是两回事。
 */
export const guestbookDraft = ref('')
