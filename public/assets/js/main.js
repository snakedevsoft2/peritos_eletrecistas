/* =============================================================================
   JS Electrical Services · peritoelectricistas.com
   Comportamiento del sitio: encabezado fijo, botón de WhatsApp y formulario.
   ============================================================================= */
(function () {
  'use strict';

  var dataLayer = (window.dataLayer = window.dataLayer || []);
  var isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);

  /* ---------- Encabezado fijo ----------
     Igual que en el sitio original: pasados 220px de scroll el menú se fija
     arriba y el <header> conserva su altura para que el contenido no salte. */
  function initStickyHeader() {
    var header = document.getElementById('site-header');
    if (!header) return;

    var nav = header.querySelector('.site-header__nav');
    var stuck = false;
    var ticking = false;

    function keepHeight() {
      header.style.minHeight = nav.getBoundingClientRect().height + 'px';
    }

    function update() {
      ticking = false;
      var shouldStick = window.scrollY > 220;
      if (shouldStick === stuck) return;

      stuck = shouldStick;
      if (stuck) {
        keepHeight();
        header.classList.add('is-stuck');
      } else {
        header.classList.remove('is-stuck');
        header.style.minHeight = '';
      }
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    window.addEventListener('resize', function () {
      if (stuck) keepHeight();
    });

    update();
  }

  /* ---------- Botón flotante de WhatsApp ---------- */
  function initWhatsApp() {
    var button = document.querySelector('.whatsapp');
    if (!button) return;

    // Mismo evento que enviaba el plugin Joinchat a Google Tag Manager
    button.addEventListener('click', function () {
      dataLayer.push({
        event: 'JoinChat',
        event_label: button.href,
        event_action: 'whatsapp: 17879448991',
        chat_channel: 'whatsapp',
        chat_id: '17879448991',
        chat_message: '',
        is_mobile: isMobile ? 'yes' : 'no',
        page_location: location.href,
        page_title: document.title || 'no title'
      });
    });

    // En el móvil se oculta mientras se escribe, para no tapar el teclado
    if (!isMobile) return;

    var timer;
    function sync() {
      var active = document.activeElement;
      var typing = !!(active && active.matches && active.matches('input, textarea'));
      if (typing) button.style.animationDelay = '10ms';
      button.hidden = typing;
    }

    ['focusin', 'focusout'].forEach(function (type) {
      document.addEventListener(type, function (event) {
        if (!event.target.matches || !event.target.matches('input, textarea')) return;
        clearTimeout(timer);
        timer = setTimeout(sync, 200);
      });
    });
  }

  /* ---------- Formulario de contacto ----------
     Valida en el navegador y envía los datos a /api/contact (función de
     Vercel que manda el email). Sin JavaScript el formulario se envía igual
     de forma tradicional. */
  var MESSAGES = {
    required: 'Este campo es obligatorio',
    email: 'Introduce un email válido',
    success: 'Gracias por tu mensaje. Nos pondremos en contacto contigo pronto.',
    failure: 'No se pudo enviar el mensaje. Inténtalo de nuevo o llámanos al 787-944-8991.'
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function initContactForm() {
    var form = document.getElementById('contact-form');
    if (!form || !window.fetch) return;

    var wrap = document.getElementById('contact-form-wrap');
    var errorsBox = document.getElementById('contact-form-errors');
    var submit = form.querySelector('[type="submit"]');
    var fields = Array.prototype.slice.call(form.querySelectorAll('.ff-control'));

    function setError(field, message) {
      var group = field.closest('.ff-group');
      var box = group.querySelector('.ff-error');

      if (!message) {
        group.classList.remove('ff-has-error');
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
        if (box) box.parentNode.removeChild(box);
        return;
      }

      if (!box) {
        box = document.createElement('div');
        box.className = 'ff-error';
        box.id = field.id + '-error';
        field.parentNode.appendChild(box);
      }
      box.textContent = message;
      group.classList.add('ff-has-error');
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', box.id);
    }

    function validate(field) {
      var value = field.value.trim();
      var message = '';
      if (field.required && !value) message = MESSAGES.required;
      else if (field.type === 'email' && value && !EMAIL_RE.test(value)) message = MESSAGES.email;
      setError(field, message);
      return !message;
    }

    function setWorking(working) {
      form.classList.toggle('is-submitting', working);
      submit.classList.toggle('is-working', working);
      submit.disabled = working;
    }

    function showSuccess(message) {
      var box = document.createElement('div');
      box.className = 'ff-success';
      box.setAttribute('role', 'status');
      box.textContent = message || MESSAGES.success;
      form.hidden = true;
      wrap.appendChild(box);
      dataLayer.push({ event: 'contact_form_submit', form_id: 'contacto' });
    }

    function showFailure(body) {
      if (body && body.errors) {
        Object.keys(body.errors).forEach(function (name) {
          var field = form.elements[name];
          if (field && field.classList.contains('ff-control')) setError(field, body.errors[name]);
        });
      }
      errorsBox.textContent = (body && body.message) || MESSAGES.failure;
      errorsBox.hidden = false;
    }

    fields.forEach(function (field) {
      field.addEventListener('input', function () {
        if (field.closest('.ff-group').classList.contains('ff-has-error')) validate(field);
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      errorsBox.hidden = true;

      var firstInvalid = null;
      fields.forEach(function (field) {
        if (!validate(field) && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      var data = {};
      new FormData(form).forEach(function (value, key) {
        data[key] = value;
      });

      setWorking(true);
      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (body) {
            if (response.ok && body.ok) showSuccess(body.message);
            else showFailure(body);
          });
        })
        .catch(function () {
          showFailure(null);
        })
        .then(function () {
          setWorking(false);
        });
    });
  }

  initStickyHeader();
  initWhatsApp();
  initContactForm();
})();
