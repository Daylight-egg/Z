import { createApp } from 'vue';
import App from './App.vue';
import { teleportStyle } from '../../util/script';

const BUTTON_NAME = '目录';
const ROOT_ID = 'contents-app-root';

async function init() {
  // 1. 幂等性检查：防止在某些环境下脚本重复执行导致的多次挂载
  if (window.parent.document.getElementById(ROOT_ID)) {
    console.log(`%c[Contents] 容器 #${ROOT_ID} 已存在，跳过初始化。`, 'color: #666;');
    return;
  }

  console.log('%c[Contents] 正在进行跨窗口 UI 挂载...', 'color: #007bff; font-weight: bold;');

  // 2. 样式传送：将沙箱内的 CSS 传送到酒馆主页面
  let destroyStyle = () => {};
  try {
    // @ts-ignore
    const teleport = teleportStyle(window.parent.document.head);
    destroyStyle = teleport.destroy;
  } catch (e) {
    console.warn('[Contents] 样式传送异常:', e);
  }

  // 3. 跨窗口挂载容器
  const container = window.parent.document.createElement('div');
  container.id = ROOT_ID;
  window.parent.document.body.appendChild(container);

  const app = createApp(App);
  let vm: any;
  try {
    vm = app.mount(container) as any;
  } catch (mountErr) {
    console.error('[Contents] Vue 应用挂载失败:', mountErr);
    return;
  }

  // 4. 注册销毁逻辑
  $(window).on('pagehide', () => {
    try {
      app.unmount();
      container.remove();
      destroyStyle();
    } catch (e) {}
  });

  // 5. 注册按钮与事件
  const setupInterface = () => {
    try {
      // @ts-ignore
      if (typeof replaceScriptButtons === 'undefined' || typeof eventOn === 'undefined') {
        throw new Error('TavernHelper 接口未就绪');
      }

      // @ts-ignore
      replaceScriptButtons([{ name: BUTTON_NAME, visible: true }]);

      // @ts-ignore
      const eventType = getButtonEvent(BUTTON_NAME);

      // @ts-ignore
      eventOn(eventType, () => {
        if (vm && typeof vm.toggleUI === 'function') {
          vm.toggleUI();
        } else {
           console.warn('[Contents] UI 切换函数未映射');
        }
      });

      console.log(`%c[Contents] 按钮 [${BUTTON_NAME}] 注册成功`, 'color: #28a745;');
    } catch (err) {
      console.error('[Contents] 注册过程发生错误，500ms 后重试:', err);
      setTimeout(setupInterface, 500);
    }
  };

  setupInterface();
}

// 启动保证
$(() => {
  // 确保父环境可访问
  try {
    if (window.parent && window.parent.document && window.parent.document.body) {
      init();
    } else {
      console.error('[Contents] 无法获取父窗口 Body，挂载失败');
    }
  } catch (e) {
    console.error('[Contents] 跨域限制或父窗口未就绪:', e);
  }
});
