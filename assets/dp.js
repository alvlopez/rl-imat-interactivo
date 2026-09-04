/* ==========================================================================
   RL · IMAT — motor de programación dinámica (Tema 3)
   Sin dependencias. Módulo ES: se usa igual desde el navegador y desde node.
   NO TOCA EL DOM: es matemática pura y testeable con `node --test`.

   Construido sobre `mdp.js`, que ya resuelve el MDP genérico. Aquí vive lo
   que el Tema 3 necesita y el Tema 2 no: historiales barrido a barrido,
   desempates del argmax controlados, la corrección del ejercicio 4.4 y los
   residuos del diagrama de GPI.

   Entorno único: gridworld 4×4 del Example 4.1 (Sutton & Barto §4.1).
   Diapositivas: 3_Tema3#slide-3 a #slide-13 · Tema3_DP#slide-4 a #slide-16.

   Convenio de toda la página, decidido en el guion §0.2: los barridos son
   SÍNCRONOS (dos arrays) por omisión, porque es lo único que reproduce la
   figura 4.1 del libro; el pseudocódigo que se proyecta en clase es in situ
   y se ofrece como conmutador en el módulo 1.
   ========================================================================== */

import {
  crearMDP,
  politicaEquiprobable,
  politicaDeterminista,
  qDeV,
  politicaGreedy,
  iteracionValor,
} from "./mdp.js";
import { generador } from "./nucleo.js";

/* ----------------------------------------------------------------------- *
 * 1. El entorno: gridworld 4×4 del Example 4.1
 * ----------------------------------------------------------------------- */

/* Mismos identificadores que ACCIONES_NAV de mdp.js: rejilla() de nucleo.js
   espera exactamente estas cuatro claves para pintar flechas y cuñas. */
export const ACCIONES_GW = ["N", "S", "O", "E"];

const DELTA_GW = { N: [-1, 0], S: [1, 0], O: [0, -1], E: [0, 1] };

const LADO_GW = 4;
const TERMINALES_GW = [0, 15];

/**
 * Gridworld 4×4 del Example 4.1: r = −1 en toda transición, dinámica
 * determinista, rebote contra el borde, γ = 1 (tarea episódica).
 *
 * Los dos terminales del libro (esquinas 0 y 15) son formalmente UN SOLO
 * estado. Aquí son dos estados absorbentes de valor 0, que es equivalente a
 * todos los efectos: ningún estado no terminal distingue a cuál de los dos
 * llega, porque los dos valen 0 y ninguno tiene transiciones de salida.
 * La página lo dice en pantalla (`t3.entorno.terminal`).
 *
 * @returns {object} MDP de `crearMDP` con 16 estados y geometría 4×4.
 */
export function gridworld4x4() {
  const nEstados = LADO_GW * LADO_GW;
  const fila = (s) => Math.floor(s / LADO_GW);
  const col = (s) => s % LADO_GW;

  /* La etiqueta que ve el alumno coincide con la numeración del libro:
     el índice interno k se muestra como k, y 0 y 15 se muestran como T. */
  const etiquetas = [];
  for (let s = 0; s < nEstados; s++) {
    etiquetas.push(TERMINALES_GW.includes(s) ? "T" : String(s));
  }

  const P = [];
  for (let s = 0; s < nEstados; s++) {
    P[s] = [];
    for (let a = 0; a < ACCIONES_GW.length; a++) {
      if (TERMINALES_GW.includes(s)) {
        P[s][a] = []; // absorbente: sin transiciones de salida
        continue;
      }
      const [df, dc] = DELTA_GW[ACCIONES_GW[a]];
      const f = fila(s) + df;
      const c = col(s) + dc;
      const dentro = f >= 0 && f < LADO_GW && c >= 0 && c < LADO_GW;
      const s2 = dentro ? f * LADO_GW + c : s; // rebote: p(7,−1|7,E) = 1
      P[s][a] = [{ s2, r: -1, p: 1 }];
    }
  }

  return crearMDP({
    nombre: "Gridworld 4×4 (Example 4.1)",
    nEstados,
    acciones: ACCIONES_GW,
    etiquetas,
    terminales: TERMINALES_GW,
    P,
    geometria: {
      filas: LADO_GW,
      columnas: LADO_GW,
      posicion: (s) => ({ fila: fila(s), col: col(s) }),
      terminales: TERMINALES_GW.slice(),
    },
  });
}

