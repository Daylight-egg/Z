<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { loadPersistence, saveGlobalPersistence } from './logic/persistence';
import { buildDirectory, jumpToFloor, type DirectoryItem } from './logic/directory';
import { fetchModels, testAiConnection } from './logic/ai';
import { parseAiDirectoryBlocks, type AiModuleData } from './logic/parser';

// --- UI State ---
const isVisible = ref(false);
const currentView = ref('main'); // 'main' or 'settings'
const currentTab = ref('panel'); // 'base', 'ai', 'panel'
const aiSubTab = ref('api'); // 'regex', 'prompt', 'api'
const showTutorial = ref(false);
const showFilterMenu = ref(false);
const panelSubTab = ref('display'); // 'display' or 'custom'
const currentCustomComponent = ref('container'); // 当前正在调试的组件

// --- Mode State ---
const isAllExpanded = ref(true);
const isApiFormExpanded = ref(false); // 控制 API 配置表单折叠

// --- Settings State (Draft vs Applied) ---
// settings: 修改中的草稿态
const initialSettings = {
  settings: {
    highlight: true,
    autoExtractInterval: 0,
    mode: 'drawer-right',
    width: '400px',
    height: '100%',
    aiConfig: {
      isAiMode: false,
      activeProfileId: 'default',
      profiles: [{ id: 'default', name: '默认配置', endpoint: '', key: '', model: '', models: [] }],
      regexRules: [
        { id: 'pres-1', name: '总结标签提取', pattern: '<summary>([\\s\\S]*?)</summary>', captureGroup: 1, mode: 'include', enabled: true, isExpanded: false }
      ],
      promptMessages: [
        { id: 'pm-1', name: '系统指令', role: 'system', content: `## 角色设定
你是一位精通小说编排与叙事结构的文学解析助手。你的任务是分析提供的聊天片段，并将其组织成具有“卷 (Volume)”和“章 (Chapter)”层级感的动态目录。

## 编排逻辑 (极其重要)
1. **层级意识**：
   - AI 现在可以完全自由决定键名和层级。
   - **分级输出**：若需要输出多个层级的标题（如卷、章），请使用多个键，并为每个标题键附带一个 \`_level\` 字段明确指定层级。
2. **拟定标题**：为每一楼层生成具有小说感的标题。

## 输出格式要求 (必需)
每一个输出块必须使用以下 XML 格式包裹，内部使用 YAML 键值对：

<ai_directory floor="对应的楼层号">
vol: "第一卷"
vol_level: 1
title: "第一章"
title_level: 2
summary: "综述内容..."
</ai_directory>`, isExpanded: true },
        { id: 'pm-2', name: '提取内容', role: 'user', content: '## 历史编排回顾 (上下文)\n{{context}}\n\n## 当前待解析楼层：\n{{messages}}', isExpanded: true }
      ],
      moduleMapping: {
        vol: { style: 'header', level: 1 },
        title: { style: 'header', level: 2 },
        summary: { style: 'block', level: 0 }
      },
      contextFloorCount: 5,
      batchSize: 50,
      uiCustomization: {
        expandedSections: [], // 默认所有折叠区收起
        container: { paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12, marginTop: 0, marginBottom: 8, marginLeft: 0, marginRight: 0, itemGap: 8, borderRadius: 8, showBorderTop: true, showBorderBottom: true, showBorderLeft: true, showBorderRight: true, borderWidth: 1, borderStyle: 'solid', borderColor: '', bgColor: '', accentColor: '' },
        header: { paddingTop: 2, paddingBottom: 2, paddingLeft: 10, paddingRight: 6, marginTop: 0, marginBottom: 0, marginLeft: -12, marginRight: 0, itemGap: 0, borderRadius: 0, fontSize: 1.0, fontWeight: 700, lineHeight: 1.2, textColor: '', isItalic: false, underlineStyle: 'none', showBorderTop: false, showBorderBottom: false, showBorderLeft: true, showBorderRight: false, borderWidth: 3, borderStyle: 'solid', borderColor: '', bgColor: '', accentColor: '' },
        block: { paddingTop: 4, paddingBottom: 4, paddingLeft: 4, paddingRight: 4, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, itemGap: 0, borderRadius: 0, fontSize: 0.88, fontWeight: 400, lineHeight: 1.7, textColor: '', isItalic: false, underlineStyle: 'none', showBorderTop: false, showBorderBottom: false, showBorderLeft: false, showBorderRight: false, borderWidth: 1, borderStyle: 'solid', borderColor: '', bgColor: '', accentColor: '' },
        quote: { paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, itemGap: 0, borderRadius: 8, fontSize: 0.88, fontWeight: 400, lineHeight: 1.6, textColor: '', isItalic: true, underlineStyle: 'none', showBorderTop: false, showBorderBottom: false, showBorderLeft: false, showBorderRight: false, borderWidth: 1, borderStyle: 'solid', borderColor: '', bgColor: 'rgba(255,255,255,0.02)', accentColor: '' },
        pill: { paddingTop: 2, paddingBottom: 2, paddingLeft: 8, paddingRight: 8, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, itemGap: 4, borderRadius: 12, fontSize: 0.75, fontWeight: 400, lineHeight: 1.2, textColor: '', isItalic: false, underlineStyle: 'none', showBorderTop: false, showBorderBottom: false, showBorderLeft: false, showBorderRight: false, borderWidth: 1, borderStyle: 'solid', borderColor: '', bgColor: 'rgba(255,255,255,0.05)', accentColor: '' },
        attr: { paddingTop: 2, paddingBottom: 2, paddingLeft: 8, paddingRight: 8, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, itemGap: 4, borderRadius: 12, fontSize: 0.75, fontWeight: 400, lineHeight: 1.2, textColor: '', isItalic: false, underlineStyle: 'none', showBorderTop: false, showBorderBottom: false, showBorderLeft: false, showBorderRight: false, borderWidth: 1, borderStyle: 'solid', borderColor: '', bgColor: '', accentColor: '' },
        progress: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0, marginTop: 8, marginBottom: 8, marginLeft: 0, marginRight: 0, itemGap: 0, borderRadius: 10, fontSize: 0.8, fontWeight: 400, lineHeight: 1.2, textColor: '', isItalic: false, underlineStyle: 'none', showBorderTop: false, showBorderBottom: false, showBorderLeft: false, showBorderRight: false, borderWidth: 0, borderStyle: 'solid', borderColor: '', bgColor: 'rgba(0,0,0,0.2)', accentColor: '' }
      }
    }
  }
};

const DEFAULT_UI = JSON.parse(JSON.stringify(initialSettings.settings.aiConfig.uiCustomization));

const settings = ref({ ...initialSettings.settings });

// appliedSettings: 实际作用于 UI 的应用态
const appliedSettings = ref({ ...settings.value });

const baseRules = ref([
  { id: '1', name: "卷名规则", pattern: "【(.*?)卷：(.*?)】", level: 1, captureGroup: 0, enabled: true, isExpanded: false },
  { id: '2', name: "章节规则", pattern: "第(.*?)章[：\\s](.*?)", level: 2, captureGroup: 0, enabled: true, isExpanded: false }
]);

const isSortAsc = ref(true);
const directoryItems = ref<DirectoryItem[]>([]); // This will store basic regex results
const aiDirectoryItems = ref<any[]>([]); // This will store AI generated results separately
const searchQuery = ref('');

// --- Filter & Sort states for Rules ---
const ruleFilter = ref<'all' | 'enabled' | 'disabled'>('all');
const ruleSort = ref<'none' | 'level'>('none');

// --- Collapse state for Directory ---
const collapsedVols = ref<Set<string>>(new Set());
const toggleVol = (id: string) => {
  if (collapsedVols.value.has(id)) collapsedVols.value.delete(id);
  else collapsedVols.value.add(id);
};

// --- AI API State ---
const showApiKey = ref(false);
const isTesting = ref(false);
const isGenerating = ref(false); 
const testResult = ref<{ success?: boolean, text: string } | null>(null);
const activePickerKey = ref<string | null>(null); // 控制当前展开哪个键的样式拾取器

const activeProfile = computed(() => {
  const cfg = settings.value.aiConfig;
  return cfg.profiles.find(p => p.id === cfg.activeProfileId) || cfg.profiles[0];
});

// --- Methods ---
const updateDirectory = () => {
  directoryItems.value = buildDirectory(baseRules.value);
  aiDirectoryItems.value = buildDirectory(settings.value.aiConfig.regexRules, true, settings.value.aiConfig.moduleMapping);
};

const isAiMode = computed({
  get: () => settings.value.aiConfig.isAiMode,
  set: (val) => {
    settings.value.aiConfig.isAiMode = val;
    saveSettings(true); // 手动切换模式时立即静默保存
  }
});

const filteredDirectory = computed(() => {
  let list = isAiMode.value ? [...aiDirectoryItems.value] : [...directoryItems.value];
  if (searchQuery.value) {
    list = list.filter(item => item.text.toLowerCase().includes(searchQuery.value.toLowerCase()));
  }
  
  // Apply sorting: first by floor (according to preference), then by level (ascending) for same-floor items
  list = list.sort((a, b) => {
    if (a.floor !== b.floor) return isSortAsc.value ? (a.floor - b.floor) : (b.floor - a.floor);
    return a.level - b.level;
  });
  
  // 1. Detect if an item has children (next item has deeper level)
  const itemsWithMeta = list.map((item, index) => {
    const nextItem = list[index + 1];
    const hasChildren = nextItem ? (nextItem.level > item.level) : false;
    return { ...item, hasChildren, isCollapsed: collapsedVols.value.has(item.id) };
  });

  // 2. Apply folding: Hide children of any collapsed parent recursively
  const visibleItems: any[] = [];
  let hideBelowLevel = 999;

  itemsWithMeta.forEach(item => {
    // If we've returned to a level higher or equal to the collapsed one, stop hiding
    if (item.level <= hideBelowLevel) {
      hideBelowLevel = 999;
    }

    if (item.level <= hideBelowLevel) {
      visibleItems.push(item);
      // If this item itself is collapsed, hide everything deeper than it
      if (item.isCollapsed) {
        hideBelowLevel = item.level;
      }
    }
  });

  return visibleItems;
});

const availableModules = computed(() => {
  const keys = new Set<string>();
  aiDirectoryItems.value.forEach(item => {
    if (item.metadata) {
      Object.keys(item.metadata).forEach(k => {
        // 排除元数据中的层级和楼层控制字段
        if (k !== 'floor' && k !== 'level') keys.add(k);
      });
    }
  });
  
  // 保持一个稳定的排序，防止 UI 闪烁
  return Array.from(keys).sort();
});

const toggleAllExpansion = () => {
  if (isAllExpanded.value) {
    collapseAll();
  } else {
    expandAll();
  }
  isAllExpanded.value = !isAllExpanded.value;
};

const expandAll = () => {
  collapsedVols.value.clear();
};

const collapseAll = () => {
  const list = isAiMode.value ? aiDirectoryItems.value : directoryItems.value;
  list.forEach((item, index) => {
    // 检查后一项是否层级更深，若是则当前项为可折叠父项
    const next = list[index + 1];
    if (next && next.level > item.level) {
      collapsedVols.value.add(item.id);
    }
  });
};

const manualRefresh = () => {
  updateDirectory();
  // @ts-ignore
  toastr.info(isAiMode.value ? '已从角色变量重新读取总结' : '目录已刷新');
};

const filteredRules = computed(() => {
  let list = [...baseRules.value];
  if (ruleFilter.value === 'enabled') list = list.filter(r => r.enabled);
  if (ruleFilter.value === 'disabled') list = list.filter(r => !r.enabled);
  if (ruleSort.value === 'level') list.sort((a,b) => a.level - b.level);
  return list;
});

const addRule = () => {
  const newId = Date.now().toString();
  baseRules.value.push({
    id: newId,
    name: "新规则",
    pattern: "",
    level: 2,
    captureGroup: 0,
    enabled: true,
    isExpanded: true
  });
  baseRules.value.forEach(r => { if (r.id !== newId) r.isExpanded = false; });
};

const removeRule = (id: string) => {
  baseRules.value = baseRules.value.filter(r => r.id !== id);
};

const toggleRuleExpansion = (targetRule: any) => {
  const targetState = !targetRule.isExpanded;
  baseRules.value.forEach(r => r.isExpanded = false);
  targetRule.isExpanded = targetState;
};

const copyCode = (text: string) => {
  // @ts-ignore
  builtin.copyText(text);
  // @ts-ignore
  toastr.success('正则已复制到剪贴板');
};

/**
 * 获取指定 Key 的最终渲染样式
 */
const getMappedStyle = (key: string, value: any): string => {
  const mapping = settings.value.aiConfig.moduleMapping || {};
  const item = mapping[key];
  let style = (typeof item === 'object' ? item.style : item) || 'auto';

  if (style === 'auto') {
    if (key.toLowerCase().includes('title') || key.toLowerCase().includes('chapter')) return 'header';
    const strVal = String(value);
    if (strVal.length > 30) return 'block';
    if (/^\d+(\.\d+)?[\/\%]\d*$/.test(strVal)) return 'progress';
    return 'pill';
  }
  return style;
};

const getMappedLevel = (key: string): number => {
  const mapping = settings.value.aiConfig.moduleMapping || {};
  const item = mapping[key];
  if (typeof item === 'object' && item.level !== undefined) return item.level;
  
  // Legacy compatibility / Defaults
  if (key === 'vol') return 1;
  if (key === 'title') return 2;
  return 0; // 0 means not a directory item
};

/**
 * 设置某个 Key 的样式 (直接赋值)
 */
const setModuleStyle = (key: string, style: string) => {
  const mapping = settings.value.aiConfig.moduleMapping || {};
  const current = mapping[key] || {};
  
  // Update or migrate to object structure
  if (typeof current === 'string') {
    mapping[key] = { style, level: getMappedLevel(key) };
  } else {
    mapping[key] = { ...current, style };
  }
  
  settings.value.aiConfig.moduleMapping = { ...mapping };
  // Header styles should not automatically collapse picker as user might want to pick level
  if (style !== 'header') activePickerKey.value = null; 
  saveSettings(true);
};

const setModuleLevel = (key: string, level: number) => {
  const mapping = settings.value.aiConfig.moduleMapping || {};
  const current = mapping[key];
  
  if (typeof current === 'string') {
    mapping[key] = { style: current, level };
  } else {
    mapping[key] = { ...(current || { style: 'auto' }), level };
  }
  
  settings.value.aiConfig.moduleMapping = { ...mapping };
  saveSettings(true);
};

