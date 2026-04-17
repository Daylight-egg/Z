import _ from 'lodash';

/**
 * 获取持久化的设置与规则
 */
export async function loadPersistence() {
  try {
    // @ts-ignore
    const settings = getVariables({ type: 'script' });
    // @ts-ignore
    const chatVars = getVariables({ type: 'chat' });
    
    return {
      settings: settings.settings || null,
      rules: settings.rules || null,
      aiSummary: chatVars.one_ai_summary || null
    };
  } catch (e) {
    console.error('[Persistence] Load failed:', e);
    return null;
  }
}

/**
 * 保存全局设置与规则 (存储在 script 变量中)
 */
export function saveGlobalPersistence(data: { settings?: any, rules?: any }) {
  try {
    // @ts-ignore
    updateVariablesWith((vars) => {
      if (data.settings) vars.settings = data.settings;
      if (data.rules) vars.rules = data.rules;
      return vars;
    }, { type: 'script' });
  } catch (e) {
    console.error('[Persistence] Save global failed:', e);
  }
}

/**
 * 保存聊天特定的 AI 总结 (存储在 chat 变量中)
 */
export function saveChatPersistence(summary: any) {
  try {
    const data = { one_ai_summary: summary };
    // @ts-ignore
    insertOrAssignVariables(data, { type: 'chat' });
  } catch (e) {
    console.error('[Persistence] Save chat failed:', e);
  }
}