/** Índices de los estados no terminales, en orden creciente (fila-mayor). */
export function estadosNoTerminales(mdp) {
  const estados = [];
  for (let s = 0; s < mdp.nEstados; s++) if (!mdp.esTerminal(s)) estados.push(s);
  return estados;
}

/**
 * Política L del módulo 2: bajar mientras no se esté en la última fila; en la
 * última fila, ir a la derecha. Alcanza el terminal desde los catorce estados,
 * así que su evaluación es finita con γ = 1.
 *
 * @param {object} mdp - Gridworld 4×4.
 * @returns {number[][]} π(a|s), una fila por estado (los terminales llevan
 *   fila equiprobable, que nunca se usa porque no se recorren).
 */
export function politicaL(mdp) {
  const iS = ACCIONES_GW.indexOf("S");
  const iE = ACCIONES_GW.indexOf("E");
  return politicaDeterminista(mdp, (s) => {
    if (mdp.esTerminal(s)) return null;
    return Math.floor(s / LADO_GW) < LADO_GW - 1 ? iS : iE;
  });
}

/* ----------------------------------------------------------------------- *
 * 2. Un barrido de evaluación
 * ----------------------------------------------------------------------- */

/** Σ_{s',r} p(s',r|s,a) [ r + γ V(s') ] — el interior de todas las cajas. */
function valorEsperado(mdp, s, a, v, gamma) {
  return mdp.P[s][a].reduce((suma, t) => suma + t.p * (t.r + gamma * v[t.s2]), 0);
}

/** Σ_a π(a|s) q_V(s,a). Con π determinista es el q de la única acción. */
function valorSegunPolitica(mdp, s, pi, v, gamma) {
  let acumulado = 0;
  for (let a = 0; a < mdp.nAcciones; a++) {
    const prob = pi[s][a];
    if (prob <= 0) continue;
    acumulado += prob * valorEsperado(mdp, s, a, v, gamma);
  }
  return acumulado;
}

/**
 * Un barrido de evaluación sobre los estados no terminales.
 *
 * @param {"sincrono"|"insitu"} modo - "sincrono" escribe en una tabla nueva
 *   (dos arrays, la versión de la figura 4.1); "insitu" escribe sobre la
 *   misma tabla en orden fila-mayor creciente, de modo que las
 *   actualizaciones ya hechas se usan en las siguientes (la caja del libro).
 * @returns {{v: number[], delta: number}} Tabla resultante y Δ del barrido.
 */
function barrido(mdp, pi, v, gamma, modo) {
  const nueva = v.slice(); // los terminales conservan su 0
  const lectura = modo === "insitu" ? nueva : v;
  let delta = 0;
  for (const s of estadosNoTerminales(mdp)) {
    const antiguo = nueva[s];
    nueva[s] = valorSegunPolitica(mdp, s, pi, lectura, gamma);
    delta = Math.max(delta, Math.abs(antiguo - nueva[s]));
  }
  return { v: nueva, delta };
}

/**
 * Evaluación iterativa de la política (Sutton & Barto §4.1, ec. 4.5).
 *
 * No reutiliza `evaluarIterativa` de `mdp.js` porque aquélla siempre arranca
 * en V ≡ 0, no admite actualización in situ y no devuelve la sucesión de Δ,
 * que aquí son las tres cosas que se enseñan.
 *
 * Parada: se itera mientras Δ > θ. El pseudocódigo escribe «hasta que Δ < θ»;
 * con la comparación estricta, θ = 1 no pararía nunca en esta rejilla (los
 * primeros barridos tienen Δ exactamente 1) y el guion exige 1 barrido para
 * θ = 1 (M1-A6). Es la misma convención que `evaluarIterativa` de `mdp.js`.
 *
 * @param {object} mdp - MDP finito.
 * @param {number[][]} pi - π(a|s).
 * @param {number} gamma - Descuento (1 en todo el Tema 3).
 * @param {object} [opciones]
 * @param {number} [opciones.theta=1e-4] - Umbral de parada.
 * @param {"sincrono"|"insitu"} [opciones.modo="sincrono"] - Tipo de barrido.
 * @param {number} [opciones.maxBarridos=5000] - Tope de seguridad.
 * @param {number[]} [opciones.v0=null] - Tabla inicial; por omisión V ≡ 0.
 *   La iteración de política la usa para arrancar cada evaluación con los
 *   valores de la política anterior, como manda el diagrama de flujo.
 * @returns {{v: number[], historial: number[][], deltas: number[],
 *            barridos: number, convergido: boolean}}
 * @throws {Error} Si el modo no es "sincrono" ni "insitu".
 */
