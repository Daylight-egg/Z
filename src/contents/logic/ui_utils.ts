/**
 * UI Utility functions for Directory components
 */

export const getStyleIcon = (style: string) => {
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

export const getModuleIcon = (key: string) => {
  const k = key.toLowerCase();
  if (k.includes('time') || k.includes('时间')) return 'fa-clock';
  if (k.includes('loc') || k.includes('地点') || k.includes('位置')) return 'fa-location-dot';
  if (k.includes('char') || k.includes('人物') || k.includes('角色')) return 'fa-users';
  if (k.includes('event') || k.includes('事件')) return 'fa-bolt';
  if (k.includes('item') || k.includes('物品')) return 'fa-box';
  return 'fa-tag';
};

export const getProgressWidth = (val: string) => {
  if (!val) return '0%';
  const s = String(val);
  if (s.includes('%')) return s;
  if (s.includes('/')) {
    const [cur, total] = s.split('/').map(Number);
    if (!isNaN(cur) && !isNaN(total) && total > 0) {
      return `${Math.min(100, (cur / total) * 100)}%`;
    }
  }
  const num = Number(s);
  if (!isNaN(num) && num <= 1 && num >= 0) return `${num * 100}%`;
  return '0%';
};

export const getMappedStyle = (key: string, value: any, moduleMapping: any): string => {
  const mapping = moduleMapping || {};
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

export const getMappedLevel = (key: string, moduleMapping: any): number => {
  const mapping = moduleMapping || {};
  const item = mapping[key];
  if (typeof item === 'object' && item.level !== undefined) return item.level;
  
  if (key === 'vol') return 1;
  if (key === 'title') return 2;
  return 0;
};