const resetUiSettings = () => {
  settings.value.aiConfig.uiCustomization = { ...DEFAULT_UI };
  saveSettings(true);
  // @ts-ignore
  toastr.success('UI 样式已恢复默认');
};

const clearColor = (key: 'accentColor' | 'textColor' | 'bgColor') => {
  if (settings.value.aiConfig.uiCustomization[currentCustomComponent.value]) {
    settings.value.aiConfig.uiCustomization[currentCustomComponent.value][key] = '';
    saveSettings(true);
  }
};

// --- Lab Persistence & Logic ---
const toggleSection = (section: string) => {
  const ui = settings.value.aiConfig.uiCustomization;
  if (!ui.expandedSections) ui.expandedSections = [];
  
  const index = ui.expandedSections.indexOf(section);
  if (index === -1) {
    ui.expandedSections.push(section);
  } else {
    ui.expandedSections.splice(index, 1);
  }
  // 静默保存折叠状态
  saveSettings(true);
};

const dynamicAiStyles = computed(() => {
  // 改为监听 settings 而非 appliedSettings，实现实验室关卡的“实时预览”效果
  const cfg = settings.value?.aiConfig;
  if (!cfg || !cfg.uiCustomization) return {};
  
  const ui = cfg.uiCustomization;
  const styles: any = {};

  // 1. Accent Color (Global Context Variable)
  const container = ui.container || DEFAULT_UI.container || {};
  styles['--one-accent-color'] = container.accentColor || 'var(--SmartThemeChatTintColor, #007bff)';

  // 2. 自动化映射 7 个组件的所有属性为 CSS 变量
  const comps = ['container', 'header', 'block', 'quote', 'pill', 'attr', 'progress'] as const;
  
  comps.forEach(comp => {
    const c = ui[comp] || DEFAULT_UI[comp] || {};
    const prefix = `--one-${comp === 'container' ? 'c' : comp === 'progress' ? 'pr' : comp[0]}`;

    if (!c) return;

    styles[`${prefix}-pt`] = `${c.paddingTop ?? 0}px`;
    styles[`${prefix}-pb`] = `${c.paddingBottom ?? 0}px`;
    styles[`${prefix}-pl`] = `${c.paddingLeft ?? 0}px`;
    styles[`${prefix}-pr`] = `${c.paddingRight ?? 0}px`;
    
    styles[`${prefix}-mt`] = `${c.marginTop ?? 0}px`;
    styles[`${prefix}-mb`] = `${c.marginBottom ?? 0}px`;
    styles[`${prefix}-ml`] = `${c.marginLeft ?? 0}px`;
    styles[`${prefix}-mr`] = `${c.marginRight ?? 0}px`;

    styles[`${prefix}-gap`] = `${c.itemGap ?? 0}px`;
    styles[`${prefix}-br`] = `${c.borderRadius ?? 0}px`;
    
    styles[`${prefix}-fs`] = `${c.fontSize ?? 1}rem`;
    styles[`${prefix}-fw`] = c.fontWeight ?? 400;
    styles[`${prefix}-lh`] = c.lineHeight ?? 1.5;
    styles[`${prefix}-tc`] = c.textColor || (comp === 'quote' ? 'var(--SmartThemeEmColor)' : 'var(--SmartThemeBodyColor)');
    
    styles[`${prefix}-btw`] = c.showBorderTop ? `${c.borderWidth ?? 1}px` : '0px';
    styles[`${prefix}-bbw`] = c.showBorderBottom ? `${c.borderWidth ?? 1}px` : '0px';
    styles[`${prefix}-blw`] = c.showBorderLeft ? `${c.borderWidth ?? 1}px` : '0px';
    styles[`${prefix}-brw`] = c.showBorderRight ? `${c.borderWidth ?? 1}px` : '0px';
    
    styles[`${prefix}-bs`] = c.borderStyle || 'solid';
    styles[`${prefix}-bc`] = c.borderColor || (comp === 'container' || comp === 'header' ? 'var(--one-accent-color)' : 'var(--SmartThemeBorderColor, rgba(255,255,255,0.1))');
    
    styles[`${prefix}-bg`] = c.bgColor || (comp === 'container' ? 'var(--SmartThemeChatTintColor, rgba(255, 255, 255, 0.03))' : 'transparent');

    // Font Style & Decoration
    styles[`${prefix}-fsy`] = c.isItalic ? 'italic' : 'normal';
    styles[`${prefix}-td`] = (c.underlineStyle && c.underlineStyle !== 'none') ? `underline ${c.underlineStyle}` : 'none';
  });

  return styles;
});

/**
 * 获取样式对应的图标
 */
const getStyleIcon = (style: string) => {
  switch (style) {
    case 'auto': return 'fa-wand-magic-sparkles';
    case 'header': return 'fa-heading';
    case 'block': return 'fa-align-left';
    case 'quote': return 'fa-quote-left';
    case 'pill': return 'fa-capsules';
    case 'attr': return 'fa-rectangle-list';
    case 'progress': return 'fa-bars-progress';
    case 'hidden': return 'fa-eye-slash';
    default: return 'fa-tag';
  }
};

/**
 * 获取元数据键对应的图标 (用于胶囊标签渲染)
 */
const getModuleIcon = (key: string) => {
  const k = key.toLowerCase();
  if (k.includes('time') || k.includes('时间')) return 'fa-clock';
  if (k.includes('loc') || k.includes('地点') || k.includes('位置')) return 'fa-location-dot';
  if (k.includes('char') || k.includes('人物') || k.includes('角色')) return 'fa-users';
  if (k.includes('event') || k.includes('事件')) return 'fa-bolt';
  if (k.includes('item') || k.includes('物品')) return 'fa-box';
  return 'fa-tag';
};

/**
 * 解析进度值并生成 CSS 宽度
 */
const getProgressWidth = (val: string) => {
  if (!val) return '0%';
  const s = String(val);
  // 处理百分比: "80%"
  if (s.includes('%')) return s;
  // 处理分数: "5/10"
  if (s.includes('/')) {
    const [cur, total] = s.split('/').map(Number);
    if (!isNaN(cur) && !isNaN(total) && total > 0) {
      return `${Math.min(100, (cur / total) * 100)}%`;
    }
  }
  // 处理数字: "0.5"
  const num = Number(s);
  if (!isNaN(num) && num <= 1 && num >= 0) return `${num * 100}%`;
  return '0%';
};
const addAiProfile = () => {
  const newId = Date.now().toString();
  settings.value.aiConfig.profiles.push({
    id: newId,
    name: `新配置 ${settings.value.aiConfig.profiles.length + 1}`,
    endpoint: '',
    key: '',
    model: '',
    models: []
  });
  settings.value.aiConfig.activeProfileId = newId;
  isApiFormExpanded.value = true; // 新增配置时自动展开
};

const removeAiProfile = (id: string) => {
  const cfg = settings.value.aiConfig;
  if (cfg.profiles.length <= 1) {
    // @ts-ignore
    toastr.warning('至少需要保留一个配置');
    return;
  }
  const index = cfg.profiles.findIndex(p => p.id === id);
  if (index !== -1) {
    cfg.profiles.splice(index, 1);
    if (cfg.activeProfileId === id) {
      cfg.activeProfileId = cfg.profiles[0].id;
    }
  }
};

const resetPrompts = () => {
  // @ts-ignore
  if (confirm('确认要重置所有提示词指令吗？这将覆盖你当前的自定义修改。')) {
    settings.value.aiConfig.promptMessages = JSON.parse(JSON.stringify(initialSettings.settings.aiConfig.promptMessages));
    // @ts-ignore
    toastr.success('提示词已重置为小说编排模式');
  }
};

const handleFetchModels = async () => {
  if (!activeProfile.value.endpoint) {
    // @ts-ignore
    toastr.error('请先填写 API 地址');
    return;
  }
  try {
    const models = await fetchModels(activeProfile.value.endpoint, activeProfile.value.key);
    activeProfile.value.models = models;
    // @ts-ignore
    toastr.success(`成功获取 ${models.length} 个模型`);
  } catch (e) {
    // @ts-ignore
    toastr.error('获取模型列表失败，请检查配置');
  }
};

// --- AI Regex Rules ---
const addAiRegexRule = () => {
  const newId = Date.now().toString();
  settings.value.aiConfig.regexRules.push({
    id: newId,
    name: "新正则规则",
    pattern: "",
    captureGroup: 0,
    mode: 'exclude',
    enabled: true,
    isExpanded: true
  });
  settings.value.aiConfig.regexRules.forEach(r => { if (r.id !== newId) r.isExpanded = false; });
};

const confirmResetPrompts = () => {
  if (confirm('确定要恢复初始提示词吗？当前的所有修改都将丢失。')) {
    settings.value.aiConfig.promptMessages = JSON.parse(JSON.stringify(initialSettings.settings.aiConfig.promptMessages));
    toastr.success('提示词已恢复初始化');
  }
};

const removeAiRegexRule = (id: string) => {
  settings.value.aiConfig.regexRules = settings.value.aiConfig.regexRules.filter(r => r.id !== id);
};

const toggleAiRegexRuleExpansion = (targetRule: any) => {
  const targetState = !targetRule.isExpanded;
  settings.value.aiConfig.regexRules.forEach(r => r.isExpanded = false);
  targetRule.isExpanded = targetState;
};

// --- AI Prompt Orchestration ---
const addPromptMessage = () => {
  const newId = Date.now().toString();
  settings.value.aiConfig.promptMessages.push({
    id: newId,
    name: '新消息项',
    role: 'user',
    content: '',
    isExpanded: true
  });
};

const removePromptMessage = (id: string) => {
  settings.value.aiConfig.promptMessages = settings.value.aiConfig.promptMessages.filter(m => m.id !== id);
};

const movePromptMessage = (index: number, direction: 'up' | 'down') => {
  const msgs = settings.value.aiConfig.promptMessages;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= msgs.length) return;
  const temp = msgs[index];
  msgs[index] = msgs[targetIndex];
  msgs[targetIndex] = temp;
};

/**
 * 提取指定范围内的聊天内容用于总结
 * @param startFloor 起始楼层 ID (含)
 * @param endFloor 结束楼层 ID (含)
 */
const getExtractedContent = (startFloor?: number, endFloor?: number) => {
  try {
    // 1. 获取范围参数
    // @ts-ignore
    const lastId = (typeof getLastMessageId !== 'undefined' ? getLastMessageId() : (window.parent as any).getLastMessageId?.() || 0);
    
    const rangeStart = startFloor ?? 0;
    const rangeEnd = endFloor ?? lastId;

    // 2. 通过官方接口获取聊天数据
    // @ts-ignore
    let chat = (typeof getChatMessages !== 'undefined' ? getChatMessages(`${rangeStart}-${rangeEnd}`) : (window.parent as any).getChatMessages?.(`${rangeStart}-${rangeEnd}`));
    
    if (!chat || chat.length === 0) return '(尚未捕捉到任何聊天内容)';

    const rules = settings.value.aiConfig.regexRules.filter(r => r.enabled);
    let resultBlocks: string[] = [];

    chat.forEach((msg: any) => {
      const floor = msg.message_id !== undefined ? msg.message_id : 0; 
      const rawText = msg.message || msg.mes || '';
      if (!rawText || typeof rawText !== 'string') return;

      let currentText = rawText;
      let matchesAtThisFloor: string[] = [];

      rules.forEach(rule => {
        try {
          const regex = new RegExp(rule.pattern, 'gs');
          if (rule.mode === 'include') {
            const matches = [...currentText.matchAll(regex)];
            matches.forEach(m => {
              const val = m[rule.captureGroup] || m[0];
              if (val) matchesAtThisFloor.push(val);
            });
            currentText = ''; 
          } else {
            currentText = currentText.replace(regex, '');
          }
        } catch (e) { }
      });
      
      if (currentText.trim() && rules.every(r => r.mode !== 'include')) {
        matchesAtThisFloor.push(currentText.trim());
      }

      if (matchesAtThisFloor.length > 0) {
        resultBlocks.push(`<summary floor="${floor}">\n${matchesAtThisFloor.join('\n')}\n</summary>`);
      }
    });

    return resultBlocks.join('\n').trim() || '(匹配结果为空)';
  } catch (e) {
    console.warn('[One] Extract failure:', e);
    return `(提取失败: ${e})`;
  }
};

/**
 * 获取最近 n 个已总结的章节作为上下文
 */
const getRecentSummaries = (n: number, beforeFloor: number) => {
  try {
    const maxBefore = Math.max(0, beforeFloor - 1);
    // 当起始楼层为 0 时直接返回，避免 getChatMessages("0--1") 导致回环
    if (beforeFloor === 0) return '(无前文总结)';

    // @ts-ignore
    const allMessages = getChatMessages(`0-${maxBefore}`);
    if (!allMessages || allMessages.length === 0) return '(无前文总结)';

    const summarized = allMessages
      .filter((msg: any) => {
        const mid = msg.message_id !== undefined ? Number(msg.message_id) : -1;
        // 确保楼层严格早于当前总结起始楼层
        return mid < beforeFloor && (msg.data?.one_ext_data || msg.one_ext_data);
      })
      .slice(-n)
      .map((msg: any) => {
        const data = msg.data?.one_ext_data || msg.one_ext_data;
        const fields = Object.entries(data)
          .filter(([key]) => key !== 'floor')
          .map(([key, val]) => `${key}: ${val}`)
          .join('\n');
        return `<ai_directory floor="${msg.message_id}">\n${fields}\n</ai_directory>`;
      });

    return summarized.length > 0 ? summarized.join('\n') : '(无前文总结)';
  } catch (e) {
    return '(上下文提取失败)';
  }
};

const showPreview = ref(false);
const previewPayload = computed(() => {
  const content = getExtractedContent();
  // 模拟之前楼层的上下文预览
  // @ts-ignore
  const lastId = (typeof getLastMessageId !== 'undefined' ? getLastMessageId() : (window.parent as any).getLastMessageId?.() || 0);
  const context = getRecentSummaries(settings.value.aiConfig.contextFloorCount || 5, lastId);

  return settings.value.aiConfig.promptMessages.map(m => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content
      .replace(/{{messages}}/g, content)
      .replace(/{{context}}/g, context)
  }));
});

