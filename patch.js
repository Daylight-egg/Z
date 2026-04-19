const fs = require('fs');
let content = fs.readFileSync('src/contents/App.vue', 'utf8');

// 1. Fix drawer indent logic
const drawerCSS = '/* 抽屉模式：剪裁缩进逻辑 (CSS 实现) */\n' +
'.one-panel.drawer-right .directory-item, \n' +
'.one-panel.drawer-right .one-ai-item-container,\n' +
'.one-panel.drawer-left .directory-item, \n' +
'.one-panel.drawer-left .one-ai-item-container {\n' +
'  margin-left: calc(var(--one-c-ml, 0px) + var(--level-indent));\n' +
'  margin-right: var(--one-c-mr, 0px);\n' +
'  padding-left: var(--one-c-pl, 12px);\n' +
'}';

const oldDrawerCSSRegex = /\/\* 抽屉模式：剪裁缩进逻辑 \(CSS 实现\) \*\/[\s\S]*?(?=\.directory-item\.level-1)/;
content = content.replace(oldDrawerCSSRegex, drawerCSS + '\n\n');

// 2. Fix .one-style-header and .one-h-text
content = content.replace('.one-style-header {', '.one-style-header {\n  justify-content: space-between;');
if (!content.includes('.one-h-text { flex: 1;')) {
    content = content.replace('.one-h-text {', '.one-h-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;');
}

// 3. Fix internal padding (spacing is too big)
content = content.replace('padding: 8px 12px;\n  border-radius: 8px;', 'padding: 6px 8px;\n  border-radius: 8px;');
content = content.replace('padding: 10px;\n  border-radius: 12px;', 'padding: 8px 10px;\n  border-radius: 8px;');
content = content.replace('padding: 10px;\n  color: var(--SmartThemeBodyColor);', 'padding: 8px 10px;\n  color: var(--SmartThemeBodyColor);');

fs.writeFileSync('src/contents/App.vue', content, 'utf8');
console.log('Fixed CSS layout.');