export function evaluar(mdp, pi, gamma, opciones = {}) {
  const { theta = 1e-4, modo = "sincrono", maxBarridos = 5000, v0 = null } = opciones;
  if (modo !== "sincrono" && modo !== "insitu") {
    throw new Error(`Modo de actualización desconocido: ${modo}`);
  }

  let v = v0 ? v0.slice() : new Array(mdp.nEstados).fill(0);
  for (let s = 0; s < mdp.nEstados; s++) if (mdp.esTerminal(s)) v[s] = 0; // V(terminal) = 0
  const historial = [v.slice()];
  const deltas = [];
  let delta = Infinity;
  let barridos = 0;

  while (delta > theta && barridos < maxBarridos) {
    const paso = barrido(mdp, pi, v, gamma, modo);
    v = paso.v;
    delta = paso.delta;
    deltas.push(delta);
    historial.push(v.slice());
    barridos++;
  }

  return { v, historial, deltas, barridos, convergido: delta <= theta };
}

/* ----------------------------------------------------------------------- *
 * 3. Mejora: el operador greedy y sus empates
 * ----------------------------------------------------------------------- */

/**
 * Acciones maximizadoras de q_V(s,·) en cada estado, TODAS ellas.
 *
 * La tolerancia protege de que el orden de sumación rompa la simetría exacta
 * de la rejilla: dos acciones que valen lo mismo tienen que salir empatadas.
 *
 * @returns {number[][]} Un array de índices de acción por estado; [] en los
 *   terminales.
 */
export function empatesGreedy(mdp, v, gamma, tol = 1e-9) {
  return politicaGreedy(mdp, qDeV(mdp, v, gamma), tol);
}

/**
 * Conjuntos A_*(s) de acciones óptimas, calculados con v_*. Es el "ground
 * truth" contra el que se decide si una política greedy es óptima.
 */
export function accionesOptimas(mdp, gamma, tol = 1e-9) {
  const { v } = iteracionValor(mdp, gamma, { tolerancia: 1e-12 });
  return empatesGreedy(mdp, v, gamma, tol);
}

/**
 * ¿Es óptima una política greedy dada por sus conjuntos de empates?
 *
 * CONTENCIÓN, no igualdad: basta con que toda acción que la política pueda
 * elegir sea óptima. Exigir Π_k(s) = A_*(s) daría «óptima a partir de k = ∞»,
 * que es falso: en k = 3 los estados 6 y 9 tienen Π_3 ⊊ A_* y la política ya
 * es óptima (guion, módulo 4 §6).
 */
export function esOptima(empates, optimas) {
  return empates.every((acciones, s) => acciones.every((a) => optimas[s].includes(a)));
}

/**
 * Elige una acción por estado entre las maximizadoras.
 *
 * @param {number[][]} empates - Salida de `empatesGreedy`.
 * @param {object} [opciones]
 * @param {"primero"|"aleatorio"} [opciones.modo="primero"] - "primero" toma el
 *   índice menor (orden N, S, O, E) y por tanto es reproducible y estable;
 *   "aleatorio" muestrea uniformemente, que es el desempate «arbitrario» que
 *   autoriza el libro y el que rompe la última línea del pseudocódigo.
 * @param {object} [opciones.rng] - Generador de `nucleo.js` (obligatorio en
 *   modo aleatorio; si falta se siembra con 2026, la semilla de la página).
 * @returns {(number|null)[]} Una acción por estado no terminal; null en los
 *   terminales.
 * @throws {Error} Si el modo no se reconoce.
 */