const handleTestConnection = async () => {
  isTesting.value = true;
  testResult.value = null;

  try {
    const config = {
      endpoint: activeProfile.value.endpoint,
      key: activeProfile.value.key,
      model: activeProfile.value.model
    };
    const result = await testAiConnection(config);
    testResult.value = { success: true, text: result };
    // @ts-ignore
    toastr.success('连接测试成功');
  } catch (e) {
    testResult.value = { success: false, text: String(e) };
    // @ts-ignore
    toastr.error('连接测试失败');
  } finally {
    isTesting.value = false;
  }
};

/**
 * 触发 AI 总结并分批处理
 * @param isManual 是否由用户手动触发
 */
const triggerAiSummary = async (isManual = true) => {
  if (!activeProfile.value.endpoint) {
    if (isManual) toastr.error('请先配置 AI API 设置');
    return;
  }

  try {
    // 1. 获取全量消息并筛选未总结部分
    // @ts-ignore
    const lastId = (typeof getLastMessageId !== 'undefined' ? getLastMessageId() : (window.parent as any).getLastMessageId?.() || 0);
    // @ts-ignore
    const allMessages = getChatMessages(`0-${lastId}`);
    if (!allMessages || allMessages.length === 0) return;

    // 识别尚未总结的楼层
    const unsummarizedFloors = allMessages
      .filter((msg: any) => !(msg.data?.one_ext_data || msg.one_ext_data))
      .map((msg: any) => msg.message_id ?? 0);

    if (unsummarizedFloors.length === 0) {
      if (isManual) {
        const defaultRange = `${Math.max(0, lastId - 50)}-${lastId}`;
        const range = prompt('所有楼层均已存在总结，请输入需要重新生成的楼层范围 (例如 0-50):', defaultRange);
        
        if (range) {
          let start: number, end: number;
          if (range.includes('-')) {
            [start, end] = range.split('-').map(Number);
          } else {
            start = end = Number(range);
          }

          if (!isNaN(start) && !isNaN(end)) {
            isGenerating.value = true;
            toastr.info(`开始处理楼层 ${start === end ? start : start + ' 至 ' + end} 的总结...`);
            await executeSummaryBatch(start, end);
            toastr.success('总结生成完成');
            // 稍作延迟确保酒馆助手变量同步完成
            setTimeout(() => {
              updateDirectory();
            }, 200);
          }
        }
      }
      return;
    }

    // 2. 分批调度
    const batchSize = settings.value.aiConfig.batchSize || 50;
    
    if (isManual && unsummarizedFloors.length > batchSize) {
      if (!confirm(`检测到共有 ${unsummarizedFloors.length} 楼层未总结，将分为 ${Math.ceil(unsummarizedFloors.length / batchSize)} 批处理，是否继续？`)) {
        return;
      }
    }

    isGenerating.value = true;
    if (isManual) toastr.info(`正在分批处理中 (0/${unsummarizedFloors.length})...`);

    // 按照 batchSize 切分楼层范围
    for (let i = 0; i < unsummarizedFloors.length; i += batchSize) {
      const batchIds = unsummarizedFloors.slice(i, i + batchSize);
      const start = batchIds[0];
      const end = batchIds[batchIds.length - 1];
      
      await executeSummaryBatch(start, end);
      
      if (isManual) {
        const progress = Math.min(i + batchSize, unsummarizedFloors.length);
        toastr.info(`进度更新: ${progress}/${unsummarizedFloors.length}`);
      }
    }

    if (isManual) toastr.success('AI 总结处理完成');
    setTimeout(() => {
      updateDirectory();
    }, 200);
  } catch (e) {
    console.error('[One] Summary Error:', e);
    if (isManual) toastr.error('执行总结时发生错误');
  } finally {
    isGenerating.value = false;
  }
};

/**
 * 执行单个批次的总结
 */
const executeSummaryBatch = async (startFloor: number, endFloor: number) => {
  const content = getExtractedContent(startFloor, endFloor);
  const context = getRecentSummaries(settings.value.aiConfig.contextFloorCount || 5, startFloor);
  
  const orderedPrompts = settings.value.aiConfig.promptMessages.map(m => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content
      .replace(/{{messages}}/g, content)
      .replace(/{{context}}/g, context)
  }));

  const config: any = {
    ordered_prompts: orderedPrompts,
    should_silence: true,
    custom_api: {
      apiurl: activeProfile.value.endpoint,
      key: activeProfile.value.key,
      model: activeProfile.value.model,
      source: 'openai'
    }
  };

  // @ts-ignore
  const result = await generateRaw(config);
  const rawText = typeof result === 'string' ? result : (result?.choices?.[0]?.message?.content || JSON.stringify(result));
  
  const parsedDataBlocks = parseAiDirectoryBlocks(rawText);
  if (parsedDataBlocks.length > 0) {
    let hasNewModules = false;
    for (const block of parsedDataBlocks) {
      // 自动检测新出现的模块并默认开启
      Object.keys(block).forEach(key => {
        if (!['floor', 'level', 'title'].includes(key) && !settings.value.aiConfig.visibleModules.includes(key)) {
          settings.value.aiConfig.visibleModules.push(key);
          hasNewModules = true;
        }
      });
      await saveAiDataToChat(block.floor, block);
    }
    if (hasNewModules) {
      saveSettings(true); 
    }
  } else {
    console.warn('[One] No valid directory blocks found in AI response');
  }
};

/**
 * 将解析出的 AI 数据存入酒馆聊天记录
 */
const saveAiDataToChat = async (floor: number, data: AiModuleData) => {
  try {
    console.log(`[One] Resetting and writing AI data to floor ${floor}:`, data);
    
    // 1. 先将旧数据显式设为 null，防止 insertOrAssignVariables 执行深度合并导致的旧字段残留
    // @ts-ignore
    await insertOrAssignVariables({ 
      one_ext_data: null 
    }, { 
      type: 'message', 
      message_id: floor 
    });

    // 2. 写入新数据
    // @ts-ignore
    await insertOrAssignVariables({ 
      one_ext_data: { ...data, floor }
    }, { 
      type: 'message', 
      message_id: floor 
    });
  } catch (e) {
    console.error(`[One] Failed to save variables to floor ${floor}`, e);
    // @ts-ignore
    toastr.error(`楼层 ${floor} 变量录入失败`);
  }
};

const loadInitialData = async () => {
  const data = await loadPersistence();
  if (data?.settings) {
    // 基础合并
    settings.value = { ...settings.value, ...data.settings };
    
    // 核心：深度确保 aiConfig 结构完整 (处理老版本迁移)
    if (!settings.value.aiConfig) {
      settings.value.aiConfig = { 
        activeProfileId: 'default', 
        profiles: [{ id: 'default', name: '默认配置', endpoint: '', key: '', model: '', models: [] }],
        regexRules: [],
        visibleModules: ['title', 'summary', 'time', 'location', 'characters']
      };
    } else {
      // 如果 aiConfig 存在但缺失新字段 (如 profiles 或 regexRules)
      if (!settings.value.aiConfig.profiles || settings.value.aiConfig.profiles.length === 0) {
        settings.value.aiConfig.profiles = [{ id: 'default', name: '默认配置', endpoint: '', key: '', model: '', models: [] }];
      }
      if (!settings.value.aiConfig.activeProfileId) {
        settings.value.aiConfig.activeProfileId = settings.value.aiConfig.profiles[0].id;
      }
      if (!settings.value.aiConfig.regexRules) {
        settings.value.aiConfig.regexRules = [
          { id: 'pres-1', name: '总结标签提取', pattern: '<summary>([\\s\\S]*?)</summary>', captureGroup: 1, mode: 'include', enabled: true, isExpanded: false }
        ];
      }
      if (!settings.value.aiConfig.promptMessages || settings.value.aiConfig.promptMessages.length === 0) {
        settings.value.aiConfig.promptMessages = initialSettings.settings.aiConfig.promptMessages;
      }
      if (!settings.value.aiConfig.visibleModules) {
        settings.value.aiConfig.visibleModules = ['title', 'summary', 'time', 'location', 'characters'];
      }
      if (settings.value.aiConfig.contextFloorCount === undefined) {
        settings.value.aiConfig.contextFloorCount = 5;
      }
      if (settings.value.aiConfig.batchSize === undefined) {
        settings.value.aiConfig.batchSize = 50;
      }
      
      // 核心：UI 自定义结构深度补全与迁移 (Tier 1.8 万能实验室补丁)
      const targetUi = JSON.parse(JSON.stringify(DEFAULT_UI));
      const userUi = settings.value.aiConfig.uiCustomization || {};
      
      // 检查是否是从最老的扁平结构迁移
      const isVeryOld = userUi.paddingTop !== undefined;
      
      Object.keys(targetUi).forEach((comp: string) => {
        if (comp === 'expandedSections') {
          // 数组字段特殊处理，确保加载后还是数组
          if (userUi[comp] && Array.isArray(userUi[comp])) {
            // 已有持久化数组，保留
          } else {
            userUi[comp] = [...targetUi[comp]];
          }
          return;
        }

        if (!userUi[comp]) {
          userUi[comp] = { ...targetUi[comp] };
        } else {
          // 深度合并属性
          Object.keys(targetUi[comp]).forEach(prop => {
            if (userUi[comp][prop] === undefined) {
              userUi[comp][prop] = targetUi[comp][prop];
            }
          });
        }
      });

      // 如果是老扁平结构，额外执行一次值映射
      if (isVeryOld) {
        userUi.container.paddingTop = userUi.paddingTop;
        userUi.container.paddingBottom = userUi.paddingBottom;
        userUi.container.borderRadius = userUi.borderRadius;
        userUi.header.fontSize = userUi.headerSize || 1.0;
        userUi.block.fontSize = userUi.fontSize || 0.88;
        // 清理旧字段
        ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderRadius', 'fontSize', 'headerSize'].forEach(k => delete userUi[k]);
      }

      settings.value.aiConfig.uiCustomization = userUi;
    }
    
    appliedSettings.value = { ...settings.value };
    // 如果是第一次加载，同步一下最后抓取长度，防止重复触发
    if (lastRefreshedLength.value === 0) {
      lastRefreshedLength.value = (typeof getChatMessages !== 'undefined' ? getChatMessages(`0-0`)?.length || 0 : 0);
    }
  }
  
  if (data?.rules) {
    baseRules.value = data.rules.map((r: any) => ({ ...r, isExpanded: false }));
  }
  if (data?.settings?.currentTab) currentTab.value = data.settings.currentTab;
  if (data?.settings?.isSortAsc !== undefined) isSortAsc.value = data.settings.isSortAsc;
  if (settings.value.autoExtractInterval === undefined) settings.value.autoExtractInterval = 0;
};

const lastRefreshedLength = ref(0);
const checkAutoRefresh = () => {
  try {
    // @ts-ignore
    const lastId = (typeof getLastMessageId !== 'undefined' ? getLastMessageId() : (window.parent as any).getLastMessageId?.() || 0);
    // @ts-ignore
    const chat = (typeof getChatMessages !== 'undefined' ? getChatMessages(`0-${lastId}`) : (window.parent as any).getChatMessages?.(`0-${lastId}`));
    
    const currentLength = chat?.length || 0;
    const interval = settings.value.autoExtractInterval;

    if (interval > 0 && currentLength > 0 && currentLength - lastRefreshedLength.value >= interval) {
      // 触发目录刷新
      updateDirectory();
      lastRefreshedLength.value = currentLength;
      
      // 如果处于 AI 模式，且满足自动总结条件，则静默触发总结
      if (isAiMode.value) {
        const unsummarizedCount = chat.filter((msg: any) => !(msg.data?.one_ext_data || msg.one_ext_data)).length;
        if (unsummarizedCount >= interval) {
          console.log('[One] Auto-triggering AI summary for', unsummarizedCount, 'floors');
          triggerAiSummary(false);
        }
      }
    }
  } catch (e) {}
};

onMounted(() => {
  loadInitialData();
  // 每 2 秒检查一次是否需要自动刷新
  setInterval(checkAutoRefresh, 2000);

  // 全局点击监听，关闭筛选菜单
  window.addEventListener('click', () => {
    showFilterMenu.value = false;
  });
});

// --- Persistence ---
const saveDebounceTimer = ref<any>(null);
const debouncedSaveRules = () => {
  if (saveDebounceTimer.value) clearTimeout(saveDebounceTimer.value);
  saveDebounceTimer.value = setTimeout(() => {
    // 剔除 UI 状态变量再存储
    const persistentRules = baseRules.value.map(({ isExpanded, ...rest }) => rest);
    saveGlobalPersistence({ rules: persistentRules });
  }, 800);
};

watch(baseRules, () => {
  debouncedSaveRules();
}, { deep: true });

watch([currentTab, isSortAsc], ([newTab, newSort]) => {
  saveGlobalPersistence({ 
    settings: { ...appliedSettings.value, currentTab: newTab, isSortAsc: newSort } 
  });
});

const handleJump = async (floor: number) => {
  await jumpToFloor(floor, appliedSettings.value.highlight);
  closeUI();
};
const toggleUI = () => {
  isVisible.value = !isVisible.value;
  if (isVisible.value) {
    settings.value = { ...appliedSettings.value };
    updateDirectory(); // 打开时扫描目录
  }
};

const closeUI = () => {
  isVisible.value = false;
};

const saveSettings = (silent = false) => {
  appliedSettings.value = { ...settings.value };
  console.log('One Extension: Settings Applied', appliedSettings.value);
  // 持久化到酒馆变量
  saveGlobalPersistence({
    settings: { 
      ...appliedSettings.value, 
      currentTab: currentTab.value, 
      isSortAsc: isSortAsc.value 
    }
  });
  // @ts-ignore
  if (!silent) toastr.success('设置保存成功');
};

// Expose toggle to the parent (index.ts)
defineExpose({ toggleUI });

</script>

