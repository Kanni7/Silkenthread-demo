// slider-component / slideshow-component behaviour (port of the Craft/Dawn global.js essentials).

class SliderComponent extends HTMLElement {
  connectedCallback() {
    this.slider = this.querySelector('[id^="Slider-"]');
    this.items = [...this.querySelectorAll('[id^="Slide-"]')];
    this.prev = this.querySelector('button[name="previous"]');
    this.next = this.querySelector('button[name="next"]');
    this.current = this.querySelector('.slider-counter--current');
    this.total = this.querySelector('.slider-counter--total');
    if (!this.slider || !this.next) return;
    this.measure();
    new ResizeObserver(() => this.measure()).observe(this.slider);
    this.slider.addEventListener('scroll', () => this.update(), { passive: true });
    this.prev?.addEventListener('click', (e) => this.step(e, -1));
    this.next.addEventListener('click', (e) => this.step(e, 1));
    if (this.dataset.marquee) this.marquee(Number(this.dataset.marquee));
  }

  // Redesign: slow right-to-left drift in a seamless loop (inert clones follow the originals). Pauses on
  // hover, keyboard focus, touch/drag/wheel (resumes after a few seconds), off-screen, hidden tab, the
  // pause button, and never starts for prefers-reduced-motion.
  marquee(speed) {
    const firstClone = this.querySelector('.st-marquee-clone');
    const toggle = this.querySelector('[data-marquee-toggle]');
    if (!firstClone) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let pos = 0, last = 0, holdUntil = 0, hover = false, focus = false, visible = true;
    const setPaused = (paused) => {
      this.userPaused = paused;
      if (!paused) this.classList.add('st-marquee-on');
      toggle?.classList.toggle('is-paused', paused);
      toggle?.setAttribute('aria-label', paused ? 'Play product carousel' : 'Pause product carousel');
    };
    const hold = () => (holdUntil = performance.now() + 4000);
    const running = () => !this.userPaused && !hover && !focus && visible && !document.hidden && performance.now() > holdUntil;
    const tick = (t) => {
      const dt = last ? Math.min(t - last, 50) : 0;
      last = t;
      if (running()) {
        const loop = firstClone.offsetLeft - this.items[0].offsetLeft;
        pos += (speed * dt) / 1000;
        if (loop > 0 && pos >= loop) pos -= loop;
        this.slider.scrollLeft = pos;
      } else {
        pos = this.slider.scrollLeft;
      }
      requestAnimationFrame(tick);
    };
    this.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && (hover = true));
    this.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && (hover = false));
    // Keyboard focus on a card pauses; focus on the controls (e.g. the Play button just pressed) doesn't.
    this.slider.addEventListener('focusin', () => (focus = true));
    this.slider.addEventListener('focusout', (e) => !this.slider.contains(e.relatedTarget) && (focus = false));
    for (const type of ['pointerdown', 'wheel', 'touchstart']) this.slider.addEventListener(type, hold, { passive: true });
    new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(this);
    toggle?.addEventListener('click', () => { setPaused(!this.userPaused); holdUntil = 0; });
    reduce.addEventListener('change', (e) => e.matches && setPaused(true));
    setPaused(reduce.matches);
    requestAnimationFrame(tick);
  }

  measure() {
    const visible = this.items.filter((el) => el.clientWidth > 0);
    if (!visible.length) return;
    this.offset = visible[1] ? visible[1].offsetLeft - visible[0].offsetLeft : visible[0].clientWidth;
    this.perPage = Math.max(1, Math.floor((this.slider.clientWidth - visible[0].offsetLeft) / this.offset));
    this.pages = Math.max(1, visible.length - this.perPage + 1);
    this.update();
  }

  update() {
    if (!this.offset) return;
    this.page = Math.round(this.slider.scrollLeft / this.offset) + 1;
    if (this.current) this.current.textContent = this.page;
    if (this.total) this.total.textContent = this.pages;
    if (this.loops) return;
    this.prev?.toggleAttribute('disabled', this.page <= 1);
    this.next?.toggleAttribute('disabled', this.page >= this.pages);
  }

  step(event, dir) {
    event.preventDefault();
    this.slider.scrollTo({ left: this.slider.scrollLeft + dir * this.offset, behavior: 'smooth' });
  }
}

class SlideshowComponent extends SliderComponent {
  connectedCallback() {
    this.loops = true;
    super.connectedCallback();
    if (!this.slider) return;
    this.slider.addEventListener('scroll', () => this.markActive(), { passive: true });
    this.toggle = this.querySelector('.slideshow__autoplay');
    if (this.slider.dataset.autoplay === 'true') {
      this.speed = (Number(this.slider.dataset.speed) || 5) * 1000;
      this.play();
      this.toggle?.addEventListener('click', () => (this.timer ? this.pause(true) : this.play()));
      this.addEventListener('mouseenter', () => this.timer && this.pause());
      this.addEventListener('mouseleave', () => !this.userPaused && this.play());
      this.addEventListener('focusin', () => this.timer && this.pause());
    }
  }

  step(event, dir) {
    event?.preventDefault();
    const max = this.items.length - 1;
    const idx = Math.round(this.slider.scrollLeft / (this.offset || 1)) + dir;
    const target = idx > max ? 0 : idx < 0 ? max : idx;
    this.slider.scrollTo({ left: target * this.offset });
  }

  markActive() {
    const idx = Math.round(this.slider.scrollLeft / (this.offset || 1));
    this.items.forEach((el, i) => {
      el.setAttribute('aria-hidden', String(i !== idx));
      el.querySelectorAll('a, button').forEach((a) => (i === idx ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
    });
  }

  play() {
    this.userPaused = false;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.step(null, 1), this.speed);
    this.toggle?.classList.remove('slideshow__autoplay--paused');
    this.toggle?.setAttribute('aria-label', 'Pause slideshow');
  }

  pause(byUser = false) {
    if (byUser) this.userPaused = true;
    clearInterval(this.timer);
    this.timer = null;
    if (byUser) {
      this.toggle?.classList.add('slideshow__autoplay--paused');
      this.toggle?.setAttribute('aria-label', 'Play slideshow');
    }
  }
}

if (!customElements.get('slider-component')) customElements.define('slider-component', SliderComponent);
if (!customElements.get('slideshow-component')) customElements.define('slideshow-component', SlideshowComponent);
