/* ============================================================
   Lógica compartida por TODOS los cartuchos.
   Cada carpeta de juego define window.JUEGO y carga este archivo.
   Si arreglás algo acá, se arregla en todos los llaveros a la vez.
   ============================================================ */
(function () {
  'use strict';

  var cfg    = window.JUEGO || {};
  var titulo = cfg.titulo || 'Forma Estudio 3D';
  var core   = cfg.core   || 'gb';
  var rom    = cfg.rom    || null;

  var CACHE  = 'formaestudio3d';   // mismo nombre que en sw.js, sin versión
  var BASE   = '/emulador/';

  /* Qué archivo de core necesita cada consola */
  var CORES = { gb: 'gambatte-wasm', gbc: 'gambatte-wasm', gba: 'mgba-wasm' };

  var NUCLEO = CORES[core] || 'gambatte-wasm';
  var MOTOR  = NUCLEO.replace('-wasm', '');

  var ESENCIALES = [
    /* La propia página del cartucho va PRIMERA y es imprescindible.
       El service worker se registra recién durante esta visita, así que
       no llega a interceptar (ni guardar) la carga que lo instaló.
       Si no la guardamos a mano acá, el cliente guarda los 16 MB del
       juego pero al abrirlo sin señal le aparece "Sin conexión". */
    location.pathname,
    'manifest.json',
    '/app.js',
    '/estilo.css',
    BASE + 'loader.js',
    BASE + 'emulator.min.js',
    BASE + 'emulator.min.css',
    BASE + 'localization/es-ES.json',
    BASE + 'compression/extract7z.js',
    BASE + 'cores/reports/' + MOTOR + '.json',
    BASE + 'cores/' + NUCLEO + '.data',
    /* El core "legacy" es el que realmente se usa en GitHub Pages:
       sin los headers COOP/COEP no hay hilos, así que el navegador cae
       en esta versión. Si falta, el juego no arranca. */
    BASE + 'cores/' + MOTOR + '-legacy-wasm.data'
  ];

  document.title = titulo + ' — Forma Estudio 3D';

  /* ---------------- pantalla ---------------- */
  document.body.innerHTML =
    '<div id="portada">' +
      '<div class="cartucho"></div>' +
      '<h1></h1>' +
      '<p class="sub"></p>' +
      '<button class="boton" id="btn" disabled></button>' +
      '<div class="barra" id="barra" hidden><i></i></div>' +
      '<p class="aviso" id="aviso" hidden></p>' +
      '<input type="file" id="archivo" accept=".gb,.gbc,.gba,.nes,.smc,.sfc,.zip" hidden>' +
      '<p class="pie">FORMA ESTUDIO 3D</p>' +
    '</div>' +
    '<div id="contenedor"><div id="game"></div></div>';

  var portada    = document.getElementById('portada');
  var contenedor = document.getElementById('contenedor');
  var btn        = document.getElementById('btn');
  var barra      = document.getElementById('barra');
  var relleno    = barra.querySelector('i');
  var aviso      = document.getElementById('aviso');
  var archivo    = document.getElementById('archivo');
  var sub        = document.querySelector('.sub');

  document.querySelector('h1').textContent = titulo;

  /* ---------------- arranque ---------------- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }

  if (!rom) {
    /* Cartucho sin juego fijo: el usuario carga el suyo */
    sub.textContent = 'Elegí el archivo del juego que tengas en tu teléfono.';
    btn.textContent = 'ELEGIR JUEGO';
    btn.disabled = false;
    btn.onclick = function () { archivo.click(); };
    archivo.onchange = function () {
      if (archivo.files.length) arrancar(URL.createObjectURL(archivo.files[0]));
    };
    return;
  }

  preparar();

  function preparar() {
    sub.textContent = 'Un momento…';
    yaGuardado().then(function (listo) {
      if (listo) {
        sub.textContent = 'Listo para jugar, con o sin internet.';
        btn.textContent = 'JUGAR';
        btn.disabled = false;
        btn.onclick = function () { arrancar(rom); };
        sugerirInstalar();
      } else {
        sub.textContent = 'La primera vez se guarda el juego en tu teléfono. Después abre solo, sin internet.';
        btn.textContent = 'GUARDAR Y JUGAR';
        btn.disabled = false;
        btn.onclick = guardarYJugar;
      }
    });
  }

  function yaGuardado() {
    if (!('caches' in window)) return Promise.resolve(false);
    return caches.open(CACHE).then(function (c) {
      return c.match(rom).then(function (hit) { return !!hit; });
    }).catch(function () { return false; });
  }

  /* ---------------- descarga ---------------- */
  function guardarYJugar() {
    btn.disabled = true;
    btn.textContent = 'GUARDANDO…';
    barra.hidden = false;
    progreso(0);

    caches.open(CACHE)
      .then(function (c) {
        return c.addAll(ESENCIALES).catch(function () { /* si falla alguno, seguimos */ })
                .then(function () { return c; });
      })
      .then(function (c) { return bajarRom(c); })
      .then(function () {
        progreso(1);
        sugerirInstalar();
        arrancar(rom);
      })
      .catch(function (e) {
        barra.hidden = true;
        btn.disabled = false;
        btn.textContent = 'REINTENTAR';
        sub.textContent = 'No se pudo descargar el juego. Revisá la conexión.';
        btn.onclick = guardarYJugar;
      });
  }

  function bajarRom(cache) {
    return fetch(rom).then(function (resp) {
      if (!resp.ok) throw new Error('rom');
      var total = parseInt(resp.headers.get('Content-Length') || '0', 10);

      if (!resp.body || !total) {                    // navegador viejo: sin barra fina
        return resp.blob().then(function (b) { return guardar(cache, b); });
      }

      var lector = resp.body.getReader();
      var trozos = [], leido = 0;

      return (function seguir() {
        return lector.read().then(function (r) {
          if (r.done) return guardar(cache, new Blob(trozos));
          trozos.push(r.value);
          leido += r.value.length;
          progreso(leido / total);
          return seguir();
        });
      })();
    });
  }

  function guardar(cache, blob) {
    return cache.put(rom, new Response(blob, {
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(blob.size) }
    }));
  }

  function progreso(p) {
    relleno.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
  }

  /* ---------------- "agregar a inicio" ---------------- */
  function sugerirInstalar() {
    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    var instalado = window.navigator.standalone === true ||
                    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (!iOS || instalado) return;
    aviso.hidden = false;
    aviso.innerHTML = 'Para que el juego te quede guardado para siempre: ' +
                      'tocá <b>Compartir</b> y después <b>Agregar a inicio</b>.';
  }

  /* ---------------- emulador ---------------- */
  function arrancar(url) {
    portada.classList.add('oculto');
    contenedor.classList.add('activo');

    window.EJS_player        = '#game';
    window.EJS_core          = core;
    window.EJS_gameUrl       = url;
    window.EJS_gameName      = titulo;
    window.EJS_startOnLoaded = true;
    window.EJS_color         = '#8bac0f';
    window.EJS_pathtodata    = BASE;

    /* El emulador guarda la partida cada 5 minutos por defecto. Para un
       llavero eso es demasiado: la gente juega un rato corto y cierra.
       Lo bajamos a 30 segundos. */
    window.EJS_defaultOptions = { 'save-save-interval': '30' };

    protegerPartida();

    var s = document.createElement('script');
    s.src = BASE + 'loader.js';
    document.body.appendChild(s);
  }

  /* Guardar la partida al salir.

     El emulador se apoya en 'beforeunload', que en iPhone NO se dispara:
     Safari no lo ejecuta al cerrar la pestaña ni al cambiar de app. Por
     eso la partida se perdía en iOS aunque el jugador hubiera guardado.

     'visibilitychange' sí es confiable en iOS y salta apenas la pantalla
     deja de verse, que es justo el momento de escribir. */
  function protegerPartida() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') guardarPartida();
    });
    window.addEventListener('pagehide', guardarPartida);
    window.addEventListener('blur', guardarPartida);
  }

  function guardarPartida() {
    try {
      var em = window.EJS_emulator;
      if (em && em.started && em.gameManager) em.gameManager.saveSaveFiles();
    } catch (e) { /* si el emulador todavía no arrancó, no hay nada que guardar */ }
  }
})();