export function desempatar(empates, opciones = {}) {
  const { modo = "primero", rng = null } = opciones;
  if (modo !== "primero" && modo !== "aleatorio") {
    throw new Error(`Modo de desempate desconocido: ${modo}`);
  }
  const azar = modo === "aleatorio" ? rng ?? generador(2026) : null;
  return empates.map((acciones) => {
    if (!acciones.length) return null;
    return modo === "primero" ? acciones[0] : acciones[azar.entero(acciones.length)];
  });
}

/** Matriz π(a|s) uniforme sobre los maximizadores de cada estado. */
function politicaUniformeSobre(mdp, empates) {
  const pi = [];
  for (let s = 0; s < mdp.nEstados; s++) {
    pi[s] = new Array(mdp.nAcciones).fill(0);
    const acciones = empates[s];
    if (!acciones || !acciones.length) {
      pi[s].fill(1 / mdp.nAcciones); // terminal: da igual, no se recorre
      continue;
    }
    for (const a of acciones) pi[s][a] = 1 / acciones.length;
  }
  return pi;
}

/** ¿Son iguales dos listas de conjuntos de acciones? (comparación de sets) */
function mismosConjuntos(a, b) {
  if (!a || !b) return false;
  return a.every((acciones, s) =>
    acciones.length === b[s].length && acciones.every((x, i) => x === b[s][i]));
}

/* ----------------------------------------------------------------------- *
 * 4. Iteración de política — y la última línea que no siempre para
 * ----------------------------------------------------------------------- */

/**
 * Iteración de política, exactamente la caja de Sutton & Barto §4.3.
 *
 * π_0 es la equiprobable y no una determinista arbitraria: con γ = 1 casi
 * cualquier política determinista de esta rejilla deja de alcanzar el
 * terminal desde algún estado y su evaluación diverge («todas al norte» se
 * queda atrapada en el estado 3). El libro hace lo mismo en la figura 4.1.
 *
 * Cada evaluación arranca con la función de valor de la política anterior:
 * el bucle del diagrama de flujo reengancha en «predicción», no en
 * «definir la primera política» (guion §B3).
 *
 * @param {object} mdp - Gridworld.
 * @param {number} gamma - Descuento.
 * @param {object} [opciones]
 * @param {number} [opciones.theta=1e-4] - Umbral de la fase E.
 * @param {"primero"|"aleatorio"} [opciones.desempate="primero"]
 * @param {boolean} [opciones.correccion44=false] - Corrección del ejercicio
 *   4.4: conservar π(s) si la acción antigua sigue siendo maximizadora, y
 *   marcar política-estable ← falso solo cuando deja de serlo.
 * @param {object} [opciones.rng=null] - Generador sembrado.
 * @param {number} [opciones.maxRondas=5000] - Tope: con desempate aleatorio y
 *   sin corrección el algoritmo puede no parar nunca, y eso es contenido, no
 *   un error. `parado` dice si se ha alcanzado el tope.
 * @returns {{rondas: number, barridos: number, parado: boolean,
 *            historial: object[]}} Cada entrada del historial es
 *   { fase: "E"|"I", v, pi, empates, delta, estable, barridosFase }. En las
 *   fases E de la ronda 1, `pi` es null porque π_0 es la equiprobable.
 */
