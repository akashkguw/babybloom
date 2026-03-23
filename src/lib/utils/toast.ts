/**
 * Show a toast notification
 */
export function toast(message: string): void {
  const toastEl = document.getElementById('toast');
  if (toastEl) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2000);
  }
}
