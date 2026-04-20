<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{
  item: any;
}>();

const emit = defineEmits(['jump', 'toggle-fold']);

const handleJump = () => {
  emit('jump', props.item.floor);
};

const handleToggleFold = () => {
  emit('toggle-fold', props.item.id);
};
</script>

<template>
  <div 
    v-memo="[item.id, item.text, item.isCollapsed, item.hasChildren, item.level]"
    class="directory-item"
    :class="['level-' + item.level, { 'is-vol': item.level === 1 }]"
    :style="{ '--level': item.level || 1 }"
    @click="handleJump"
  >
    <!-- 展开折叠触发区 -->
    <div v-if="item.hasChildren" class="fold-trigger" @click.stop="handleToggleFold">
      <i class="fa-solid" :class="item.isCollapsed ? 'fa-square-plus' : 'fa-square-minus'"></i>
    </div>
    <i v-else class="fa-solid fa-file-lines" style="opacity: 0.3; margin-right: 4px; font-size: 0.8rem;"></i>
    
    <span class="item-text">{{ item.text }}</span>
    <span class="floor-badge">{{ item.floor }}</span>
  </div>
</template>

<style scoped>
/* Styles are globally available from App.vue or can be moved here if we want full isolation. 
   Since App.vue is already massive, we'll keep the styles there for now but use scoped here for item-specific tweaks. */
.directory-item {
  contain: layout style;
  will-change: background, opacity;
}
</style>
