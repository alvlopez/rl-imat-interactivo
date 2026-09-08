/* ==========================================================================
   RL · IMAT — worker de cálculo del Tema 5
   Saca del hilo principal los dos únicos cálculos largos de `tema5.html`:
   el módulo 3 (predicción: 5000 episodios × 2 métodos × 10 ejecuciones) y el
   módulo 5 (control: 5 pasos de aprendizaje × 10 ejecuciones × 500 episodios
   de Mountain Car, y 5 ejecuciones si λ > 0). Los módulos 1, 2, 4 y 6 están
   por debajo de 100 ms y se calculan en el hilo principal.

   Regla del repositorio: todo lo que pase de ~2 s va a un worker con barra de
   progreso.

   Patrón de mensajes: el mismo que `sinmodelo-worker.js` y `calculo-worker.js`.
     entrada:  { tarea, id, config }
     salida:   { tipo: "progreso" | "listo" | "error", id, ... }

   ⚠ LOS DOS MÉTODOS VEN LOS MISMOS EPISODIOS. En la tarea "prediccion" el lote
   se muestrea UNA SOLA VEZ por ejecución y se pasa a MC y a TD, igual que hace
   `curvasPorLotes` en el worker del tema 4: es lo que garantiza el invariante
   A/B (aserción C3-5) y además cuesta la mitad. `curvaVE` del motor hace lo
   mismo por su cuenta y da EXACTAMENTE las mismas cifras, porque el lote se
   genera con el mismo generador y ninguno de los dos métodos consume azar.

   ⚠ CLAVES DE CACHÉ, fijadas por el guion (§C1):
       "prediccion" → (semilla, α, γ, episodios, ejecuciones, grupos)
       "control"    → (semilla, algoritmo, λ, tipo de traza, …)
   La de control incluye λ y el tipo de traza porque el control de traza del
   módulo 5 los cambia sin cambiar el algoritmo (addenda §2, punto 4).
   ========================================================================== */

import { generador } from "./nucleo.js";
import {
  paseoMil, agregacion, mountainCar, tileCoding2D,
  muestrearEpisodio, mcGradiente, tdSemiGradiente, errorVE, pesosOptimos, puntoFijoTD,
  sarsaSemiGradiente, qLearningSemiGradiente,
} from "./aproximacion.js";

/** Caché por tarea y firma de configuración. */
const CACHE = new Map();

/* ----------------------------------------------------------------------- *
 * Tarea "prediccion" — módulo 3
 * ----------------------------------------------------------------------- */

/**
 * Un episodio no truncado, descartando los que alcanzan el tope.
 *
 * Replica la función interna del motor: el consumo del generador es idéntico,
 * así que las curvas coinciden con las de `curvaVE`.
 *
 * @param {object} entorno Entorno discreto.
 * @param {object} rng Generador.
 * @param {number} maxPasos Tope de pasos.
 * @param {object} contador Acumulador de truncados.
 * @returns {object} Episodio de `muestrearEpisodio`.
 * @throws {Error} Si no se consigue un episodio corto en 100 intentos.
 */
function episodioCompleto(entorno, rng, maxPasos, contador) {
  for (let intento = 0; intento < 100; intento++) {
    const episodio = muestrearEpisodio(entorno, rng, { maxPasos });
    if (!episodio.truncado) return episodio;
    contador.truncados += 1;
  }
  throw new Error(`No se ha conseguido un episodio de menos de ${maxPasos} pasos en 100 intentos`);
}

/**
 * Las dos curvas de √VE del módulo 3 y las instantáneas de la ejecución 0.
 *
 * @param {object} config
 * @param {number} config.semilla Semilla base; la ejecución i usa `semilla + i`.
 * @param {number} config.alpha Paso de aprendizaje.
 * @param {number} [config.gamma=1] Descuento.
 * @param {number} [config.episodios=5000] Episodios por ejecución.
 * @param {number} [config.ejecuciones=10] Ejecuciones a promediar.
 * @param {number} [config.grupos=10] Grupos de la agregación.
 * @param {number} [config.maxPasos=10000] Tope de pasos por episodio.
 * @param {Function} config.alProgresar `(fraccion) => void`.
 * @returns {object} Curvas, instantáneas, asíntotas exactas y los contadores
 *   de episodios truncados y ejecuciones cortadas.
 */
