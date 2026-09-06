/* ==========================================================================
   RL · IMAT — worker de cálculo del Tema 4
   Saca del hilo principal el único cálculo largo de la página: el modo por
   lotes del módulo 2 (§6.3 del libro), que reprocesa el lote entero tras cada
   episodio nuevo y cuesta ~14 s con 100 repeticiones.

   Regla del repositorio: todo lo que pase de ~2 s va a un worker con barra de
   progreso. El resto de los módulos del Tema 4 está por debajo de 500 ms y se
   calcula en el hilo principal.

   Patrón de mensajes: el mismo que `calculo-worker.js` del Tema 1.
   ========================================================================== */

import { generador } from "./nucleo.js";
import {
  paseoAleatorio, prediccionPorLotes, errorRMS, muestrearEpisodio,
} from "./sinmodelo.js";

/** Tope de pasos por episodio del paseo aleatorio; el mismo que usa el motor. */
const MAX_PASOS = 1000;

/**
 * Un episodio no truncado, descartando los que alcanzan el tope.
 *
 * Replica `episodioCompleto` de `sinmodelo.js`, que es interna. El consumo del
 * generador es idéntico, así que los números coinciden con los de `curvaRMS`.
 *
 * @param {object} entorno Entorno simulable.
 * @param {object} rng Generador de `generador(semilla)`.
 * @returns {object} Episodio de `muestrearEpisodio`.
 * @throws {Error} Si no se consigue un episodio corto en 100 intentos.
 */
function episodioCompleto(entorno, rng) {
  for (let intento = 0; intento < 100; intento++) {
    const episodio = muestrearEpisodio(entorno, null, null, rng, { maxPasos: MAX_PASOS });
    if (!episodio.truncado) return episodio;
  }
  throw new Error(`No se ha conseguido un episodio de menos de ${MAX_PASOS} pasos en 100 intentos`);
}

/**
 * Curvas de error RMS del entrenamiento por lotes, para MC y para TD(0).
 *
 * Los dos métodos ven EXACTAMENTE los mismos episodios: se muestrean una sola
 * vez por ejecución y se pasan a los dos. Es lo mismo que hace `curvaRMS`
 * llamando a cada método por separado con la misma semilla —`prediccionPorLotes`
 * no consume azar—, pero a la mitad de coste.
 *
 * @param {object} opciones
 * @param {number} opciones.semilla Semilla base; la ejecución i usa `semilla + i`.
 * @param {number} opciones.episodios Episodios por ejecución.
 * @param {number} opciones.ejecuciones Ejecuciones independientes a promediar.
 * @param {number} opciones.alpha Paso de aprendizaje del lote.
 * @param {Function} opciones.alProgresar `(fraccion) => void`.
 * @returns {{curvaMC: number[], curvaTD: number[], historialMC: number[][], historialTD: number[][], ejecuciones: number}}
 *   Los dos historiales son los de la ejecución 0: una instantánea de V por
 *   episodio, para el panel de valores estimados.
 * @throws {Error} Si la iteración por lotes diverge con ese alpha.
 */
function curvasPorLotes({ semilla, episodios, ejecuciones, alpha, alProgresar }) {
  const entorno = paseoAleatorio();
  const verdaderos = entorno.valoresVerdaderos;
  const vInicial = entorno.valorInicial;
  const vCero = new Array(entorno.nEstados).fill(vInicial);
  const rmsInicial = errorRMS(vCero, verdaderos);

  const curvaMC = new Array(episodios + 1).fill(0);
  const curvaTD = new Array(episodios + 1).fill(0);
  curvaMC[0] = rmsInicial;
  curvaTD[0] = rmsInicial;
  let historialMC = null;
  let historialTD = null;

  for (let i = 0; i < ejecuciones; i++) {
    const rng = generador(semilla + i);
    const acumulados = [];
    const instantaneasMC = [vCero.slice()];
    const instantaneasTD = [vCero.slice()];

    for (let k = 0; k < episodios; k++) {
      acumulados.push(episodioCompleto(entorno, rng));
      const mc = prediccionPorLotes(entorno, acumulados, { metodo: "mc", alpha, vInicial });
      const td = prediccionPorLotes(entorno, acumulados, { metodo: "td", alpha, vInicial });
      curvaMC[k + 1] += errorRMS(mc.V, verdaderos) / ejecuciones;
      curvaTD[k + 1] += errorRMS(td.V, verdaderos) / ejecuciones;
      if (i === 0) {
        instantaneasMC.push(mc.V.slice());
        instantaneasTD.push(td.V.slice());
      }
    }

    if (i === 0) {
      historialMC = instantaneasMC;
      historialTD = instantaneasTD;
    }
    alProgresar((i + 1) / ejecuciones);
  }

  return { curvaMC, curvaTD, historialMC, historialTD, ejecuciones };
}

self.onmessage = (evento) => {
  const { tarea, id, config } = evento.data;
  const alProgresar = (fraccion) => self.postMessage({ tipo: "progreso", id, fraccion });

  try {
    if (tarea === "lotes") {
      const resultado = curvasPorLotes({ ...config, alProgresar });
      self.postMessage({ tipo: "listo", id, resultado });
    } else {
      self.postMessage({ tipo: "error", id, mensaje: `Tarea desconocida: ${tarea}` });
    }
  } catch (error) {
    self.postMessage({
      tipo: "error",
      id,
      mensaje: String(error && error.message ? error.message : error),
    });
  }
};
