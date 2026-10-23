import './styles.css';
import products from './data/products.json';
import faqs from './data/faqs.json';
import sizeGuide from './data/size-guide.json';
import {
  customKitMessage,
  productMessage,
  waLink,
} from './lib/whatsapp.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function finishIntro() {
  if (typeof window.__dynamiqFinishIntro === 'function') {
    window.__dynamiqFinishIntro();
    return;
  }

  document.documentElement.classList.remove('intro-pending', 'intro-running');
  const intro = document.getElementById('intro');
  if (intro) intro.hidden = true;

  try {
    sessionStorage.setItem('dynamiq-intro-seen', '1');
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

function initIntro() {
  const intro = document.getElementById('intro');
  const skipButton = document.getElementById('intro-skip');
  if (!intro) return;

  if (!document.documentElement.classList.contains('intro-pending')) {
    intro.hidden = true;
    return;
  }

  document.documentElement.classList.add('intro-running');
  window.__DYNAMIQ_INTRO_STARTED__ = true;
  skipButton?.addEventListener('click', finishIntro);

  if (prefersReducedMotion.matches) {
    window.setTimeout(() => {
      intro.classList.add('intro--closing');
      window.setTimeout(finishIntro, 200);
    }, 450);
    return;
  }

  window.setTimeout(finishIntro, 6550);
}

function initNavigation() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  const closeMenu = () => {
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  };

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    nav.classList.toggle('is-open', !isOpen);
  });

  nav.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      closeMenu();
      toggle.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!nav.classList.contains('is-open')) return;
    if (!(event.target instanceof Node)) return;
    if (toggle.contains(event.target) || nav.contains(event.target)) return;
    closeMenu();
  });

  const desktopQuery = window.matchMedia('(min-width: 781px)');
  desktopQuery.addEventListener('change', (event) => {
    if (event.matches) closeMenu();
  });
}

function productAlt(product, view) {
  let type = `${product.category.toLowerCase()} jersey`;
  if (product.category === 'Tees') type = 'tee';
  if (product.category === 'Team Kits') type = 'team kit';
  return `${product.name}, ${type}, ${view} view`;
}

function buildProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.category = product.category;
  card.dataset.productId = product.id;

  const media = document.createElement('div');
  media.className = 'product-card__media';

  const badge = document.createElement('span');
  badge.className = 'product-card__badge';
  badge.textContent = 'Sample';

  const front = document.createElement('img');
  front.className = 'product-card__image product-card__image--front';
  front.src = product.images.front;
  front.alt = productAlt(product, 'front');
  front.width = 1000;
  front.height = 1250;
  front.loading = 'lazy';
  front.decoding = 'async';

  const back = document.createElement('img');
  back.className = 'product-card__image product-card__image--back';
  back.src = product.images.back;
  back.alt = productAlt(product, 'back');
  back.width = 1000;
  back.height = 1250;
  back.loading = 'lazy';
  back.decoding = 'async';

  media.append(front, back, badge);

  const body = document.createElement('div');
  body.className = 'product-card__body';

  const category = document.createElement('p');
  category.className = 'product-card__category';
  category.textContent = product.category;

  const title = document.createElement('h3');
  title.className = 'product-card__name';
  title.textContent = product.name;

  body.append(category, title);

  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    const chips = document.createElement('div');
    chips.className = 'size-chips';
    chips.setAttribute('aria-label', 'Available sizes');
    for (const size of product.sizes) {
      const chip = document.createElement('span');
      chip.className = 'size-chip';
      chip.textContent = size;
      chips.append(chip);
    }
    body.append(chips);
  }

  const price = document.createElement('p');
  price.className = 'product-card__price';
  price.textContent = product.price === null ? 'Price on WhatsApp' : `Price: ${product.price}`;
  body.append(price);

  const button = document.createElement('button');
  button.className = 'button product-card__button';
  button.type = 'button';
  button.textContent = 'View product';
  button.setAttribute('aria-label', `View product: ${product.name}`);
  button.setAttribute('aria-haspopup', 'dialog');
  button.dataset.quickView = product.id;
  body.append(button);

  card.append(media, body);
  return card;
}

