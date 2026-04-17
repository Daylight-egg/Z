/**
 * AI 总结模块的 API 连接逻辑
 */

/**
 * 获取模型列表
 * @param apiurl API 端点
 * @param key API Key
 * @returns 模型名称数组
 */
export async function fetchModels(apiurl: string, key?: string): Promise<string[]> {
  try {
    // @ts-ignore
    const models = await getModelList({ apiurl, key });
    return models;
  } catch (e) {
    console.error('[AI] Fetch models failed:', e);
    throw e;
  }
}

/**
 * 测试 AI 连接
 * @param config 包含 endpoint, key, model 的配置对象
 * @returns 测试结果文本
 */
export async function testAiConnection(config: { endpoint: string, key: string, model?: string }): Promise<string> {
  const testInput = '请原样回复：“API已连接成功”';
  
  try {
    const parentWin = (window.parent as any);
    const generateConfig: any = {
      user_input: testInput,
      should_silence: true,
      max_chat_history: 1, 
      custom_api: {
        apiurl: config.endpoint,
        key: config.key,
        model: config.model || '',
        source: 'openai'
      },
      overrides: {
        system_prompt: 'You are an AI assistant. Please reply as requested.',
      }
    };

    // 尝试从父窗口获取当前激活角色
    try {
      if (parentWin && parentWin.selected_character !== undefined && parentWin.characters && parentWin.characters[parentWin.selected_character]) {
        const char = parentWin.characters[parentWin.selected_character];
        generateConfig.character_id = char.id || char.name;
        generateConfig.overrides.char_name = char.name;
      } else {
        generateConfig.overrides.char_name = 'One-Tester';
      }
    } catch (e) {
      generateConfig.overrides.char_name = 'One-Tester';
    }

    // @ts-ignore
    const result = await generateRaw(generateConfig);
    return typeof result === 'string' ? result : JSON.stringify(result);
  } catch (e) {
    console.error('[AI] Connection test failed:', e);
    throw e;
  }
}