<template>
  <div 
    v-show="isVisible" 
    class="one-overlay" 
    :class="{ 'no-flex': appliedSettings.mode.includes('drawer') }"
    @click.self="closeUI"
  >
    <div 
      class="one-panel" 
      :class="[appliedSettings.mode, { 'locked': isGenerating }]"
      :style="{ 
        width: appliedSettings.width, 
        height: appliedSettings.mode === 'modal' ? appliedSettings.height : '100vh' 
      }"
    >
      <!-- Loading Overlay -->
      <div v-if="isGenerating" class="generating-overlay">
        <div class="spinner-box">
          <i class="fa-solid fa-wand-magic-sparkles fa-spin spinner-icon"></i>
          <span class="loading-text">AI 正在努力归纳中...</span>
        </div>
      </div>
      
      <!-- MAIN VIEW -->
      <div v-if="currentView === 'main'" class="view-main">
        <div class="header sticky-header">
          <div class="search-bar mini">
            <input type="text" v-model="searchQuery" :placeholder="isAiMode ? '搜索总结...' : '搜索目录...'">
          </div>
          <div class="actions">
            <!-- Consolidated Expand/Collapse -->
            <button class="icon-btn sm" :title="isAllExpanded ? '全部折叠' : '全部展开'" @click="toggleAllExpansion">
              <i class="fa-solid" :class="isAllExpanded ? 'fa-square-minus' : 'fa-square-plus'"></i>
            </button>

            <!-- Mode Toggle (Basic <-> AI) -->
            <button class="icon-btn sm" :title="isAiMode ? '切换到基础目录' : '切换到 AI 目录'" @click="isAiMode = !isAiMode" :class="{ 'active-mode': isAiMode }">
              <i class="fa-solid" :class="isAiMode ? 'fa-robot' : 'fa-list-ul'"></i>
            </button>

            <!-- AI Mode Dedicated Icons -->
            <template v-if="isAiMode">
              <button class="icon-btn sm" title="模块筛选" @click.stop="showFilterMenu = !showFilterMenu" :class="{ 'active-mode': showFilterMenu }">
                <i class="fa-solid fa-layer-group"></i>
              </button>

              <!-- New Modular Mapper Dropdown (With Picker) -->
              <div v-if="showFilterMenu" class="filter-dropdown wide" @click.stop>
                <div class="filter-dropdown-title">AI 组件映射与美化</div>
                <div class="mapper-list">
                  <div v-for="key in availableModules" :key="key" class="mapper-row-container">
                    <div class="mapper-item" @click="activePickerKey = activePickerKey === key ? null : key">
                      <span class="mapper-key">{{ key }}</span>
                      <div class="style-preview">
                        <i class="fa-solid" :class="getStyleIcon(settings.aiConfig.moduleMapping?.[key] || 'auto')"></i>
                        <span class="style-name">{{ settings.aiConfig.moduleMapping?.[key] || 'auto' }}</span>
                      </div>
                    </div>
                    <!-- Picker Grid -->
                    <div v-if="activePickerKey === key" class="style-picker-grid-container">
                      <div class="style-picker-grid">
                        <div 
                          v-for="s in ['auto', 'header', 'block', 'quote', 'pill', 'attr', 'progress', 'hidden']" 
                          :key="s" 
                          class="picker-icon" 
                          :class="{ active: getMappedStyle(key, null) === s }"
                          @click="setModuleStyle(key, s)"
                          :title="s"
                        >
                          <i class="fa-solid" :class="getStyleIcon(s)"></i>
                        </div>
                      </div>
                      <!-- Level Selector (Only for headers) -->
                      <div v-if="getMappedStyle(key, null) === 'header'" class="level-picker">
                        <span class="level-label">层级:</span>
                        <div class="level-btn-group">
                          <button 
                            v-for="l in [1, 2, 3]" 
                            :key="l" 
                            class="level-btn"
                            :class="{ active: getMappedLevel(key) === l }"
                            @click="setModuleLevel(key, l)"
                          >
                            {{ l }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="filter-dropdown-footer">点击条目展开样式拾取器</div>
              </div>

              <button 
                class="icon-btn sm" 
                :class="{ 'pulse-active': isGenerating }"
                title="手动总结当前章节" 
                @click="triggerAiSummary"
                :disabled="isGenerating"
              >
                <i class="fa-solid" :class="isGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'"></i>
              </button>
            </template>

            <!-- Refresh Icon (Behavior context sensitive) -->
            <button 
              class="icon-btn sm" 
              :title="isAiMode ? '刷新 AI 状态' : '刷新正则提取'" 
              @click="updateDirectory"
            >
              <i class="fa-solid fa-rotate"></i>
            </button>

            <!-- Sort Toggle -->
            <button 
              class="icon-btn sm" 
              :title="isSortAsc ? '正序' : '倒序'"
              @click="isSortAsc = !isSortAsc"
            >
              <i class="fa-solid" :class="isSortAsc ? 'fa-arrow-down-a-z' : 'fa-arrow-up-z-a'"></i>
            </button>
            <button class="icon-btn sm" title="设置" @click="currentView = 'settings'"><i class="fa-solid fa-gear"></i></button>
          </div>
        </div>
        
        <div class="content">
          <div class="directory-list">
            <template v-if="!isAiMode">
              <div 
                v-for="item in filteredDirectory" 
                :key="item.id" 
                class="directory-item"
                :class="['level-' + item.level, { 'is-vol': item.level === 1 }]"
                @click="handleJump(item.floor)"
              >
                <!-- 展开折叠触发区 -->
                <div v-if="item.hasChildren" class="fold-trigger" @click.stop="toggleVol(item.id)">
                  <i class="fa-solid" :class="item.isCollapsed ? 'fa-square-plus' : 'fa-square-minus'"></i>
                </div>
                <i v-else class="fa-solid fa-file-lines" style="opacity: 0.3; margin-right: 4px; font-size: 0.8rem;"></i>
                
                <span class="item-text">{{ item.text }}</span>
                <span class="floor-badge">{{ item.floor }}</span>
              </div>
            </template>

            <!-- AI Modular View -->
            <template v-else>
              <div 
                v-for="item in filteredDirectory" 
                :key="item.id" 
                class="one-ai-item-container"
                :class="['level-' + (item.level || 1)]"
                :style="dynamicAiStyles"
                @click="handleJump(item.floor)"
              >
                <!-- Modular Rendering Engine (Tier 1.8 Universal) -->
                <div v-if="item.metadata" class="one-ai-grid">
                  
                  <div v-if="Object.entries(item.metadata).some(([k,v]) => ['header', 'block', 'quote'].includes(getMappedStyle(k, v)) && k !== 'floor' && k !== 'level')" class="one-ai-primary-zone">
                    <template v-for="(val, key) in item.metadata" :key="key">
                      <template v-if="['header', 'block', 'quote'].includes(getMappedStyle(key, val)) && key !== 'floor' && key !== 'level'">
                        
                        <!-- Header Style -->
                        <div v-if="getMappedStyle(key, val) === 'header'" class="one-style-header">
                          <div v-if="item.hasChildren" class="one-fold-trigger" @click.stop="toggleVol(item.id)">
                            <i class="fa-solid" :class="item.isCollapsed ? 'fa-square-plus' : 'fa-square-minus'"></i>
                          </div>
                          <div class="one-h-text">{{ val }}</div>
                          <div class="one-floor-badge-inline">#{{ item.floor }}</div>
                        </div>

                        <!-- Quote Style -->
                        <div v-else-if="getMappedStyle(key, val) === 'quote'" class="one-style-quote">
                          <i class="fa-solid fa-quote-left"></i>
                          <div class="one-q-text">{{ val }}</div>
                        </div>

                        <!-- Block Style -->
                        <div v-else-if="getMappedStyle(key, val) === 'block'" class="one-style-block">
                          {{ val }}
                        </div>
                      </template>
                    </template>
                  </div>

                  <!-- 2. Detail Components: Pills, Attrs, Progress -->
                  <div v-if="Object.entries(item.metadata).some(([k,v]) => ['pill', 'attr', 'progress'].includes(getMappedStyle(k, v)) && k !== 'floor' && k !== 'level')" class="one-ai-details-zone">
                    <template v-for="(val, key) in item.metadata" :key="key">
                      <template v-if="['pill', 'attr', 'progress'].includes(getMappedStyle(key, val)) && key !== 'floor' && key !== 'level'">
                        
                        <div v-if="getMappedStyle(key, val) === 'pill'" class="one-style-pill">
                           <i class="fa-solid" :class="getModuleIcon(key)"></i>
                           <span>{{ val }}</span>
                        </div>

                        <div v-else-if="getMappedStyle(key, val) === 'attr'" class="one-style-attr">
                           <span class="one-attr-key">{{ key }}:</span>
                           <span class="one-attr-val">{{ val }}</span>
                        </div>

                        <!-- Progress Style -->
                        <div v-else-if="getMappedStyle(key, val) === 'progress'" class="one-style-progress">
                          <div class="one-pr-label">
                            <span><i class="fa-solid fa-chart-line"></i> {{ key }}</span>
                            <span>{{ val }}</span>
                          </div>
                          <div class="one-style-progress-wrap">
                            <div class="one-pr-fill" :style="{ width: getProgressWidth(val), background: 'var(--one-accent-color)' }"></div>
                          </div>
                        </div>
                      </template>
                    </template>
                </div>

                <!-- 3. 后备楼层标记 (只有在没有标题组件时显示) -->
                <div v-if="!Object.keys(item.metadata || {}).some(k => getMappedStyle(k, item.metadata[k]) === 'header')" class="one-floor-badge-unified">
                  #{{ item.floor }}
                </div>
                
              </div>
            </div>
          </template>
            
            <div v-if="filteredDirectory.length === 0" class="empty-state">
              <i class="fa-solid fa-folder-open"></i>
              <p>{{ searchQuery ? '未找到相关条目' : (isAiMode ? '点击魔法棒开始 AI 归纳总结' : '数据加载中或暂无记录...') }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- SETTINGS VIEW -->
      <div v-if="currentView === 'settings'" class="view-settings">
        <div class="one-settings-layout">
          <div class="one-settings-tabs">
            <button class="icon-btn back-btn" title="返回" @click="currentView = 'main'"><i class="fa-solid fa-arrow-left"></i></button>
            <div class="tabs-group">
              <button class="one-tab-btn" :class="{ active: currentTab === 'base' }" @click="currentTab = 'base'"><i class="fa-solid fa-folder-tree"></i></button>
              <button class="one-tab-btn" :class="{ active: currentTab === 'ai' }" @click="currentTab = 'ai'"><i class="fa-solid fa-robot"></i></button>
              <button class="one-tab-btn" :class="{ active: currentTab === 'panel' }" @click="currentTab = 'panel'"><i class="fa-solid fa-display"></i></button>
            </div>
          </div>

          <div class="one-settings-content">
            
            <!-- Tab: Base Rules -->
            <div v-if="currentTab === 'base'" class="one-tab-pane">
              <div class="rules-header">
                <div class="rules-title-area">
                  <h3 class="rules-main-title">基础目录</h3>
                  <div class="rules-filters">
                    <i class="fa-solid filter-icon" :class="ruleFilter === 'all' ? 'fa-eye' : (ruleFilter === 'enabled' ? 'fa-circle-check' : 'fa-circle-xmark')" @click="ruleFilter = ruleFilter === 'all' ? 'enabled' : (ruleFilter === 'enabled' ? 'disabled' : 'all')" :title="'筛选: ' + ruleFilter"></i>
                    <i class="fa-solid fa-sort filter-icon" @click="ruleSort = ruleSort === 'none' ? 'level' : 'none'" :class="{ active: ruleSort === 'level' }" title="按层级排序"></i>
                    <i class="fa-solid fa-circle-question help-icon" @click="showTutorial = true"></i>
                  </div>
                </div>
                <button class="save-btn btn-sm" @click="addRule"><i class="fa-solid fa-plus"></i></button>
              </div>
              <p class="rules-subtext">当消息匹配到下方开启的正则时，将解析为树状目录。</p>
              
              <div class="rules-container">
                <div v-for="rule in filteredRules" :key="rule.id" class="rule-card">
                  <div class="rule-card-header" @click="toggleRuleExpansion(rule)">
                    <div class="toggle-area" style="display:flex; align-items:center; gap:8px;" @click.stop>
                      <label class="toggle-switch">
                        <input type="checkbox" v-model="rule.enabled">
                        <span class="slider"></span>
                      </label>
                      <span class="r-title-display" style="font-weight:bold;">{{ rule.name }}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                      <i class="fa-solid fa-trash del-icon-btn" @click.stop="removeRule(rule.id)"></i>
                      <i class="fa-solid r-expand-icon" :class="rule.isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                    </div>
                  </div>
                  <div v-show="rule.isExpanded" class="rule-card-body">
                    <div style="grid-column: span 2; display:flex; gap:8px; align-items:center;">
                      <span style="font-size:0.85rem; opacity:0.7; width:60px;">规则名</span>
                      <input type="text" v-model="rule.name" placeholder="(如: 卷名)">
                    </div>
                    <div style="grid-column: span 2; display:flex; gap:8px; align-items:center;">
                      <span style="font-size:0.85rem; opacity:0.7; width:60px;">正则式</span>
                      <input type="text" v-model="rule.pattern" placeholder="(如: 【(.*?)卷】)">
                    </div>
                    <div style="display:flex; align-items:center; gap:4px">
                      <span style="font-size:0.75rem;opacity:0.7; white-space:nowrap;">层级</span>
                      <input type="number" v-model="rule.level" min="1" max="5">
                    </div>
                    <div style="display:flex; align-items:center; gap:4px">
                      <span style="font-size:0.75rem;opacity:0.7; white-space:nowrap;">提取组</span>
                      <input type="number" v-model="rule.captureGroup" min="0" max="9">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tab: AI Module (Refined with Sub-tabs) -->
            <div v-if="currentTab === 'ai'" class="one-tab-pane">
              <div class="one-sub-tabs">
                <button :class="{ active: aiSubTab === 'regex' }" @click="aiSubTab = 'regex'" title="正则">
                  <i class="fa-solid fa-code"></i>
                </button>
                <button :class="{ active: aiSubTab === 'prompt' }" @click="aiSubTab = 'prompt'" title="提示词">
                  <i class="fa-solid fa-terminal"></i>
                </button>
                <button :class="{ active: aiSubTab === 'api' }" @click="aiSubTab = 'api'" title="API 设置">
                  <i class="fa-solid fa-plug"></i>
                </button>
              </div>

              <div class="ai-tab-content">
                <!-- Sub-tab: Regex Extraction Rules -->
                <div v-if="aiSubTab === 'regex'" class="ai-sub-pane">
                  <div class="rules-header">
                    <h3 class="rules-main-title">AI 提取规则</h3>
                    <button class="save-btn btn-sm" @click="addAiRegexRule" title="添加提取规则"><i class="fa-solid fa-plus"></i></button>
                  </div>
                  <p class="rules-subtext" style="margin-bottom:12px;">用于精简发送给 AI 的文本。只有“开启”的规则会生效。</p>
                  
                  <div class="ai-rules-container">
                    <div v-for="rule in (settings.aiConfig.regexRules || [])" :key="rule.id" class="rule-card mini">
                      <div class="rule-card-header" @click="toggleAiRegexRuleExpansion(rule)">
                        <div class="toggle-area" style="display:flex; align-items:center; gap:8px;" @click.stop>
                          <label class="toggle-switch">
                            <input type="checkbox" v-model="rule.enabled">
                            <span class="slider"></span>
                          </label>
                          <span class="r-title-display" style="font-weight:bold; font-size:0.85rem;">{{ rule.name }}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                          <div class="mode-badge" :class="rule.mode" @click.stop="rule.mode = rule.mode === 'include' ? 'exclude' : 'include'">
                            {{ rule.mode === 'include' ? '正选' : '反选' }}
                          </div>
                          <i class="fa-solid fa-trash del-icon-btn" style="font-size:0.8rem;" @click.stop="removeAiRegexRule(rule.id)"></i>
                        </div>
                      </div>
                      
                      <div v-show="rule.isExpanded" class="rule-card-body">
                        <div style="grid-column: span 2; display:flex; gap:8px; align-items:center;">
                          <span class="label-txt">规则名</span>
                          <input type="text" v-model="rule.name" placeholder="如: 提取摘要">
                        </div>
                        <div style="grid-column: span 2; display:flex; gap:8px; align-items:center;">
                          <span class="label-txt">正则式</span>
                          <input type="text" v-model="rule.pattern" :placeholder="'&lt;summary&gt;(.*?)&lt;/summary&gt;'">
                        </div>
                        <div style="display:flex; align-items:center; gap:8px">
                          <span class="label-txt">提取组</span>
                          <input type="number" v-model="rule.captureGroup" min="0" max="9">
                        </div>
                        <div style="display:flex; align-items:center; justify-content: flex-end;">
                           <span style="font-size:0.7rem; opacity:0.5;">组0即全匹配</span>
                        </div>
                      </div>
                    </div>

                    <div v-if="settings.aiConfig.regexRules.length === 0" class="empty-state mini">
                      <i class="fa-solid fa-filter"></i>
                      <p>暂无提取规则，将发送完整文本</p>
                    </div>
                  </div>

                  <div class="action-footer" style="margin-top:20px;">
                      <button class="save-btn" @click="saveSettings"><i class="fa-solid fa-floppy-disk"></i> 保存正则设置</button>
                  </div>
                </div>

                <!-- Sub-tab: Prompt Orchestration (RE-FIXED) -->
                <div v-if="aiSubTab === 'prompt'" class="ai-sub-pane">
                  <div class="rules-header">
                    <h3 class="rules-main-title">提示词编排</h3>
                    <div style="display:flex; gap:8px;">
                      <button class="save-btn btn-sm secondary-btn" @click="confirmResetPrompts" title="恢复初始化" style="background: rgba(128,128,128,0.2); color: inherit;">
                        <i class="fa-solid fa-rotate-left"></i>
                      </button>
                      <button class="save-btn btn-sm" @click="showPreview = true" title="预览最终请求体"><i class="fa-solid fa-eye"></i></button>
                      <button class="save-btn btn-sm" @click="addPromptMessage" title="添加新消息项"><i class="fa-solid fa-plus"></i></button>
                    </div>
                  </div>
                  <p class="rules-subtext" style="margin-bottom:12px;">构建对话序列。使用 <code v-text="'{{messages}}'"></code> 注入提取的内容。</p>
                  
                  <div class="prompt-container">
                    <div v-for="(msg, idx) in settings.aiConfig.promptMessages" :key="msg.id" class="prompt-msg-card" :class="[msg.role, { collapsed: !msg.isExpanded }]">
                      <div class="msg-header" @click="msg.isExpanded = !msg.isExpanded">
                        <div class="msg-title-area" @click.stop>
                          <input v-model="msg.name" class="msg-name-input" placeholder="消息标题...">
                          <select v-model="msg.role" class="role-select">
                            <option value="system">System</option>
                            <option value="user">User</option>
                            <option value="assistant">Assistant</option>
                          </select>
                        </div>
                        <div class="msg-actions">
                          <i class="fa-solid fa-arrow-up" @click.stop="movePromptMessage(idx, 'up')" :class="{ disabled: idx === 0 }"></i>
                          <i class="fa-solid fa-arrow-down" @click.stop="movePromptMessage(idx, 'down')" :class="{ disabled: idx === settings.aiConfig.promptMessages.length - 1 }"></i>
                          <i class="fa-solid fa-trash" @click.stop="removePromptMessage(msg.id)"></i>
                          <i class="fa-solid" :class="msg.isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'" style="margin-left:4px; opacity:0.5;"></i>
                        </div>
                      </div>
                      <div v-if="msg.isExpanded" class="msg-body">
                         <textarea v-model="msg.content" :placeholder="'输入指令内容...可用 {{messages}}'"></textarea>
                      </div>
                    </div>
                  </div>

                  <!-- Preview Overlay -->
                  <div v-if="showPreview" class="preview-overlay" @click="showPreview = false">
                    <div class="preview-modal" @click.stop>
                        <div class="preview-header">
                          <span>API 发送内容预览</span>
                          <i class="fa-solid fa-xmark" @click="showPreview = false"></i>
                        </div>
                        <div class="preview-body">
                          <div v-for="(p, pi) in previewPayload" :key="pi" class="preview-msg-item">
                             <div class="p-role" :class="p.role">{{ p.role.toUpperCase() }}</div>
                             <pre class="p-content">{{ p.content }}</pre>
                          </div>
                        </div>
                        <div class="preview-footer">
                          展示基于当前聊天提取的变量替换结果
                        </div>
                    </div>
                  </div>

                  <div class="action-footer" style="margin-top:20px;">
                      <button class="save-btn" @click="saveSettings"><i class="fa-solid fa-floppy-disk"></i> 保存提示词设置</button>
                  </div>
                </div>

                <!-- Sub-tab: API Configuration -->
                <div v-if="aiSubTab === 'api'" class="ai-sub-pane">
                  <div class="rules-header">
                    <h3 class="rules-main-title">API 配置管理</h3>
                    <button class="save-btn btn-sm" @click="addAiProfile" title="添加新配置"><i class="fa-solid fa-plus"></i></button>
                  </div>
                  
                  <div class="ai-api-container">
                    <!-- Profile List Selection -->
                    <div class="profile-list">
                      <div 
                        v-for="p in settings.aiConfig.profiles" 
                        :key="p.id" 
                        class="profile-item"
                        :class="{ active: settings.aiConfig.activeProfileId === p.id }"
                        @click="settings.aiConfig.activeProfileId = p.id"
                      >
                        <i class="fa-solid fa-server"></i>
                        <span class="p-name">{{ p.name }}</span>
                        <i v-if="settings.aiConfig.profiles.length > 1" class="fa-solid fa-xmark del-p" @click.stop="removeAiProfile(p.id)"></i>
                      </div>
                    </div>

                    <div class="api-config-form">
                      <div class="profile-card">
                        <div class="profile-card-header" @click="isApiFormExpanded = !isApiFormExpanded">
                          <span><i class="fa-solid fa-gear"></i> {{ activeProfile.name }} 详细配置</span>
                          <i class="fa-solid" :class="isApiFormExpanded ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                        </div>
                        
                        <div v-if="isApiFormExpanded" class="profile-card-body">
                          <div class="input-group">
                          <label>配置名称</label>
                          <input type="text" v-model="activeProfile.name" placeholder="如: Gemini反代">
                        </div>
                        <div class="input-group">
                          <label>API 地址 (Endpoint)</label>
                          <input type="text" v-model="activeProfile.endpoint" placeholder="https://...">
                        </div>
                        <div class="input-group">
                          <label>API Key</label>
                          <div class="password-input">
                            <input :type="showApiKey ? 'text' : 'password'" v-model="activeProfile.key" placeholder="sk-...">
                            <i @click="showApiKey = !showApiKey" class="fa-solid" :class="showApiKey ? 'fa-eye-slash' : 'fa-eye'"></i>
                          </div>
                        </div>
                        <div class="input-group">
                          <label>对话模型 (Model)</label>
                          <div class="model-select-area">
                            <select v-model="activeProfile.model">
                              <option v-if="activeProfile.models.length === 0" value="">-- 请先刷新列表 --</option>
                              <option v-for="m in activeProfile.models" :key="m" :value="m">{{ m }}</option>
                            </select>
                            <button class="refresh-btn" @click="handleFetchModels" title="获取模型列表"><i class="fa-solid fa-rotate"></i></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                    <div class="test-section">
                       <div class="test-header">
                          <span>连通性测试</span>
                          <button class="test-btn" :disabled="isTesting" @click="handleTestConnection">
                            <span v-if="isTesting">测试中...</span>
                            <span v-else>立即测试</span>
                          </button>
                       </div>
                       <div v-if="testResult" class="test-console" :class="{ error: !testResult.success }">
                          <div class="console-content">{{ testResult.text }}</div>
                       </div>
                    </div>

                    <div class="auto-trigger-section" style="margin-top:20px; border-top: 1px solid var(--SmartThemeBorderColor); padding-top:15px;">
                       <div class="input-group">
                          <label style="display:flex; justify-content: space-between;">
                            <span>自动总结/刷新间隔</span>
                            <span style="font-size:0.7rem; opacity:0.5;">每 N 楼层触发</span>
                          </label>
                          <div style="display:flex; align-items:center; gap:8px;">
                            <input type="number" v-model="settings.autoExtractInterval" min="0" placeholder="0" style="flex:1;">
                            <span style="font-size:0.7rem; opacity:0.5; white-space:nowrap;">0为禁用</span>
                          </div>
                       </div>
                       <div class="input-group" style="margin-top:10px;">
                          <label style="display:flex; justify-content: space-between;">
                            <span>单次总结最大楼层 (分批大小)</span>
                          </label>
                          <input type="number" v-model="settings.aiConfig.batchSize" min="1" max="100" placeholder="50">
                       </div>
                       <div class="input-group" style="margin-top:10px;">
                          <label style="display:flex; justify-content: space-between;">
                            <span>上下文回顾章节数 (n)</span>
                          </label>
                          <input type="number" v-model="settings.aiConfig.contextFloorCount" min="0" max="20" placeholder="5">
                       </div>
                    </div>
                    
                    <div class="action-footer" style="margin-top:20px;">
                        <button class="save-btn" @click="saveSettings"><i class="fa-solid fa-floppy-disk"></i> 保存所有设置</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tab: Panel Settings -->
            <div v-if="currentTab === 'panel'" class="one-tab-pane">
              
              <!-- Iconized Sub-Tabs -->
              <div class="one-sub-tab-bar">
                <div 
                  class="sub-tab-item" 
                  :class="{ active: panelSubTab === 'display' }" 
                  @click="panelSubTab = 'display'"
                  title="面板显示"
                >
                  <i class="fa-solid fa-display"></i>
                </div>
                <div 
                  class="sub-tab-item" 
                  :class="{ active: panelSubTab === 'custom' }" 
                  @click="panelSubTab = 'custom'"
                  title="UI 组件自定义"
                >
                  <i class="fa-solid fa-palette"></i>
                </div>
              </div>

              <!-- Sub-Pane 1: Basic Display -->
              <div v-if="panelSubTab === 'display'" class="panel-sub-content">
                <div class="setting-item">
                    <label>面板显示模式</label>
                    <select v-model="settings.mode">
                      <option value="modal">居中弹窗 (Modal)</option>
                      <option value="drawer-right">侧边抽屉 - 靠右 (Drawer Right)</option>
                      <option value="drawer-left">侧边抽屉 - 靠左 (Drawer Left)</option>
                    </select>
                </div>
                <div class="setting-item">
                    <label>面板宽度 (px 或 %)</label>
                    <input type="text" v-model="settings.width">
                </div>
                <div class="setting-item">
                    <label>面板高度 (px 或 %)</label>
                    <input type="text" v-model="settings.height">
                </div>
                <div class="setting-item checkbox-item">
                    <label>滚动高亮目标楼层</label>
                    <label class="toggle-switch">
                      <input type="checkbox" v-model="settings.highlight">
                      <span class="slider"></span>
                    </label>
                </div>
              </div>

              <!-- Sub-Pane 2: UI Customization (实验室) -->
              <div v-if="panelSubTab === 'custom'" class="panel-sub-content">
                <div class="custom-form-grid">
                  
                  <div class="component-selector">
                    <label>正在重塑组件</label>
                    <div class="selector-wrapper">
                      <select v-model="currentCustomComponent">
                        <option value="container">整体容器 (Container)</option>
                        <option value="header">标题项目 (Header)</option>
                        <option value="block">总结正文 (Summary)</option>
                        <option value="quote">引用区块 (Quote)</option>
                        <option value="pill">胶囊标签 (Pills)</option>
                        <option value="attr">属性列表 (Attributes)</option>
                        <option value="progress">进度条 (Progress)</option>
                      </select>
                    </div>
                  </div>

                  <!-- 实验室折叠面板 -->
                  <div class="lab-accordion" v-if="settings.aiConfig?.uiCustomization">
                    
                    <!-- 1. 布局布局 (Layout) -->
                    <div class="lab-section" :class="{ open: settings.aiConfig.uiCustomization.expandedSections?.includes('layout') }">
                      <div class="section-title" @click="toggleSection('layout')">
                        <span><i class="fa-solid fa-arrows-to-dot"></i> 布局与间距</span>
                        <i class="fa-solid fa-chevron-down fold-arrow"></i>
                      </div>
                      <div v-if="settings.aiConfig.uiCustomization.expandedSections?.includes('layout')" class="section-body">
                        <div class="custom-section-title">内边距 (Padding)</div>
                        <div class="input-row" v-if="settings.aiConfig.uiCustomization[currentCustomComponent]">
                          <div class="input-mini"><label>上</label><input type="number" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].paddingTop"></div>
                          <div class="input-mini"><label>下</label><input type="number" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].paddingBottom"></div>
                          <div class="input-mini"><label>左</label><input type="number" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].paddingLeft"></div>
                          <div class="input-mini"><label>右</label><input type="number" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].paddingRight"></div>
                        </div>
                        <div class="custom-section-title">外边距与几何 (Margin/Radius)</div>
                        <div class="input-row" v-if="settings.aiConfig.uiCustomization[currentCustomComponent]">
                          <div class="input-mini"><label>左移</label><input type="number" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].marginLeft"></div>
                          <div class="input-mini"><label>右移</label><input type="number" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].marginRight"></div>
                          <div class="input-mini"><label>间距</label><input type="number" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].itemGap"></div>
                          <div class="input-mini"><label>圆角</label><input type="number" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].borderRadius"></div>
                        </div>
                      </div>
                    </div>

                    <!-- 2. 文字样式 (Text) -->
                    <div v-if="currentCustomComponent !== 'container'" class="lab-section" :class="{ open: settings.aiConfig.uiCustomization.expandedSections?.includes('text') }">
                      <div class="section-title" @click="toggleSection('text')">
                        <span><i class="fa-solid fa-font"></i> 文字样式</span>
                        <i class="fa-solid fa-chevron-down fold-arrow"></i>
                      </div>
                      <div v-if="settings.aiConfig.uiCustomization.expandedSections?.includes('text')" class="section-body">
                        <div class="input-row" v-if="settings.aiConfig.uiCustomization[currentCustomComponent]">
                          <div class="input-mini"><label>字号 (rem)</label><input type="number" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].fontSize" step="0.05"></div>
                          <div class="input-mini"><label>粗细 (weight)</label><input type="number" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].fontWeight" step="100" min="100" max="900"></div>
                          <div class="input-mini-wide"><label>行高</label><input type="number" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].lineHeight" step="0.1"></div>
                        </div>
                        <div class="input-row inline-toggles" v-if="settings.aiConfig.uiCustomization[currentCustomComponent]">
                          <label class="check-label"><input type="checkbox" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].isItalic"> 斜体</label>
                          <div class="input-mini-wide" style="flex:1;">
                             <label>修饰线</label>
                             <select v-model="settings.aiConfig.uiCustomization[currentCustomComponent].underlineStyle">
                               <option value="none">无修饰</option>
                               <option value="solid">直线</option>
                               <option value="wavy">波浪线</option>
                             </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 3. 边框样式 (Border) -->
                    <div class="lab-section" :class="{ open: settings.aiConfig.uiCustomization.expandedSections?.includes('border') }">
                      <div class="section-title" @click="toggleSection('border')">
                        <span><i class="fa-solid fa-border-all"></i> 边框线条</span>
                        <i class="fa-solid fa-chevron-down fold-arrow"></i>
                      </div>
                      <div v-if="settings.aiConfig.uiCustomization.expandedSections?.includes('border')" class="section-body">
                        <div class="custom-section-title">显示位置</div>
                        <div class="input-row inline-toggles" v-if="settings.aiConfig.uiCustomization[currentCustomComponent]">
                           <label class="check-label"><input type="checkbox" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].showBorderTop"> 上</label>
                           <label class="check-label"><input type="checkbox" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].showBorderBottom"> 下</label>
                           <label class="check-label"><input type="checkbox" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].showBorderLeft"> 左</label>
                           <label class="check-label"><input type="checkbox" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].showBorderRight"> 右</label>
                        </div>
                        <div class="input-row" v-if="settings.aiConfig.uiCustomization[currentCustomComponent]">
                          <div class="input-mini-wide">
                            <label>线型</label>
                            <select v-model="settings.aiConfig.uiCustomization[currentCustomComponent].borderStyle">
                              <option value="solid">实线 (Solid)</option>
                              <option value="dashed">虚线 (Dashed)</option>
                              <option value="dotted">点线 (Dotted)</option>
                            </select>
                          </div>
                          <div class="input-mini"><label>粗细</label><input type="number" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].borderWidth"></div>
                          <div class="color-picker-box-mini">
                            <label>边框颜色</label>
                            <div class="c-wrap">
                               <input type="color" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].borderColor">
                               <i class="fa-solid fa-circle-xmark clear-c" @click="settings.aiConfig.uiCustomization[currentCustomComponent].borderColor = ''"></i>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 4. 色彩美化 (Color) -->
                    <div class="lab-section" :class="{ open: settings.aiConfig.uiCustomization.expandedSections?.includes('color') }">
                      <div class="section-title" @click="toggleSection('color')">
                        <span><i class="fa-solid fa-palette"></i> 颜色与背景</span>
                        <i class="fa-solid fa-chevron-down fold-arrow"></i>
                      </div>
                      <div v-if="settings.aiConfig.uiCustomization.expandedSections?.includes('color')" class="section-body">
                        <div class="input-row colors" v-if="settings.aiConfig.uiCustomization[currentCustomComponent]">
                          <div class="color-picker-box"><label>背景色</label><div class="c-wrap"><input type="color" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].bgColor"><i class="fa-solid fa-circle-xmark clear-c" @click="settings.aiConfig.uiCustomization[currentCustomComponent].bgColor = ''"></i></div></div>
                          <template v-if="currentCustomComponent !== 'container'">
                            <div class="color-picker-box"><label>字体色</label><div class="c-wrap"><input type="color" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].textColor"><i class="fa-solid fa-circle-xmark clear-c" @click="settings.aiConfig.uiCustomization[currentCustomComponent].textColor = ''"></i></div></div>
                            <div class="color-picker-box"><label>强调色</label><div class="c-wrap"><input type="color" v-model="settings.aiConfig.uiCustomization[currentCustomComponent].accentColor"><i class="fa-solid fa-circle-xmark clear-c" @click="settings.aiConfig.uiCustomization[currentCustomComponent].accentColor = ''"></i></div></div>
                          </template>
                        </div>
                      </div>
                    </div>

                  </div>

                  <div class="custom-footer">
                    <button class="reset-btn" @click="resetUiSettings"><i class="fa-solid fa-undo"></i> 全部清除并重置</button>
                  </div>
                </div>
              </div>

               <div class="action-footer">
                  <button class="save-btn" @click="saveSettings"><i class="fa-solid fa-floppy-disk"></i> 保存生效</button>
               </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Tutorial Modal -->
      <div v-if="showTutorial" class="tutorial-overlay" @click.self="showTutorial = false">
        <div class="tutorial-modal">
          <i class="fa-solid fa-times tutorial-close" @click="showTutorial = false"></i>
          <h2 class="tutorial-title">📝 正则匹配教程</h2>
          <p class="tutorial-desc">
            正则用于自动从内容中提取目录。<strong>点击代码可一键复制：</strong>
          </p>
          <div class="tutorial-examples">
            <div class="example-box">
              <strong class="example-name">卷名提取 (全宽括号)</strong><br>
              <span class="example-text">待匹配文本：【第一卷：冒险起航】</span><br>
              <code class="copy-code" @click="copyCode('【(.*?)】')">【(.*?)】</code><br>
              <span class="example-text">提示：层级建议设为 1，提取组设为 1 可排除括号。</span>
            </div>
            <div class="example-box">
              <strong class="example-name">章节提取 (标准格式)</strong><br>
              <span class="example-text">待匹配文本：第十二章：夜袭</span><br>
              <code class="copy-code" @click="copyCode('第(.*?)章(.*?)')">第(.*?)章(.*?)</code><br>
              <span class="example-text">提示：层级建议设为 2。</span>
            </div>
            <div class="example-box">
              <strong class="example-name">自定义标记</strong><br>
              <span class="example-text">待匹配文本：[Chapter: Title]</span><br>
              <code class="copy-code" @click="copyCode('\\[Chapter: (.*?)\\]')">\[Chapter: (.*?)]</code>
            </div>
          </div>
          <p class="tutorial-hint">
            <strong>层级说明：</strong>层级越小(如1)权重越高。点击目录中的卷级(Level 1)条目可折叠/展开其下的章节。
          </p>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Faithfully replicated styles from the original one extension */

