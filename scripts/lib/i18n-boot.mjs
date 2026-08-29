/**
 * 首屏语言：让服务器发出去的 HTML 本身就是英文。
 *
 * 为什么不再走「发中文 + 上屏前换掉」那条路：
 * 那段脚本注在 `</body>` 前，前提是「body 解析完 = 还没绘制」。这个前提只在快机器上
 * 成立。实测 www.luyi.me（干净配置，默认英文）：HTML 本体 172ms 就下完了，但解析
 * 走到文件末尾要到 domInteractive —— 桌面不限速 243ms（早于 FCP 500ms，确实不闪），
 * 4G+2×CPU 是 1103ms 而 FCP 只有 476ms，慢 3G+4×CPU 是 3329ms 而 FCP 1668ms。
 * 也就是慢一点的设备上首屏画的就是中文，脚本要 630ms ~ 1.7s 之后才换掉。
 *
 * 现在改成 `localizeHtml()` 在构建期直接把 dist 里的中文换成英文，浏览器拿到的第一帧
 * 就是英文，客户端连一趟替换都不用跑。两个前提都验过：
 * 1. **hydration 不会把英文改回中文**。VuePress 把 markdown 编译成 static vnode，
 *    hydration 只认领现有 DOM、不比对文本。实测首屏 42 个节点里只有 1 个被改回去
 *    （那个是运行时才算出来的动态文案，本来就走 pageLang 双语那条路）。
 * 2. 切回中文要能还原。本脚本把「译文 -> 原文」表挂在 `window.__LK_I18N_BOOT__.rev`，
 *    `pageTranslate.js` 的 `adoptBootReverse()` 收进 `bootReverse`，`restoreAll()`
 *    遍历全文按译文查回原文 —— 这条路本来就是给「照抄英文 DOM 的 TOC」准备的，
 *    对整页英文同样成立。
 *
 * 明确选了中文的访客拿到的也是英文 HTML，所以本脚本要在解析期把它换回去：注在
 * `<head>`，用 MutationObserver 在节点被解析出来的当帧就换掉（微任务检查点早于绘制），
 * 不能再等 `</body>` —— 那正是上面被证伪的那个前提。
 *
 * ## 英文访客也要这个 observer（上面第 1 条前提只对静态 vnode 成立）
 *
 * 「hydration 不会把英文改回中文」只对 markdown 编译出来的 static vnode 成立。
 * 主题的导航栏、站名、跳转链接、首页推荐卡这些是**组件渲染**的，hydration 会照着
 * 客户端 bundle 里的中文把文本 patch 回去。实测线上首页（4×CPU + 4G、冷缓存）：
 * 首屏 0 个中文 → hydration 在 6670ms 把 26 处改回中文 → 直到 9707ms 词典
 * (`/i18n/en.json`，46KB，慢网下要 4.4s) 到手才换回英文，**整整 3 秒的中文**。
 * 缓存命中时这个窗口是 ~950ms，也还是看得见。
 *
 * 根因是运行时那条路要等一个网络请求，而 hydration 不等。所以英文访客这边把反查表
 * 倒过来当正查表用（`R` 是「译文 -> 原文」，`D` 取它的逆），hydration 改一处就在
 * 当帧换回一处 —— 数据是内联的，零请求、零等待。observer 一直留到
 * `pageTranslate.js` 接手（`B.stop()`），之后由它的词典和增量扫描负责。
 */

/** 与 pageTranslate.js 的 SKIP_SELECTOR 保持一致，两边改要一起改。 */
const SKIP_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'code',
  'pre',
  'kbd',
  'samp',
  'svg',
  'canvas',
  'iframe',
  'textarea',
  '[contenteditable]',
  '[data-lk-no-translate]',
  '.lk-no-translate',
  '.katex',
  '.lk-particles-nav-item',
  '#live2d-widget',
  '.home-typewriter-tagline',
].join(',')

export const BOOT_SCRIPT_ID = 'lk-i18n-boot'

