<template>
  <div id="board-wrapper">
    <div id="board">
      <div
        v-for="({ bc, chip, locked, isRemove, isFree, isLastChip }, key) in cells"
        :key="key"
        class="cell"
        :class="{
          'free-cell': isFree,
          'no-hover': isFree || !isRemove,
          'remove-target': isRemove,
        }"
        @click="!isFree && emit('cell-click', Math.floor(key / 10), key % 10)"
        @contextmenu.prevent
      >
        <template v-if="isFree">
          <div class="free-label">FREE</div>
        </template>
        <template v-else>
          <div class="card-rank">{{ rank(bc) }}</div>
          <div class="card-suit" :class="isRed(bc) ? 'red-suit' : 'black-suit'">{{ suitChar(bc) }}</div>
        </template>
        <div v-if="chip" class="chip" :class="[chip, locked ? 'seq' : '', isLastChip ? 'last-chip' : '']" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BOARD, rank, suitChar, isRed } from '../game/gameLogic.js'

const props = defineProps({
  board:        { type: Array,  required: true },
  locked:       { type: Array,  required: true },
  removeSet:    { type: Set,    default: () => new Set() },
  lastChipKey:  { type: String, default: null },
})
const emit = defineEmits(['cell-click'])

const cells = computed(() => {
  const out = []
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const key = `${r},${c}`
      out.push({
        bc:         BOARD[r][c],
        chip:       props.board[r][c],
        locked:     props.locked[r][c],
        isRemove:   props.removeSet.has(key),
        isFree:     BOARD[r][c] === 'FREE',
        isLastChip: props.lastChipKey === key,
      })
    }
  }
  return out
})
</script>

<style scoped>
#board-wrapper {
  height: 100vh;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  padding: 4px;
  background: #111;
  border-right: 3px solid #333;
}

#board {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  grid-template-rows: repeat(10, 1fr);
  gap: 2px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
}

.cell {
  background: #f5f0e8;
  border-radius: 2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  border: 2px solid transparent;
  transition: border-color 0.1s, background 0.1s;
  user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
  overflow: hidden;
}
.cell:hover:not(.no-hover) { border-color: #ffd700; }
.cell.no-hover  { cursor: default; }
.cell.free-cell { background: #c8e6c9; cursor: default; }
.cell.remove-target {
  border-color: #ff3300 !important;
  background: #ffaa88;
  box-shadow: inset 0 0 6px rgba(220,80,0,0.5);
}

.card-rank  { font-size: 2.2vh; font-weight: bold; line-height: 1; color: #111; }
.card-suit  { font-size: 1.8vh; line-height: 1; }
.red-suit   { color: #cc0000; }
.black-suit { color: #111; }
.free-label { font-size: 1.5vh; font-weight: bold; color: #2e7d32; letter-spacing: -0.5px; }

.chip {
  position: absolute;
  width: 74%; height: 74%;
  border-radius: 50%;
  border: 2px solid rgba(0,0,0,0.2);
  pointer-events: none;
}
.chip.p0 { background: radial-gradient(circle at 35% 35%, #7eb3ff, #1144bb); }
.chip.p1 { background: radial-gradient(circle at 35% 35%, #ff9999, #bb1111); }
.chip.seq { border: 2.5px solid gold; box-shadow: 0 0 5px gold; }
.chip.last-chip {
  box-shadow: 0 0 0 2.5px white, 0 0 0 4.5px rgba(255,255,255,0.5);
  animation: last-chip-pulse 1.8s ease-in-out infinite;
}
.chip.seq.last-chip {
  box-shadow: 0 0 5px gold, 0 0 0 2.5px white, 0 0 0 4.5px rgba(255,255,255,0.5);
}
@keyframes last-chip-pulse {
  0%, 100% { box-shadow: 0 0 0 2px white, 0 0 0 4px rgba(255,255,255,0.4); }
  50%       { box-shadow: 0 0 0 3px white, 0 0 0 6px rgba(255,255,255,0.7); }
}
</style>
