const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const player = document.querySelector('.player');
const fullVideo = player.querySelector('video');
const playerTitle = player.querySelector('h2');
const gallery = document.querySelector('.reels');
const cards = [...gallery.querySelectorAll('.reel')];
const buttons = [...document.querySelectorAll('[data-slide]')];
const previewToggle = document.querySelector('.preview-toggle');
const counter = document.querySelector('.gallery-count');
const progress = document.querySelector('.gallery-progress span');
const preview = document.createElement('video');
preview.muted = false;
// Sound is on by default. Browsers refuse sound before the visitor's first tap or key press,
// so the preview starts muted in that case and unmutes on the first interaction.
let soundWanted = true;
let soundBlocked = false;
const ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4Z" fill="currentColor"/><path d="M15.500 9a4.200 4.200 0 0 1 0 6M18 6.500a7.800 7.800 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4Z" fill="currentColor"/><path d="m15.500 9.500 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"/></svg>';
const soundButton = document.createElement('button');
soundButton.type = 'button';
soundButton.className = 'sound-toggle';
function updateSoundButton() {
  const audible = !preview.muted;
  soundButton.innerHTML = audible ? ICON_ON : ICON_OFF;
  soundButton.setAttribute('aria-label', translate(audible ? 'Mute sound' : 'Turn sound on'));
  soundButton.setAttribute('aria-pressed', String(audible));
}
soundButton.addEventListener('click', event => {
  event.stopPropagation();
  soundBlocked = false;
  soundWanted = preview.muted;
  preview.muted = !soundWanted;
  updateSoundButton();
});
const unlockSound = () => {
  soundBlocked = false;
  if (soundWanted && preview.muted) { preview.muted = false; updateSoundButton(); }
};
['pointerdown', 'keydown', 'touchend'].forEach(type => document.addEventListener(type, unlockSound, { once: true }));
preview.loop = true;
preview.playsInline = true;
preview.preload = 'none';
preview.setAttribute('aria-hidden', 'true');
let currentIndex = -1;
let previewEnabled = !reducedMotion.matches;
let galleryVisible = false;
let loadTimer;
let trigger;
let scrollTrigger;
let drag;
let suppressClick = false;
let scrollFrame;

function updatePlayback() {
  const playing = previewEnabled && galleryVisible && !player.open && !document.hidden;
  previewToggle.textContent = previewEnabled ? 'Ⅱ' : '▶';
  previewToggle.setAttribute('aria-label', translate(previewEnabled ? 'Pause video preview' : 'Play video preview'));
  previewToggle.setAttribute('aria-pressed', String(previewEnabled));
  if (playing && preview.getAttribute('src')) {
    preview.muted = !soundWanted || soundBlocked;
    preview.play().catch(error => {
      if (error.name !== 'NotAllowedError') return;
      if (!preview.muted) {
        soundBlocked = true;
        preview.muted = true;
        updateSoundButton();
        return preview.play().catch(() => { previewEnabled = false; updatePlayback(); });
      }
      previewEnabled = false;
      updatePlayback();
    });
    updateSoundButton();
  } else {
    preview.pause();
  }
}

function selectCard(index) {
  if (index === currentIndex) return;
  currentIndex = index;
  cards.forEach((card, position) => card.classList.toggle('is-active', position === index));
  counter.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
  progress.style.transform = 'scaleX(' + (index + 1) / cards.length + ')';
  buttons[0].disabled = index === 0;
  buttons[1].disabled = index === cards.length - 1;
  clearTimeout(loadTimer);
  preview.pause();
  preview.remove();
  soundButton.remove();
  const button = cards[index].querySelector('.reel-preview');
  previewToggle.disabled = !button;
  if (!button) return;
  loadTimer = setTimeout(() => {
    preview.src = button.dataset.video;
    preview.poster = button.querySelector('img').src;
    button.append(preview);
    button.after(soundButton);
    updatePlayback();
  }, 220);
}

function cardOffset(index) {
  const first = cards[0].offsetLeft;
  return cards[index].offsetLeft - first;
}

function syncGallery() {
  scrollFrame = null;
  const center = gallery.scrollLeft;
  let nearest = 0;
  let distance = Infinity;
  cards.forEach((card, index) => {
    const difference = Math.abs(cardOffset(index) - center);
    if (difference < distance) {
      distance = difference;
      nearest = index;
    }
  });
  selectCard(nearest);
}

