// Función serverless de Vercel: recibe el formulario de contacto de la web y
// lo envía por email con la API transaccional de Brevo.
//
// Variables de entorno (Vercel → Project → Settings → Environment Variables):
//   BREVO_API_KEY       Clave API de Brevo (obligatoria).
//   CONTACT_TO_EMAIL    Destinatario(s), separados por comas.
//                       Por defecto: electricidad2373@gmail.com
//   CONTACT_FROM_EMAIL  Remitente de un dominio verificado en Brevo.
//                       Por defecto: no-reply@peritoelectricistas.com
//   CONTACT_FROM_NAME   Nombre del remitente. Por defecto: Web JS Electrical Services

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const LIMITS = { nombre: 100, apellido: 100, email: 254, mensaje: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY = 32 * 1024;

const MESSAGES = {
  success: 'Gracias por tu mensaje. Nos pondremos en contacto contigo pronto.',
  invalid: 'Revisa los campos marcados.',
  required: 'Este campo es obligatorio',
  email: 'Introduce un email válido',
  tooLong: 'El texto es demasiado largo',
  failure: 'No se pudo enviar el mensaje. Inténtalo de nuevo o llámanos al 787-944-8991.',
  unavailable: 'El formulario no está disponible en este momento. Llámanos al 787-944-8991 o escríbenos por WhatsApp.',
};

export default async function handler(req, res) {
  const wantsJson = /application\/json/i.test(`${req.headers.accept || ''} ${req.headers['content-type'] || ''}`);
  const reply = (status, body) => {
    if (wantsJson) return res.status(status).json(body);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(status).send(resultPage(body));
  };

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(405, { ok: false, message: 'Método no permitido.' });
  }

  // Solo se aceptan envíos hechos desde esta misma web
  if (!isSameOrigin(req)) {
    return reply(403, { ok: false, message: MESSAGES.failure });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    body = null;
  }
  if (!body || typeof body !== 'object') {
    return reply(400, { ok: false, message: MESSAGES.failure });
  }

  // Campo trampa: si un bot lo rellena, se responde como si todo fuera bien
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return reply(200, { ok: true, message: MESSAGES.success });
  }

  const data = {};
  const errors = {};
  for (const [name, max] of Object.entries(LIMITS)) {
    const value = typeof body[name] === 'string' ? body[name].trim() : '';
    if (value.length > max) errors[name] = MESSAGES.tooLong;
    data[name] = value;
  }
  if (!data.email) errors.email = MESSAGES.required;
  else if (!errors.email && !EMAIL_RE.test(data.email)) errors.email = MESSAGES.email;
  if (!data.mensaje) errors.mensaje = MESSAGES.required;

  if (Object.keys(errors).length) {
    return reply(400, { ok: false, message: MESSAGES.invalid, errors });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('[contact] Falta la variable de entorno BREVO_API_KEY');
    return reply(500, { ok: false, message: MESSAGES.unavailable });
  }

  // Los nombres van en el asunto: se quitan saltos de línea y caracteres de control
  const fullName = `${data.nombre} ${data.apellido}`.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const recipients = (process.env.CONTACT_TO_EMAIL || 'electricidad2373@gmail.com')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({ email }));

  const payload = {
    sender: {
      name: process.env.CONTACT_FROM_NAME || 'Web JS Electrical Services',
      email: process.env.CONTACT_FROM_EMAIL || 'no-reply@peritoelectricistas.com',
    },
    to: recipients,
    replyTo: fullName ? { email: data.email, name: fullName } : { email: data.email },
    subject: `Nuevo mensaje desde la web${fullName ? ` · ${fullName}` : ''}`,
    htmlContent: emailHtml(data, fullName),
    textContent: emailText(data, fullName),
    tags: ['formulario-web'],
  };

  try {
    const response = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[contact] Brevo respondió ${response.status}: ${detail.slice(0, 500)}`);
      return reply(502, { ok: false, message: MESSAGES.failure });
    }
  } catch (error) {
    console.error('[contact] Error al llamar a Brevo:', error);
    return reply(502, { ok: false, message: MESSAGES.failure });
  }

  return reply(200, { ok: true, message: MESSAGES.success });
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // algunos navegadores antiguos no lo envían
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

// Vercel ya interpreta JSON y formularios en req.body; si no lo hizo, se lee
// el cuerpo a mano (con límite de tamaño).
async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;

  let raw = '';
  if (typeof req.body === 'string') raw = req.body;
  else if (Buffer.isBuffer(req.body)) raw = req.body.toString('utf8');
  else {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw new Error('Cuerpo demasiado grande');
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }

  if (/application\/json/i.test(req.headers['content-type'] || '')) return JSON.parse(raw || '{}');
  return Object.fromEntries(new URLSearchParams(raw));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function emailHtml(data, fullName) {
  const row = (label, value) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#555;vertical-align:top"><strong>${label}</strong></td>` +
    `<td style="padding:6px 0">${value}</td></tr>`;
  const email = escapeHtml(data.email);
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#222">' +
    '<h2 style="margin:0 0 12px;color:#1e3a8a">Nuevo mensaje desde peritoelectricistas.com</h2>' +
    '<table style="border-collapse:collapse">' +
    row('Nombre', escapeHtml(fullName || '(sin indicar)')) +
    row('Email', `<a href="mailto:${email}">${email}</a>`) +
    '</table>' +
    '<p style="margin:16px 0 6px"><strong>Mensaje:</strong></p>' +
    `<p style="margin:0;white-space:pre-wrap">${escapeHtml(data.mensaje)}</p>` +
    '<p style="margin:20px 0 0;color:#888;font-size:12px">Puedes responder directamente a este correo para contestar al cliente.</p>' +
    '</div>'
  );
}

function emailText(data, fullName) {
  return [
    'Nuevo mensaje desde peritoelectricistas.com',
    '',
    `Nombre: ${fullName || '(sin indicar)'}`,
    `Email: ${data.email}`,
    '',
    'Mensaje:',
    data.mensaje,
  ].join('\n');
}

// Página que se muestra si el formulario se envió sin JavaScript
const LABELS = { nombre: 'Nombre', apellido: 'Apellido', email: 'Email', mensaje: 'Mensaje' };

function resultPage({ ok, message, errors }) {
  const title = ok ? 'Mensaje enviado' : 'No se pudo enviar el mensaje';
  const list = errors
    ? `<ul>${Object.entries(errors).map(([name, text]) => `<li><strong>${LABELS[name] || name}:</strong> ${escapeHtml(text)}</li>`).join('')}</ul>`
    : '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title} · JS Electrical Services</title>
  <link rel="icon" href="/assets/img/favicon.png" sizes="32x32">
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: #bfdbfe; color: #333; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.5; }
    main { max-width: 480px; padding: 40px 30px; border-radius: 20px; background: #fff; text-align: center; box-shadow: 0 1px 5px rgba(0, 0, 0, .1); }
    h1 { margin: 0 0 12px; color: #1e3a8a; font-family: sans-serif; font-size: 28px; line-height: 1.2; }
    p, ul { margin: 0 0 24px; }
    ul { padding: 0; list-style: none; color: #f56c6c; }
    a { display: inline-block; padding: 15px 30px; border-radius: 10px; background: #2461e5; color: #fff; font-family: sans-serif; font-size: 18px; font-weight: 500; line-height: 1; text-decoration: none; }
    a:hover { background: #1760d6; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${escapeHtml(message || '')}</p>
    ${list}
    <a href="/#contacto">Volver a la web</a>
  </main>
</body>
</html>`;
}