function initCollection() {
  const grid = document.getElementById('product-grid');
  const count = document.getElementById('collection-count');
  const filterBar = document.querySelector('.filters');
  if (!grid || !count || !filterBar) return;

  const cards = products.map((product) => {
    const card = buildProductCard(product);
    grid.append(card);
    return card;
  });

  const isSampleSet = products.every((product) => product.name.startsWith('Sample product'));
  const updateCount = (number) => {
    const noun = number === 1 ? 'product' : 'products';
    count.textContent = isSampleSet
      ? `Showing ${number} sample ${noun}.`
      : `Showing ${number} ${noun}.`;
  };

  const applyFilter = (category) => {
    let visible = 0;
    for (const card of cards) {
      const show = category === 'All' || card.dataset.category === category;
      card.hidden = !show;
      if (show) visible += 1;
    }
    updateCount(visible);
  };

  filterBar.addEventListener('click', (event) => {
    const button = event.target.closest('.filter');
    if (!(button instanceof HTMLButtonElement)) return;
    for (const other of filterBar.querySelectorAll('.filter')) {
      const isActive = other === button;
      other.classList.toggle('is-active', isActive);
      other.setAttribute('aria-pressed', String(isActive));
    }
    applyFilter(button.dataset.filter || 'All');
  });

  updateCount(cards.length);
}

