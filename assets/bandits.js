/* ==========================================================================
   RL · IMAT — motor de k-armed bandits (Tema 1)
   Sin dependencias. Módulo ES: se usa igual desde el navegador, desde un
   Web Worker y desde node.

   Reproduce el banco de pruebas de 10 brazos de Tema1_Intro#slide-23 y las
   cuatro estrategias de exploración de #slide-24 a #slide-29.
   ========================================================================== */

import { generador, argmax } from "./nucleo.js";

/* ----------------------------------------------------------------------- *
 * 1. El entorno: banco de pruebas de k brazos
 * ----------------------------------------------------------------------- */

/**
 * Banco de pruebas de Tema1_Intro#slide-23:
 *   q_*(a) ~ N(mediaQ, sigmaQ)  ·  R_t ~ N(q_*(a), sigmaR)
 *
 * Con `deriva > 0` el problema se vuelve NO ESTACIONARIO: cada q_*(a) da un
 * paso aleatorio en cada instante. Es el caso que las diapositivas plantean
 * dos veces sin resolver ("¿tiene sensibilidad a cambios posteriores en el
 * entorno?", #slide-25 y #slide-26).
 */
export function crearBandit({
  k = 10,
  rngProblema,
  rngRuido,
  mediaQ = 0,
  sigmaQ = 1,
  sigmaR = 1,
  deriva = 0,
  qEstrella = null,
} = {}) {
  const q = qEstrella
    ? Float64Array.from(qEstrella)
    : Float64Array.from({ length: k }, () => rngProblema.normal(mediaQ, sigmaQ));

  return {
    k: q.length,
    qEstrella: q,
    /** Recompensa de tirar del brazo a. */
    tirar(a) {
      return rngRuido.normal(q[a], sigmaR);
    },
    /** Brazo con mayor valor verdadero en este instante. */
    mejorAccion() {
      let mejor = 0;
      for (let a = 1; a < q.length; a++) if (q[a] > q[mejor]) mejor = a;
      return mejor;
    },
    /** Paso del entorno no estacionario. */
    derivar() {
      if (deriva <= 0) return;
      for (let a = 0; a < q.length; a++) q[a] += rngRuido.normal(0, deriva);
    },
    esNoEstacionario: deriva > 0,
  };
}

/* ----------------------------------------------------------------------- *
 * 2. Los agentes
 * ----------------------------------------------------------------------- */

export const TIPOS = {
  EPSILON: "epsilon-greedy",
  OPTIMISTA: "optimista",
  UCB: "ucb",
  GRADIENTE: "gradiente",
};

/**
 * Agente de bandits con la interfaz mínima { elegir(), actualizar(a, r) }.
 *
 *   alpha = null  →  promedio muestral, Q_{n+1} = Q_n + (1/n)[R_n − Q_n]
 *   alpha = 0.1   →  paso constante, promedio ponderado por recencia (#slide-21)
 */
export function crearAgente({
  tipo = TIPOS.EPSILON,
  k = 10,
  epsilon = 0,
  c = 2,
  alpha = null,
  q0 = 0,
  conBaseline = true,
  rng,
}) {
  const Q = new Float64Array(k).fill(q0);
  const N = new Int32Array(k);
  const H = new Float64Array(k);      // preferencias del gradient bandit
  const pi = new Float64Array(k).fill(1 / k);
  let mediaR = 0;
  let t = 0;

  function softmax() {
    let maximo = -Infinity;
    for (let a = 0; a < k; a++) if (H[a] > maximo) maximo = H[a];
    let suma = 0;
    for (let a = 0; a < k; a++) {
      pi[a] = Math.exp(H[a] - maximo);
      suma += pi[a];
    }
    for (let a = 0; a < k; a++) pi[a] /= suma;
    return pi;
  }

  return {
    tipo, Q, N, H, pi,

    elegir() {
      switch (tipo) {
        case TIPOS.UCB: {
          // los brazos no probados se consideran maximizadores (#slide-26)
          for (let a = 0; a < k; a++) if (N[a] === 0) return a;
          const puntuacion = new Float64Array(k);
          const lnT = Math.log(t + 1);
          for (let a = 0; a < k; a++) puntuacion[a] = Q[a] + c * Math.sqrt(lnT / N[a]);
          return argmax(puntuacion, rng);
        }
        case TIPOS.GRADIENTE: {
          return rng.categorica(Array.from(softmax()));
        }
        default: {
          // epsilon-greedy y optimista (que es epsilon-greedy con epsilon = 0)
          if (epsilon > 0 && rng.uniforme() < epsilon) return rng.entero(k);
          return argmax(Q, rng);
        }
      }
    },

    actualizar(a, r) {
      t++;
      N[a]++;
      if (tipo === TIPOS.GRADIENTE) {
        const base = conBaseline ? mediaR : 0;
        const p = softmax();
        const ventaja = r - base;
        for (let b = 0; b < k; b++) {
          H[b] += b === a
            ? alpha * ventaja * (1 - p[b])
            : -alpha * ventaja * p[b];
        }
        mediaR += (r - mediaR) / t;
      } else {
        const paso = alpha === null ? 1 / N[a] : alpha;
        Q[a] += paso * (r - Q[a]);
        mediaR += (r - mediaR) / t;
      }
    },

    get recompensaMedia() {
      return mediaR;
    },
  };
}