export function iteracionPolitica(mdp, gamma, opciones = {}) {
  const {
    theta = 1e-4, desempate = "primero", correccion44 = false,
    rng = null, maxRondas = 5000,
  } = opciones;
  const azar = desempate === "aleatorio" ? rng ?? generador(2026) : null;

  let v = new Array(mdp.nEstados).fill(0);
  let piMatriz = politicaEquiprobable(mdp);
  let acciones = null; // π_0 es estocástica: no hay «acción antigua» todavía
  const historial = [];
  let barridos = 0;
  let rondas = 0;
  let parado = false;

  while (rondas < maxRondas) {
    /* --- fase E: evaluar hasta Δ < θ, continuando desde la V anterior --- */
    const evaluacion = evaluar(mdp, piMatriz, gamma, { theta, v0: v });
    v = evaluacion.v;
    barridos += evaluacion.barridos;
    historial.push({
      fase: "E",
      v: v.slice(),
      pi: acciones ? acciones.slice() : null,
      empates: null,
      delta: evaluacion.deltas[evaluacion.deltas.length - 1] ?? 0,
      estable: null,
      barridosFase: evaluacion.barridos,
    });

    /* --- fase I: mejorar, con el desempate elegido --- */
    const empates = empatesGreedy(mdp, v, gamma);
    const elegidas = desempatar(empates, { modo: desempate, rng: azar });
    let estable = true;
    for (const s of estadosNoTerminales(mdp)) {
      const antigua = acciones ? acciones[s] : null;
      if (correccion44 && antigua !== null && empates[s].includes(antigua)) {
        elegidas[s] = antigua; // sigue siendo maximizadora: se conserva
      } else if (antigua === null || antigua !== elegidas[s]) {
        estable = false;
      }
    }
    acciones = elegidas;
    piMatriz = politicaDeterminista(mdp, (s) => acciones[s]);
    rondas++;
    historial.push({
      fase: "I",
      v: v.slice(),
      pi: acciones.slice(),
      empates: empates.map((lista) => lista.slice()),
      delta: null,
      estable,
      barridosFase: 0,
    });

    if (estable) {
      parado = true;
      break;
    }
  }

  return { rondas, barridos, parado, historial };
}

/**
 * Cuántas rondas tarda en parar la iteración de política con desempate
 * aleatorio y sin corrección, repetida muchas veces.
 *
 * En este tablero hay 256 políticas óptimas deterministas, así que la
 * probabilidad de que una ronda devuelva exactamente las acciones ya
 * almacenadas es 1/256 y la media teórica son 2 + 256 = 258 rondas.
 * Un solo generador sembrado recorre las repeticiones, de modo que toda la
 * curva se reproduce con la semilla.
 *
 * @returns {{rondas: number[], acumulada: number[], media: number,
 *            mediana: number}} `acumulada[n−1]` es la fracción de
 *   repeticiones que ya habían parado en la ronda n.
 */
export function distribucionRondas(mdp, gamma, opciones = {}) {
  const { repeticiones = 200, semilla = 2026, theta = 1e-4 } = opciones;
  const rng = generador(semilla);
  const rondas = [];
  for (let i = 0; i < repeticiones; i++) {
    const corrida = iteracionPolitica(mdp, gamma, {
      theta, desempate: "aleatorio", correccion44: false, rng,
    });
    rondas.push(corrida.rondas);
  }

  const maximo = Math.max(...rondas);
  const acumulada = new Array(maximo).fill(0);
  for (const n of rondas) for (let k = n - 1; k < maximo; k++) acumulada[k]++;
  const ordenadas = rondas.slice().sort((a, b) => a - b);
  const mitad = Math.floor(ordenadas.length / 2);

  return {
    rondas,
    acumulada: acumulada.map((c) => c / repeticiones),
    media: rondas.reduce((a, b) => a + b, 0) / repeticiones,
    mediana: ordenadas.length % 2
      ? ordenadas[mitad]
      : (ordenadas[mitad - 1] + ordenadas[mitad]) / 2,
  };
}

/* ----------------------------------------------------------------------- *
 * 5. Iteración de valor y el continuo entre los dos extremos
 * ----------------------------------------------------------------------- */

