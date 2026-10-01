// ===== Navigation =====
const navbar = document.getElementById('navbar') || document.querySelector('.navbar');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

// Scroll effect for navbar
window.addEventListener('scroll', () => {
    if (navbar && window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else if (navbar) {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle
navToggle?.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navLinks.classList.toggle('active');
    navToggle.setAttribute('aria-expanded', navLinks.classList.contains('active'));
});

// Close mobile menu on link click
navLinks?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
    });
});

// ===== Typing Effect =====
const taglineElement = document.getElementById('taglineLine');
const taglines = [
    'AI Researcher & Systems Engineer',
    'Building at 1.25B ops/sec',
    'From CUDA kernels to multi-agent RL',
    'Masters of IT (AI) at UNSW'
];

let taglineIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingSpeed = 100;

function typeEffect() {
    const currentTagline = taglines[taglineIndex];
    
    if (isDeleting) {
        taglineElement.textContent = currentTagline.substring(0, charIndex - 1);
        charIndex--;
        typingSpeed = 50;
    } else {
        taglineElement.textContent = currentTagline.substring(0, charIndex + 1);
        charIndex++;
        typingSpeed = 100;
    }
    
    if (!isDeleting && charIndex === currentTagline.length) {
        typingSpeed = 2000; // Pause at end
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        taglineIndex = (taglineIndex + 1) % taglines.length;
        typingSpeed = 500; // Pause before next
    }
    
    setTimeout(typeEffect, typingSpeed);
}

// Start typing effect after page loads
if (taglineElement) setTimeout(typeEffect, 1500);

// ===== Scroll Reveal Animation =====
const revealElements = document.querySelectorAll(
    '.timeline-item, .project-card, .skill-category, .pub-card, .achieve-item, .stat-card, .contact-card'
);

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
});

revealElements.forEach(el => {
    el.classList.add('reveal');
    revealObserver.observe(el);
});

// ===== Smooth Scroll for Safari =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// ===== Active Nav Link on Scroll =====
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-links a');

function highlightNavOnScroll() {
    const scrollY = window.scrollY + 100;
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        
        if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
            navItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('href') === `#${sectionId}`) {
                    item.classList.add('active');
                }
            });
        }
    });
}

window.addEventListener('scroll', highlightNavOnScroll);

// ===== Performance: Reduce animations on low-end devices =====
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (prefersReducedMotion.matches && taglineElement) {
    taglineElement.textContent = taglines[0];
}

// ===== Console Easter Egg =====
console.log('%c👋 Hey there, curious developer!', 'font-size: 20px; color: #6366f1; font-weight: bold;');
console.log('%cLike what you see? Let\'s connect: prathamgohil751@gmail.com', 'font-size: 14px; color: #a0a0b0;');
console.log('%cGitHub: https://github.com/RisingRedstone', 'font-size: 12px; color: #6a6a7a;');