export function curvasPrediccion({
  semilla, alpha, gamma = 1, episodios = 5000, ejecuciones = 10, grupos = 10,
  maxPasos = 10000, alProgresar,
}) {
  const entorno = paseoMil({ gamma });
  const repr = agregacion(entorno.nEstados, grupos);
  const verdaderos = entorno.valoresVerdaderos;
  const mu = entorno.mu;

  /* Las dos asíntotas: NO se simulan, se resuelven. No dependen de α ni de la
     semilla (aserción C3-7). */
  const optimo = pesosOptimos(repr, verdaderos, mu);
  const fijo = puntoFijoTD(entorno, repr, gamma);
  const asintotaMC = Math.sqrt(errorVE(repr, optimo.w, verdaderos, mu));
  const asintotaTD = Math.sqrt(errorVE(repr, fijo.w, verdaderos, mu));

  const curvaMC = new Array(episodios + 1).fill(0);
  const curvaTD = new Array(episodios + 1).fill(0);
  let instantaneasMC = null;
  let instantaneasTD = null;
  const contador = { truncados: 0 };
  let cortadas = 0;
  let cortadaEn = null;

  for (let i = 0; i < ejecuciones; i++) {
    const rng = generador(semilla + i);
    const wMC = new Float64Array(repr.d);
    const wTD = new Float64Array(repr.d);
    const errorInicial = Math.sqrt(errorVE(repr, wMC, verdaderos, mu));
    curvaMC[0] += errorInicial / ejecuciones;
    curvaTD[0] += errorInicial / ejecuciones;
    const instMC = [Float64Array.from(wMC)];
    const instTD = [Float64Array.from(wTD)];
    let cortadaMC = false;
    let cortadaTD = false;

    for (let k = 0; k < episodios; k++) {
      /* UN SOLO episodio para los dos métodos. */
      const episodio = episodioCompleto(entorno, rng, maxPasos, contador);
      if (!cortadaMC) {
        const paso = mcGradiente(entorno, repr, [episodio], { alpha, gamma, w0: wMC, instantaneasCada: 0 });
        wMC.set(paso.w);
        if (paso.cortada) {
          cortadaMC = true;
          cortadas += 1;
          if (cortadaEn === null || k < cortadaEn) cortadaEn = k;
        }
      }
      if (!cortadaTD) {
        const paso = tdSemiGradiente(entorno, repr, [episodio], { alpha, gamma, w0: wTD, instantaneasCada: 0 });
        wTD.set(paso.w);
        if (paso.cortada) {
          cortadaTD = true;
          cortadas += 1;
          if (cortadaEn === null || k < cortadaEn) cortadaEn = k;
        }
      }
      curvaMC[k + 1] += Math.sqrt(errorVE(repr, wMC, verdaderos, mu)) / ejecuciones;
      curvaTD[k + 1] += Math.sqrt(errorVE(repr, wTD, verdaderos, mu)) / ejecuciones;
      if (i === 0) {
        instMC.push(Float64Array.from(wMC));
        instTD.push(Float64Array.from(wTD));
      }
    }

    if (i === 0) {
      instantaneasMC = instMC;
      instantaneasTD = instTD;
    }
    alProgresar((i + 1) / ejecuciones);
  }

  return {
    curvaMC,
    curvaTD,
    /* Instantáneas de la ejecución 0, una por episodio: las usa la Viz 2 sin
       reentrenar al mover el deslizador de episodios. */
    instantaneasMC: instantaneasMC.map((w) => Array.from(w)),
    instantaneasTD: instantaneasTD.map((w) => Array.from(w)),
    wOptimo: Array.from(optimo.w),
    wTD: Array.from(fijo.w),
    asintotaMC,
    asintotaTD,
    razonVE: errorVE(repr, fijo.w, verdaderos, mu) / errorVE(repr, optimo.w, verdaderos, mu),
    regularizada: fijo.regularizada,
    ejecuciones,
    episodios,
    truncados: contador.truncados,
    cortadas,
    cortadaEn,
  };
}

