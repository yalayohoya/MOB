import { writable } from 'svelte/store';
import { auth } from './auth';

const IDLE_LIMIT = 28800; // 8 hours (28800 seconds)

export const idleTimeLeft = writable<number>(IDLE_LIMIT);
let timerInterval: any = null;

export function resetIdleTimer() {
  idleTimeLeft.set(IDLE_LIMIT);
}

export function startIdleTimer() {
  stopIdleTimer();
  resetIdleTimer();
  timerInterval = setInterval(() => {
    idleTimeLeft.update((n) => {
      if (n <= 1) {
        stopIdleTimer();
        // Trigger auto-logout
        auth.logout();
        return 0;
      }
      return n - 1;
    });
  }, 1000);
}

export function stopIdleTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}
