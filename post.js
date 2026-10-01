// Reading-progress bar and table-of-contents highlighting for article pages.
(() => {
    const bar = document.getElementById('readingProgress');
    const tocLinks = [...document.querySelectorAll('.post-toc a')];
    const targets = tocLinks
        .map(a => document.getElementById(a.getAttribute('href').slice(1)))
        .filter(Boolean);

    let ticking = false;
    const update = () => {
        ticking = false;
        const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        if (bar && max > 0) bar.style.width = (window.scrollY / max) * 100 + '%';

        let current = '';
        targets.forEach(el => { if (el.getBoundingClientRect().top <= 140) current = el.id; });
        tocLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
    };

    window.addEventListener('scroll', () => {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
})();
