/**
 * Guide page interactions — guide.js
 * Tab switching, TOC active tracking, copy buttons.
 */

// ─── Tab switching ────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-group').forEach(group => {
  const tabs = group.querySelectorAll('.tab');
  const panels = group.parentElement.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      group.parentElement.querySelector(`[data-panel="${tab.dataset.tab}"]`)?.classList.add('active');
    });
  });
});

// ─── Copy buttons ─────────────────────────────────────────────────────────────
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const code = btn.nextElementSibling?.querySelector('code')?.innerText ?? '';
    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = '✓';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = '⎘'; btn.classList.remove('copied'); }, 1500);
    } catch { /* clipboard blocked */ }
  });
});

// ─── TOC active tracking (Intersection Observer) ───────────────────────────────
const tocLinks = document.querySelectorAll('.toc-link');
const sections = document.querySelectorAll('.doc-section, [id]');

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      tocLinks.forEach(l => {
        l.classList.toggle('active', l.getAttribute('href') === `#${id}`);
      });
    }
  });
}, { rootMargin: '-20% 0px -70% 0px' });

document.querySelectorAll('section[id], h2[id], h3[id]').forEach(el => observer.observe(el));
