<script setup lang="ts">
import { createTrackerState } from './utils/tracker-state'
import { STORAGE_KEY } from './utils/tracker-storage'

useHead({ title: 'Today · Daily practice', htmlAttrs: { lang: 'en' } })
const { document: tracker, today, ready, error, announcement, rows, refresh, toggle, retry } =
  createTrackerState(() => window.localStorage)
const completed = computed(() => rows.value.filter(row => row.done).length)
const formattedDate = computed(() => today.value
  ? new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(`${today.value}T12:00:00`))
  : '')
let midnightTimer: ReturnType<typeof setTimeout> | undefined

function update() {
  refresh()
  clearTimeout(midnightTimer)
  const now = new Date()
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  midnightTimer = setTimeout(update, nextMidnight.getTime() - now.getTime() + 50)
}
function storageChanged(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) update()
}
function visibilityChanged() {
  if (document.visibilityState === 'visible') update()
}
onMounted(() => {
  update()
  window.addEventListener('focus', update)
  window.addEventListener('storage', storageChanged)
  document.addEventListener('visibilitychange', visibilityChanged)
})
onBeforeUnmount(() => {
  clearTimeout(midnightTimer)
  window.removeEventListener('focus', update)
  window.removeEventListener('storage', storageChanged)
  document.removeEventListener('visibilitychange', visibilityChanged)
})
</script>

<template>
  <a class="skip-link" href="#habits">Skip to habits</a>
  <div class="app-shell">
    <header class="app-header"><span class="brand-mark" aria-hidden="true">✓</span>Daily practice</header>
    <main id="habits" tabindex="-1">
      <header class="today-header">
        <div><h1>Today's habits</h1><p><time v-if="today" :datetime="today">{{ formattedDate }}</time><span v-else>Your daily check-in</span></p></div>
        <p v-if="tracker" class="daily-count"><strong>{{ completed }} / {{ rows.length }}</strong>done today</p>
      </header>

      <div v-if="error" class="error-message" role="alert">
        <h2>{{ error.code === 'write-failed' ? 'Your change was not saved' : 'Saved habits are unavailable' }}</h2>
        <p>{{ error.message }}</p><button type="button" @click="retry">Try again</button>
      </div>
      <p v-if="!tracker && !error" class="loading-state" role="status">Loading your habits…</p>
      <template v-if="tracker">
        <p v-if="rows.length === 0" class="loading-state">No habits are saved in this tracker yet.</p>
        <ul v-else class="habit-list" aria-label="Habits for today">
          <HabitItem v-for="row in rows" :key="row.habit.id"
            :habit="row.habit" :done="row.done" :stats="row.stats" :disabled="!ready || !row.eligible"
            @toggle="toggle(row.habit.id, $event)" />
        </ul>
        <p class="streak-help">An unfinished today keeps yesterday's streak. A missed day resets it. Weekly streaks follow your weekly goal.</p>
      </template>
      <p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
      <noscript><p>Enable JavaScript to save habits and mark today done. Your history stays in this browser.</p></noscript>
    </main>
    <footer><p><strong>Your habits stay on this device.</strong> No account or cloud sync.</p><p>Clearing this browser's site data removes your history.</p></footer>
  </div>
</template>

<style>
@import './assets/main.css';
</style>
