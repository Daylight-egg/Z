import _ from 'lodash';

export interface DirectoryItem {
  id: string;
  text: string;
  floor: number;
  level: number;
  metadata?: any; // To store XML/YAML parsed modules (Title, Summary, etc.)
}

/**
 * 构建目录结构
 * @param rules 用户自定义的正则规则
 * @param isAiMode 是否处于 AI 模式
 * @param mapping AI 组件映射配置 (仅 AI 模式需要)
 * @returns 扁平化的目录项数组
 */
export function buildDirectory(rules: any[], isAiMode: boolean = false, mapping: any = {}): DirectoryItem[] {
  try {
    // 1. 获取最新楼层 ID
    // @ts-ignore
    const lastId = (typeof getLastMessageId !== 'undefined' ? getLastMessageId() : (window.parent as any).getLastMessageId?.() || 0);
    
    // 2. 获取全量可见消息（需要扫描全量消息查看是否有元数据）
    // @ts-ignore
    const allMessages = getChatMessages(`0-${lastId}`, { 
      hide_state: 'unhidden' 
    });
    
    const directory: DirectoryItem[] = [];

    if (isAiMode) {
      // AI 模式：从消息对象的变量系统提取 (msg.data.one_ext_data)
      allMessages.forEach((msg: any) => {
        const rawData = msg.data?.one_ext_data || msg.one_ext_data;
        if (!rawData) return;

        // 统一转为数组处理，支持未来的多块扩展，同时也兼容单块
        const dataBlocks = Array.isArray(rawData) ? rawData : [rawData];

        dataBlocks.forEach((data, index) => {
          const suffix = dataBlocks.length > 1 ? `-${index}` : '';
          
          // --- 无锚点动态提取逻辑 ---
          const splitItems: { key: string; level: number }[] = [];
          
          // 遍历消息块中所有可能的键
          Object.keys(data).forEach(key => {
            if (key === 'floor' || key === 'level' || key.endsWith('_level')) return;
            
            // 获取该键在设置中的样式映射
            const mapCfg = mapping[key];
            const style = (typeof mapCfg === 'object' ? mapCfg.style : mapCfg) || 'auto';
            
            // 只有 Header 类型的键才会被提取到目录
            if (style === 'header') {
              // 层级判定优先级：
              // 1. data[key + '_level'] (AI 显式指定)
              // 2. mapCfg.level (设置中预设的该键层级)
              // 3. data.level (本块全局层级回退)
              // 4. 默认 1
              let lvl = parseInt(data[key + '_level']);
              if (isNaN(lvl)) {
                lvl = (typeof mapCfg === 'object' ? mapCfg.level : 0) || parseInt(data.level) || 1;
              }
              
              splitItems.push({ key, level: lvl });
            }
          });

          // 如果没有被明确映射为 Header 的键，但存在数据，则执行“保底提取”
          if (splitItems.length === 0) {
            // 找到第一个非内置字段作为兜底标题
            const firstValidKey = Object.keys(data).find(k => 
              k !== 'floor' && k !== 'level' && !k.endsWith('_level') && k !== 'summary'
            );
            if (firstValidKey) {
              const fallbackLvl = parseInt(data[firstValidKey + '_level']) || parseInt(data.level) || 1;
              splitItems.push({ key: firstValidKey, level: fallbackLvl });
            } else if (data.summary) {
              // 连自定义键都没有，才退回到 summary
              const fallbackLvl = parseInt(data.level) || 1;
              splitItems.push({ key: 'summary', level: fallbackLvl });
            }
          }

          // 按层级从浅到深排序，确保渲染顺序正确
          const sortedItems = splitItems.sort((a, b) => a.level - b.level);

          sortedItems.forEach((config, idx) => {
            const isLeaf = idx === sortedItems.length - 1;
            directory.push({
              id: `ai-${msg.message_id}${suffix}-${config.key}`,
              text: data[config.key] || (isLeaf ? (data.summary?.slice(0, 10) || '未命名章节') : ''),
              floor: msg.message_id,
              level: config.level,
              // 逻辑：只有该楼层的“最深层级”项才显示全部元数据（摘要、标签等）
              // 非最深层级仅显示自己的标识键，实现“只显示标题”的要求
              metadata: isLeaf 
                ? Object.fromEntries(Object.entries(data).filter(([k]) => {
                    // 如果某个键已经被本楼层更上层的项显示过了，则在叶子节点排除它，避免重复标题
                    const shownIndex = splitItems.findIndex(si => si.key === k);
                    return shownIndex === -1 || shownIndex === idx;
                  }))
                : { [config.key]: data[config.key] }
            });
          });
        });
      });
    } else {
      // 基础模式：遍历助手消息进行正则提取
      const enabledRules = rules.filter(r => r.enabled);
      if (enabledRules.length === 0) return [];

      allMessages.forEach((msg: any) => {
        // 基础正则通常只针对助理消息提取目录
        if (msg.role !== 'assistant') return;

        enabledRules.forEach(rule => {
          try {
            const regex = new RegExp(rule.pattern, 'gs'); // 增加 s 标志支持多行
            const matches = msg.message.matchAll(regex);
            
            for (const match of matches) {
              const text = rule.captureGroup > 0 ? match[rule.captureGroup] : match[0];
              if (text) {
                directory.push({
                  id: `${msg.message_id}-${rule.id}-${match.index}`,
                  text: text.trim(),
                  floor: msg.message_id,
                  level: rule.level
                });
              }
            }
          } catch (e) { }
        });
      });
    }

    // 3. 按楼层排序
    return directory.sort((a, b) => a.floor - b.floor);
    
  } catch (e) {
    console.error('[Directory] Build failed:', e);
    return [];
  }
}