function initQuickView() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'quick-view';
  dialog.setAttribute('aria-labelledby', 'quick-view-title');
  dialog.innerHTML = `
    <div class="quick-view__inner">
      <button class="quick-view__close" type="button">Close</button>
      <div class="quick-view__layout">
        <div class="quick-view__media">
          <figure class="quick-view__figure">
            <img id="quick-view-front" width="1000" height="1250" alt="">
            <figcaption>Front</figcaption>
          </figure>
          <figure class="quick-view__figure">
            <img id="quick-view-back" width="1000" height="1250" alt="">
            <figcaption>Back</figcaption>
          </figure>
        </div>
        <div>
          <p class="quick-view__category" id="quick-view-category"></p>
          <h2 id="quick-view-title"></h2>
          <p class="quick-view__price" id="quick-view-price"></p>
          <div class="quick-view__form">
            <div class="field">
              <label for="quick-size">Size</label>
              <select id="quick-size"></select>
            </div>
            <div class="field">
              <label for="quick-quantity">Quantity</label>
              <input id="quick-quantity" type="number" inputmode="numeric" min="1" max="999" value="1">
            </div>
            <a class="button button--dark field--full" id="quick-order" href="#" target="_blank" rel="noopener noreferrer">Order on WhatsApp</a>
          </div>
          <p class="quick-view__note">The order message includes this product, size, and quantity.</p>
        </div>
      </div>
    </div>
  `;
  document.body.append(dialog);

  const closeButton = dialog.querySelector('.quick-view__close');
  const title = dialog.querySelector('#quick-view-title');
  const category = dialog.querySelector('#quick-view-category');
  const price = dialog.querySelector('#quick-view-price');
  const front = dialog.querySelector('#quick-view-front');
  const back = dialog.querySelector('#quick-view-back');
  const sizeSelect = dialog.querySelector('#quick-size');
  const quantityInput = dialog.querySelector('#quick-quantity');
  const orderLink = dialog.querySelector('#quick-order');
  let trigger = null;
  let currentProduct = null;

  const updateOrderLink = () => {
    if (!currentProduct) return;
    const size = sizeSelect.value || 'One size';
    const quantity = Math.max(1, Number.parseInt(quantityInput.value, 10) || 1);
    orderLink.href = waLink(productMessage(currentProduct, size, quantity));
  };

  const openDialog = (product, button) => {
    currentProduct = product;
    trigger = button;
    title.textContent = product.name;
    category.textContent = product.category;
    price.textContent = product.price === null ? 'Price on WhatsApp' : `Price: ${product.price}`;
    front.src = product.images.front;
    front.alt = productAlt(product, 'front');
    back.src = product.images.back;
    back.alt = productAlt(product, 'back');

    sizeSelect.replaceChildren();
    const sizes = Array.isArray(product.sizes) && product.sizes.length > 0 ? product.sizes : ['One size'];
    for (const size of sizes) {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = size;
      sizeSelect.append(option);
    }

    quantityInput.value = '1';
    updateOrderLink();
    dialog.showModal();
    closeButton.focus();
  };

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-quick-view]');
    if (!(button instanceof HTMLButtonElement)) return;
    const product = products.find((item) => item.id === button.dataset.quickView);
    if (product) openDialog(product, button);
  });

  sizeSelect.addEventListener('change', updateOrderLink);
  quantityInput.addEventListener('input', updateOrderLink);

  closeButton.addEventListener('click', () => dialog.close());

  dialog.addEventListener('close', () => {
    currentProduct = null;
    if (trigger) trigger.focus();
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function initSizeGuide() {
  const section = document.getElementById('size-guide');
  if (!section) return;

  if (!Array.isArray(sizeGuide) || sizeGuide.length === 0) {
    section.hidden = true;
    return;
  }

  const columns = Array.from(
    new Set(sizeGuide.flatMap((row) => Object.keys(row))),
  );
  if (columns.length === 0) {
    section.hidden = true;
    return;
  }

  const table = section.querySelector('table');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  const headerRow = document.createElement('tr');

  for (const column of columns) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = column;
    headerRow.append(th);
  }
  thead.append(headerRow);

  for (const row of sizeGuide) {
    const tr = document.createElement('tr');
    for (const column of columns) {
      const td = document.createElement('td');
      td.textContent = row[column] ?? '';
      tr.append(td);
    }
    tbody.append(tr);
  }

  section.hidden = false;
}

function initFaq() {
  const list = document.getElementById('faq-list');
  const section = document.getElementById('faq');
  if (!list || !section) return;

  const answered = faqs.filter((item) => typeof item.answer === 'string' && item.answer.trim() !== '');
  if (answered.length === 0) {
    section.hidden = true;
    return;
  }

  for (const item of answered) {
    const details = document.createElement('details');
    details.className = 'faq__item';

    const summary = document.createElement('summary');
    summary.textContent = item.question;

    const answer = document.createElement('div');
    answer.className = 'faq__answer';
    const paragraph = document.createElement('p');
    paragraph.textContent = item.answer;
    answer.append(paragraph);

    details.append(summary, answer);
    list.append(details);
  }
}

function setFieldValidity(input, isValid) {
  if (isValid) {
    input.removeAttribute('aria-invalid');
  } else {
    input.setAttribute('aria-invalid', 'true');
  }
}

function initCustomKitForm() {
  const form = document.getElementById('custom-kit-form');
  const status = document.getElementById('form-status');
  if (!form || !status) return;

  form.noValidate = true;
  const fields = Array.from(form.querySelectorAll('input, select, textarea'));

  for (const field of fields) {
    field.addEventListener('input', () => setFieldValidity(field, field.checkValidity()));
    field.addEventListener('change', () => setFieldValidity(field, field.checkValidity()));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    let firstInvalid = null;

    for (const field of fields) {
      const valid = field.checkValidity();
      setFieldValidity(field, valid);
      if (!valid && !firstInvalid) firstInvalid = field;
    }

    if (firstInvalid) {
      status.textContent = 'Check the highlighted fields.';
      firstInvalid.focus();
      firstInvalid.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const values = {
      teamName: String(formData.get('teamName') || '').trim(),
      sport: String(formData.get('sport') || '').trim(),
      quantity: String(formData.get('quantity') || '').trim(),
      customization: String(formData.get('customization') || '').trim(),
      city: String(formData.get('city') || '').trim(),
      notes: String(formData.get('notes') || '').trim(),
    };

    const orderUrl = waLink(customKitMessage(values));
    status.replaceChildren();
    const message = document.createElement('span');
    message.textContent = 'Opening WhatsApp with these order details. ';
    const fallback = document.createElement('a');
    fallback.href = orderUrl;
    fallback.target = '_blank';
    fallback.rel = 'noopener noreferrer';
    fallback.textContent = 'Open WhatsApp';
    status.append(message, fallback);

    const opener = document.createElement('a');
    opener.href = orderUrl;
    opener.target = '_blank';
    opener.rel = 'noopener noreferrer';
    document.body.append(opener);
    opener.click();
    opener.remove();
  });
}

function initFloatingButton() {
  const float = document.getElementById('whatsapp-float');
  const form = document.getElementById('custom-kit-form');
  if (!float || !form || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const formVisible = entries.some((entry) => entry.isIntersecting);
      float.classList.toggle('is-concealed', formVisible);
      if (formVisible) {
        float.setAttribute('aria-hidden', 'true');
      } else {
        float.removeAttribute('aria-hidden');
      }
    },
    { rootMargin: '0px 0px 60px 0px', threshold: 0.04 },
  );

  observer.observe(form);
}

function handlePlaceholderLinks() {
  const links = document.querySelectorAll('a[href*="{{REPLACE:"]');
  for (const link of links) {
    link.href = '#contact';
    link.setAttribute('aria-disabled', 'true');
    link.title = 'Link to be added';
  }
}

initIntro();
initNavigation();
initCollection();
initQuickView();
initSizeGuide();
initFaq();
initCustomKitForm();
initFloatingButton();
handlePlaceholderLinks();