/* ----------------------------------------------------------------------- *
 * Tarea "control" — módulo 5
 * ----------------------------------------------------------------------- */

/** Los cinco valores de α×m del deslizador del módulo 5. */
const ALPHAS_M = [0.1, 0.2, 0.5, 1.0, 1.5];

/** Las cuatro instantáneas de la superficie: tres del libro y el cierre. */
const INSTANTANEAS = [
  { clave: "paso428", pasos: 428 },
  { clave: "ep12", episodio: 12 },
  { clave: "ep104", episodio: 104 },
  { clave: "ep500", episodio: 500 },
];

/**
 * Las cinco curvas de pasos por episodio de un algoritmo, más los pesos de las
 * cuatro instantáneas de la ejecución 0 de cada α×m.
 *
 * Las instantáneas viajan para LOS CINCO α×m en el mismo mensaje: cambiar de
 * instantánea o de α×m no reentrena, que es lo que exige la clave de caché
 * (semilla, algoritmo, λ, traza).
 *
 * ⚠ Si una ejecución se corta por |w| > 1e6 —lo que ocurre de verdad con
 * α×m = 1,5— la curva se promedia SOLO sobre las ejecuciones vivas en cada
 * episodio, y `ejecucionesPorEpisodio` dice cuántas son. No se rellena con el
 * último valor ni se descarta la ejecución en silencio.
 *
 * @param {object} config
 * @param {number} config.semilla Semilla base.
 * @param {string} config.algoritmo "sarsa" | "qLearning".
 * @param {number} [config.episodios=500] Episodios por ejecución.
 * @param {number} [config.ejecuciones] Ejecuciones; por omisión 10 con λ = 0 y
 *   5 con λ > 0 (addenda §2, punto 4).
 * @param {number} [config.epsilon=0.1] Exploración.
 * @param {number} [config.gamma=1] Descuento.
 * @param {number} [config.lambda=0] Parámetro de la traza.
 * @param {string} [config.traza="reemplazo"] Tipo de traza.
 * @param {number} [config.maxPasos=5000] Tope de pasos por episodio.
 * @param {Function} config.alProgresar `(fraccion) => void`.
 * @returns {object} Una entrada por α×m, con curva, métricas y pesos.
 * @throws {Error} Si el algoritmo no es "sarsa" ni "qLearning".
 */