/**
 * 跳转至指定楼层并高亮
 * @param floor 楼层号
 * @param showHighlight 是否显示高亮特效 (默认开启)
 */
export async function jumpToFloor(floor: number, showHighlight: boolean = true) {
  const logPrefix = `[One-Jump] [Floor ${floor}]`;
  console.log(`${logPrefix} Starting...`);

  try {
    // 跨窗口环境适配：所有酒馆原生对象均应从 window.parent 获取
    const parentWin = window.parent as any;
    const parentDoc = parentWin.document;

    // 1. 尝试获取 DOM 元素
    // @ts-ignore
    let $mes = parentWin.retrieveDisplayedMessage ? parentWin.retrieveDisplayedMessage(floor) : retrieveDisplayedMessage(floor);
    
    // 2. 如果 DOM 不存在 (由于离屏卸载或高楼层折叠导致)，则执行区间渲染
    if (!$mes || $mes.length === 0) {
      console.log(`${logPrefix} Not found in DOM, initiating virtual range render.`);
      
      // 获取全量消息
      // @ts-ignore
      let allChat = parentWin.chat || (parentWin.SillyTavern && parentWin.SillyTavern.chat);
      if (!allChat || !allChat.length) {
        console.log(`${logPrefix} window.chat is unavailable, fallback to API.`);
        // @ts-ignore
        const lastId = getLastMessageId();
        // @ts-ignore
        allChat = getChatMessages(`0-${lastId}`);
      }

      const totalMessages = allChat ? allChat.length : 0;
      if (totalMessages === 0 || floor >= totalMessages) {
        throw new Error(`Invalid floor index: ${floor}/${totalMessages}`);
      }

      const start = Math.max(0, floor - 4);
      const end = Math.min(totalMessages - 1, floor + 4);

      // 清除当前 DOM
      const chatContainer = parentDoc.getElementById('chat');
      if (chatContainer) {
        chatContainer.innerHTML = '';
      }

      const builtinObj = parentWin.builtin || (typeof builtin !== 'undefined' ? builtin : null);

      if (!builtinObj) {
        throw new Error('Builtin renderer not found');
      }

      // 手动逐条渲染包含目标楼层的区间
      for (let i = start; i <= end; i++) {
        const msg = allChat[i];
        if (!msg) continue;

        // 核心兼容性修复：映射消息内容字段
        if (msg.message && !msg.mes) msg.mes = msg.message;
        if (msg.mes && !msg.message) msg.message = msg.mes;

        // @ts-ignore
        builtinObj.addOneMessage(msg, { forceId: i });
        
        // 发送渲染事件
        // @ts-ignore
        const eventType = msg.role === 'user' || msg.is_user ? 'user_message_rendered' : 'character_message_rendered';
        // @ts-ignore
        const emitter = parentWin.eventEmit || (typeof eventEmit !== 'undefined' ? eventEmit : null);
        if (emitter) emitter(eventType, i);
      }
      
      // 重新获取 DOM
      // @ts-ignore
      $mes = parentWin.retrieveDisplayedMessage ? parentWin.retrieveDisplayedMessage(floor) : retrieveDisplayedMessage(floor);
    }

    if ($mes && $mes.length > 0) {
      console.log(`${logPrefix} Success. Scrolling into view.`);
      
      const el = $mes.get(0);
      // 策略：立即滚动一次，并于 150ms 后再次强制滚动。
      // 这是为了应对某些酒馆设置（如“开头自动滚动至消息尾部”）导致的冲突。
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
      
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        console.log(`${logPrefix} Reinforced scroll applied.`);
      }, 150);

      if (showHighlight) {
        $mes.addClass('one-highlight');
        setTimeout(() => $mes.removeClass('one-highlight'), 3000);
      }
      return true;
    } else {
      console.warn(`${logPrefix} Still not found after render.`);
      // 发送警告，考虑跨窗口 toastr
      const toast = parentWin.toastr || (typeof toastr !== 'undefined' ? toastr : null);
      if (toast) toast.warning(`无法定位楼层 ${floor}，请重试`);
      return false;
    }
  } catch (e) {
    console.error(`${logPrefix} Critical error:`, e);
    return false;
  }
}