function goTo(index, instant = false) {
  const target = Math.max(0, Math.min(cards.length - 1, index));
  if (scrollTrigger) {
    const fraction = cardOffset(target) / (gallery.scrollWidth - gallery.clientWidth);
    const top = scrollTrigger.start + fraction * (scrollTrigger.end - scrollTrigger.start);
    window.scrollTo({ top, behavior: instant || reducedMotion.matches ? 'instant' : 'smooth' });
  } else {
    gallery.scrollTo({ left: cardOffset(target), behavior: instant || reducedMotion.matches ? 'instant' : 'smooth' });
  }
}

gallery.addEventListener('scroll', () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(syncGallery);
}, { passive: true });
buttons.forEach(button => button.addEventListener('click', () => goTo(currentIndex + Number(button.dataset.slide))));
gallery.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Home') goTo(0);
  else if (event.key === 'End') goTo(cards.length - 1);
  else goTo(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
});
gallery.addEventListener('focusin', event => {
  const card = event.target.closest('.reel');
  if (card) goTo(cards.indexOf(card), true);
});
gallery.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  drag = { x: event.clientX, left: gallery.scrollLeft, moved: false };
});
gallery.addEventListener('pointermove', event => {
  if (!drag) return;
  const distance = drag.x - event.clientX;
  if (Math.abs(distance) < 6 && !drag.moved) return;
  drag.moved = true;
  gallery.classList.add('dragging');
  gallery.setPointerCapture(event.pointerId);
  const left = Math.max(0, Math.min(gallery.scrollWidth - gallery.clientWidth, drag.left + distance));
  if (scrollTrigger) {
    window.scrollTo(0, scrollTrigger.start + left / (gallery.scrollWidth - gallery.clientWidth) * (scrollTrigger.end - scrollTrigger.start));
  } else gallery.scrollLeft = left;
});
function endDrag() {
  if (!drag) return;
  suppressClick = drag.moved;
  gallery.classList.remove('dragging');
  drag = null;
  if (suppressClick) {
    goTo(currentIndex);
    setTimeout(() => { suppressClick = false; }, 0);
  }
}
gallery.addEventListener('pointerup', endDrag);
gallery.addEventListener('pointercancel', endDrag);
gallery.addEventListener('dragstart', event => event.preventDefault());
gallery.addEventListener('wheel', event => {
  if (!scrollTrigger || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
  event.preventDefault();
  window.scrollBy(0, event.deltaX);
}, { passive: false });
gallery.addEventListener('click', event => {
  if (suppressClick) { event.preventDefault(); return; }
  const button = event.target.closest('.reel-preview');
  if (!button) return;
  const index = cards.indexOf(button.closest('.reel'));
  if (index !== currentIndex) { goTo(index); return; }
  trigger = button;
  playerTitle.textContent = cards[index].querySelector('h3').textContent;
  fullVideo.src = button.dataset.video;
  player.showModal();
  updatePlayback();
  if (!reducedMotion.matches) {
    player.animate(
      [{ opacity: 0, transform: 'translateY(30px) scale(.97)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }],
      { duration: 350, easing: 'cubic-bezier(.22,1,.36,1)' }
    );
  }
  fullVideo.play().catch(() => {});
});
player.addEventListener('close', () => {
  fullVideo.pause();
  fullVideo.removeAttribute('src');
  fullVideo.load();
  trigger?.focus({ preventScroll: true });
  updatePlayback();
});
previewToggle.addEventListener('click', () => {
  previewEnabled = !previewEnabled;
  updatePlayback();
});
document.addEventListener('visibilitychange', updatePlayback);
document.addEventListener('portfolio:languagechange', () => { updatePlayback(); updateSoundButton(); });
reducedMotion.addEventListener('change', () => {
  previewEnabled = !reducedMotion.matches;
  updatePlayback();
});
new IntersectionObserver(entries => {
  galleryVisible = entries[0].isIntersecting;
  updatePlayback();
}, { threshold: .2 }).observe(gallery);
new ResizeObserver(() => {
  if (!scrollTrigger) gallery.scrollLeft = cardOffset(Math.max(currentIndex, 0));
  syncGallery();
}).observe(gallery);
selectCard(0);

if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  const media = gsap.matchMedia();
  media.add('(min-width: 901px) and (min-height: 650px) and (prefers-reduced-motion: no-preference)', () => {
    gallery.classList.add('scroll-driven');
    const tween = gsap.to(gallery, {
      scrollLeft: () => gallery.scrollWidth - gallery.clientWidth,
      ease: 'none',
      scrollTrigger: {
        trigger: '.work-stage',
        start: 'top top',
        end: () => '+=' + (gallery.scrollWidth - gallery.clientWidth),
        pin: true,
        scrub: .3,
        snap: { snapTo: 1 / (cards.length - 1), delay: .15, duration: { min: .15, max: .4 }, inertia: false },
        invalidateOnRefresh: true,
        onUpdate: syncGallery,
      },
    });
    scrollTrigger = tween.scrollTrigger;
    return () => {
      scrollTrigger = null;
      gallery.classList.remove('scroll-driven');
    };
  });
  media.add('(prefers-reduced-motion: no-preference)', () => {
    const hero = document.querySelector('.hero');
    // Interactive 2D character: head tilts and eyes follow the cursor, blinks, smiles on hover.
    // Character: DiceBear "Lorelei" (CC0) with swappable eyes/mouth, built by source/build_lorelei.py.
    const svg = document.querySelector('.toon');
    const head = svg.querySelector('.lo-head');
    const eyesOpen = svg.querySelector('.lo-eyes');
    const eyesClosed = svg.querySelector('.lo-eyes-closed');
    const brows = svg.querySelector('.lo-brows');
    const neutral = svg.querySelector('.lo-mouth');
    const smile = svg.querySelector('.lo-smile');
    gsap.set(head, { svgOrigin: '490 860' });
    const quick = (el, prop, d = .5) => gsap.quickTo(el, prop, { duration: d, ease: 'power3.out' });
    const turn = quick(head, 'rotation', .8);
    const moves = [[eyesOpen, 16, 9], [eyesClosed, 16, 9], [brows, 11, 7], [neutral, 8, 5], [smile, 8, 5]]
      .map(([el, ax, ay]) => ({ x: quick(el, 'x'), y: quick(el, 'y'), ax, ay }));
    let usingPointer = false, idleFrame;
    const lookAt = (nx, ny) => {                 // nx, ny in -1..1
      turn(nx * 3.5);
      moves.forEach(m => { m.x(nx * m.ax); m.y(ny * m.ay); });
    };
    const followPointer = event => {
      if (event.pointerType === 'touch') return;
      usingPointer = true;
      const box = svg.getBoundingClientRect();
      const cx = box.left + box.width / 2, cy = box.top + box.height * .45;
      lookAt(gsap.utils.clamp(-1, 1, (event.clientX - cx) / (innerWidth * .35)),
             gsap.utils.clamp(-1, 1, (event.clientY - cy) / (innerHeight * .45)));
    };
    const resetPose = () => { usingPointer = false; };
    const idle = () => {                         // no mouse (phones): slowly look around
      if (!usingPointer) {
        const t = performance.now() / 1000;
        lookAt(Math.sin(t * .5) * .6, Math.sin(t * .37 + 1) * .4);
      }
      idleFrame = requestAnimationFrame(idle);
    };
    const blink = gsap.timeline({ repeat: -1, repeatDelay: 3.4, delay: 2 })
      .set(eyesOpen, { opacity: 0 }).set(eyesClosed, { opacity: 1 })
      .set(eyesOpen, { opacity: 1 }, '+=.13').set(eyesClosed, { opacity: 0 }, '<');
    const happy = on => {
      gsap.to(smile, { opacity: on ? 1 : 0, duration: .15 });
      gsap.to(neutral, { opacity: on ? 0 : 1, duration: .15 });
    };
    const smileTriggers = document.querySelectorAll('a[href="#contact"], a[href^="mailto:"], .hero-copy .pill');
    const onEnter = () => happy(true), onLeave = () => happy(false);
    smileTriggers.forEach(el => { el.addEventListener('pointerenter', onEnter); el.addEventListener('pointerleave', onLeave); });
    idleFrame = requestAnimationFrame(idle);
    document.addEventListener('pointermove', followPointer);
    document.documentElement.addEventListener('pointerleave', resetPose);
    const visibility = new IntersectionObserver(entries => {
      const on = entries[0].isIntersecting;
      blink.paused(!on);
      cancelAnimationFrame(idleFrame);
      if (on) idleFrame = requestAnimationFrame(idle);
    });
    visibility.observe(hero);
    gsap.timeline({ defaults: { duration: .8, ease: 'power3.out', clearProps: 'transform,opacity' } })
      .from('.hero h1 > *', { y: 25, opacity: 0, stagger: .12 })
      .from('.portrait', { y: 35, opacity: 0 }, .2)
      .from('.hero-copy, .hero-links', { opacity: 0 }, .45);
    document.querySelectorAll('.services .section-title, .clients .section-title, .contact .section-title').forEach(heading => {
      gsap.from(heading, {
        y: 32,
        opacity: .2,
        duration: .8,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: heading, start: 'top 85%', once: true },
      });
    });
    document.querySelectorAll('.performance-card').forEach(account => {
      gsap.from(account, {
        x: 35, opacity: .3, duration: .65, ease: 'power3.out', clearProps: 'transform,opacity',
        scrollTrigger: { trigger: account, start: 'top 88%', once: true },
      });
    });
    return () => {
      document.removeEventListener('pointermove', followPointer);
      document.documentElement.removeEventListener('pointerleave', resetPose);
      cancelAnimationFrame(idleFrame);
      blink.kill();
      smileTriggers.forEach(el => { el.removeEventListener('pointerenter', onEnter); el.removeEventListener('pointerleave', onLeave); });
      visibility.disconnect();
    };
  });
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

// Animate disclosure height while preserving native focus and keyboard activation.
document.querySelectorAll('.service-list details').forEach(details => {
  let animation;
  let expanded = details.open;
  const summary = details.querySelector('summary');
  summary.addEventListener('click', event => {
    if (reducedMotion.matches) return;
    event.preventDefault();
    const start = details.getBoundingClientRect().height;
    animation?.cancel();
    expanded = !expanded;
    details.style.height = '';
    details.open = true;
    const end = expanded ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height + 1;
    animation = details.animate(
      { height: [start + 'px', end + 'px'] },
      { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' }
    );
    animation.onfinish = () => {
      details.open = expanded;
      animation = null;
      window.ScrollTrigger?.refresh();
    };
  });
  details.addEventListener('toggle', () => {
    if (!animation) expanded = details.open;
  });
});


// Results charts: grow bars when they scroll into view, and show exact values on hover/tap.
document.querySelectorAll('.performance-card').forEach(card => {
  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    card.classList.add('pre-reveal');
    const reveal = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      requestAnimationFrame(() => card.classList.remove('pre-reveal'));
      reveal.disconnect();
    }, { threshold: .35 });
    reveal.observe(card);
  }
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.setAttribute('aria-hidden', 'true');
  card.append(tip);
  const show = target => {
    const mark = target.querySelector('.chart-bar, .column-bar');
    const box = mark.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    tip.innerHTML = '';
    const label = document.createElement('span');
    label.textContent = translate(target.dataset.tip);
    const value = document.createElement('b');
    value.textContent = target.dataset.value;
    tip.append(label, value);
    const isRow = target.classList.contains('chart-row');
    const x = isRow ? (document.documentElement.dir === 'rtl' ? box.left : box.right) : box.left + box.width / 2;
    tip.style.left = Math.min(cardBox.width - 70, Math.max(70, x - cardBox.left)) + 'px';
    tip.style.top = (box.top - cardBox.top - (isRow ? 0 : 44)) + 'px';
    tip.classList.add('visible');
  };
  const hide = () => tip.classList.remove('visible');
  card.querySelectorAll('[data-tip]').forEach(target => {
    target.addEventListener('pointerenter', () => show(target));
    target.addEventListener('pointerleave', hide);
    target.addEventListener('click', () => show(target));
  });
});

// Reveal cards as they scroll into view.
if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const rise = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('pre-rise');
      rise.unobserve(entry.target);
    });
  }, { threshold: .15 });
  document.querySelectorAll('.rise').forEach(el => { el.classList.add('pre-rise'); rise.observe(el); });
}

// Show the floating WhatsApp button only after the hero, so it never covers the hero links.
{
  const float = document.querySelector('.whatsapp-float');
  const toggleFloat = () => float.classList.toggle('visible', scrollY > innerHeight * .6);
  addEventListener('scroll', toggleFloat, { passive: true });
  toggleFloat();
}
