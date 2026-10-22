# peritoelectricistas.com · JS Electrical Services

Sitio web de **JS Electrical Services** (perito electricista 24/7 en Puerto Rico).

Es una réplica exacta de la web que estaba hecha con WordPress + Elementor en Hostinger, reconstruida como sitio
estático (HTML + CSS + JS sin dependencias) para publicarse en **Vercel**. Mantiene el mismo diseño, textos,
imágenes, botones de llamada y WhatsApp, formulario de contacto y etiquetas de Google Tag Manager.

## Estructura

```
public/                     Lo que publica Vercel
  index.html                Página principal (todo el contenido)
  404.html                  Página de "no encontrada"
  robots.txt, sitemap.xml
  assets/css/styles.css     Estilos
  assets/js/main.js         Encabezado fijo, botón de WhatsApp y formulario
  assets/img/               Imágenes (optimizadas, mismas dimensiones que las originales)
api/contact.js              Función serverless que envía el formulario por email (Brevo)
vercel.json                 Configuración de Vercel: carpeta pública, redirecciones y cabeceras
.env.example                Variables de entorno que necesita el formulario
```

## Ver el sitio en local

- Solo la parte visual: `npx serve public` y abrir la URL que indique.
- Con el formulario funcionando: `npx vercel dev` (pide iniciar sesión en Vercel). Copia `.env.example`
  como `.env.local` y pon tu `BREVO_API_KEY`.

## Publicar en Vercel

1. En Vercel: **Add New → Project → Import** el repositorio `snakedevsoft2/peritos_eletrecistas`.
2. Framework Preset: **Other**. No hace falta tocar Build ni Output: `vercel.json` ya indica que se publica
   la carpeta `public/`.
3. En **Environment Variables** añade:

   | Variable | Obligatoria | Valor |
   | --- | --- | --- |
   | `BREVO_API_KEY` | Sí | Clave API de Brevo (Brevo → SMTP & API → API Keys) |
   | `CONTACT_TO_EMAIL` | No | Quién recibe los mensajes. Por defecto `electricidad2373@gmail.com` (admite varios separados por comas) |
   | `CONTACT_FROM_EMAIL` | No | Remitente. Por defecto `no-reply@peritoelectricistas.com` (el dominio ya está verificado en Brevo) |
   | `CONTACT_FROM_NAME` | No | Nombre del remitente. Por defecto `Web JS Electrical Services` |

4. **Deploy** y revisa la URL `*.vercel.app` que te da Vercel. Prueba el formulario: el mensaje llega al
   correo configurado y al pulsar "Responder" se contesta directamente al cliente.

Cada `git push` a `main` vuelve a publicar el sitio automáticamente.

Si falta `BREVO_API_KEY` o Brevo rechaza el envío, el visitante ve un aviso para que llame o escriba por
WhatsApp, y el motivo queda en **Vercel → Project → Logs**.

## Dominio: de Cloudflare a WordPress.com + Vercel

Situación de partida (octubre de 2026):

- Registrador del dominio: **WordPress.com** (Automattic).
- DNS: **Cloudflare** (`ganz.ns.cloudflare.com` / `cloe.ns.cloudflare.com`), sin proxy y sin DNSSEC.
- Web: Hostinger (IP `82.25.81.243`).
- Registros que hay que conservar porque autentican el dominio en **Brevo** (sin ellos el formulario deja
  de enviar): `TXT @ brevo-code:…`, `TXT mail._domainkey` (DKIM) y `TXT _dmarc` (DMARC).
  El dominio no tiene registros MX (no recibe correo).

Sigue los pasos en este orden para no dejar la web caída en ningún momento:

1. **Vercel → Project → Settings → Domains**: añade `peritoelectricistas.com` y `www.peritoelectricistas.com`,
   y marca que `www` redirija al dominio principal. Vercel mostrará los registros que necesita (un `A` para
   `@` y un `CNAME` para `www`). Usa exactamente esos valores.
2. **Cloudflare → DNS → Records → Import and Export → Export**: descarga una copia de la zona actual. Ahí
   están los valores exactos de los TXT de Brevo.
3. **Cloudflare** (que aún manda): cambia el `A` de `@` y el registro de `www` por los de Vercel, con la nube
   en gris ("DNS only"). En unos 30 minutos la web ya sale desde Vercel y Vercel emite el certificado SSL.
   Compruébalo antes de seguir.
4. **WordPress.com → Mejoras (Upgrades) → Dominios → peritoelectricistas.com → Registros DNS**: crea los
   mismos registros: el `A` y el `CNAME` de Vercel y los tres `TXT` de Brevo (`@`, `mail._domainkey`,
   `_dmarc`), copiando los valores del archivo exportado. Borra los registros `A`/`CNAME` que WordPress.com
   tenga por defecto para `@` y `www`.
5. En la misma pantalla, en **Servidores de nombres (Name servers)**, activa **Usar los servidores de nombres
   de WordPress.com**.
6. Espera a que el cambio se propague (normalmente unas horas; hasta 48 h). Comprueba en
   [dnschecker.org](https://dnschecker.org/#NS/peritoelectricistas.com) que los NS ya son de WordPress.com y que la
   web, el SSL y el formulario funcionan. En Brevo → Senders, Domains & Dedicated IPs → Domains, el dominio
   debe seguir como autenticado.
7. Solo entonces, en **Cloudflare → el sitio → Overview → Advanced actions → Remove site from Cloudflare**.
8. Antes de cancelar Hostinger, haz copia de seguridad de WordPress (archivos y base de datos) y exporta los
   mensajes guardados del formulario (Fluent Forms → Entries → Export).

## Notas para mantenimiento

- **Textos e imágenes**: todo el contenido está en `public/index.html`. Si cambias `styles.css` o `main.js`,
  sube el número de `?v=1` en las etiquetas `<link>`/`<script>` para que los navegadores no usen la versión
  antigua.
- **Conversiones de Google Ads**: Google Tag Manager (`GTM-NJPL3F92`, cuenta `AW-678777273`) está en
  `index.html` y `404.html`. La conversión de llamada se dispara al pulsar enlaces `tel:`; si añades botones
  de llamada, usa siempre `href="tel:787-944-8991"`. Además se envían a `dataLayer` los eventos
  `contact_form_submit` (formulario enviado) y `JoinChat` (botón flotante de WhatsApp, igual que el plugin
  original), por si quieres usarlos como conversiones en GTM.
- **Tipografías**: el sitio original pedía Outfit, Poppins, Plus Jakarta Sans y Geologica, pero las cargaba
  desde un dominio que ya no existe, así que siempre se vio con la tipografía del sistema. La réplica mantiene
  ese aspecto. Para activar las fuentes reales, cárgalas (por ejemplo, desde Google Fonts) y añade su nombre
  en las variables `--f-*` al principio de `styles.css`.
- **Direcciones antiguas**: `vercel.json` redirige las URLs que existían en WordPress (`/servicios/`,
  `/contacto/`, `/sample-page/`, la entrada "Hello world", los feeds y los `wp-sitemap*.xml`) a la sección
  equivalente de la página principal, para no perder visitas desde Google.
- **Anti-spam del formulario**: campo trampa oculto y comprobación de que el envío viene de la propia web.