/**
 * Iteración de política truncada a m barridos de evaluación entre mejoras.
 * Con m = 1 es la iteración de valor; con m = ∞, la iteración de política.
 *
 * La política greedy reparte la probabilidad UNIFORMEMENTE entre todas las
 * acciones maximizadoras, que es lo que el libro autoriza en §4.2. Dos
 * motivos, y ninguno es cosmético:
 *   · Un barrido de evaluación de esa π ES un barrido de la ecuación (4.10):
 *     Σ_a π(a|s) q(s,a) = (1/|M|) Σ_{a∈M} q(s,a) = max_a q(s,a), porque todos
 *     los sumandos valen lo mismo. La unificación no es una aproximación.
 *   · Con γ = 1 y desempate determinista, la greedy de V ≡ 0 sería «todas al
 *     norte», que se queda atrapada en el estado 3 y no se puede evaluar.
 *
 * La parada se comprueba tras la mejora: si π no ha cambiado y la última
 * evaluación ya cumplía Δ < θ, no hace falta otro barrido.
 *
 * @returns {{v: number[], pi: number[][], barridos: number, rondas: number,
 *            historial: object[]}} `pi` son los conjuntos de maximizadores
 *   (la política uniforme sobre ellos); el historial lleva una entrada por
 *   fase I y una por cada barrido de la fase E.
 */
export function iteracionPoliticaTruncada(mdp, gamma, opciones = {}) {
  const { m = 1, theta = 1e-4, maxBarridos = 5000 } = opciones;
  if (!(m >= 1)) throw new Error(`m debe ser ≥ 1 (o Infinity); recibido: ${m}`);

  let v = new Array(mdp.nEstados).fill(0);
  let empates = null;
  const historial = [];
  let barridos = 0;
  let rondas = 0;
  let ultimoDelta = Infinity;

  while (barridos < maxBarridos) {
    /* --- fase I --- */
    const nuevos = empatesGreedy(mdp, v, gamma);
    const cambio = !mismosConjuntos(empates, nuevos);
    empates = nuevos;
    rondas++;
    historial.push({
      fase: "I",
      v: v.slice(),
      pi: empates.map((lista) => lista.slice()),
      delta: null,
    });
    if (!cambio && ultimoDelta <= theta) break;

    /* --- fase E: m barridos, o menos si Δ < θ antes --- */
    const piMatriz = politicaUniformeSobre(mdp, empates);
    for (let k = 0; k < m && barridos < maxBarridos; k++) {
      const paso = barrido(mdp, piMatriz, v, gamma, "sincrono");
      v = paso.v;
      ultimoDelta = paso.delta;
      barridos++;
      historial.push({
        fase: "E",
        v: v.slice(),
        pi: empates.map((lista) => lista.slice()),
        delta: ultimoDelta,
      });
      if (ultimoDelta <= theta) break;
    }
  }

  return { v, pi: empates, barridos, rondas, historial };
}

/**
 * Coste en barridos de cada valor de m, incluido el extremo m = ∞.
 *
 * @returns {object[]} [{ m, barridos, rondas }], con la entrada de Infinity
 *   al final (178 barridos en este tablero, la misma cifra que la iteración
 *   de política con desempate determinista).
 */
export function costePorM(mdp, gamma, opciones = {}) {
  const { valoresM = [1, 2, 3, 5, 10, 20], theta = 1e-4 } = opciones;
  const filas = valoresM.map((m) => {
    const { barridos, rondas } = iteracionPoliticaTruncada(mdp, gamma, { m, theta });
    return { m, barridos, rondas };
  });
  const limite = iteracionPoliticaTruncada(mdp, gamma, { m: Infinity, theta });
  filas.push({ m: Infinity, barridos: limite.barridos, rondas: limite.rondas });
  return filas;
}

/* ----------------------------------------------------------------------- *
 * 6. GPI: los dos residuos y las tres trayectorias
 * ----------------------------------------------------------------------- */

/**
 * Los dos residuos que sitúan un par (V, π) en el diagrama de las dos rectas.
 *
 *   e = (1/|S|) Σ_s | Σ_a π(a|s) q_V(s,a) − V(s) |   → 0 sii V = v_π
 *   g = (1/|S|) Σ_s [ max_a q_V(s,a) − Σ_a π(a|s) q_V(s,a) ]  → 0 sii π greedy
 *
 * Son notación propia del recurso, no del libro, y se declara en pantalla.
 * Se usa la MEDIA y no el máximo porque el máximo se queda enganchado en el
 * peor estado y la trayectoria no se ve avanzar; las dos elecciones se anulan
 * exactamente sobre su recta, que es lo único que la construcción necesita.
 *
 * Se calculan con residuos de Bellman y no con distancias a v_π: así nunca
 * hay que resolver un sistema y no aparecen −∞ ni matrices singulares aunque
 * π no alcance el terminal.
 */