.one-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(3px);
}

.one-overlay.no-flex {
  display: block; /* 允许抽屉模式自由排布 */
}

.one-panel {
  background-color: var(--SmartThemeBlurTintColor, rgba(30,30,30,0.85));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1));
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow-y: auto;
  overflow-x: hidden;
}

/* Modal Displacement - Slight vertical offset for better visual balance */
.one-panel.modal {
  transform: translateY(-2vh);
}

/* Drawer Modes - Force Full Height and Precise Zero-Top Alignment */
.drawer-left {
  justify-content: flex-start !important;
  height: 100vh !important;
  border-radius: 0 12px 12px 0;
  position: fixed !important;
  left: 0 !important;
  top: 0 !important;
  margin: 0 !important;
}
.drawer-right {
  justify-content: flex-start !important; /* Changed from flex-end to flex-start to fix top spacing */
  height: 100vh !important;
  border-radius: 12px 0 0 12px;
  position: fixed !important;
  right: 0 !important;
  top: 0 !important;
  margin: 0 !important;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1));
}

.sticky-header {
  position: sticky;
  top: 0;
  z-index: 100;
  /* Sync with the panel theme */
  background: var(--SmartThemeBlurTintColor, rgba(30, 30, 30, 0.85));
  backdrop-filter: blur(20px); 
  border-bottom: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.05));
  opacity: 1 !important;
}

