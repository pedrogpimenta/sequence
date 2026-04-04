<template>
  <div
    v-if="card"
    class="truco-card"
    :class="{ selected, played: false, clickable, small, macho: isMacho(card) }"
    :style="cardStyle"
    @click="emit('click')"
  >
    <div class="cn top">{{ cardNum(card) }}</div>
    <div class="cs">{{ SUIT_SYMBOLS[cardSuit(card)] }}</div>
    <div class="cn bot">{{ cardNum(card) }}</div>
    <div v-if="isMacho(card)" class="macho-dot">★</div>
  </div>
  <div v-else class="truco-card empty" :class="{ small }"></div>
</template>

<script setup>
import { computed } from 'vue'
import { cardSuit, cardNum, SUIT_SYMBOLS, SUIT_COLORS, isMacho } from '../game/trucoLogic.js'

const props = defineProps({
  card:      { type: String, default: null },
  selected:  { type: Boolean, default: false },
  played:    { type: Boolean, default: false },
  clickable: { type: Boolean, default: false },
  small:     { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

const cardStyle = computed(() => {
  if (!props.card) return {}
  const s = cardSuit(props.card)
  const c = SUIT_COLORS[s]
  return {
    background: c.bg,
    borderColor: props.selected ? '#fff' : c.border,
    color: c.text,
    boxShadow: props.selected
      ? '0 0 0 3px #fff, 0 4px 16px rgba(0,0,0,0.5)'
      : '0 2px 8px rgba(0,0,0,0.4)',
    transform: props.selected ? 'translateY(-6px)' : '',
    cursor: props.clickable ? 'pointer' : 'default',
    opacity: props.played ? 0.25 : 1,
  }
})
</script>

<style scoped>
.truco-card {
  position: relative;
  width: 54px;
  height: 78px;
  border-radius: 8px;
  border: 2px solid;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s, box-shadow 0.12s;
  user-select: none;
  flex-shrink: 0;
}
.truco-card.small {
  width: 38px;
  height: 54px;
  border-radius: 5px;
}
.truco-card.clickable:hover {
  transform: translateY(-4px);
}
.truco-card.empty {
  background: rgba(255,255,255,0.04);
  border: 2px dashed rgba(255,255,255,0.15);
}

.cn {
  font-size: 1.15em;
  font-weight: bold;
  line-height: 1;
  position: absolute;
}
.cn.top { top: 4px; left: 6px; }
.cn.bot { bottom: 4px; right: 6px; transform: rotate(180deg); }

.cs {
  font-size: 1.6em;
  line-height: 1;
}

.small .cn { font-size: 0.85em; }
.small .cn.top { top: 2px; left: 4px; }
.small .cn.bot { bottom: 2px; right: 4px; }
.small .cs { font-size: 1.1em; }

.macho-dot {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 0.55em;
  opacity: 0.7;
  color: #ffd700;
}

.truco-card.macho {
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
}
</style>
