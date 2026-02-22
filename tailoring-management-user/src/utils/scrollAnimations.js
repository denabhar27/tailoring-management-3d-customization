
export const initScrollAnimations = () => {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');

      }
    });
  }, observerOptions);

  const animatedElements = document.querySelectorAll(
    '.fade-in-up, .fade-in-left, .fade-in-right, .scale-in, .stagger-children'
  );

  animatedElements.forEach(el => observer.observe(el));

  return observer;
};

export const initHeaderScroll = () => {
  const header = document.querySelector('.header');
  if (!header) return;

  let lastScroll = 0;
  const scrollThreshold = 50;

  const handleScroll = () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > scrollThreshold) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  return () => window.removeEventListener('scroll', handleScroll);
};

export const smoothScrollTo = (elementId, offset = 100) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
  const elementPosition = element.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - headerHeight - offset;

  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth'
  });
};

export const initParallax = () => {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const handleScroll = () => {
    const scrolled = window.pageYOffset;
    const rate = scrolled * 0.5;

    if (scrolled < window.innerHeight) {
      hero.style.transform = `translateY(${rate}px)`;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  return () => window.removeEventListener('scroll', handleScroll);
};

