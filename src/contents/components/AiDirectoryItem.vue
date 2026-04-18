<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import { getMappedStyle, getModuleIcon, getProgressWidth } from '../logic/ui_utils';

const props = defineProps<{
  item: any;
  moduleMapping: any;
}>();

const emit = defineEmits(['jump', 'toggle-fold']);

const handleJump = () => {
  emit('jump', props.item.floor);
};

const handleToggleFold = () => {
  emit('toggle-fold', props.item.id);
};

// Optimization: Pre-calculate zones to avoid repetitive lookups in template
const hasPrimaryZone = (metadata: any) => {
  return Object.entries(metadata).some(([k, v]) => 
    ['header', 'block', 'quote'].includes(getMappedStyle(k, v, props.moduleMapping)) && 
    k !== 'floor' && k !== 'level'
  );
};

const hasDetailsZone = (metadata: any) => {
  return Object.entries(metadata).some(([k, v]) => 
    ['pill', 'attr', 'progress'].includes(getMappedStyle(k, v, props.moduleMapping)) && 
    k !== 'floor' && k !== 'level'
  );
};

const isHeader = (k: string, v: any) => getMappedStyle(k, v, props.moduleMapping) === 'header';

</script>

<template>
  <div 
    v-memo="[item.id, item.metadata, item.isCollapsed, item.hasChildren, item.level, moduleMapping]"
    class="one-ai-item-container"
    :class="['level-' + (item.level || 1)]"
    :style="{ '--level': item.level || 1 }"
    @click="handleJump"
  >
    <div v-if="item.metadata" class="one-ai-grid">
      <!-- 1. Primary Zone: Headers, Blocks, Quotes -->
      <div v-if="hasPrimaryZone(item.metadata)" class="one-ai-primary-zone">
        <template v-for="(val, key) in item.metadata" :key="key">
          <template v-if="key !== 'floor' && key !== 'level'">
            <template v-if="getMappedStyle(key, val, moduleMapping) === 'header'">
              <div class="one-style-header">
                <div v-if="item.hasChildren" class="one-fold-trigger" @click.stop="handleToggleFold">
                  <i class="fa-solid" :class="item.isCollapsed ? 'fa-square-plus' : 'fa-square-minus'"></i>
                </div>
                <div class="one-h-text">{{ val }}</div>
                <div class="one-floor-badge-inline">#{{ item.floor }}</div>
              </div>
            </template>

            <template v-else-if="getMappedStyle(key, val, moduleMapping) === 'quote'">
              <div class="one-style-quote">
                <i class="fa-solid fa-quote-left"></i>
                <div class="one-q-text">{{ val }}</div>
              </div>
            </template>

            <template v-else-if="getMappedStyle(key, val, moduleMapping) === 'block'">
              <div class="one-style-block">
                {{ val }}
              </div>
            </template>
          </template>
        </template>
      </div>

      <!-- 2. Details Zone: Pills, Attrs, Progress -->
      <div v-if="hasDetailsZone(item.metadata)" class="one-ai-details-zone">
        <template v-for="(val, key) in item.metadata" :key="key">
          <template v-if="key !== 'floor' && key !== 'level'">
            <template v-if="getMappedStyle(key, val, moduleMapping) === 'pill'">
              <div class="one-style-pill">
                <i class="fa-solid" :class="getModuleIcon(key)"></i>
                <span>{{ val }}</span>
              </div>
            </template>

            <template v-else-if="getMappedStyle(key, val, moduleMapping) === 'attr'">
              <div class="one-style-attr">
                <span class="one-attr-key">{{ key }}:</span>
                <span class="one-attr-val">{{ val }}</span>
              </div>
            </template>

            <template v-else-if="getMappedStyle(key, val, moduleMapping) === 'progress'">
              <div class="one-style-progress">
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
        </template>
      </div>

      <!-- 3. Fallback Floor Badge (if no header) -->
      <div v-if="!Object.keys(item.metadata).some(k => isHeader(k, item.metadata[k]))" class="one-floor-badge-unified">
        #{{ item.floor }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.one-ai-item-container {
  contain: paint layout style;
  will-change: transform, opacity;
}
</style>
