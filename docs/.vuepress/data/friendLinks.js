/**
 * 友链数据。**同一份数据喂两个地方**：
 *   - 「关于我」侧栏的 FriendLinks 卡片（窄列表）
 *   - 「留言板」左栏的友链墙（宽卡片网格，写在 GuestbookBoard.vue 里）
 * 两边都为空时各自显示一行文案，不放占位卡。
 * 申请规则写在留言板右边栏，改规则去 GuestbookBoard.vue。
 *
 * 单条字段：
 *   - id     必填，唯一标识
 *   - name   必填，显示名
 *   - url    必填，跳转外链
 *   - desc   可选，一句话简介
 *   - avatar 可选，图片路径；不填则用首字头像
 */
export const friendLinks = [
  {
    id: 'ntkk',
    name: 'ntkk.net',
    url: 'https://ntkk.net/login',
    /* ntkk.net 对跨站直接拉取(hotlink)favicon 有 Referer 校验，非同源请求一律 403，
       所以这份图标不能像其它友链那样直接引用对方域名，改成下载后自己托管的一份静态拷贝。 */
    avatar: '/gallery/friend-ntkk-favicon.png',
  },
]
