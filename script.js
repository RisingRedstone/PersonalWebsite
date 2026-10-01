// Shared site behaviour: mobile navigation and active-section highlighting.
(() => {
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    const setMenu = open => {
        navToggle?.classList.toggle('active', open);
        navLinks?.classList.toggle('active', open);
        navToggle?.setAttribute('aria-expanded', String(open));
    };

    navToggle?.addEventListener('click', () => setMenu(!navLinks.classList.contains('active')));
    navLinks?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

    // Highlight the nav link for the section in view (home page only).
    const sectionLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
    if (!sectionLinks.length || !('IntersectionObserver' in window)) return;

    const targets = sectionLinks
        .map(a => document.querySelector(a.getAttribute('href')))
        .filter(Boolean);

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            sectionLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
        });
    }, { rootMargin: '-40% 0px -55% 0px' });

    targets.forEach(t => observer.observe(t));
})();