/* ----------------------------------------------------------------------- *
 * 3. Ejecución promediada sobre varios problemas
 * ----------------------------------------------------------------------- */

/** Mezcla dos enteros en una semilla estable (para que todo sea reproducible). */
function semillaDe(base, indice) {
  let x = (base ^ (indice * 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0 || 1;
}

/**
 * Ejecuta varias configuraciones sobre EXACTAMENTE los mismos problemas, que
 * es lo que hace justa la comparación de #slide-24 a #slide-29.
 *
 * configuraciones: [{ id, tipo, epsilon, c, alpha, q0, conBaseline }]
 * Devuelve, por configuración, la recompensa media y el % de acción óptima
 * en cada paso, promediados sobre `ejecuciones` problemas distintos.
 */
export function ejecutar({
  configuraciones,
  pasos = 1000,
  ejecuciones = 200,
  semilla = 1,
  k = 10,
  mediaQ = 0,
  deriva = 0,
  alProgresar = null,
}) {
  const resultados = configuraciones.map((cfg) => ({
    id: cfg.id,
    recompensa: new Float64Array(pasos),
    optimo: new Float64Array(pasos),
    recompensaTotal: 0,
  }));

  for (let ejecucion = 0; ejecucion < ejecuciones; ejecucion++) {
    const semillaProblema = semillaDe(semilla, ejecucion);

    configuraciones.forEach((cfg, indice) => {
      // mismo problema para todas las configuraciones: mismos q_*(a)
      const bandit = crearBandit({
        k,
        rngProblema: generador(semillaProblema),
        rngRuido: generador(semillaDe(semillaProblema, 7777)),
        mediaQ,
        deriva,
      });
      const agente = crearAgente({
        ...cfg,
        k,
        rng: generador(semillaDe(semillaProblema, 31 + indice)),
      });

      const salida = resultados[indice];
      for (let paso = 0; paso < pasos; paso++) {
        const optima = bandit.mejorAccion();
        const a = agente.elegir();
        const r = bandit.tirar(a);
        agente.actualizar(a, r);
        salida.recompensa[paso] += r;
        if (a === optima) salida.optimo[paso] += 1;
        salida.recompensaTotal += r;
        bandit.derivar();
      }
    });

    if (alProgresar && ejecucion % 10 === 0) {
      alProgresar((ejecucion + 1) / ejecuciones);
    }
  }

  for (const salida of resultados) {
    for (let paso = 0; paso < pasos; paso++) {
      salida.recompensa[paso] /= ejecuciones;
      salida.optimo[paso] /= ejecuciones;
    }
    salida.recompensaTotal /= ejecuciones * pasos;
  }
  return resultados;
}

/* ----------------------------------------------------------------------- *
 * 4. Estudio de parámetros — Tema1_Intro#slide-29 (figura 2.6 del libro)
 * ----------------------------------------------------------------------- */

/** Potencias de dos entre dos exponentes, ambos incluidos. */
export function potencias(desde, hasta) {
  const salida = [];
  for (let e = desde; e <= hasta; e++) salida.push(2 ** e);
  return salida;
}

/** Las cuatro curvas del estudio de parámetros, con los rangos del libro. */
export const CURVAS_BARRIDO = [
  {
    id: "epsilon-greedy",
    nombre: "ε-greedy",
    parametro: "ε",
    valores: potencias(-7, -2),
    config: (valor) => ({ tipo: TIPOS.EPSILON, epsilon: valor, alpha: null, q0: 0 }),
  },
  {
    id: "gradiente",
    nombre: "gradient bandit",
    parametro: "α",
    valores: potencias(-5, 2),
    config: (valor) => ({ tipo: TIPOS.GRADIENTE, alpha: valor, conBaseline: true }),
  },
  {
    id: "ucb",
    nombre: "UCB",
    parametro: "c",
    valores: potencias(-4, 2),
    config: (valor) => ({ tipo: TIPOS.UCB, c: valor, alpha: null, q0: 0 }),
  },
  {
    id: "optimista",
    nombre: "greedy con inicialización optimista",
    parametro: "Q₀",
    valores: potencias(-2, 2),
    config: (valor) => ({ tipo: TIPOS.OPTIMISTA, epsilon: 0, alpha: 0.1, q0: valor }),
  },
];

/**
 * Recompensa media en los primeros `pasos` pasos para cada valor de cada
 * parámetro. Es caro: conviene lanzarlo en un Web Worker.
 */
export function barridoParametros({
  pasos = 1000,
  ejecuciones = 100,
  semilla = 1,
  k = 10,
  deriva = 0,
  alProgresar = null,
}) {
  const total = CURVAS_BARRIDO.reduce((n, curva) => n + curva.valores.length, 0);
  let hechos = 0;

  return CURVAS_BARRIDO.map((curva) => {
    const medias = curva.valores.map((valor) => {
      const [resultado] = ejecutar({
        configuraciones: [{ id: `${curva.id}-${valor}`, ...curva.config(valor) }],
        pasos, ejecuciones, semilla, k, deriva,
      });
      hechos++;
      if (alProgresar) alProgresar(hechos / total);
      return resultado.recompensaTotal;
    });
    return { id: curva.id, nombre: curva.nombre, parametro: curva.parametro, valores: curva.valores, medias };
  });
}

/* ----------------------------------------------------------------------- *
 * 5. Bandit interactivo de pocos brazos (el ejemplo del jamón, #slide-17)
 * ----------------------------------------------------------------------- */

/**
 * Estado de un bandit que el alumno maneja a mano, tirada a tirada.
 * Lleva la cuenta del regret: "la máxima recompensa que puedo obtener vs. lo
 * que obtengo" (#slide-19).
 */
export function crearBanditManual({ qEstrella, sigmaR = 0.25, semilla = 1 }) {
  const rng = generador(semilla);
  const k = qEstrella.length;
  const bandit = crearBandit({ k, rngRuido: rng, sigmaR, qEstrella });
  const Q = new Float64Array(k);
  const N = new Int32Array(k);
  const historial = [];
  let recompensaTotal = 0;

  const optimo = bandit.mejorAccion();

  return {
    k,
    qEstrella: bandit.qEstrella,
    Q, N, historial,
    accionOptima: optimo,

    tirar(a) {
      const r = bandit.tirar(a);
      N[a]++;
      Q[a] += (r - Q[a]) / N[a];
      recompensaTotal += r;
      historial.push({ t: historial.length + 1, a, r, Q: Q[a], N: N[a] });
      return r;
    },

    /** Acción que elegiría una política greedy con las estimaciones actuales. */
    accionGreedy() {
      // sin datos, greedy se queda con el primer brazo: ese es justo el problema
      return argmax(Array.from(Q), null);
    },

    get tiradas() {
      return historial.length;
    },
    get recompensaMedia() {
      return historial.length ? recompensaTotal / historial.length : 0;
    },
    /** Regret acumulado respecto de haber tirado siempre del mejor brazo. */
    get regret() {
      return historial.reduce(
        (suma, paso) => suma + (bandit.qEstrella[optimo] - bandit.qEstrella[paso.a]),
        0,
      );
    },
  };
}
