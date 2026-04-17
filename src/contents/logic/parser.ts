import YAML from 'yaml';

export interface AiModuleData {
  floor: number;
  title?: string;
  summary?: string;
  time?: string;
  location?: string;
  characters?: string;
  [key: string]: any; // Allow for other extensible modules
}

/**
 * 解析 AI 返回的格式化文本
 * 格式示例:
 * <ai_directory floor="10">
 * title: "章节标题"
 * summary: "剧情总结"
 * </ai_directory>
 */
export function parseAiDirectoryBlocks(text: string): AiModuleData[] {
  const results: AiModuleData[] = [];
  // 匹配 <ai_directory floor="N">...</ai_directory>
  const blockRegex = /<ai_directory\s+floor=["']?(\d+)["']?>([\s\S]*?)<\/ai_directory>/g;
  
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    const floor = parseInt(match[1], 10);
    // 预处理：统一将全角冒号、引号等标准化，确保 YAML 解析成功率
    const yamlContent = match[2].trim()
      .replace(/：/g, ':')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
    
    try {
      // 解析内部的 YAML 键值对
      const data = YAML.parse(yamlContent);
      if (data && typeof data === 'object') {
        results.push({
          floor,
          ...data
        });
      }
    } catch (e) {
      console.warn(`[Parser] Failed to parse YAML at floor ${floor}:`, e);
      // 如果 YAML 解析失败，尝试手动解析
      const fallbackData: any = { floor };
      yamlContent.split('\n').forEach(line => {
        // 使用正则分割，兼容中英文冒号
        const parts = line.split(/[:：]/);
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
          fallbackData[key] = value;
        }
      });
      results.push(fallbackData);
    }
  }
  
  return results;
}
