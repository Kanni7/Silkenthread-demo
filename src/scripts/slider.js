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
    this.slider.scrollTo({ left: this.slider.scrollLeft + dir * this.offset });
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
