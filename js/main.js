// Language Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
    const langToggle = document.getElementById('lang-toggle');
    const html = document.documentElement;
    
    // Check for saved language preference or default to Japanese
    const currentLang = localStorage.getItem('preferredLanguage') || 'ja';
    html.setAttribute('lang', currentLang);
    
    // Toggle language
    langToggle.addEventListener('click', function() {
        const newLang = html.getAttribute('lang') === 'en' ? 'ja' : 'en';
        html.setAttribute('lang', newLang);
        localStorage.setItem('preferredLanguage', newLang);
        
        // Update page title and meta description
        updatePageMeta(newLang);
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Update meta tags based on language
    function updatePageMeta(lang) {
        const title = lang === 'ja' 
            ? 'Illumenza - スマートテクノロジーでより良いビジネス判断を'
            : 'Illumenza - Smart Technology for Smarter Business Decisions';
        
        const description = lang === 'ja'
            ? 'Illumenzaは、企業が顧客インサイトを収集、理解、活用して測定可能な結果を得るのに役立つインテリジェントなソリューションを作成します。'
            : 'Illumenza creates intelligent solutions that help businesses capture, understand, and leverage customer insights for measurable results.';
            
        document.title = title;
        document.querySelector('meta[name="description"]').setAttribute('content', description);
        document.querySelector('meta[property="og:title"]').setAttribute('content', title);
        document.querySelector('meta[property="og:description"]').setAttribute('content', description);
        document.querySelector('meta[property="twitter:title"]').setAttribute('content', title);
        document.querySelector('meta[property="twitter:description"]').setAttribute('content', description);
    }
    
    // Initialize with current language
    updatePageMeta(currentLang);
});

// Add scroll effect to navigation
window.addEventListener('scroll', function() {
    const nav = document.querySelector('nav');
    if (window.scrollY > 50) {
        nav.classList.add('shadow-lg');
    } else {
        nav.classList.remove('shadow-lg');
    }
});

// Intersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            
            // Add staggered animation to child elements
            const delayElements = entry.target.querySelectorAll('[class*="delay-"]');
            delayElements.forEach(el => {
                el.classList.add('visible');
            });
        }
    });
}, observerOptions);

// Observe all animation elements
document.addEventListener('DOMContentLoaded', function() {
    const animatedElements = document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right, .scale-in');
    animatedElements.forEach(el => {
        observer.observe(el);
    });
});