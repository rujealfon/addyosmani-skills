<script setup lang="ts">
import type { Habit } from '../utils/tracker-model'

const props = defineProps<{
  habit: Habit
  done: boolean
  disabled: boolean
  stats: { current: number; longest: number; completedThisWeek?: number }
}>()
const emit = defineEmits<{ toggle: [done: boolean] }>()
const unit = computed(() => props.habit.schedule.kind === 'daily' ? 'day' : 'week')
function change(event: Event) {
  const input = event.target as HTMLInputElement
  emit('toggle', input.checked)
  // A failed synchronous save may leave the prop unchanged. Restore native state too.
  input.checked = props.done
}
</script>

<template>
  <li class="habit-item" :class="{ 'is-done': done }">
    <div class="habit-main">
      <label class="habit-check" :for="`habit-${habit.id}`">
        <input
          :id="`habit-${habit.id}`" type="checkbox" :checked="done" :disabled="disabled"
          :aria-describedby="`goal-${habit.id} status-${habit.id}`" @change="change"
        >
        <span class="habit-copy">
          <span class="habit-name">{{ habit.name }}</span>
          <span :id="`goal-${habit.id}`" class="habit-goal">{{ habit.thresholdDescription }}</span>
        </span>
      </label>
      <span :id="`status-${habit.id}`" class="completion-status">{{ done ? 'Done today' : 'Not done yet' }}</span>
    </div>
    <div class="habit-details">
      <dl class="streak-stats">
        <div><dt>Current streak</dt><dd>{{ stats.current }} {{ unit }}{{ stats.current === 1 ? '' : 's' }}</dd></div>
        <div><dt>Longest streak</dt><dd>{{ stats.longest }} {{ unit }}{{ stats.longest === 1 ? '' : 's' }}</dd></div>
      </dl>
      <p v-if="habit.schedule.kind === 'weekly'" class="schedule-note">
        {{ stats.completedThisWeek }} of {{ habit.schedule.targetDays }} days this week
        <span>Monday to Sunday</span>
      </p>
      <p v-else class="schedule-note">Daily goal<span>Today stays open until midnight</span></p>
    </div>
  </li>
</template>
