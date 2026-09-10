/* Service worker de Forma Estudio 3D.
   Hace que los cartuchos funcionen sin internet.

   Dos estrategias distintas a propósito:

   - ROMs y cores del emulador  -> CACHE PRIMERO.
     Son pesados y nunca cambian. Una vez guardados, no se bajan nunca más.

   - HTML, CSS y JS             -> RED PRIMERO, cache como respaldo.
     Así, si arreglás algo en app.js, todos los llaveros ya vendidos
     agarran la corrección solos la próxima vez que tengan señal.
     Y si no hay señal, igual abren con la última versión guardada. */

/* OJO: este nombre NO lleva número de versión, y es a propósito.
   Si le pusieras "-v2" y algún día lo cambiaras a "-v3", TODOS los
   clientes que ya compraron perderían el juego guardado y volverían a
   bajar 16 MB cada uno. El contenido acá adentro (ROMs y cores) no
   cambia nunca, así que el cache tampoco necesita versionarse. */
var CACHE = 'formaestudio3d';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  /* No borramos nada: lo guardado es del cliente y borrarlo le costaría
     otra descarga completa. Solo tomamos el control de las pestañas. */
  e.waitUntil(self.clients.claim());
});

/* ¿Es un archivo pesado que nunca cambia? */
function esPesado(url) {
  return url.indexOf('/roms/') !== -1 ||
         url.indexOf('/emulador/cores/') !== -1 ||
         /\.(data|wasm)$/.test(url);
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);

  if (url.origin !== self.location.origin) return;   // no tocamos pedidos de afuera

  /* EmulatorJS pregunta el tamaño de la ROM con un pedido HEAD antes de
     bajarla. Sin internet ese pedido moría y el juego se colgaba en
     "Descargando datos del juego". Lo contestamos desde lo guardado. */
  if (req.method === 'HEAD' && esPesado(url.pathname)) {
    e.respondWith(
      caches.match(url.href).then(function (hit) {
        if (!hit) return fetch(req);
        return hit.blob().then(function (b) {
          return new Response(null, {
            status: 200,
            headers: {
              'Content-Length': String(b.size),
              'Content-Type': 'application/octet-stream'
            }
          });
        });
      }).catch(function () { return fetch(req); })
    );
    return;
  }

  if (req.method !== 'GET') return;

  if (esPesado(url.pathname)) {
    /* Cache primero */
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (resp) {
          if (resp && resp.ok) {
            var copia = resp.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copia); });
          }
          return resp;
        });
      })
    );
    return;
  }

  /* Red primero, cache de respaldo.

     Ojo con el 'no-cache': GitHub Pages manda los archivos con la orden
     de guardarlos 10 minutos. Sin esto, el navegador contesta desde SU
     propio cache sin preguntar y una corrección recién publicada tarda
     en llegar. Peor todavía en iPhone: al agregar a la pantalla de
     inicio, Safari leía el HTML viejo y se quedaba con el ícono viejo.
     Con 'no-cache' siempre le pregunta al servidor si cambió; si no
     cambió, la respuesta es mínima y no se baja nada de nuevo. */
  e.respondWith(
    fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(function (resp) {
      if (resp && resp.ok) {
        var copia = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); });
        return resp;
      }
      /* El servidor contestó, pero con un error (un 404 si algún día el
         sitio dejara de existir, un 500, lo que sea). Eso NO es una
         respuesta válida para mostrar: si tenemos el juego guardado en
         el teléfono, vale infinitamente más que la página de error.
         Sin esto, alguien con el juego ya descargado vería un 404. */
      return caches.match(req).then(function (hit) { return hit || resp; });
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        /* Sin red y sin copia guardada: hay que devolver un error de
           verdad. Devolver la portada con estado 200, como hacíamos
           antes, le miente al emulador y lo deja colgado buscando un
           archivo que en realidad nunca llegó. */
        return hit || new Response('Sin conexión', { status: 503 });
      });
    })
  );
});