export function residuosGPI(mdp, v, pi, gamma) {
  const estados = estadosNoTerminales(mdp);
  let e = 0;
  let g = 0;
  for (const s of estados) {
    let mejor = -Infinity;
    let segunPi = 0;
    for (let a = 0; a < mdp.nAcciones; a++) {
      const q = valorEsperado(mdp, s, a, v, gamma);
      if (q > mejor) mejor = q;
      if (pi[s][a] > 0) segunPi += pi[s][a] * q;
    }
    e += Math.abs(segunPi - v[s]);
    g += mejor - segunPi;
  }
  return { e: e / estados.length, g: g / estados.length };
}

const CERO_GPI = 1e-12;

/**
 * Recorrido de un algoritmo sobre el plano (e, g) del diagrama de GPI.
 *
 * Las tres arrancan en el mismo sitio: V ≡ 0 y la política L del módulo 2.
 * Con V ≡ 0 todas las acciones empatan, así que cualquier política es greedy
 * y el recorrido empieza sobre la recta de abajo (g = 0).
 *
 * @param {object} [opciones]
 * @param {"politica"|"valor"|"caotica"} opciones.tipo
 *   · "politica": un punto por objetivo completado (evaluación entera, mejora
 *     entera). Es la única trayectoria que el libro dibuja.
 *   · "valor": un punto por fase con m = 1 (mejora, un barrido, mejora…).
 *   · "caotica": DP asíncrona (§4.5), un punto cada 4 actualizaciones de un
 *     solo estado elegido al azar.
 * @param {object} [opciones.rng=null] - Generador sembrado (solo "caotica").
 * @param {number} [opciones.maxPasos=2000] - Tope de actualizaciones.
 * @returns {object[]} [{ etiqueta: "inicio"|"E"|"I"|"A", e, g }]
 * @throws {Error} Si el tipo no se reconoce.
 */
export function trayectoriaGPI(mdp, gamma, opciones = {}) {
  const { tipo, rng = null, maxPasos = 2000 } = opciones;
  if (!["politica", "valor", "caotica"].includes(tipo)) {
    throw new Error(`Tipo de trayectoria desconocido: ${tipo}`);
  }

  let v = new Array(mdp.nEstados).fill(0);
  let pi = politicaL(mdp);
  const puntos = [];
  const anotar = (etiqueta) => {
    const { e, g } = residuosGPI(mdp, v, pi, gamma);
    puntos.push({ etiqueta, e, g });
    return e <= CERO_GPI && g <= CERO_GPI;
  };

  anotar("inicio");

  if (tipo === "politica") {
    /* Evaluar hasta que un barrido no cambie nada (θ = 0: aquí las políticas
       que aparecen son acíclicas y la evaluación converge en pocos barridos
       de forma exacta), y después mejorar del todo. */
    for (let ronda = 0; ronda < maxPasos; ronda++) {
      const evaluacion = evaluar(mdp, pi, gamma, { theta: 0, v0: v, maxBarridos: 5000 });
      v = evaluacion.v;
      if (anotar("E")) break;
      pi = politicaUniformeSobre(mdp, empatesGreedy(mdp, v, gamma));
      if (anotar("I")) break;
    }
    return puntos;
  }

  if (tipo === "valor") {
    for (let paso = 0; paso < maxPasos; paso++) {
      pi = politicaUniformeSobre(mdp, empatesGreedy(mdp, v, gamma));
      if (anotar("I")) break;
      const barridoUnico = barrido(mdp, pi, v, gamma, "sincrono");
      v = barridoUnico.v;
      if (anotar("E")) break;
    }
    return puntos;
  }

  /* --- caótica: DP asíncrona, un estado al azar por actualización --- */
  const azar = rng ?? generador(2026);
  const estados = estadosNoTerminales(mdp);
  for (let paso = 1; paso <= maxPasos; paso++) {
    const s = estados[azar.entero(estados.length)];
    if (azar.uniforme() < 0.5) {
      v = v.slice();
      v[s] = valorSegunPolitica(mdp, s, pi, v, gamma); // evaluar un solo estado
    } else {
      const maximizadoras = empatesGreedy(mdp, v, gamma)[s];
      pi = pi.map((fila) => fila.slice());
      pi[s] = new Array(mdp.nAcciones).fill(0);
      for (const a of maximizadoras) pi[s][a] = 1 / maximizadoras.length;
    }
    const { e, g } = residuosGPI(mdp, v, pi, gamma);
    const convergido = e <= CERO_GPI && g <= CERO_GPI;
    if (paso % 4 === 0 || convergido) puntos.push({ etiqueta: "A", e, g });
    if (convergido) break;
  }
  return puntos;
}

