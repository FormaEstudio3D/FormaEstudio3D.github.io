# Forma Estudio 3D — cartuchos NFC

Web de los llaveros con NFC: acercás el cartucho al teléfono y arranca el juego.

## Cómo funciona

El tag NFC guarda **solo una URL**. El teléfono la abre, y esta web corre el
juego con un emulador que funciona dentro del navegador.

La primera vez se descarga y **queda guardado en el teléfono**. De ahí en más
abre sin internet.

## Estructura

    index.html          catálogo
    app.js              lógica compartida por todos los cartuchos
    estilo.css          diseño
    sw.js               el modo offline
    icono-512.png       ícono para la pantalla de inicio
    emulador/           EmulatorJS (propio, no depende de ningún CDN)
    roms/               los juegos
    portadas/           las carátulas (opcionales)
    gba/<slug>/         un cartucho
    gbc/<slug>/         un cartucho

## Agregar un cartucho nuevo

1. Poner el archivo del juego en `roms/`
2. Copiar una carpeta existente (por ejemplo `gba/rubi/`) con el nombre nuevo
3. En su `index.html`, cambiar el bloque:

       window.JUEGO = {
         titulo: 'Nombre del juego',
         rom:    '/roms/archivo.gba',
         core:   'gba',              // gb | gba | nes | snes
         portada: '/portadas/slug.png'   // opcional
       };

   La carátula es opcional: si el archivo no está, la pantalla usa el
   cartucho dibujado y no se rompe nada.

4. En `manifest.json` de esa carpeta, cambiar `name` y `short_name`
5. Agregarlo al índice de la consola

## Reglas que NO hay que romper

- **Los nombres de carpeta no se cambian nunca.** Quedan grabados y bloqueados
  en los tags NFC ya vendidos. Renombrar una carpeta mata esos llaveros.
- **Las ROMs se suben una sola vez, bien.** Git guarda todas las versiones para
  siempre: si subís una de 16 MB y la reemplazás, el repo se queda con las dos.
- **El nombre del cache en `sw.js` no lleva versión.** Si le agregás una, todos
  los clientes pierden lo guardado y vuelven a bajar el juego entero.
- El core `-legacy-wasm.data` es el que realmente se usa en GitHub Pages.
  Sin él el juego no arranca en producción, aunque ande en tu PC.