.search-bar.mini {
  max-width: 140px;
}

.directory-item-container {
  margin-bottom: 4px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.ai-item-mode.directory-item-container {
  background: var(--SmartThemeChatTintColor, rgba(255, 255, 255, 0.03));
  border-color: var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.05));
}

.directory-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-item-mode .directory-item {
  background: var(--SmartThemeChatTintColor, rgba(255, 255, 255, 0.03));
  font-weight: bold;
  border-bottom: 1px dashed var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
}

.ai-module-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

/* 统一楼层号 (Fallback) */
.floor-badge-unified {
  position: absolute;
  top: 6px;
  right: 10px;
  font-size: 0.65rem;
  opacity: 0.3;
  font-family: monospace;
  pointer-events: none;
}

/* Header 内部楼层号 (Preferred) */
.floor-badge-inline {
  font-size: 0.7rem;
  opacity: 0.3;
  font-weight: normal;
  font-family: monospace;
}

.ai-primary-zone {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-details-zone {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 2px;
}

.module-summary {
  opacity: 0.8;
  margin-bottom: 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.module-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.module-tag {
  background: var(--SmartThemeBlurTintColor, rgba(0,0,0,0.2));
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  opacity: 0.7;
  display: flex;
  align-items: center;
  gap: 4px;
}

.directory-item:hover {
  background: var(--SmartThemeChatTintColor, rgba(255,255,255,0.05));
}

.directory-item.level-1 { padding-left: 12px; font-weight: 600; }
.directory-item.level-2 { padding-left: 32px; font-size: 0.95em; opacity: 0.9; }
.directory-item.level-3 { padding-left: 48px; font-size: 0.9em; opacity: 0.8; }

.one-ai-item-container.level-1 { margin-left: 0; width: 100%; font-weight: 600; }
.one-ai-item-container.level-2 { margin-left: 20px; width: calc(100% - 20px); font-size: 0.95em; opacity: 0.9; }
.one-ai-item-container.level-3 { margin-left: 35px; width: calc(100% - 35px); font-size: 0.9em; opacity: 0.8; }

.fold-trigger, .one-fold-trigger {
  padding: 4px 8px;
  margin-left: -8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 24px;
}

.fold-trigger:hover, .one-fold-trigger:hover {
  background: var(--SmartThemeChatTintColor, rgba(128, 128, 128, 0.2));
  color: var(--SmartThemeQuoteColor, #ff6b6b);
}

.item-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.floor-badge {
  background: var(--SmartThemeChatTintColor, rgba(0,0,0,0.3));
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  opacity: 0.6;
}

.search-bar {
  display: flex;
  align-items: center;
  background: transparent;
  border-radius: 8px;
  padding: 0;
  flex: 1;
  margin: 0 4px;
}

.search-bar input {
  background: var(--SmartThemeChatTintColor, rgba(0,0,0,0.2));
  border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1));
  color: var(--SmartThemeBodyColor);
  padding: 8px 12px;
  border-radius: 8px;
  outline: none;
  width: 100%;
}

.actions { display: flex; gap: 2px; }

.icon-btn, .one-tab-btn {
  background: transparent; border: none;
  color: var(--SmartThemeBodyColor);
  font-size: 1.1rem; cursor: pointer;
  padding: 8px 10px; border-radius: 8px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-btn.sm {
  font-size: 1rem;
  padding: 6px;
}
.icon-btn:hover, .one-tab-btn:hover { background: rgba(128,128,128,0.2); }

.content { flex: 1; padding: 4px 6px; }

/* Settings Layout Fixes */
.one-settings-layout { display: flex; flex-direction: column; min-height: 100%; }

.view-settings {
  height: 100%;
}

.one-settings-tabs {
  display: flex; 
  align-items: center; 
  padding: 8px 16px;
  border-bottom: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1));
  min-height: 50px;
}

.back-btn { margin-right: 8px; }

.tabs-group { display: flex; flex: 1; justify-content: space-evenly; }
.one-tab-btn { position: relative; }
.one-tab-btn.active { color: var(--SmartThemeEmColor, #007bff); }
.one-tab-btn.active::after {
  content: ''; position: absolute; bottom: 0; left: 50%;
  transform: translateX(-50%); height: 3px; width: 60%;
  background: var(--SmartThemeEmColor, #007bff); border-radius: 4px 4px 0 0;
}

.one-settings-content { 
  flex: 1; 
  padding: 16px; 
}

/* Rules Title Icons Row Alignment */
.rules-title-area { 
  display: flex; 
  align-items: center; 
  gap: 12px;
  flex: 1;
}

.rules-main-title { margin: 0; font-size: 1.2rem; }

.rules-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  opacity: 0.8;
}

.filter-icon, .help-icon {
  cursor: pointer;
  font-size: 0.9rem;
  transition: opacity 0.2s;
}
.filter-icon:hover, .help-icon:hover { opacity: 1; color: var(--SmartThemeEmColor); }

.setting-item { margin-bottom: 20px; display: flex; flex-direction: column; gap: 6px; }
.setting-item label { font-weight: bold; opacity: 0.9; font-size: 0.9rem; }

select, input[type="text"], input[type="number"] {
  background: var(--SmartThemeChatTintColor, rgba(0,0,0,0.2));
  color: var(--SmartThemeBodyColor);
  border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1));
  padding: 8px 12px; border-radius: 8px; outline: none;
}

.checkbox-item {
  flex-direction: row; align-items: center; justify-content: space-between;
  background: var(--SmartThemeChatTintColor, rgba(0,0,0,0.1));
  padding: 10px 16px; border-radius: 8px;
}

