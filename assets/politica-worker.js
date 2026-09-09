/* ==========================================================================
   RL · IMAT — worker de cálculo del Tema 5 (2.ª parte)
   Saca del hilo principal los cuatro módulos con simulación de `tema5b.html`:
   el 3 (REINFORCE: hasta 3 × 100 × 1000 episodios), el 4 (línea base: hasta
   3 × 100 × 1000, más 10 000 episodios con θ congelado), el 5 (actor-crítico:
   2 × 50 × 500 con tope de 1 000 pasos) y el 6 (colapso: 20 × 300 con tope de
   1 000 pasos). Los módulos 1 y 2 NO pasan por aquí: son forma cerrada y
   están por debajo de 5 ms.

   Regla del repositorio: todo lo que pase de ~2 s va a un worker con barra de
   progreso.

   Patrón de mensajes: el mismo que `aproximacion-worker.js` y
   `sinmodelo-worker.js`.
     entrada:  { tarea, id, config }
     salida:   { tipo: "progreso" | "listo" | "error", id, ... }

   UNA SOLA TAREA, "tanda", porque los cuatro módulos piden lo mismo con
   distinta configuración (guion §C1):

     módulo 3   algoritmo "reinforce"                     1000 × {1,10,100}
     módulo 4   algoritmo "reinforceLineaBase"            1000 × 100
     módulo 5   algoritmos ["lineaBase","actorCritico"]    500 × 50
     módulo 6   algoritmo "reinforce" con freno            300 × 20

   El progreso se informa POR EJECUCIÓN TERMINADA, y la respuesta lleva el
   número de ejecuciones, los truncados, las cortadas, los recortes y las
   colapsadas PARA QUE LA INTERFAZ LOS ROTULE SIN RECALCULAR NADA.

   ⚠ QUÉ COMPARTEN LAS VARIANTES DE UNA TANDA. La ejecución k de cada variante
   usa `generador(semilla + k)` y el mismo orden de consumo del generador. NO
   comparten las trayectorias, y no pueden: en REINFORCE los episodios los
   genera la política que se está actualizando, así que en cuanto dos
   variantes divergen en θ dejan de ver los mismos episodios. Dos variantes
   idénticas sí dan curvas idénticas (aserciones C4-14 y C6-10). El único
   sitio donde los episodios se comparten literalmente es el estudio del
   estimador con θ congelado del módulo 4, que va en el hilo principal porque
   son 10 000 episodios cortos.

   ⚠ CLAVE DE CACHÉ: toda la configuración que cambia el resultado. La caché
   se vacía al cambiar la semilla porque la semilla forma parte de la clave.
   ========================================================================== */

import { tanda } from "./politica.js";

/** Caché por firma de configuración. */
const CACHE = new Map();

/**
 * Firma de caché de una configuración: solo lo que cambia el resultado.
 *
 * @param {string} tarea Nombre de la tarea.
 * @param {object} config Configuración de la tanda.
 * @returns {string} Clave de caché.
 */
function firma(tarea, config) {
  const {
    entorno, algoritmo, episodios, ejecuciones, semilla, p0 = 0.05, theta0 = null,
    alphaTheta, alphaW = 0, gamma = null, maxPasos = 10000, w0 = null,
    base = "estado", capacidad = "unNumero", freno = null, acumularEpisodio = false,
  } = config;
  const ent = typeof entorno === "string"
    ? entorno
    : `${entorno.tipo}:${entorno.alias !== false}:${entorno.gamma ?? 1}`;
  const alg = Array.isArray(algoritmo) ? algoritmo.join("+") : algoritmo;
  const ini = theta0 ? `t${Array.from(theta0).join(",")}` : `p${p0}`;
  const fr = freno ? `kl${freno.delta}` : "-";
  return [
    tarea, ent, alg, episodios, ejecuciones, semilla, ini, alphaTheta, alphaW,
    gamma, maxPasos, w0, base, capacidad, fr, acumularEpisodio,
  ].join("|");
}

/**
 * Convierte los tipados de la respuesta en arrays normales.
 *
 * El clonado estructurado sabe copiar `Float64Array`, pero la interfaz y las
 * pruebas trabajan con arrays; hacerlo aquí evita que cada módulo lo repita.
 *
 * @param {object} resultado Salida de `tanda`.
 * @returns {object} La misma estructura con arrays normales.
 */
function serializar(resultado) {
  const curvas = {};
  for (const [clave, valor] of Object.entries(resultado.curvas)) {
    curvas[clave] = Array.from(valor);
  }
  const porEjecucion = {};
  for (const [variante, detalle] of Object.entries(resultado.porEjecucion)) {
    porEjecucion[variante] = {
      curvaG0: detalle.curvaG0.map((c) => Array.from(c)),
      curvaP: detalle.curvaP.map((c) => Array.from(c)),
      pFinal: detalle.pFinal.slice(),
      thetaFinal: detalle.thetaFinal.map((t) => Array.from(t)),
      wFinal: detalle.wFinal.map((w) => Array.from(w)),
      cortadaEn: detalle.cortadaEn.slice(),
    };
  }
  const ejecucionesPorEpisodio = {};
  for (const [variante, valor] of Object.entries(resultado.ejecucionesPorEpisodio)) {
    ejecucionesPorEpisodio[variante] = Array.from(valor);
  }
  return { ...resultado, curvas, porEjecucion, ejecucionesPorEpisodio };
}

/**
 * Ejecuta una tanda y devuelve el resultado listo para viajar.
 *
 * Está exportada para poder probarla desde `node --test` sin simular la
 * mensajería.
 *
 * @param {object} config Configuración de `tanda`.
 * @param {Function} [alProgresar] `(fraccion) => void`.
 * @returns {object} Resultado serializable.
 */
export function calcularTanda(config, alProgresar = null) {
  return serializar(tanda(config, { alProgresar }));
}

/* El `self.onmessage` se instala SOLO dentro de un worker: así este módulo se
   puede importar desde `node --test` —donde no hay `self`— para probar la
   función de cálculo, que está exportada, sin simular la mensajería. */
if (typeof self !== "undefined" && typeof self.postMessage === "function") {
  self.onmessage = (evento) => {
    const { tarea, id, config } = evento.data;
    const alProgresar = (fraccion) => self.postMessage({ tipo: "progreso", id, fraccion });

    try {
      if (tarea !== "tanda") {
        self.postMessage({ tipo: "error", id, mensaje: `Tarea desconocida: ${tarea}` });
        return;
      }
      const clave = firma(tarea, config);
      if (CACHE.has(clave)) {
        self.postMessage({ tipo: "listo", id, resultado: CACHE.get(clave), deCache: true });
        return;
      }
      const resultado = calcularTanda(config, alProgresar);
      CACHE.set(clave, resultado);
      self.postMessage({ tipo: "listo", id, resultado, deCache: false });
    } catch (error) {
      self.postMessage({
        tipo: "error",
        id,
        mensaje: String(error && error.message ? error.message : error),
      });
    }
  };
}