/** 重复注入会越滚越大，写之前先按这个把上一版整段摘掉。 */
export const BOOT_SCRIPT_RE = new RegExp(
  `<script id="${BOOT_SCRIPT_ID}"[\\s\\S]*?<\\/script>`,
  'g',
)

/** 标在 <html> 上：构建产物已经是这个语言了，重跑本脚本不要再翻一遍。 */
export const LOCALIZED_ATTR = 'data-lk-i18n'

/**
 * @param {Record<string,string>} rev 本页「译文 -> 原文」，只含真正换过的条目
 * @param {string} target 目标语言，与 translatePref.js 的 DEFAULT_TARGET_LANG 一致
 */
export function renderBootScript(rev, target = 'en') {
  // 语言判定必须和 translatePref.js 的 readLangMode/resolveLang 一模一样：
  // 没存过 -> 默认英文；存了 auto -> 跟浏览器；存了 zh/en 是明确选择。
  const body = `(function(){try{
var M=null;try{M=localStorage.getItem('lk-page-lang')}catch(e){}
var L=(M==='zh'||M==='${target}')?M:(M==='auto'?((navigator.languages&&navigator.languages[0]||navigator.language||'').toLowerCase().indexOf('zh')===0?'zh':'${target}'):'${target}');
var H=document.documentElement;H.setAttribute('data-lk-lang',L);H.lang=L==='zh'?'zh-CN':L;
var R=${JSON.stringify(rev)};
var B={lang:L,rev:R,done:false};window.__LK_I18N_BOOT__=B;
var S=${JSON.stringify(SKIP_SELECTOR)};
var D=R;if(L!=='zh'){D={};for(var k in R)D[R[k]]=k}
function T(n){var r=n.nodeValue;if(!r)return;var k=r.trim();if(!k)return;var v=D[k];if(!v)return;
var p=n.parentElement;if(p&&p.closest(S))return;n.nodeValue=r.replace(k,v);}
function W(n){if(n.nodeType===3)return T(n);if(n.nodeType!==1)return;
var w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT),x;while(x=w.nextNode())T(x);}
/* 浏览器内置翻译（Edge 的 Microsoft Translator）给译出的元素打 _msttexthash / _msthash，
   Google 翻译给 <html> 加 translated-ltr。它们译成中文，而中文正是本表的 key，
   两边会互相改到卡死 —— 见到任一标记就收手。只查节点自身 / 直接父元素，
   不做 querySelector：这条是首屏热路径。 */
function X(e){return !!(e&&e.nodeType===1&&e.hasAttribute&&(e.hasAttribute('_msttexthash')||e.hasAttribute('_msthash')))}
/* A: DOMContentLoaded 后才置 1。解析期回调本来就密，熔断不能在那时生效。
   熔断本身与翻译器无关：在 observer 回调里改 DOM 会再排一个微任务，
   两边对着改就是一个不给渲染留帧的微任务死循环，数次到阈就得让路。 */
var A=0,C=0,Z=0;
var O=new MutationObserver(function(rs){if(B.done){O.disconnect();return}
if(A){if((H.className+'').indexOf('translated-')>=0){B.stop();return}
var t=Date.now();if(t-Z>1000){Z=t;C=0}if(++C>150){B.stop();return}}
for(var i=0;i<rs.length;i++){var r=rs[i];
if(r.type==='characterData'){if(X(r.target.parentElement)){B.stop();return}T(r.target);continue}
for(var j=0;j<r.addedNodes.length;j++){var a=r.addedNodes[j];
if(X(a)){B.stop();return}
W(a);}}});
O.observe(document,{childList:true,subtree:true,characterData:true});
B.stop=function(){B.done=true;O.disconnect()};
document.addEventListener('DOMContentLoaded',function(){A=1;if(L==='zh')B.stop();if(document.body)W(document.body);},{once:true});
}catch(e){}})();`

  return `<script id="${BOOT_SCRIPT_ID}">${body}</script>`
}