/* Toggle Switch */
.toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; min-width: 44px; }
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(128, 128, 128, 0.4); transition: .3s; border-radius: 24px;
}
.slider:before {
  position: absolute; content: ""; height: 18px; width: 18px;
  left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;
}
input:checked + .slider { background-color: var(--SmartThemeEmColor, #007bff); }
input:checked + .slider:before { transform: translateX(20px); }

.save-btn {
  background: var(--SmartThemeEmColor, #007bff); color: #fff; border: none;
  padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold;
}
.btn-sm { padding: 6px 12px; font-size: 0.8rem; }

/* Rules */
.rules-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.rules-container { display: flex; flex-direction: column; gap: 10px; }
.rule-card {
  background: var(--SmartThemeChatTintColor, rgba(0,0,0,0.1));
  border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1));
  border-radius: 8px;
}

.del-icon-btn {
  cursor: pointer;
  opacity: 0.6;
  font-size: 0.9rem;
  transition: all 0.2s;
}
.del-icon-btn:hover {
  opacity: 1;
  color: #ff4d4f;
  transform: scale(1.1);
}
.copy-code:active {
  transform: scale(0.98);
}

/* AI API Settings Styles */
.mode-toggle {
  display: flex;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}
.mode-toggle button {
  background: transparent;
  border: none;
  color: #fff;
  opacity: 0.6;
  padding: 4px 10px;
  font-size: 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.mode-toggle button.active {
  background: var(--SmartThemeChatTintColor, #007bff);
  opacity: 1;
}

.ai-api-cont.ai-module-grid {
  margin-top: 4px;
  position: relative;
}

.ai-module-grid.no-title {
  padding-top: 8px; /* 给悬浮楼层号留出些许空间 */
}

.fold-trigger-float {
  position: absolute;
  top: -2px;
  left: -20px;
  cursor: pointer;
  opacity: 0.7;
  color: var(--SmartThemeBodyColor);
  transition: transform 0.2s;
}

.fold-trigger-float:hover {
  transform: scale(1.1);
  opacity: 1;
}

.module-summary {
  display: flex;
  gap: 15px;
  padding: 15px;
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 20px;
}
.info-icon {
  font-size: 1.5rem;
  opacity: 0.5;
  display: flex;
  align-items: center;
}
.info-content strong {
  display: block;
  font-size: 0.95rem;
  margin-bottom: 4px;
}
.info-content p {
  font-size: 0.8rem;
  opacity: 0.7;
  margin: 0;
  line-height: 1.4;
}

.profile-card {
  background: rgba(0,0,0,0.1);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.05);
  overflow: hidden;
}

.profile-card-header {
  padding: 12px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.03);
  font-size: 0.9rem;
  font-weight: bold;
  transition: background 0.2s;
}

.profile-card-header:hover {
  background: rgba(255, 255, 255, 0.06);
}

.profile-card-body {
  padding: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  animation: one-slide-down 0.2s ease-out;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.input-group label {
  font-size: 0.8rem;
  opacity: 0.6;
}
.password-input {
  position: relative;
  display: flex;
}
.password-input i {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
}
.password-input i:hover {
  opacity: 1;
}

.model-select-area {
  display: flex;
  gap: 8px;
}
.refresh-btn {
  background: rgba(255,255,255,0.1);
  border: none;
  color: #fff;
  width: 36px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}
.refresh-btn:hover {
  background: rgba(255,255,255,0.2);
}

.test-section {
  margin-top: 20px;
}
.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 0.9rem;
  font-weight: bold;
}
.test-btn {
  background: transparent;
  border: 1px solid var(--SmartThemeChatTintColor, #007bff);
  color: var(--SmartThemeChatTintColor, #007bff);
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}
.test-btn:hover:not(:disabled) {
  background: var(--SmartThemeChatTintColor, #007bff);
  color: #fff;
}
.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-console {
  background: rgba(0,0,0,0.3);
  border-left: 3px solid #4caf50;
  padding: 10px;
  border-radius: 6px;
  font-family: monospace;
}
.test-console.error {
  border-left-color: #f44336;
}
.console-label {
  font-size: 0.7rem;
  opacity: 0.5;
  margin-bottom: 4px;
}
.console-content {
  font-size: 0.8rem;
  word-break: break-all;
  white-space: pre-wrap;
}

.rule-card-header { display: flex; justify-content: space-between; align-items: center; padding: 12px; cursor: pointer; }
.rule-card-body {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px;
  border-top: 1px dashed var(--SmartThemeBorderColor, rgba(255,255,255,0.1));
}

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 200px; opacity: 0.5;
}
.empty-state i { font-size: 3rem; margin-bottom: 12px; }

/* Tutorial Modal */
.tutorial-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1100;
}
.tutorial-modal {
  background: var(--SmartThemeChatTintColor, #222); padding: 20px; border-radius: 12px;
  width: 85%; max-height: 85%; overflow-y: auto; position: relative;
}
.tutorial-close { position: absolute; top: 12px; right: 12px; cursor: pointer; }
.example-box { background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; margin: 8px 0; border: 1px solid rgba(255,255,255,0.1); }
.copy-code { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; color: var(--SmartThemeEmColor); font-family: monospace; }

/* Mobile Adaptations */
@media (max-width: 768px) {
  .one-panel { max-width: 95%; max-height: 90%; }
  .one-panel.modal { transform: translateY(0); } /* Reset displacement on mobile */
  .drawer-left, .drawer-right { max-width: 85%; max-height: 100% !important; height: 100% !important; }
  
  /* Narrow Screen Adaptation for Rules */
  .rule-card-header { padding: 10px 8px; gap: 4px; }
  .toggle-area { gap: 4px !important; }
  .r-title-display { font-size: 0.9rem; }
  .rule-card-body { 
    display: flex; /* Use flex instead of grid for better stacking control on narrow screens */
    flex-direction: column;
    gap: 12px; 
    padding: 10px; 
  }
  
  /* Stack label and input vertically within rule rows */
  .rule-card-body > div {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 4px !important;
  }
  
  .rule-card-body span {
    width: auto !important;
    font-size: 0.8rem;
  }
  
  .rule-card-body input {
    width: 100% !important;
    box-sizing: border-box;
  }
  
  .header { padding: 10px 8px; }
  .one-settings-tabs { padding: 4px 8px; }
  .tabs-group { gap: 4px; }
}

/* --- Settings Panel Sub-Tabs (Regex/Prompt/API) --- */
.one-sub-tabs {
  display: flex !important;
  background: rgba(0,0,0,0.1);
  border-radius: 8px;
  padding: 4px;
  gap: 4px;
  margin-bottom: 12px;
  border: 1px solid var(--SmartThemeBorderColor);
}
.one-sub-tabs button {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--SmartThemeBodyColor);
  padding: 6px 0;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: all 0.2s;
}
.one-sub-tabs button i { font-size: 1rem; }
.one-sub-tabs button.active {
  background: var(--SmartThemeChatTintColor, #444);
  opacity: 1;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

/* --- Master Sub-Tab Bar (Display/Palette) --- */
.one-sub-tab-bar {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 18px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 8px;
  margin-top: -10px; /* 缩小顶部间距 */
}
.sub-tab-item {
  font-size: 1.1rem;
  opacity: 0.3;
  color: var(--SmartThemeBodyColor); /* 跟随主要文本颜色 */
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  padding: 4px 10px;
}
.sub-tab-item i { color: inherit; }
.sub-tab-item:hover { opacity: 0.7; }
.sub-tab-item.active {
  opacity: 1;
  color: var(--SmartThemeBodyColor);
}
.sub-tab-item.active::after {
  content: "";
  position: absolute;
  bottom: -9px;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--SmartThemeChatTintColor, #007bff);
}

.component-selector {
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.component-selector label { font-size: 0.75rem; font-weight: bold; opacity: 0.5; }
.component-selector select {
  background: var(--SmartThemeChatTintColor, #333);
  border: 1px solid var(--SmartThemeBorderColor);
  border-radius: 8px;
  padding: 8px;
  color: var(--SmartThemeBodyColor);
  font-size: 0.9rem;
}

.comp-settings-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* --- Form Utility Classes --- */
.custom-section-title {
  font-size: 0.75rem;
  font-weight: bold;
  opacity: 0.4;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 5px;
}
.input-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.input-mini {
  flex: 1;
  min-width: 60px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.input-mini label { font-size: 0.65rem; opacity: 0.5; }
.input-mini input {
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 4px 6px;
  color: var(--SmartThemeBodyColor);
  font-size: 0.8rem;
  width: 100%;
}
.input-mini-wide {
  flex: 2;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.input-mini-wide label { font-size: 0.65rem; opacity: 0.5; }
.input-mini-wide select {
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 4px 6px;
  color: var(--SmartThemeBodyColor);
  font-size: 0.8rem;
}

.inline-toggles {
  padding: 5px 0;
  gap: 15px !important;
}
.check-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.colors {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.color-picker-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.color-picker-box label { font-size: 0.65rem; opacity: 0.5; }
.c-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
}
.c-wrap input[type="color"] {
  flex: 1;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}
.clear-c {
  font-size: 0.9rem;
  opacity: 0.3;
  cursor: pointer;
  transition: opacity 0.2s;
}
.clear-c:hover { opacity: 0.8; color: #f44336; }

.custom-footer {
  margin-top: 15px;
  display: flex;
  justify-content: flex-end;
}
.reset-btn {
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.3);
  color: #f44336;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
}
.reset-btn:hover { background: #f44336; color: #fff; }

.prompt-msg-card {
  background: rgba(0,0,0,0.15);
  border: 1px solid var(--SmartThemeBorderColor);
  border-left-width: 4px;
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.prompt-msg-card.collapsed {
  margin-bottom: 6px;
}
.prompt-msg-card.system { border-left-color: #ffd700; }
.prompt-msg-card.user { border-left-color: #007bff; }
.one-ai-item-container {
  width: 100% !important;
  box-sizing: border-box;
  margin-top: var(--one-c-mt, 0);
  margin-bottom: var(--one-c-mb, 8px);
  margin-left: var(--one-c-ml, 0);
  margin-right: var(--one-c-mr, 0);
  background: var(--one-c-bg, var(--SmartThemeChatTintColor, rgba(255, 255, 255, 0.03)));
  border-top: var(--one-c-btw) var(--one-c-bs) var(--one-c-bc);
  border-bottom: var(--one-c-bbw) var(--one-c-bs) var(--one-c-bc);
  border-left: var(--one-c-blw) var(--one-c-bs) var(--one-c-bc);
  border-right: var(--one-c-brw) var(--one-c-bs) var(--one-c-bc);
  border-radius: var(--one-c-br, 8px);
  overflow: hidden;
  transition: all 0.2s;
  cursor: pointer;
}

.one-ai-grid {
  display: flex;
  flex-direction: column;
  gap: var(--one-c-gap, 8px);
  position: relative;
  width: 100% !important;
  box-sizing: border-box;
  padding-top: var(--one-c-pt, 10px);
  padding-bottom: var(--one-c-pb, 10px);
  padding-left: var(--one-c-pl, 12px);
  padding-right: var(--one-c-pr, 12px);
  margin-top: var(--one-c-mt, 0);
  margin-bottom: var(--one-c-mb, 0);
  margin-left: var(--one-c-ml, 0);
  margin-right: var(--one-c-mr, 0);
}

/* 统一楼层号 (Fallback) */
.one-floor-badge-unified {
  position: absolute;
  top: 10px;
  right: 14px;
  font-size: 0.65rem;
  opacity: 0.25;
  font-family: monospace;
  pointer-events: none;
}

/* Header 内部楼层号 */
.one-floor-badge-inline {
  font-size: 0.7rem;
  opacity: 0.25;
  font-weight: normal;
  font-family: monospace;
  margin-left: auto; 
}

.one-ai-primary-zone, .one-ai-details-zone {
  width: 100%;
  display: flex;
}

.one-ai-primary-zone {
  flex-direction: column;
  gap: var(--one-item-gap, 8px);
}

.one-ai-details-zone {
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: var(--one-sep-display, flex);
}

/* 1. Header Style */
.one-style-header {
  display: flex;
  align-items: center;
  gap: var(--one-h-gap, 8px);
  border-top: var(--one-h-btw) var(--one-h-bs) var(--one-h-bc);
  border-bottom: var(--one-h-bbw) var(--one-h-bs) var(--one-h-bc);
  border-left: var(--one-h-blw) var(--one-h-bs) var(--one-h-bc);
  border-right: var(--one-h-brw) var(--one-h-bs) var(--one-h-bc);
  padding-top: var(--one-h-pt);
  padding-bottom: var(--one-h-pb);
  padding-left: var(--one-h-pl);
  padding-right: var(--one-h-pr);
  margin-top: var(--one-h-mt);
  margin-bottom: var(--one-h-mb);
  margin-left: var(--one-h-ml);
  margin-right: var(--one-h-mr);
  border-radius: var(--one-h-br);
  background: var(--one-h-bg);
}
.one-h-text {
  font-size: var(--one-h-fs);
  font-weight: var(--one-h-fw);
  color: var(--one-h-tc);
  font-style: var(--one-h-fsy);
  text-decoration: var(--one-h-td);
  flex: 1;
  letter-spacing: 0.01em;
}

/* 2. Block Style (Summary) */
.one-style-block {
  font-size: var(--one-b-fs);
  font-weight: var(--one-b-fw);
  line-height: var(--one-b-lh);
  color: var(--one-b-tc);
  font-style: var(--one-b-fsy);
  text-decoration: var(--one-b-td);
  padding-top: var(--one-b-pt);
  padding-bottom: var(--one-b-pb);
  padding-left: var(--one-b-pl);
  padding-right: var(--one-b-pr);
  margin-top: var(--one-b-mt);
  margin-bottom: var(--one-b-mb);
  margin-left: var(--one-b-ml);
  margin-right: var(--one-b-mr);
  border-top: var(--one-b-btw) var(--one-b-bs) var(--one-b-bc);
  border-bottom: var(--one-b-bbw) var(--one-b-bs) var(--one-b-bc);
  border-left: var(--one-b-blw) var(--one-b-bs) var(--one-b-bc);
  border-right: var(--one-b-brw) var(--one-b-bs) var(--one-b-bc);
  border-radius: var(--one-b-br);
  background: var(--one-b-bg);
  opacity: 0.95;
  word-break: break-word;
}


/* 3. Quote Style */
.one-style-quote {
  padding-top: var(--one-q-pt);
  padding-bottom: var(--one-q-pb);
  padding-left: var(--one-q-pl);
  padding-right: var(--one-q-pr);
  margin-top: var(--one-q-mt);
  margin-bottom: var(--one-q-mb);
  margin-left: var(--one-q-ml);
  margin-right: var(--one-q-mr);
  border-radius: var(--one-q-br);
  background: var(--one-q-bg);
  font-style: var(--one-q-fsy);
  text-decoration: var(--one-q-td);
  font-size: var(--one-q-fs);
  font-weight: var(--one-q-fw);
  color: var(--one-q-tc);
  display: flex;
  gap: var(--one-q-gap, 10px);
  border-top: var(--one-q-btw) var(--one-q-bs) var(--one-q-bc);
  border-bottom: var(--one-q-bbw) var(--one-q-bs) var(--one-q-bc);
  border-left: var(--one-q-blw) var(--one-q-bs) var(--one-q-bc);
  border-right: var(--one-q-brw) var(--one-q-bs) var(--one-q-bc);
}
.one-q-icon {
  font-size: 0.8rem;
  opacity: 0.3;
  margin-top: 3px;
}

.one-style-pill {
  background: var(--one-p-bg);
  padding-top: var(--one-p-pt);
  padding-bottom: var(--one-p-pb);
  padding-left: var(--one-p-pl);
  padding-right: var(--one-p-pr);
  margin-top: var(--one-p-mt);
  margin-bottom: var(--one-p-mb);
  margin-left: var(--one-p-ml);
  margin-right: var(--one-p-mr);
  border-radius: var(--one-p-br);
  font-size: var(--one-p-fs);
  font-weight: var(--one-p-fw);
  font-style: var(--one-p-fsy);
  text-decoration: var(--one-p-td);
  border-top: var(--one-p-btw) var(--one-p-bs) var(--one-p-bc);
  border-bottom: var(--one-p-bbw) var(--one-p-bs) var(--one-p-bc);
  border-left: var(--one-p-blw) var(--one-p-bs) var(--one-p-bc);
  border-right: var(--one-p-brw) var(--one-p-bs) var(--one-p-bc);
  display: flex;
  align-items: center;
  gap: var(--one-p-gap, 6px);
  color: var(--one-p-tc);
  opacity: 0.8;
}
.one-f-icon { font-size: 0.7rem; opacity: 0.5; }

.one-style-attr {
  font-size: var(--one-a-fs);
  font-weight: var(--one-a-fw);
  background: var(--one-a-bg);
  padding-top: var(--one-a-pt);
  padding-bottom: var(--one-a-pb);
  padding-left: var(--one-a-pl);
  padding-right: var(--one-a-pr);
  margin-top: var(--one-a-mt);
  margin-bottom: var(--one-a-mb);
  margin-left: var(--one-a-ml);
  margin-right: var(--one-a-mr);
  border-radius: var(--one-a-br);
  color: var(--one-a-tc);
  font-style: var(--one-a-fsy);
  text-decoration: var(--one-a-td);
  border-top: var(--one-a-btw) var(--one-a-bs) var(--one-a-bc);
  border-bottom: var(--one-a-bbw) var(--one-a-bs) var(--one-a-bc);
  border-left: var(--one-a-blw) var(--one-a-bs) var(--one-a-bc);
  border-right: var(--one-a-brw) var(--one-a-bs) var(--one-a-bc);
}
.one-attr-key { opacity: 0.5; margin-right: 6px; font-weight: bold; }

.one-style-progress {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--one-pr-gap, 10px);
  padding-top: var(--one-pr-pt);
  padding-bottom: var(--one-pr-pb);
  padding-left: var(--one-pr-pl);
  padding-right: var(--one-pr-pr);
  margin-left: var(--one-pr-ml);
  margin-right: var(--one-pr-mr);
  border-top: var(--one-pr-btw) var(--one-pr-bs) var(--one-pr-bc);
  border-bottom: var(--one-pr-bbw) var(--one-pr-bs) var(--one-pr-bc);
  border-left: var(--one-pr-blw) var(--one-pr-bs) var(--one-pr-bc);
  border-right: var(--one-pr-brw) var(--one-pr-bs) var(--one-pr-bc);
  border-radius: var(--one-pr-br);
}
.one-pg-label { font-size: var(--one-pr-fs); font-weight: var(--one-pr-fw); color: var(--one-pr-tc); opacity: 0.8; min-width: 60px; text-transform: uppercase; }
.one-pg-bar-bg { flex: 1; height: 8px; background: var(--one-pr-bg); border-radius: var(--one-pr-br); overflow: hidden; }
.one-pg-bar-fill { height: 100%; background: var(--one-accent-color); border-radius: var(--one-pr-br); box-shadow: 0 0 10px var(--one-accent-color); transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
.one-pg-val { font-size: var(--one-pr-fs); opacity: 0.6; min-width: 40px; text-align: right; font-family: monospace; }

/* --- Mapper UI Styles --- */
.filter-dropdown.wide {
  width: 280px;
  background: var(--SmartThemeBlurTintColor, rgba(30,30,30,0.85));
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border: 1px solid var(--SmartThemeBorderColor);
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  border-radius: 12px;
}
.mapper-list {
  max-height: 280px;
  overflow-y: auto;
  padding: 6px;
}
.mapper-row-container {
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.mapper-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.2s;
  border-radius: 6px;
}
.mapper-item:hover {
  background: rgba(255,255,255,0.05);
}
.style-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  opacity: 0.7;
}
.style-preview i { color: var(--SmartThemeChatTintColor); }

.style-picker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 10px;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  margin: 4px 8px 10px 8px;
}
.picker-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.picker-icon:hover { background: rgba(255,255,255,0.1); border-color: var(--SmartThemeChatTintColor); }
.picker-icon.active { background: var(--SmartThemeChatTintColor); color: #fff; }
.picker-icon i { font-size: 1rem; }
.mapper-item:hover {
  background: rgba(255,255,255,0.05);
}
.mapper-key {
  font-size: 0.85rem;
  opacity: 0.8;
  font-family: monospace;
}
.style-toggle-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--SmartThemeBodyColor);
  cursor: pointer;
  min-width: 80px;
}
.style-toggle-btn i {
  color: var(--SmartThemeChatTintColor);
}
.filter-dropdown-footer {
  font-size: 0.65rem;
  opacity: 0.4;
  text-align: center;
  padding: 8px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.msg-header {
  background: rgba(255,255,255,0.03);
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}
.msg-title-area {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.msg-name-input {
  background: transparent;
  border: none;
  color: var(--SmartThemeBodyColor);
  font-size: 0.85rem;
  font-weight: bold;
  padding: 2px 4px;
  width: auto;
  max-width: 150px;
  outline: none;
  border-radius: 4px;
  transition: background 0.2s;
}
.msg-name-input:focus {
  background: rgba(255,255,255,0.1);
}
.role-select {
  background: rgba(0,0,0,0.2);
  border: none;
  color: var(--SmartThemeBodyColor);
  opacity: 0.7;
  font-size: 0.7rem;
  outline: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.msg-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.8rem;
  opacity: 0.6;
}
.msg-actions i { cursor: pointer; }
.msg-actions i:hover { opacity: 1; color: var(--SmartThemeEmColor); }
.msg-actions i.disabled { pointer-events: none; opacity: 0.2; }

.prompt-msg-card textarea {
  width: 100%;
  background: rgba(0,0,0,0.05);
  border: none;
  border-top: 1px solid var(--SmartThemeBorderColor);
  color: var(--SmartThemeBodyColor);
  padding: 12px;
  font-size: 0.85rem;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  outline: none;
  display: block;
}

/* Preview Modal Styles (Native Theme Integrated) */
.preview-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); /* 降低叠加背景，让模糊更透亮 */
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.preview-modal {
  width: 100%;
  max-width: 700px;
  max-height: 85vh;
  background: var(--SmartThemeBlurTintColor, rgba(30,30,30,0.85));
  color: var(--SmartThemeBodyColor);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1));
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}
.preview-header {
  padding: 16px 20px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid var(--SmartThemeBorderColor);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  font-size: 1.1rem;
}
.preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.preview-msg-item {
  border-bottom: 1px solid var(--SmartThemeBorderColor);
  padding-bottom: 15px;
  opacity: 0.9;
}
.preview-msg-item:last-child {
  border-bottom: none;
}
.p-role {
  font-size: 0.75rem;
  font-weight: 900;
  margin-bottom: 8px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.p-role.system { color: #ffd700; text-shadow: 0 0 10px rgba(255,215,0,0.2); }
.p-role.user { color: #007bff; text-shadow: 0 0 10px rgba(0,123,255,0.2); }
.p-role.assistant { color: #28a745; text-shadow: 0 0 10px rgba(40,167,69,0.2); }
.p-content {
  font-size: 0.9rem;
  white-space: pre-wrap;
  line-height: 1.6;
  font-family: var(--SmartThemeChatFontFamily, inherit);
  background: rgba(255,255,255,0.02);
  padding: 12px;
  border-radius: 8px;
  margin: 0;
}
.preview-footer {
  padding: 12px 20px;
  background: rgba(0,0,0,0.1);
  font-size: 0.75rem;
  opacity: 0.5;
  text-align: center;
  border-top: 1px solid var(--SmartThemeBorderColor);
}

.ai-tab-content {
  min-height: 200px;
}

.empty-state.mini {
  padding: 40px 20px;
  opacity: 0.3;
}
.empty-state.mini i {
  font-size: 2rem;
  margin-bottom: 10px;
}
.empty-state.mini p {
  font-size: 0.85rem;
}

/* API Profile Management Styles */
.profile-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.profile-item {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 6px 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
  max-width: 150px;
}
.profile-item i {
  opacity: 0.4;
}
.profile-item .p-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-item.active {
  background: var(--SmartThemeChatTintColor, #007bff);
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.profile-item.active i {
  opacity: 1;
}
.del-p {
  font-size: 0.75rem;
  opacity: 0.4;
  padding: 4px;
}
.del-p:hover {
  opacity: 1;
  color: #ff4d4f;
}

/* AI Regex Rule Customizations */
.rule-card.mini {
  margin-bottom: 8px;
  background: rgba(255,255,255,0.03);
}
.rule-card.mini .rule-card-header {
  padding: 8px 10px;
}
.rule-card.mini .label-txt {
  font-size: 0.75rem;
  opacity: 0.6;
  width: 50px;
}
.mode-badge {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}
.mode-badge.include {
  background: rgba(76, 175, 80, 0.2);
  color: #81c784;
  border: 1px solid rgba(76, 175, 80, 0.3);
}
.mode-badge.exclude {
  background: rgba(244, 67, 54, 0.2);
  color: #e57373;
  border: 1px solid rgba(244, 67, 54, 0.3);
}
.mode-badge:hover {
  filter: brightness(1.2);
}

.locked {
  pointer-events: none;
  filter: grayscale(0.2) contrast(0.9);
}

.generating-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(8px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  pointer-events: all;
}

.spinner-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  color: white;
}

.spinner-icon {
  font-size: 3.5rem;
  color: var(--SmartThemeEmColor);
  filter: drop-shadow(0 0 10px var(--SmartThemeEmColor));
}

.loading-text {
  font-weight: bold;
  letter-spacing: 2px;
  font-size: 1.1rem;
}

.pulse-active {
  animation: bg-pulse 2s infinite;
}

@keyframes bg-pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

.lab-accordion {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 15px;
}
.lab-section {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px;
  overflow: hidden;
}
.lab-section.open { border-color: var(--one-accent-color); }
.section-title {
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  background: transparent;
  font-size: 0.85rem;
  font-weight: bold;
}
.section-title span { display: flex; align-items: center; gap: 8px; }
.fold-arrow { transition: transform 0.2s; font-size: 0.7rem; opacity: 0.5; }
.lab-section.open .fold-arrow { transform: rotate(180deg); }
.section-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: fadeIn 0.15s ease-out;
}

.selector-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 0 10px;
}
.selector-wrapper i { opacity: 0.7; color: var(--one-accent-color); }
.selector-wrapper select {
  flex: 1;
  background: transparent;
  border: none;
  padding: 8px 0;
  color: var(--SmartThemeBodyColor);
  outline: none;
}

.one-floor-badge-unified {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 0.65rem;
  padding: 2px 6px;
  background: rgba(0,0,0,0.3);
  border-radius: 4px;
  opacity: 0.5;
}

.one-fold-trigger {
  width: 24px;
  height: 24px;
  display: flex !important;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: -8px;
  margin-right: -4px;
  opacity: 1 !important;
  visibility: visible !important;
  z-index: 5;
}

.one-fold-trigger i {
  color: var(--SmartThemeBodyColor) !important;
  font-size: 0.95rem;
  opacity: 1 !important;
  display: block !important;
  visibility: visible !important;
}

.one-style-header i.fa-square-plus, .one-style-header i.fa-square-minus {
  opacity: 1;
}

.style-picker-grid-container {
  background: rgba(0,0,0,0.25);
  border-radius: 8px;
  margin: 4px 8px 10px 8px;
  padding-bottom: 8px;
}
.style-picker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 10px;
}
.level-picker {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px 8px 12px;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 8px;
}
.level-label { font-size: 0.7rem; opacity: 0.5; font-weight: bold; }
.level-btn-group { display: flex; gap: 6px; }
.level-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--SmartThemeBodyColor);
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}
.level-btn:hover { background: rgba(255,255,255,0.1); }
.level-btn.active { background: var(--SmartThemeChatTintColor); color: #fff; border-color: transparent; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 模块筛选下拉菜单 */
.filter-dropdown {
  position: absolute;
  top: 45px;
  right: 15px;
  width: 160px;
  background: var(--SmartThemeBlurBackgroundColor);
  backdrop-filter: blur(20px);
  border: 1px solid var(--SmartThemeBorderColor);
  border-radius: 12px;
  padding: 10px;
  color: var(--SmartThemeBodyColor);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 4px;
  animation: one-slide-down 0.2s ease-out;
}

@keyframes one-slide-down {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.filter-dropdown-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 700;
  opacity: 0.5;
  margin-bottom: 6px;
  padding: 0 8px;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  user-select: none;
}

.filter-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.filter-item input[type="checkbox"] {
  accent-color: #3b82f6;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.filter-item-label {
  flex: 1;
}

</style>

<!-- 全局高亮样式 -->
<style>
@keyframes one-pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.4); }
  70% { box-shadow: 0 0 0 15px rgba(255, 107, 107, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0); }
}

.one-highlight {
  animation: one-pulse 1s ease-out 3;
  border: 2px solid var(--SmartThemeQuoteColor, #ff6b6b) !important;
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.1);
  position: relative;
  z-index: 10;
}
</style>
