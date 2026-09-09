document.querySelectorAll('[data-copy-platforms]').forEach((button) => {
  button.addEventListener('click', async () => {
    const panel = button.closest('.platform-copy');
    const text = Array.from(panel.querySelectorAll('li'), (item) => item.textContent.trim()).join('\n');
    const status = panel.querySelector('[role="status"]');
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const field = document.createElement('textarea');
      field.value = text;
      field.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.append(field);
      field.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
      field.remove();
      button.focus({ preventScroll: true });
    }
    status.textContent = copied ? 'Список скопирован — каждая площадка с новой строки.' : 'Не удалось скопировать. Выделите список и скопируйте вручную.';
  });
});