export function curvasControl({
  semilla, algoritmo, episodios = 500, ejecuciones = null, epsilon = 0.1, gamma = 1,
  lambda = 0, traza = "reemplazo", maxPasos = 5000, alProgresar,
}) {
  if (algoritmo !== "sarsa" && algoritmo !== "qLearning") {
    throw new Error(`Algoritmo desconocido: ${algoritmo}`);
  }
  /* Presupuesto: 10 ejecuciones con λ = 0 y 5 con λ > 0, y se dice en pantalla.
     Viaja en la respuesta para que la interfaz lo rotule y no lo cablee. */
  const nEjecuciones = ejecuciones !== null ? ejecuciones : (lambda > 0 ? 5 : 10);
  const aprender = algoritmo === "sarsa" ? sarsaSemiGradiente : qLearningSemiGradiente;
  const entorno = mountainCar();
  const resultados = [];
  const totalTrabajos = ALPHAS_M.length * nEjecuciones;
  let hechos = 0;

  for (const alphaM of ALPHAS_M) {
    const repr = tileCoding2D({
      rangos: entorno.rangos, m: 8, desplazamiento: [1, 3], nAcciones: 3, mosaicosPorLado: 8,
    });
    const series = [];
    let topes = 0;
    let cortadas = 0;
    let trazaNoNulaMedia = 0;
    let instantaneas = [];
    let pesosFinales = null;

    for (let i = 0; i < nEjecuciones; i++) {
      const res = aprender(entorno, repr, {
        alpha: alphaM / repr.m,
        epsilon,
        gamma,
        episodios,
        rng: generador(semilla + i),
        maxPasos,
        lambda,
        traza,
        instantaneasEn: i === 0 ? INSTANTANEAS : [],
      });
      series.push(res.pasosPorEpisodio);
      topes += res.topes;
      if (res.cortada) cortadas += 1;
      if (res.trazaNoNulaMedia !== undefined) trazaNoNulaMedia += res.trazaNoNulaMedia / nEjecuciones;
      if (i === 0) {
        instantaneas = res.instantaneas.map((s) => ({ clave: s.clave, w: Array.from(s.w) }));
        pesosFinales = Array.from(res.w);
      }
      hechos += 1;
      alProgresar(hechos / totalTrabajos);
    }

    const largoMaximo = Math.max(...series.map((s) => s.length));
    const largoComun = Math.min(...series.map((s) => s.length));
    const curva = new Array(largoMaximo).fill(0);
    const ejecucionesPorEpisodio = new Array(largoMaximo).fill(0);
    for (const serie of series) {
      for (let k = 0; k < serie.length; k++) {
        curva[k] += serie[k];
        ejecucionesPorEpisodio[k] += 1;
      }
    }
    for (let k = 0; k < largoMaximo; k++) curva[k] /= ejecucionesPorEpisodio[k];

    const mediaDe = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    resultados.push({
      alphaM,
      alpha: alphaM / repr.m,
      curva,
      ejecucionesPorEpisodio,
      episodiosComunes: largoComun,
      primeros50: mediaDe(curva.slice(0, Math.min(50, curva.length))),
      ultimos50: mediaDe(curva.slice(-Math.min(50, curva.length))),
      topes,
      cortadas,
      trazaNoNulaMedia: lambda > 0 ? trazaNoNulaMedia : null,
      instantaneas,
      pesosFinales,
      d: repr.d,
    });
  }

  return {
    algoritmo, alphasM: ALPHAS_M, ejecuciones: nEjecuciones, episodios,
    lambda, traza: lambda > 0 ? traza : null, resultados,
  };
}

/* ----------------------------------------------------------------------- *
 * Mensajería
 * ----------------------------------------------------------------------- */

/** Firma de caché de una configuración: solo lo que cambia el resultado. */
function firma(tarea, config) {
  if (tarea === "prediccion") {
    const { semilla, alpha, gamma = 1, episodios = 5000, ejecuciones = 10, grupos = 10 } = config;
    return `prediccion|${semilla}|${alpha}|${gamma}|${episodios}|${ejecuciones}|${grupos}`;
  }
  const {
    semilla, algoritmo, episodios = 500, ejecuciones = null, epsilon = 0.1, gamma = 1,
    lambda = 0, traza = "reemplazo",
  } = config;
  return `control|${semilla}|${algoritmo}|${lambda}|${lambda > 0 ? traza : "-"}|${episodios}|${ejecuciones}|${epsilon}|${gamma}`;
}

/* El `self.onmessage` se instala SOLO dentro de un worker: así este módulo se
   puede importar desde `node --test` —donde no hay `self`— para probar las dos
   funciones de cálculo, que están exportadas, sin simular la mensajería. */
if (typeof self !== "undefined" && typeof self.postMessage === "function") {
  self.onmessage = (evento) => {
    const { tarea, id, config } = evento.data;
    const alProgresar = (fraccion) => self.postMessage({ tipo: "progreso", id, fraccion });

    try {
      if (tarea !== "prediccion" && tarea !== "control") {
        self.postMessage({ tipo: "error", id, mensaje: `Tarea desconocida: ${tarea}` });
        return;
      }
      const clave = firma(tarea, config);
      if (CACHE.has(clave)) {
        self.postMessage({ tipo: "listo", id, resultado: CACHE.get(clave), deCache: true });
        return;
      }
      const resultado = tarea === "prediccion"
        ? curvasPrediccion({ ...config, alProgresar })
        : curvasControl({ ...config, alProgresar });
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