/* ----------------------------------------------------------------------- *
 * 7. Utilidades
 * ----------------------------------------------------------------------- */

/**
 * d(s) = número mínimo de pasos hasta un terminal, por anchura sobre el grafo
 * de transiciones. Con este entorno coincide con la distancia de Manhattan al
 * terminal más próximo, y −d(s) es v_*.
 *
 * @returns {number[]} d(s) por estado; Infinity si el terminal es inalcanzable.
 */
export function distanciaMinima(mdp) {
  const d = new Array(mdp.nEstados).fill(Infinity);
  const cola = [];
  for (let s = 0; s < mdp.nEstados; s++) {
    if (mdp.esTerminal(s)) {
      d[s] = 0;
      cola.push(s);
    }
  }
  /* Grafo inverso: de qué (s,a) se puede llegar a cada s'. */
  const predecesores = new Map();
  for (let s = 0; s < mdp.nEstados; s++) {
    if (mdp.esTerminal(s)) continue;
    for (let a = 0; a < mdp.nAcciones; a++) {
      for (const t of mdp.P[s][a]) {
        if (t.s2 === s) continue; // el rebote sobre uno mismo no acerca a nada
        if (!predecesores.has(t.s2)) predecesores.set(t.s2, new Set());
        predecesores.get(t.s2).add(s);
      }
    }
  }
  while (cola.length) {
    const s2 = cola.shift();
    for (const s of predecesores.get(s2) ?? []) {
      if (d[s] === Infinity) {
        d[s] = d[s2] + 1;
        cola.push(s);
      }
    }
  }
  return d;
}

/** Acción que una política determinista elige en s, venga como índices o como matriz. */
function accionDeterminista(pi, s) {
  const entrada = pi[s];
  if (entrada === null || entrada === undefined) return null;
  if (typeof entrada === "number") return entrada;
  const a = entrada.findIndex((p) => p > 0.999999);
  return a >= 0 ? a : null;
}

/**
 * ¿Desde qué estados se llega al terminal siguiendo una política determinista?
 *
 * Es lo que decide qué celdas valen −∞ en el módulo 2: con γ = 1, una política
 * que no termina tiene valor −∞ (y `evaluarLineal` devuelve null porque el
 * sistema es singular, sin decir en qué estados). El camino es determinista,
 * así que 16 pasos bastan: o termina o ha entrado en ciclo.
 *
 * @param {object} mdp - MDP con dinámica determinista.
 * @param {(number|null)[]|number[][]} piDeterminista - Una acción por estado,
 *   como índices (salida de `desempatar`) o como matriz π(a|s).
 * @returns {boolean[]} true si desde ese estado se alcanza un terminal.
 */
export function alcanzaTerminal(mdp, piDeterminista) {
  const llega = new Array(mdp.nEstados).fill(false);
  for (let inicio = 0; inicio < mdp.nEstados; inicio++) {
    let s = inicio;
    for (let paso = 0; paso <= mdp.nEstados; paso++) {
      if (mdp.esTerminal(s)) {
        llega[inicio] = true;
        break;
      }
      const a = accionDeterminista(piDeterminista, s);
      if (a === null) break; // política no determinista en s: no se puede seguir
      const transicion = mdp.P[s][a][0];
      if (!transicion) break;
      s = transicion.s2;
    }
  }
  return llega;
}
