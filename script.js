(() => {
  'use strict';

  // Disable pinch-to-zoom (iOS Safari ignores user-scalable=no in some versions)
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  let lastTapTime = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTapTime <= 300) e.preventDefault(); // block double-tap zoom
    lastTapTime = now;
  }, { passive: false });

  const nav = document.getElementById('nav');
  const toTop = document.getElementById('toTop');
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 8);
    toTop.classList.toggle('show', y > 700);
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Keep the mobile menu's top offset in sync with the *real* header height
  // (it changes across breakpoints/fonts), so it never overlaps or crops the nav.
  function updateNavHeight() {
    document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');
  }
  updateNavHeight();
  window.addEventListener('resize', updateNavHeight);
  window.addEventListener('orientationchange', updateNavHeight);
  window.addEventListener('load', updateNavHeight);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(updateNavHeight).catch(() => {});
  }

  toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const burger = document.getElementById('burger');
  const navLinks = document.getElementById('navLinks');
  burger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
    if (open) {
      updateNavHeight();
      lockBodyScroll();
    } else {
      unlockBodyScrollIfNoneOpen();
    }
  });
  const navAnchorEls = Array.from(navLinks.querySelectorAll('a'));

  let suppressSpy = false;
  let suppressTimer = null;
  const releaseSpySuppression = () => { suppressSpy = false; };
  const armSpySuppression = () => {
    suppressSpy = true;
    clearTimeout(suppressTimer);
    suppressTimer = setTimeout(releaseSpySuppression, 1200); // fallback if scrollend never fires
  };
  window.addEventListener('scrollend', releaseSpySuppression);

  navAnchorEls.forEach(a => {
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      burger.classList.remove('open');
      unlockBodyScrollIfNoneOpen();
      navAnchorEls.forEach(link => link.classList.remove('active'));
      a.classList.add('active');
      armSpySuppression();
    });
  });

  const navSections = navAnchorEls
    .map(a => {
      const id = a.getAttribute('href');
      if (!id || id.length < 2 || !id.startsWith('#')) return null;
      const section = document.querySelector(id);
      return section ? { link: a, section } : null;
    })
    .filter(Boolean);

  if (navSections.length) {
    const setActiveLink = (activeSection) => {
      navSections.forEach(({ link, section }) => {
        link.classList.toggle('active', section === activeSection);
      });
    };

    const spyObserver = new IntersectionObserver((entries) => {
      if (suppressSpy) return;
      const visible = entries.filter(e => e.isIntersecting);
      if (!visible.length) return;
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const match = navSections.find(ns => ns.section === visible[0].target);
      if (match) setActiveLink(match.section);
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

    navSections.forEach(({ section }) => spyObserver.observe(section));
  }

  const navSearch = document.getElementById('navSearch');
  const searchToggle = document.getElementById('searchToggle');
  const navSearchInput = document.getElementById('navSearchInput');
  const searchCourseCards = document.querySelectorAll('.course-card');
  const coursesGridEmptyState = document.getElementById('coursesGridEmptyState');

  // Shared filter: runs the query against every course card's title/category/description.
  // Returns how many cards matched, so callers can show/hide the empty state.
  function filterCourseCards(rawQuery) {
    const q = rawQuery.trim().toLowerCase();
    let visibleCount = 0;
    searchCourseCards.forEach(card => {
      if (!q) { card.style.display = ''; visibleCount++; return; }
      const title = card.querySelector('.course-title')?.textContent.toLowerCase() || '';
      const cat = (card.dataset.cat || '').toLowerCase();
      const desc = (card.dataset.desc || '').toLowerCase();
      const match = title.includes(q) || cat.includes(q) || desc.includes(q);
      card.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });
    if (coursesGridEmptyState) {
      coursesGridEmptyState.style.display = (q && visibleCount === 0) ? 'block' : 'none';
    }
    return visibleCount;
  }

  function jumpToCourses() {
    document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openSearch() {
    navSearch.classList.add('open');
    searchToggle.setAttribute('aria-expanded', 'true');
    window.setTimeout(() => navSearchInput.focus(), 250);
  }
  function closeSearch() {
    navSearch.classList.remove('open');
    searchToggle.setAttribute('aria-expanded', 'false');
    navSearchInput.value = '';
    navSearchInput.blur();
    filterCourseCards('');
  }
  searchToggle.addEventListener('click', () => {
    if (navSearch.classList.contains('open')) closeSearch();
    else openSearch();
  });
  document.addEventListener('click', (e) => {
    if (navSearch.classList.contains('open') && !navSearch.contains(e.target)) closeSearch();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navSearch.classList.contains('open')) closeSearch();
  });

  let navSearchJumped = false;
  navSearchInput.addEventListener('input', () => {
    const count = filterCourseCards(navSearchInput.value);
    // Jump to the results the first time this query starts returning matches,
    // so typing actually shows something instead of filtering off-screen cards.
    if (navSearchInput.value.trim() && count > 0 && !navSearchJumped) {
      navSearchJumped = true;
      jumpToCourses();
    }
    if (!navSearchInput.value.trim()) navSearchJumped = false;
  });
  navSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      jumpToCourses();
      navSearch.classList.remove('open');
      searchToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Mobile menu search (shown inside the hamburger dropdown on small screens)
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', () => {
      filterCourseCards(mobileSearchInput.value);
    });
    mobileSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        navLinks.classList.remove('open');
        burger.classList.remove('open');
        unlockBodyScrollIfNoneOpen();
        // wait for the menu-close transition so scrollIntoView measures the final layout
        window.setTimeout(jumpToCourses, 260);
      }
    });
  }
  const mobileLoginTrigger = document.getElementById('mobileLoginTrigger');
  if (mobileLoginTrigger) {
    mobileLoginTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      navLinks.classList.remove('open');
      burger.classList.remove('open');
      unlockBodyScrollIfNoneOpen();
      openAuthModal('login');
    });
  }

  const MODAL_IDS = ['authModal', 'courseModal', 'coursesModalOverlay', 'categoriesModalOverlay'];
  let bodyScrollLocked = false;
  let savedScrollY = 0;
  function lockBodyScroll() {
    if (bodyScrollLocked) return;
    bodyScrollLocked = true;
    savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = -savedScrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }
  function unlockBodyScrollIfNoneOpen() {
    const navOpen = navLinks.classList.contains('open');
    const stillOpen = navOpen || MODAL_IDS.some(id => {
      const el = document.getElementById(id);
      return el && el.classList.contains('open');
    });
    if (stillOpen || !bodyScrollLocked) return;
    bodyScrollLocked = false;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, savedScrollY);
  }

  const authModal = document.getElementById('authModal');
  const loginTrigger = document.getElementById('loginTrigger');
  const authTabs = document.querySelectorAll('.auth-tab');
  const authTabsWrap = document.getElementById('authTabs');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const authTitle = document.getElementById('authTitle');
  const authSub = document.getElementById('authSub');
  let authLastFocused = null;

  const authCopy = {
    login: { title: 'Welcome back', sub: 'Log in to keep track of your courses and progress.' },
    register: { title: 'Create your account', sub: 'Join 25K+ learners building real skills, project by project.' }
  };

  const authSwitchLogin = document.querySelector('.auth-switch-login');
  const authSwitchRegister = document.querySelector('.auth-switch-register');

  function setAuthTab(tab) {
    authTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    authTabsWrap.dataset.active = tab;
    loginForm.hidden = tab !== 'login';
    registerForm.hidden = tab !== 'register';
    authSwitchLogin.hidden = tab !== 'login';
    authSwitchRegister.hidden = tab !== 'register';
    authTitle.textContent = authCopy[tab].title;
    authSub.textContent = authCopy[tab].sub;
    document.getElementById('loginMsg').hidden = true;
    document.getElementById('registerMsg').hidden = true;
  }

  function openAuthModal(tab) {
    setAuthTab(tab || 'login');
    authLastFocused = document.activeElement;
    authModal.classList.add('open');
    authModal.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    window.setTimeout(() => authModal.querySelector('.auth-modal-close').focus(), 250);
  }
  function closeAuthModal() {
    authModal.classList.remove('open');
    authModal.setAttribute('aria-hidden', 'true');
    unlockBodyScrollIfNoneOpen();
    if (authLastFocused) authLastFocused.focus();
  }

  loginTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    if (loginTrigger.dataset.mode === 'logout') {
      if (supabaseClient) supabaseClient.auth.signOut();
      updateAuthUI(null);
    } else {
      openAuthModal('login');
    }
  });
  authTabs.forEach(tab => tab.addEventListener('click', () => setAuthTab(tab.dataset.tab)));
  authModal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeAuthModal));
  authModal.querySelectorAll('[data-switch]').forEach(el => el.addEventListener('click', () => setAuthTab(el.dataset.switch)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && authModal.classList.contains('open')) closeAuthModal(); });

  function showAuthMsg(el, text, isError) {
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle('auth-msg-error', !!isError);
    el.classList.toggle('auth-msg-success', !isError);
  }

  function setSubmitLoading(form, loading, label) {
    const btn = form.querySelector('.auth-submit');
    if (loading) {
      btn.dataset.label = btn.textContent;
      btn.textContent = 'Please wait…';
      btn.disabled = true;
    } else {
      btn.textContent = label || btn.dataset.label || btn.textContent;
      btn.disabled = false;
    }
  }

  function updateAuthUI(user) {
    if (user) {
      const displayName = (user.user_metadata && user.user_metadata.full_name) || user.email.split('@')[0];
      loginTrigger.textContent = `Hi, ${displayName} · Logout`;
      loginTrigger.dataset.mode = 'logout';
    } else {
      loginTrigger.textContent = 'Login / Register';
      loginTrigger.dataset.mode = 'login';
    }
  }

  // Restore session on page load
  if (supabaseClient) {
    supabaseClient.auth.getSession().then(({ data }) => {
      updateAuthUI(data.session ? data.session.user : null);
    });
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      updateAuthUI(session ? session.user : null);
    });
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('loginMsg');
    msg.hidden = true;
    if (!supabaseClient) { showAuthMsg(msg, 'Backend not configured.', true); return; }
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    setSubmitLoading(loginForm, true);
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    setSubmitLoading(loginForm, false, 'Log In');
    if (error) { showAuthMsg(msg, error.message, true); return; }
    updateAuthUI(data.user);
    closeAuthModal();
    loginForm.reset();
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('registerMsg');
    msg.hidden = true;
    if (!supabaseClient) { showAuthMsg(msg, 'Backend not configured.', true); return; }
    const fullName = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    setSubmitLoading(registerForm, true);
    const { data, error } = await supabaseClient.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    });
    setSubmitLoading(registerForm, false, 'Create Account');
    if (error) { showAuthMsg(msg, error.message, true); return; }
    if (data.session) {
      updateAuthUI(data.user);
      closeAuthModal();
    } else {
      showAuthMsg(msg, 'Account created! Check your email to confirm.', false);
    }
    registerForm.reset();
  });

  document.querySelectorAll('.auth-social-btn[data-provider]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!supabaseClient) return;
      const provider = btn.dataset.provider;
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.href }
      });
      if (error) {
        const activeTab = authTabsWrap.dataset.active;
        showAuthMsg(document.getElementById(activeTab === 'login' ? 'loginMsg' : 'registerMsg'), error.message, true);
      }
    });
  });

  // ── Newsletter signup → saves to newsletter_signups table ──
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('newsletterEmail');
      const msgEl = document.getElementById('newsletterMsg');
      const btn = newsletterForm.querySelector('button[type="submit"]');
      const email = emailInput.value.trim();
      if (!email) return;
      btn.disabled = true;
      btn.textContent = 'Subscribing…';
      if (supabaseClient) {
        const { error } = await supabaseClient.from('newsletter_signups').insert({ email });
        msgEl.hidden = false;
        if (error && error.code === '23505') {
          msgEl.textContent = "You're already subscribed!";
          msgEl.className = 'news-msg news-msg-info';
        } else if (error) {
          msgEl.textContent = 'Something went wrong — please try again.';
          msgEl.className = 'news-msg news-msg-error';
        } else {
          msgEl.textContent = '🎉 You\'re in! See you every other Tuesday.';
          msgEl.className = 'news-msg news-msg-success';
          emailInput.value = '';
        }
      }
      btn.disabled = false;
      btn.textContent = 'Subscribe';
    });
  }

  // ── Contact form → saves to contact_messages table ──
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('contactName').value.trim();
      const email = document.getElementById('contactEmail').value.trim();
      const message = document.getElementById('contactMessage').value.trim();
      const msgEl = document.getElementById('contactMsg');
      const btn = contactForm.querySelector('.contact-submit');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      if (supabaseClient) {
        const { error } = await supabaseClient.from('contact_messages').insert({ name, email, message });
        msgEl.hidden = false;
        if (error) {
          msgEl.textContent = 'Something went wrong — please try again.';
          msgEl.className = 'contact-msg contact-msg-error';
        } else {
          msgEl.textContent = "Message sent! We'll get back to you within 24 hours.";
          msgEl.className = 'contact-msg contact-msg-success';
          contactForm.reset();
        }
      }
      btn.disabled = false;
      btn.textContent = 'Send Message';
    });
  }

  const revealEls = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  revealEls.forEach(el => io.observe(el));

  const scribbles = document.querySelectorAll('.scribble');
  const io2 = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io2.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });
  scribbles.forEach(el => io2.observe(el));

  const statEls = document.querySelectorAll('.stat-num');
  const animateCount = (el) => {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || '';
    const duration = 1400;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      el.textContent = value + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io3 = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        io3.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  statEls.forEach(el => io3.observe(el));

  const pricingSwitch = document.getElementById('pricingSwitch');
  if (pricingSwitch) {
    const amountEls = document.querySelectorAll('.pricing-price .amount');
    pricingSwitch.addEventListener('click', () => {
      const yearly = pricingSwitch.getAttribute('aria-pressed') !== 'true';
      pricingSwitch.setAttribute('aria-pressed', String(yearly));
      amountEls.forEach(el => {
        el.style.opacity = '0';
        window.setTimeout(() => {
          const value = yearly ? el.dataset.yearly : el.dataset.monthly;
          el.textContent = '$' + value;
          el.style.opacity = '1';
        }, 150);
      });
    });
  }

  const modalOverlay = document.getElementById('coursesModalOverlay');
  const modalGrid = document.getElementById('modalCoursesGrid');
  const modalCards = modalGrid ? Array.from(modalGrid.querySelectorAll('.course-card')).map(card => ({
    el: card,
    cat: card.dataset.cat,
    title: (card.querySelector('.course-title')?.textContent || '').toLowerCase()
  })) : [];
  const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
  const modalSearchInput = document.getElementById('modalSearchInput');
  const modalResultCount = document.getElementById('modalResultCount');
  const modalEmptyState = document.getElementById('modalEmptyState');
  const browseAllBtn = document.getElementById('browseAllBtn');
  const modalCloseBtn = document.getElementById('coursesModalClose');

  let modalActiveCategory = 'all';

  let modalFilterRaf = null;
  function applyModalFilters() {
    if (modalFilterRaf) cancelAnimationFrame(modalFilterRaf);
    modalFilterRaf = requestAnimationFrame(() => {
      const query = (modalSearchInput?.value || '').trim().toLowerCase();
      let visibleCount = 0;
      modalGrid.style.display = 'none'; // detach from layout while we batch-toggle 150 cards
      modalCards.forEach(card => {
        const matchesCategory = modalActiveCategory === 'all' || card.cat === modalActiveCategory;
        const matchesQuery = !query || card.title.includes(query);
        const visible = matchesCategory && matchesQuery;
        card.el.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
      });
      modalGrid.style.display = '';
      if (modalResultCount) modalResultCount.textContent = visibleCount + (visibleCount === 1 ? ' course' : ' courses');
      if (modalEmptyState) modalEmptyState.style.display = visibleCount === 0 ? 'block' : 'none';
    });
  }

  function openCoursesModal(catName) {
    if (!modalOverlay) return;
    modalActiveCategory = catName || 'all';
    modalTabBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === modalActiveCategory));
    if (modalSearchInput) modalSearchInput.value = '';
    applyModalFilters();
    modalOverlay.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
  }

  function closeCoursesModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('open');
    modalOverlay.setAttribute('aria-hidden', 'true');
    unlockBodyScrollIfNoneOpen();
  }

  if (browseAllBtn) browseAllBtn.addEventListener('click', () => openCoursesModal('all'));
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeCoursesModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeCoursesModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay?.classList.contains('open')) closeCoursesModal();
  });

  modalTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modalActiveCategory = btn.dataset.filter;
      modalTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyModalFilters();
    });
  });

  if (modalSearchInput) {
    modalSearchInput.addEventListener('input', applyModalFilters);
  }

  const categoriesModalOverlay = document.getElementById('categoriesModalOverlay');
  const categoriesModalGrid = document.getElementById('categoriesModalGrid');
  const categoriesModalCards = categoriesModalGrid ? Array.from(categoriesModalGrid.querySelectorAll('.cat-card')).map(card => ({
    el: card,
    title: (card.querySelector('.cat-title')?.textContent || '').toLowerCase()
  })) : [];
  const allCategoriesBtn = document.getElementById('allCategoriesBtn');
  const categoriesModalClose = document.getElementById('categoriesModalClose');
  const catModalSearchInput = document.getElementById('catModalSearchInput');
  const catModalResultCount = document.getElementById('catModalResultCount');
  const catModalEmptyState = document.getElementById('catModalEmptyState');

  let catModalFilterRaf = null;
  function applyCategoriesModalFilter() {
    if (catModalFilterRaf) cancelAnimationFrame(catModalFilterRaf);
    catModalFilterRaf = requestAnimationFrame(() => {
      const query = (catModalSearchInput?.value || '').trim().toLowerCase();
      let visibleCount = 0;
      categoriesModalGrid.style.display = 'none';
      categoriesModalCards.forEach(card => {
        const visible = !query || card.title.includes(query);
        card.el.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
      });
      categoriesModalGrid.style.display = '';
      if (catModalResultCount) catModalResultCount.textContent = visibleCount + (visibleCount === 1 ? ' category' : ' categories');
      if (catModalEmptyState) catModalEmptyState.style.display = visibleCount === 0 ? 'block' : 'none';
    });
  }

  function openCategoriesModal() {
    if (!categoriesModalOverlay) return;
    if (catModalSearchInput) catModalSearchInput.value = '';
    applyCategoriesModalFilter();
    categoriesModalOverlay.classList.add('open');
    categoriesModalOverlay.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
  }

  function closeCategoriesModal() {
    if (!categoriesModalOverlay) return;
    categoriesModalOverlay.classList.remove('open');
    categoriesModalOverlay.setAttribute('aria-hidden', 'true');
    unlockBodyScrollIfNoneOpen();
  }

  if (allCategoriesBtn) allCategoriesBtn.addEventListener('click', openCategoriesModal);
  if (categoriesModalClose) categoriesModalClose.addEventListener('click', closeCategoriesModal);
  if (categoriesModalOverlay) {
    categoriesModalOverlay.addEventListener('click', (e) => {
      if (e.target === categoriesModalOverlay) closeCategoriesModal();
    });
  }
  if (catModalSearchInput) catModalSearchInput.addEventListener('input', applyCategoriesModalFilter);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && categoriesModalOverlay?.classList.contains('open')) closeCategoriesModal();
  });

  const catCards = document.querySelectorAll('.cat-card');
  catCards.forEach(card => {
    card.addEventListener('click', () => {
      const catName = card.dataset.cat || card.querySelector('.cat-title')?.textContent.trim();
      closeCategoriesModal();
      openCoursesModal(catName);
    });
  });

  const track = document.getElementById('testiTrack');
  const dotsWrap = document.getElementById('testiDots');
  const cards = track ? Array.from(track.children) : [];

  if (track && cards.length) {
    let perView = getPerView();
    let index = 0;
    let autoTimer;

    function getPerView() {
      const w = window.innerWidth;
      if (w <= 760) return 1;
      if (w <= 1080) return 2;
      return 4;
    }

    function maxIndex() {
      return Math.max(0, cards.length - perView);
    }

    function buildDots() {
      dotsWrap.innerHTML = '';
      const count = maxIndex() + 1;
      for (let i = 0; i < count; i++) {
        const dot = document.createElement('button');
        dot.className = 'tdot' + (i === index ? ' active' : '');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.addEventListener('click', () => { goTo(i); restartAuto(); });
        dotsWrap.appendChild(dot);
      }
    }

    function update() {
      const cardWidth = cards[0].getBoundingClientRect().width;
      const gap = 24;
      track.style.transform = `translateX(-${index * (cardWidth + gap)}px)`;
      Array.from(dotsWrap.children).forEach((d, i) => d.classList.toggle('active', i === index));
    }

    function goTo(i) {
      index = Math.max(0, Math.min(i, maxIndex()));
      update();
    }

    function next() {
      index = index >= maxIndex() ? 0 : index + 1;
      update();
    }

    function restartAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(next, 4500);
    }

    window.addEventListener('resize', () => {
      perView = getPerView();
      index = Math.min(index, maxIndex());
      buildDots();
      update();
    });

    buildDots();
    update();
    restartAuto();

    track.addEventListener('mouseenter', () => clearInterval(autoTimer));
    track.addEventListener('mouseleave', restartAuto);

    // Touch swipe support
    let touchStartX = 0;
    let touchCurrentX = 0;
    let isDragging = false;

    track.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchCurrentX = touchStartX;
      isDragging = true;
      clearInterval(autoTimer);
      track.style.transition = 'none';
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      touchCurrentX = e.touches[0].clientX;
      const dx = touchCurrentX - touchStartX;
      const cardWidth = cards[0].getBoundingClientRect().width;
      const gap = 24;
      const base = -(index * (cardWidth + gap));
      track.style.transform = `translateX(${base + dx}px)`;
    }, { passive: true });

    track.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      track.style.transition = '';
      const dx = touchCurrentX - touchStartX;
      const threshold = 40;
      if (dx < -threshold) {
        index = Math.min(index + 1, maxIndex());
      } else if (dx > threshold) {
        index = Math.max(index - 1, 0);
      }
      update();
      restartAuto();
    });
  }

  function relLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function parseColor(str) {
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  }
  function effectiveBackground(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const c = parseColor(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) return c;
      node = node.parentElement;
    }
    return { r: 251, g: 247, b: 238, a: 1 }; // fallback: page cream
  }

  const ADAPT_SELECTOR = [
    'h1', 'h2', 'h3', 'h4',
    '.hero-copy p', '.section-head p', '.testi-text', '.article-excerpt',
    '.course-author', '.foot-links a', '.footer-about p', '.newsletter h3',
    '.promo-mid p.sub', '.stat-label', '.cat-title', '.cat-count',
    '.foot-contact li', '.faq-q', '.faq-a'
  ].join(',');

  function applyAdaptiveContrast() {
    document.querySelectorAll(ADAPT_SELECTOR).forEach(el => {
      const bg = effectiveBackground(el);
      const lum = relLuminance(bg.r, bg.g, bg.b);
      const isHeading = /^H[1-4]$/.test(el.tagName);
      if (lum > 0.5) {
        el.style.color = '';
      } else {
        el.style.color = isHeading ? '#ffffff' : 'rgba(255,255,255,.78)';
      }
    });
  }

  applyAdaptiveContrast();
  window.addEventListener('resize', applyAdaptiveContrast);
  window.addEventListener('load', applyAdaptiveContrast);

  const contrastObserver = new MutationObserver(() => applyAdaptiveContrast());
  contrastObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true
  });

  const hasHoverPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function initTilt(selector, maxDeg) {
    if (!hasHoverPointer) return;
    document.querySelectorAll(selector).forEach(card => {
      let targetX = 0, targetY = 0, curX = 0, curY = 0, raf = null, lastFrame = null;

      function loop(now) {
        const dt = lastFrame == null ? 16.67 : now - lastFrame;
        lastFrame = now;
        const pull = 1 - Math.pow(1 - 0.15, dt / 16.67);
        curX += (targetX - curX) * pull;
        curY += (targetY - curY) * pull;
        card.style.transform = `perspective(700px) rotateX(${curY.toFixed(2)}deg) rotateY(${curX.toFixed(2)}deg) translateY(${(Math.abs(curX) + Math.abs(curY)) * -0.6}px)`;
        if (Math.abs(targetX - curX) > 0.02 || Math.abs(targetY - curY) > 0.02) {
          raf = requestAnimationFrame(loop);
        } else {
          raf = null;
          lastFrame = null;
        }
      }

      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        targetX = px * maxDeg * 2;
        targetY = -py * maxDeg;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      card.addEventListener('mouseleave', () => {
        targetX = 0; targetY = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  }
  initTilt('.team-card', 7);
  initTilt('.ceo-portrait', 5);
  initTilt('.course-card', 7);
  initTilt('.cat-card', 7);
  initTilt('.article-card', 7);
  initTilt('.testi-card', 7);
  initTilt('.step-card', 7);
  initTilt('.feature-card', 7);

  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(o => { if (o !== item) o.classList.remove('open'); });
      item.classList.toggle('open', !isOpen);
    });
  });

  const courseModal = document.getElementById('courseModal');
  const modalThumb = document.getElementById('modalThumb');
  const modalTag = document.getElementById('modalTag');
  const modalTitle = document.getElementById('modalTitle');
  const modalAuthor = document.getElementById('modalAuthor');
  const modalMeta = document.getElementById('modalMeta');
  const modalDesc = document.getElementById('modalDesc');
  const modalPrice = document.getElementById('modalPrice');
  let lastFocused = null;

  function openCourseModal(card) {
    const svg = card.querySelector('.course-thumb svg');
    modalThumb.innerHTML = '';
    if (svg) modalThumb.appendChild(svg.cloneNode(true));
    modalTag.textContent = card.querySelector('.course-tag')?.textContent || '';
    modalTitle.textContent = card.querySelector('.course-title')?.textContent || '';
    modalAuthor.innerHTML = card.querySelector('.course-author')?.innerHTML || '';
    modalMeta.innerHTML = card.querySelector('.course-meta')?.innerHTML || '';
    modalPrice.innerHTML = card.querySelector('.price')?.innerHTML || '';
    modalDesc.textContent = card.dataset.desc || 'Full syllabus and project briefs are shared on enrollment.';

    lastFocused = document.activeElement;
    courseModal.classList.add('open');
    courseModal.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    courseModal.querySelector('.course-modal-close').focus();
    applyAdaptiveContrast();
  }

  function closeCourseModal() {
    courseModal.classList.remove('open');
    courseModal.setAttribute('aria-hidden', 'true');
    unlockBodyScrollIfNoneOpen();
    if (lastFocused) lastFocused.focus();
  }

  document.querySelectorAll('.course-card').forEach(card => {
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.addEventListener('click', () => openCourseModal(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCourseModal(card); }
    });
  });
  document.querySelectorAll('.view-more').forEach(link => {
    link.addEventListener('click', (e) => e.preventDefault());
  });

  const enrollBtn = courseModal.querySelector('.btn-primary');
  if (enrollBtn) enrollBtn.addEventListener('click', (e) => e.preventDefault());

  courseModal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeCourseModal));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && courseModal.classList.contains('open')) closeCourseModal(); });

  document.addEventListener('contextmenu', (e) => {
    if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) e.preventDefault();
  });
  document.addEventListener('selectstart', (e) => {
    if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) e.preventDefault();
  });
  document.addEventListener('copy', (e) => {
    if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => e.preventDefault());
})();
