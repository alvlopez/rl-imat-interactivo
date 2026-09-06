/* ==========================================================================
   RL · IMAT — motor de RL sin modelo (Tema 4)
   Sin dependencias. Módulo ES: se usa igual desde el navegador y desde node.
   NO TOCA EL DOM: es matemática pura y testeable con `node --test`.

   Por qué no cabe en `mdp.js`: aquel es un motor de MDP CON modelo (recibe la
   tabla P y calcula resultados exactos). El Tema 4 necesita lo contrario,
   entornos que solo se saben SIMULAR —el paseo aleatorio no tiene acciones, el
   acantilado devuelve al inicio sin terminar el episodio, el MDP de dos estados
   tiene recompensa gaussiana— y algoritmos que producen historiales, no puntos
   fijos. `mdp.js` no se toca ni una línea: los tests de los temas 2 y 3
   dependen de él.

   Diapositivas: 4_Tema4#slide-6 a #slide-38 · Tema4_1/2_ModelFree.
   Libro: Sutton & Barto §5, §6 (Examples 6.2, 6.4, 6.5, 6.6, 6.7).

   ─────────────────────────────────────────────────────────────────────────
   INTERFAZ COMÚN DE ENTORNO SIMULABLE  (la consume también `npasos.js`)

     { nombre, nEstados, nAcciones(s), inicio(rng), paso(s, a, rng),
       esTerminal(s), etiquetas, geometria|null, valoresVerdaderos|null }

     · `paso(s, a, rng)` → { s2, r, fin };  `fin` es true si s2 es terminal.
     · `nAcciones(s)` devuelve 0 en los entornos SIN acciones (procesos de
       recompensa: el paseo aleatorio lo es).
     · `valoresVerdaderos` es el vector v_π exacto cuando se conoce; null si no.
     · `nEstados` cuenta los estados INDEXABLES en V/Q. En el paseo aleatorio
       los dos terminales quedan FUERA de ese rango (índices nEstados y
       nEstados+1) para que `valoresVerdaderos` tenga exactamente un valor por
       estado no terminal, que es lo que exige el Example 6.2.

   ─────────────────────────────────────────────────────────────────────────
   ALEATORIEDAD

   Ninguna función de este fichero llama al azar global del lenguaje. Todo lo
   que consume azar recibe un `rng` de `generador(semilla)` de `nucleo.js`.
   (El nombre de esa función global no se escribe ni en los comentarios: hay
   un test que comprueba que la cadena no aparece en el fichero.)

   ─────────────────────────────────────────────────────────────────────────
   LOS CINCO PARÁMETROS QUE EL LIBRO NO PUBLICA Y AQUÍ SE FIJAN

   Están declarados en la página, no escondidos en el motor:

     1. α = 0,5 en el Cliff Walking (Example 6.6). El libro solo publica
        ε = 0,1 y la geometría. Se toma el α que el propio libro usa en el
        Windy Gridworld. Aquí NO hay valor por omisión: `sarsa`, `qLearning`,
        `expectedSarsa` y `qLearningDoble` exigen `alpha` explícito.
     2. 50 ejecuciones promediadas en la figura del acantilado (el libro no
        dice cuántas promedia). Tampoco hay valor por omisión: `curvaRMS` y
        `promediarEjecuciones` exigen `ejecuciones`.
     3. α = 0,01 en el entrenamiento por lotes de la Figura 6.2, donde el
        libro solo dice «suficientemente pequeño». Es el único de los cinco
        que sí aparece como valor por omisión, en `prediccionPorLotes`.
     4. n_B = 10 acciones en el estado B del Example 6.7: la figura del libro
        solo pone puntos suspensivos. Valor por omisión de `mdpDosEstados`,
        y control protagonista del módulo 4 precisamente por eso.
     5. Semilla 2026 en todas las figuras (el libro no publica ninguna).
        Valor por omisión de `loteEpisodios`.
   ========================================================================== */

import { crearMDP, rejilla3x3, ACCIONES_NAV, retornos } from "./mdp.js";
import { generador, argmax } from "./nucleo.js";

/** Tolerancia de empate del argmax, la misma que usa `argmax` de nucleo.js. */
const EPS_EMPATE = 1e-12;

/* ----------------------------------------------------------------------- *
 * 1. Entornos
 * ----------------------------------------------------------------------- */

/**
 * Paseo aleatorio (Example 6.2 con 5 estados; Example 7.1 con 19).
 *
 * Es un PROCESO DE RECOMPENSA DE MARKOV, no un MDP con decisiones: en cada
 * estado se va a izquierda o a derecha con probabilidad 0,5 y no hay nada que
 * decidir. Por eso `nAcciones(s)` devuelve 0 y `paso` ignora `a`. Meterle
 * acciones ficticias rompería el consumo del rng de `muestrearEpisodio` (un
 * valor por paso) y con él todos los números reproducibles de `tema4b.html`.
 *
 * Los cuatro parámetros son explícitos a propósito: decidir las recompensas
 * con un `if (nEstados === 19)` escondido dentro es una bomba de relojería.
 *
 * @param {object} opciones
 * @param {number} opciones.nEstados Estados no terminales (5 en 6.2, 19 en 7.1).
 * @param {number} opciones.recompensaIzquierda Recompensa al salir por la izquierda.
 * @param {number} opciones.recompensaDerecha Recompensa al salir por la derecha.
 * @param {number} opciones.valorInicial Valor con el que se inicializa V(s).
 * @returns {object} Entorno simulable, con `estadoInicial`, `valorInicial` y
 *   `vVerdadero` (alias del MISMO array `valoresVerdaderos`, no una copia).
 * @throws {Error} Si `nEstados` no es un entero ≥ 1.
 */
export function paseoAleatorio({
  nEstados = 5,
  recompensaIzquierda = 0,
  recompensaDerecha = 1,
  valorInicial = 0.5,
} = {}) {
  if (!Number.isInteger(nEstados) || nEstados < 1) {
    throw new Error(`paseoAleatorio: nEstados debe ser un entero ≥ 1; recibido: ${nEstados}`);
  }

  /* Los dos terminales viven fuera de [0, nEstados) para que V y
     valoresVerdaderos tengan exactamente un hueco por estado no terminal. */
  const TERMINAL_IZQUIERDA = nEstados;
  const TERMINAL_DERECHA = nEstados + 1;
  const estadoInicial = Math.floor(nEstados / 2); // "C" con 5 estados, el 9 con 19

  /* v_π SE CALCULA, no se escribe a mano. Con γ = 1 y paseo simétrico el valor
     es la interpolación lineal entre las dos recompensas terminales:
       v(i) = rIzq + (rDch − rIzq) · (i+1)/(n+1)
     que da [1/6 … 5/6] con 5 estados y [−0,9 … 0,9] con 19. */
  const valoresVerdaderos = [];
  for (let s = 0; s < nEstados; s++) {
    valoresVerdaderos.push(
      recompensaIzquierda + ((recompensaDerecha - recompensaIzquierda) * (s + 1)) / (nEstados + 1),
    );
  }

  /* Etiquetas: letras SOLO en el paseo de cinco estados, que es el único que
     el libro nombra (A…E, Example 6.2); números 1…n en los demás.
     No es cosmética: con los 19 estados del Example 7.1 el alfabeto llega a
     «R» y «S», que son los símbolos de recompensa y de estado del curso, y
     `Teoria/referencia/notacion.md` no admite ese choque. La semántica va
     siempre por índice; esto es solo lo que se imprime. */
  const etiquetas = [];
  for (let s = 0; s < nEstados; s++) {
    etiquetas.push(nEstados <= 5 ? String.fromCharCode(65 + s) : String(s + 1));
  }

  return {
    nombre: `Paseo aleatorio de ${nEstados} estados`,
    nEstados,
    estadoInicial,
    valorInicial,
    etiquetas,
    geometria: null,
    valoresVerdaderos,
    vVerdadero: valoresVerdaderos, // alias: el mismo array, no una copia
    terminalIzquierda: TERMINAL_IZQUIERDA,
    terminalDerecha: TERMINAL_DERECHA,
    nAcciones() {
      return 0; // proceso de recompensa: no hay nada que decidir
    },
    inicio() {
      return estadoInicial; // determinista: NO consume rng
    },
    esTerminal(s) {
      return s >= nEstados;
    },
    /* Consume EXACTAMENTE un valor del rng por paso. Ver §2.2 del contrato. */
    paso(s, _a, rng) {
      const derecha = rng.uniforme() < 0.5;
      const s2 = derecha ? s + 1 : s - 1;
      if (s2 < 0) return { s2: TERMINAL_IZQUIERDA, r: recompensaIzquierda, fin: true };
      if (s2 >= nEstados) return { s2: TERMINAL_DERECHA, r: recompensaDerecha, fin: true };
      return { s2, r: 0, fin: false };
    },
  };
}

const FILAS_CLIFF = 4;
const COLUMNAS_CLIFF = 12;
const INICIO_CLIFF = 36; // fila 3, columna 0
const META_CLIFF = 47; // fila 3, columna 11

const DELTA_NAV = { N: [-1, 0], S: [1, 0], O: [0, -1], E: [0, 1] };

/**
 * Cliff Walking (Example 6.6, S&B p. 154).
 *
 * 4×12, S = 36, G = 47, acantilado = 37…46 (las diez celdas centrales de la
 * fila de abajo). r = −1 en toda transición; caer al acantilado cuesta −100 y
 * devuelve a S **sin terminar el episodio** —es el error de implementación más
 * frecuente de este entorno y cambia por completo las curvas—. γ = 1.
 *
 * @returns {object} Entorno simulable con las cuatro acciones de ACCIONES_NAV.
 */
export function cliffWalking() {
  const nEstados = FILAS_CLIFF * COLUMNAS_CLIFF;
  const acantilado = [];
  for (let c = 1; c <= COLUMNAS_CLIFF - 2; c++) acantilado.push(3 * COLUMNAS_CLIFF + c);
  const enAcantilado = new Set(acantilado);

  const fila = (s) => Math.floor(s / COLUMNAS_CLIFF);
  const col = (s) => s % COLUMNAS_CLIFF;

  const etiquetas = new Array(nEstados).fill("");
  etiquetas[INICIO_CLIFF] = "S";
  etiquetas[META_CLIFF] = "G";

  return {
    nombre: "Cliff Walking",
    nEstados,
    acciones: ACCIONES_NAV,
    etiquetas,
    valoresVerdaderos: null,
    geometria: {
      filas: FILAS_CLIFF,
      columnas: COLUMNAS_CLIFF,
      posicion: (s) => ({ fila: fila(s), col: col(s) }),
      inicio: INICIO_CLIFF,
      meta: META_CLIFF,
      terminal: META_CLIFF,
      acantilado,
    },
    nAcciones() {
      return ACCIONES_NAV.length;
    },
    inicio() {
      return INICIO_CLIFF; // determinista: NO consume rng
    },
    esTerminal(s) {
      return s === META_CLIFF;
    },
    /* Determinista: NO consume rng. Toda la aleatoriedad del módulo 3 viene de
       la política, que es justo lo que se quiere aislar. */
    paso(s, a, _rng) {
      const [df, dc] = DELTA_NAV[ACCIONES_NAV[a]];
      const f = Math.min(FILAS_CLIFF - 1, Math.max(0, fila(s) + df));
      const c = Math.min(COLUMNAS_CLIFF - 1, Math.max(0, col(s) + dc));
      const destino = f * COLUMNAS_CLIFF + c; // rebote contra el contorno
      if (enAcantilado.has(destino)) return { s2: INICIO_CLIFF, r: -100, fin: false };
      return { s2: destino, r: -1, fin: destino === META_CLIFF };
    },
  };
}

const FILAS_VIENTO = 7;
const COLUMNAS_VIENTO = 10;
const INICIO_VIENTO = 30; // fila 3, columna 0
const META_VIENTO = 37; // fila 3, columna 7

/** Viento por columna, hacia arriba (Example 6.5, leído de la figura p. 152). */
export const VIENTO = [0, 0, 0, 1, 1, 1, 2, 2, 1, 0];

/**
 * Windy Gridworld (Example 6.5, S&B p. 152).
 *
 * 7×10, S = 30, G = 37, r = −1 por paso, γ = 1. El viento empuja hacia arriba
 * tantas filas como diga la columna DE ORIGEN, y el rebote contra el contorno
 * se aplica DESPUÉS del viento. Con esta lectura el camino mínimo de S a G es
 * de 15 pasos, que es exactamente el que declara el libro: es la comprobación
 * de que la fila de vientos está bien leída.
 *
 * En `tema4.html` se usa solo como figura estática (bloque B11).
 *
 * @returns {object} Entorno simulable con las cuatro acciones de ACCIONES_NAV.
 */
export function windyGridworld() {
  const nEstados = FILAS_VIENTO * COLUMNAS_VIENTO;
  const fila = (s) => Math.floor(s / COLUMNAS_VIENTO);
  const col = (s) => s % COLUMNAS_VIENTO;

  const etiquetas = new Array(nEstados).fill("");
  etiquetas[INICIO_VIENTO] = "S";
  etiquetas[META_VIENTO] = "G";

  return {
    nombre: "Windy Gridworld",
    nEstados,
    acciones: ACCIONES_NAV,
    etiquetas,
    valoresVerdaderos: null,
    geometria: {
      filas: FILAS_VIENTO,
      columnas: COLUMNAS_VIENTO,
      posicion: (s) => ({ fila: fila(s), col: col(s) }),
      inicio: INICIO_VIENTO,
      meta: META_VIENTO,
      terminal: META_VIENTO,
      viento: VIENTO,
    },
    nAcciones() {
      return ACCIONES_NAV.length;
    },
    inicio() {
      return INICIO_VIENTO;
    },
    esTerminal(s) {
      return s === META_VIENTO;
    },
    paso(s, a, _rng) {
      const [df, dc] = DELTA_NAV[ACCIONES_NAV[a]];
      const f = Math.min(FILAS_VIENTO - 1, Math.max(0, fila(s) + df - VIENTO[col(s)]));
      const c = Math.min(COLUMNAS_VIENTO - 1, Math.max(0, col(s) + dc));
      const destino = f * COLUMNAS_VIENTO + c;
      return { s2: destino, r: -1, fin: destino === META_VIENTO };
    },
  };
}

/** Índices de las dos acciones de A en el MDP del Example 6.7. */
export const IZQUIERDA = 0;
export const DERECHA = 1;

/**
 * MDP de dos estados del Example 6.7 (S&B p. 156), el del sesgo de maximización.
 *
 * A (índice 0) tiene dos acciones: `izquierda` lleva a B con r = 0, `derecha`
 * termina con r = 0. B (índice 1) tiene `nB` acciones, todas terminan con
 * r ~ N(media, sigma²). γ = 1. Ir a la izquierda es siempre un error: su
 * retorno esperado es la media (−0,1) y el de la derecha es 0.
 *
 * El libro NO dice cuántas acciones tiene B (la figura solo pone puntos
 * suspensivos): nB = 10 es decisión de esta página y por eso es el control
 * protagonista del módulo 4.
 *
 * @param {object} opciones
 * @param {number} opciones.nB Número de acciones del estado B.
 * @param {number} opciones.sigma Desviación típica de la recompensa desde B.
 * @param {number} opciones.media Media de la recompensa desde B.
 * @returns {object} Entorno simulable.
 * @throws {Error} Si `nB` no es un entero ≥ 1 o `sigma` no es positiva.
 */
export function mdpDosEstados({ nB = 10, sigma = 1, media = -0.1 } = {}) {
  if (!Number.isInteger(nB) || nB < 1) {
    throw new Error(`mdpDosEstados: nB debe ser un entero ≥ 1; recibido: ${nB}`);
  }
  if (!(sigma > 0)) {
    throw new Error(`mdpDosEstados: sigma debe ser > 0; recibido: ${sigma}`);
  }
  const A = 0;
  const B = 1;
  const TERMINAL = 2;

  return {
    nombre: "MDP de dos estados (Example 6.7)",
    nEstados: 3,
    nB,
    sigma,
    media,
    etiquetas: ["A", "B", "fin"],
    geometria: null,
    valoresVerdaderos: null,
    nAcciones(s) {
      if (s === A) return 2;
      if (s === B) return nB;
      return 0; // el terminal no tiene acciones: Q(terminal, ·) = 0 siempre
    },
    inicio() {
      return A; // siempre en A: NO consume rng
    },
    esTerminal(s) {
      return s === TERMINAL;
    },
    paso(s, a, rng) {
      if (s === A) {
        return a === IZQUIERDA
          ? { s2: B, r: 0, fin: false }
          : { s2: TERMINAL, r: 0, fin: true };
      }
      /* Desde B, cualquier acción termina; la recompensa consume dos valores
         del rng (Box-Muller de nucleo.js). */
      return { s2: TERMINAL, r: rng.normal(media, sigma), fin: true };
    },
  };
}

/**
 * Rejilla 3×3 del Tema 2 con dos acciones de un estado intercambiadas.
 *
 * Es el entorno B del módulo 1: el contraejemplo que demuestra que v_π no basta
 * para actuar. Permutar dos acciones de un estado deja P_π invariante bajo
 * política equiprobable —y con ella v_π—, pero cambia q_π y por tanto la acción
 * greedy. Devuelve un `mdp` de `crearMDP`, NO un entorno simulable: el módulo 1
 * no simula nada, resuelve el sistema lineal.
 *
 * @param {object} opciones
 * @param {number} opciones.estado Estado cuyas acciones se permutan (índice interno).
 * @param {number} opciones.a1 Primera acción a intercambiar.
 * @param {number} opciones.a2 Segunda acción a intercambiar.
 * @returns {object} MDP nuevo; el original de `mdp.js` no se toca.
 * @throws {Error} Si el estado o las acciones están fuera de rango.
 */
export function rejilla3x3Permutada({ estado = 2, a1 = 1, a2 = 2 } = {}) {
  const base = rejilla3x3();
  if (!Number.isInteger(estado) || estado < 0 || estado >= base.nEstados) {
    throw new Error(`rejilla3x3Permutada: estado fuera de rango; recibido: ${estado}`);
  }
  for (const a of [a1, a2]) {
    if (!Number.isInteger(a) || a < 0 || a >= base.nAcciones) {
      throw new Error(`rejilla3x3Permutada: acción fuera de rango; recibida: ${a}`);
    }
  }

  const P = base.P.map((fila) => fila.map((transiciones) => transiciones.map((t) => ({ ...t }))));
  [P[estado][a1], P[estado][a2]] = [P[estado][a2], P[estado][a1]];

  return crearMDP({
    nombre: `${base.nombre} (acciones ${base.acciones[a1]}/${base.acciones[a2]} permutadas en ${base.etiquetas[estado]})`,
    nEstados: base.nEstados,
    acciones: base.acciones,
    etiquetas: base.etiquetas,
    terminales: [...base.terminales],
    P,
    geometria: base.geometria,
  });
}

/* ----------------------------------------------------------------------- *
 * 2. Muestreo de episodios
 *
 * EL ORDEN DE CONSUMO DEL rng ES EL CONTRATO CON `npasos.js`. Está fijado en
 * la ficha `contrato-motores.md` §2.2 y §2.3, y es lo que hace que los
 * números de las dos páginas sean reproducibles. NO SE «ARREGLA»:
 *
 *   1. `s0 === null`  → se pide a `entorno.inicio(rng)`. Si se pasa un número,
 *      no se consume nada.
 *   2. En cada paso: PRIMERO la acción (solo si `nAcciones(s) > 0`), DESPUÉS
 *      la transición (`entorno.paso(s, a, rng)`).
 *   3. En un entorno SIN acciones —el paseo aleatorio— `pi` se ignora,
 *      `acciones` queda vacío y se consume EXACTAMENTE un valor del rng por
 *      paso, dentro de `paso`. Un valor de más y cambian todos los números.
 * ----------------------------------------------------------------------- */

/** Tope de pasos del paseo aleatorio: p(alcanzarlo) < 1e-30, pero el bucle acaba. */
const MAX_PASOS_PASEO = 1000;

/**
 * Muestrea un episodio completo del entorno siguiendo `pi`.
 *
 * @param {object} entorno Entorno simulable.
 * @param {Array<Array<number>>|Function|null} pi Política: matriz π(a|s) o
 *   función `pi(s, rng)` que devuelve la acción. Se ignora si el entorno no
 *   tiene acciones.
 * @param {number|null} s0 Estado inicial; `null` para pedírselo al entorno.
 * @param {object} rng Generador de `generador(semilla)`.
 * @param {object} opciones
 * @param {number} opciones.maxPasos Tope de pasos antes de truncar.
 * @returns {{estados: number[], acciones: number[], recompensas: number[], T: number, truncado: boolean}}
 *   `estados` = [S_0 … S_{T−1}] (sin el terminal), `acciones` = [A_0 … A_{T−1}]
 *   (vacío si el entorno no tiene acciones), `recompensas` = [R_1 … R_T].
 * @throws {Error} Si el entorno tiene acciones y no se ha dado política.
 */
export function muestrearEpisodio(entorno, pi, s0, rng, { maxPasos = 100000 } = {}) {
  const estados = [];
  const acciones = [];
  const recompensas = [];

  let s = s0 === null || s0 === undefined ? entorno.inicio(rng) : s0;
  let truncado = true;

  for (let k = 0; k < maxPasos; k++) {
    if (entorno.esTerminal(s)) {
      truncado = false;
      break;
    }
    const nA = entorno.nAcciones(s);
    let a = null;
    if (nA > 0) {
      if (pi === null || pi === undefined) {
        throw new Error("muestrearEpisodio: el entorno tiene acciones y no se ha dado política");
      }
      a = typeof pi === "function" ? pi(s, rng) : rng.categorica(pi[s]);
      acciones.push(a);
    }
    const { s2, r, fin } = entorno.paso(s, a, rng);
    estados.push(s);
    recompensas.push(r);
    s = s2;
    if (fin) {
      truncado = false;
      break;
    }
  }

  return { estados, acciones, recompensas, T: estados.length, truncado };
}

/**
 * Genera un lote de episodios con UN SOLO generador para todo el lote.
 *
 * El recorrido es `para rep { para ep { … } }`. Es la condición del libro para
 * el barrido de la figura 7.2 —los mismos caminos para todos los ajustes de
 * parámetros—: cambiar el orden invalida la comparación entre valores de n, no
 * solo los números.
 *
 * @param {object} entorno Entorno simulable.
 * @param {Array<Array<number>>|Function|null} pi Política (ver `muestrearEpisodio`).
 * @param {number|null} s0 Estado inicial; `null` para pedírselo al entorno.
 * @param {object} opciones
 * @param {number} opciones.semilla Semilla única del lote.
 * @param {number} opciones.repeticiones Número de filas.
 * @param {number} opciones.episodios Episodios por fila.
 * @param {number} opciones.maxPasos Tope de pasos por episodio.
 * @returns {Array<Array<object>>} `repeticiones` filas de `episodios` elementos.
 * @throws {Error} Si `repeticiones` o `episodios` no son enteros ≥ 1.
 */
export function loteEpisodios(entorno, pi, s0, {
  semilla = 2026, repeticiones, episodios, maxPasos = 100000,
} = {}) {
  if (!Number.isInteger(repeticiones) || repeticiones < 1) {
    throw new Error(`loteEpisodios: repeticiones debe ser un entero ≥ 1; recibido: ${repeticiones}`);
  }
  if (!Number.isInteger(episodios) || episodios < 1) {
    throw new Error(`loteEpisodios: episodios debe ser un entero ≥ 1; recibido: ${episodios}`);
  }

  const rng = generador(semilla); // UNO para todo el lote, no uno por repetición
  const lote = [];
  for (let rep = 0; rep < repeticiones; rep++) {
    const fila = [];
    for (let ep = 0; ep < episodios; ep++) {
      fila.push(muestrearEpisodio(entorno, pi, s0, rng, { maxPasos }));
    }
    lote.push(fila);
  }
  return lote;
}

/* ----------------------------------------------------------------------- *
 * 3. Las tres primitivas por episodio
 *
 * Son la unidad testeable: `prediccionTD`, `prediccionMC` y los bucles de
 * control las LLAMAN en vez de duplicar la regla, para que el test de la
 * primitiva y el del bucle no se puedan desincronizar.
 *
 * Convenio común: el episodio no incluye el estado terminal, así que
 * V(S_T) = 0 y Q(S_T, ·) = 0 salen solos del formato. Es la trampa clásica de
 * este pseudocódigo: si el terminal se actualiza, TD(0) converge a otra cosa.
 * ----------------------------------------------------------------------- */

/**
 * TD(0) sobre un episodio ya muestreado — ecuación (6.2). Muta `V`.
 *
 * @param {number[]} V Vector de valores, se modifica in situ.
 * @param {object} episodio Episodio de `muestrearEpisodio`.
 * @param {object} opciones
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} opciones.gamma Descuento.
 * @returns {number} Número de actualizaciones aplicadas.
 * @throws {Error} Si `alpha` no es un número finito.
 */
export function tdCero(V, episodio, { alpha, gamma = 1 } = {}) {
  validarAlpha(alpha, "tdCero");
  const { estados, recompensas, T } = episodio;
  for (let t = 0; t < T; t++) {
    const s = estados[t];
    const vSiguiente = t + 1 < T ? V[estados[t + 1]] : 0; // S_T es terminal
    V[s] += alpha * (recompensas[t] + gamma * vSiguiente - V[s]);
  }
  return T;
}

/**
 * Monte Carlo de paso constante sobre un episodio — ecuación (6.1). Muta `V`.
 *
 * Las actualizaciones se aplican en orden CRECIENTE de t, con V viva: es lo
 * que hace que coincida con TD de n pasos cuando n ≥ T, y lo que fija los
 * números del guion cuando un estado se visita varias veces.
 *
 * @param {number[]} V Vector de valores, se modifica in situ.
 * @param {object} episodio Episodio de `muestrearEpisodio`.
 * @param {object} opciones
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} opciones.gamma Descuento.
 * @param {boolean} opciones.primeraVisita `false` ⇒ de CADA visita (lo que usan
 *   los dos guiones: en el paseo aleatorio los estados se repiten sin parar).
 * @returns {number} Número de actualizaciones aplicadas.
 * @throws {Error} Si `alpha` no es un número finito.
 */
export function mcConstante(V, episodio, { alpha, gamma = 1, primeraVisita = false } = {}) {
  validarAlpha(alpha, "mcConstante");
  const { estados, recompensas, T } = episodio;
  const g = retornos(recompensas, gamma); // G_t de mdp.js: no se duplica
  const vistos = new Set();
  let actualizaciones = 0;
  for (let t = 0; t < T; t++) {
    const s = estados[t];
    if (primeraVisita) {
      if (vistos.has(s)) continue;
      vistos.add(s);
    }
    V[s] += alpha * (g[t] - V[s]);
    actualizaciones++;
  }
  return actualizaciones;
}

/**
 * SARSA sobre un episodio ya muestreado — ecuación (6.7). Muta `Q`.
 *
 * OJO: no confundir con `sarsa`, que es el BUCLE DE ENTRENAMIENTO completo.
 * Aquí el episodio ya está muestreado y las acciones ya están elegidas; esta
 * función solo aplica la regla.
 *
 * @param {Array<number[]>} Q Tabla de valores de acción, se modifica in situ.
 * @param {object} episodio Episodio con `acciones` no vacío.
 * @param {object} opciones
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} opciones.gamma Descuento.
 * @returns {number} Número de actualizaciones aplicadas.
 * @throws {Error} Si `alpha` no es válido o el episodio no tiene acciones.
 */
export function sarsaEpisodio(Q, episodio, { alpha, gamma = 1 } = {}) {
  validarAlpha(alpha, "sarsaEpisodio");
  const { estados, acciones, recompensas, T } = episodio;
  if (T > 0 && acciones.length !== T) {
    throw new Error("sarsaEpisodio: el episodio no trae una acción por paso");
  }
  for (let t = 0; t < T; t++) {
    const s = estados[t];
    const a = acciones[t];
    const qSiguiente = t + 1 < T ? Q[estados[t + 1]][acciones[t + 1]] : 0; // Q(terminal, ·) = 0
    Q[s][a] += alpha * (recompensas[t] + gamma * qSiguiente - Q[s][a]);
  }
  return T;
}

/* ----------------------------------------------------------------------- *
 * 4. Predicción: MC frente a TD(0)  (módulo 2)
 * ----------------------------------------------------------------------- */

/** V inicial: `vInicial` en los no terminales y 0 en los terminales, siempre. */
function vectorValores(entorno, vInicial) {
  const V = new Array(entorno.nEstados).fill(vInicial);
  for (let s = 0; s < entorno.nEstados; s++) if (entorno.esTerminal(s)) V[s] = 0;
  return V;
}

/**
 * Muestrea un episodio descartando los truncados, como pide el guion: si se
 * alcanza el tope se genera otro con el MISMO generador. La probabilidad es
 * menor que 1e-30 en el paseo aleatorio, pero el bucle tiene que terminar.
 */
function episodioCompleto(entorno, rng, maxPasos) {
  for (let intento = 0; intento < 100; intento++) {
    const episodio = muestrearEpisodio(entorno, null, null, rng, { maxPasos });
    if (!episodio.truncado) return episodio;
  }
  throw new Error(`No se ha conseguido un episodio de menos de ${maxPasos} pasos en 100 intentos`);
}

/** Esqueleto común de `prediccionMC` y `prediccionTD`: solo cambia la regla. */
function prediccion(entorno, opciones, aplicarRegla) {
  const { episodios, rng, maxPasos = MAX_PASOS_PASEO } = opciones;
  if (!Number.isInteger(episodios) || episodios < 0) {
    throw new Error(`predicción: episodios debe ser un entero ≥ 0; recibido: ${episodios}`);
  }
  if (!rng) throw new Error("predicción: hace falta un rng de generador(semilla)");

  const V = vectorValores(entorno, opciones.vInicial ?? 0.5);
  const historial = [V.slice()];
  const listaEpisodios = [];

  for (let k = 0; k < episodios; k++) {
    const episodio = episodioCompleto(entorno, rng, maxPasos);
    listaEpisodios.push(episodio);
    aplicarRegla(V, episodio);
    historial.push(V.slice());
  }
  return { V, historial, episodios: listaEpisodios };
}

/**
 * Predicción por Monte Carlo de paso constante, ecuación (6.1).
 *
 * @param {object} entorno Entorno simulable SIN acciones (proceso de recompensa).
 * @param {object} opciones
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} opciones.episodios Número de episodios a generar.
 * @param {object} opciones.rng Generador de `generador(semilla)`.
 * @param {string} opciones.visitas "primera" | "cada".
 * @param {number} opciones.vInicial Valor inicial de V en los no terminales.
 * @param {number} opciones.gamma Descuento.
 * @param {number} opciones.maxPasos Tope de pasos por episodio.
 * @returns {{V: number[], historial: number[][], episodios: object[]}}
 *   `historial` tiene `episodios + 1` instantáneas: [V_0, V_1, …, V_n].
 * @throws {Error} Si `visitas` no es "primera" ni "cada".
 */
export function prediccionMC(entorno, {
  alpha, episodios, rng, visitas = "cada", vInicial = 0.5, gamma = 1, maxPasos = MAX_PASOS_PASEO,
} = {}) {
  if (visitas !== "primera" && visitas !== "cada") {
    throw new Error(`prediccionMC: visitas debe ser "primera" o "cada"; recibido: ${visitas}`);
  }
  const primeraVisita = visitas === "primera";
  return prediccion(
    entorno,
    { alpha, episodios, rng, vInicial, maxPasos },
    (V, ep) => mcConstante(V, ep, { alpha, gamma, primeraVisita }),
  );
}

/**
 * Predicción por TD(0), ecuación (6.2). Misma forma de salida que `prediccionMC`.
 *
 * Con la misma semilla, MC y TD ven EXACTAMENTE los mismos episodios: el
 * muestreo no depende de V. Es la aserción M2-A11 y la base del módulo 2.
 *
 * @param {object} entorno Entorno simulable SIN acciones.
 * @param {object} opciones Ver `prediccionMC`.
 * @returns {{V: number[], historial: number[][], episodios: object[]}}
 */
export function prediccionTD(entorno, {
  alpha, episodios, rng, vInicial = 0.5, gamma = 1, maxPasos = MAX_PASOS_PASEO,
} = {}) {
  return prediccion(
    entorno,
    { alpha, episodios, rng, vInicial, maxPasos },
    (V, ep) => tdCero(V, ep, { alpha, gamma }),
  );
}

/**
 * Actualización por lotes (batch updating, S&B §6.3).
 *
 * Se acumulan TODOS los incrementos sobre un V congelado, se aplica la suma, y
 * se repite sobre el mismo lote hasta que V converge. El resultado no depende
 * de α mientras sea pequeño, que es justamente lo que afirma el libro.
 *
 * @param {object} entorno Entorno simulable (solo se usan `nEstados` y `esTerminal`).
 * @param {object[]} episodiosDatos Episodios ya muestreados.
 * @param {object} opciones
 * @param {string} opciones.metodo "mc" | "td".
 * @param {number} opciones.alpha Paso; el libro solo dice «suficientemente
 *   pequeño», y lo que hace falta es α · (visitas por estado) ≲ 2: con los 100
 *   episodios del paseo aleatorio α = 0,01 DIVERGE, y con TD tampoco aguantan
 *   0,005 (revienta en el episodio 87) ni 0,004: el mayor que completa los 100
 *   es α = 0,002. Medido, no estimado; ver tests/sinmodelo.test.js (M2-A10).
 * @param {number} opciones.vInicial Valor inicial de V.
 * @param {number} opciones.gamma Descuento.
 * @param {number} opciones.tol Parada: max_s |ΔV(s)| < tol.
 * @param {number} opciones.maxPasadas Tope de pasadas sobre el lote.
 * @returns {{V: number[], pasadas: number, convergido: boolean}}
 * @throws {Error} Si `metodo` no es "mc" ni "td".
 */
export function prediccionPorLotes(entorno, episodiosDatos, {
  metodo, alpha = 0.002, vInicial = 0.5, gamma = 1, tol = 1e-6, maxPasadas = 1000,
} = {}) {
  if (metodo !== "mc" && metodo !== "td") {
    throw new Error(`prediccionPorLotes: metodo debe ser "mc" o "td"; recibido: ${metodo}`);
  }
  validarAlpha(alpha, "prediccionPorLotes");

  const V = vectorValores(entorno, vInicial);
  let pasadas = 0;
  let cambio = Infinity;

  while (cambio > tol && pasadas < maxPasadas) {
    const incremento = new Array(entorno.nEstados).fill(0);

    for (const episodio of episodiosDatos) {
      const { estados, recompensas, T } = episodio;
      const g = metodo === "mc" ? retornos(recompensas, gamma) : null;
      for (let t = 0; t < T; t++) {
        const s = estados[t];
        const objetivo = metodo === "mc"
          ? g[t]
          : recompensas[t] + gamma * (t + 1 < T ? V[estados[t + 1]] : 0);
        incremento[s] += alpha * (objetivo - V[s]); // V no se toca dentro del lote
      }
    }

    cambio = 0;
    for (let s = 0; s < entorno.nEstados; s++) {
      if (entorno.esTerminal(s)) continue;
      V[s] += incremento[s];
      cambio = Math.max(cambio, Math.abs(incremento[s]));
    }
    pasadas++;

    /* La iteración por lotes solo es estable si α · (visitas por estado) es
       pequeño: sumando los incrementos de TODO el lote, un α que va bien con
       10 episodios diverge con 100. El libro solo dice «suficientemente
       pequeño», así que el tamaño del lote decide. Si diverge se avisa en vez
       de devolver NaN en silencio. */
    if (!Number.isFinite(cambio) || cambio > 1e6) {
      throw new Error(
        `prediccionPorLotes: la iteración diverge con alpha = ${alpha} y ${episodiosDatos.length} episodios; hace falta un alpha menor`,
      );
    }
  }

  return { V, pasadas, convergido: cambio <= tol };
}

/**
 * Error RMS entre V y los valores verdaderos.
 *
 * @param {number[]} V Estimaciones.
 * @param {number[]} valoresVerdaderos v_π exacto, un valor por estado no terminal.
 * @param {number[]|null} estados Índices sobre los que promediar; `null` = todos
 *   los que trae `valoresVerdaderos`, que por construcción son los no terminales.
 * @returns {number} Raíz de la media de los cuadrados de las diferencias.
 * @throws {Error} Si la lista de estados queda vacía.
 */
export function errorRMS(V, valoresVerdaderos, estados = null) {
  const indices = estados ?? valoresVerdaderos.map((_, s) => s);
  if (indices.length === 0) throw new Error("errorRMS: no hay estados sobre los que promediar");
  let suma = 0;
  for (const s of indices) {
    const d = V[s] - valoresVerdaderos[s];
    suma += d * d;
  }
  return Math.sqrt(suma / indices.length);
}

/**
 * Curva de error RMS frente al número de episodios, promediada sobre ejecuciones.
 *
 * MC y TD llamados con la MISMA semilla ven los MISMOS episodios.
 *
 * @param {object} entorno Entorno simulable con `valoresVerdaderos`.
 * @param {object} opciones
 * @param {string} opciones.metodo "mc" | "td".
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} opciones.episodios Episodios por ejecución.
 * @param {number} opciones.ejecuciones Ejecuciones independientes a promediar.
 * @param {number} opciones.semilla Semilla base; la ejecución i usa `semilla + i`.
 * @param {boolean} opciones.porLotes Modo batch de §6.3.
 * @param {string} opciones.visitas "primera" | "cada" (solo MC).
 * @returns {{curva: number[], ejecuciones: number}} `curva` tiene `episodios + 1`
 *   puntos; el primero es el error de la inicialización.
 * @throws {Error} Si el entorno no conoce sus valores verdaderos.
 */
export function curvaRMS(entorno, {
  metodo, alpha, episodios, ejecuciones, semilla, porLotes = false, visitas = "cada",
} = {}) {
  const verdaderos = entorno.valoresVerdaderos;
  if (!verdaderos) throw new Error("curvaRMS: el entorno no conoce sus valores verdaderos");
  if (metodo !== "mc" && metodo !== "td") {
    throw new Error(`curvaRMS: metodo debe ser "mc" o "td"; recibido: ${metodo}`);
  }
  const vInicial = entorno.valorInicial ?? 0.5;

  const unaEjecucion = (rng) => {
    if (!porLotes) {
      const salida = metodo === "mc"
        ? prediccionMC(entorno, { alpha, episodios, rng, visitas, vInicial })
        : prediccionTD(entorno, { alpha, episodios, rng, vInicial });
      return salida.historial.map((V) => errorRMS(V, verdaderos));
    }
    /* Por lotes: tras cada episodio nuevo se reprocesa el lote entero hasta
       converger, y solo entonces se registra el error. El α es el que pase
       quien llama: tiene que ser lo bastante pequeño para el lote MÁS GRANDE
       que se vaya a procesar (ver la nota de `prediccionPorLotes`). */
    const acumulados = [];
    const serie = [errorRMS(vectorValores(entorno, vInicial), verdaderos)];
    for (let k = 0; k < episodios; k++) {
      acumulados.push(episodioCompleto(entorno, rng, MAX_PASOS_PASEO));
      const { V } = prediccionPorLotes(entorno, acumulados, { metodo, alpha, vInicial });
      serie.push(errorRMS(V, verdaderos));
    }
    return serie;
  };

  const { media } = promediarEjecuciones(unaEjecucion, { ejecuciones, semilla });
  return { curva: media, ejecuciones };
}

/**
 * Los ocho episodios del Example 6.4 (S&B p. 149), literales, como datos.
 * Cada episodio es una lista de pares [estado, recompensa].
 */
export const EPISODIOS_PREDICTOR = [
  [["A", 0], ["B", 0]],
  [["B", 1]],
  [["B", 1]],
  [["B", 1]],
  [["B", 1]],
  [["B", 1]],
  [["B", 1]],
  [["B", 0]],
];

/**
 * Resuelve «eres el predictor» (Example 6.4) a partir de los ocho episodios.
 *
 * Se CALCULA, no se escribe a mano. Y se calcula el punto fijo exacto en vez
 * de iterar `prediccionPorLotes`: la actualización por lotes converge a estos
 * mismos valores, pero solo hasta la tolerancia, y el guion los quiere exactos
 * (M2-A9). El punto fijo de TD por lotes es el valor exacto en el modelo de
 * Markov de máxima verosimilitud —la estimación de equivalencia cierta— y el
 * de MC por lotes es la media de los retornos observados.
 *
 * @returns {{vB: number, vA_td: number, vA_mc: number, modelo: object}}
 */
export function resolverPredictor() {
  let visitasA = 0;
  let retornoA = 0; // suma de retornos observados tras A
  let aVaB = 0;
  let visitasB = 0;
  let recompensaB = 0; // suma de recompensas al terminar desde B

  for (const episodio of EPISODIOS_PREDICTOR) {
    const g = episodio.reduce((suma, [, r]) => suma + r, 0); // γ = 1
    for (let t = 0; t < episodio.length; t++) {
      const [estado, r] = episodio[t];
      if (estado === "A") {
        visitasA++;
        retornoA += g; // el retorno desde A es el del episodio entero
        if (episodio[t + 1] && episodio[t + 1][0] === "B") aVaB++;
      } else {
        visitasB++;
        recompensaB += r;
      }
    }
  }

  const vB = recompensaB / visitasB; // 6/8 = 0,75
  const pAB = aVaB / visitasA; // 1: de A siempre se pasa a B, con r = 0
  return {
    vB,
    vA_td: 0 + pAB * vB, // equivalencia cierta: resolver el modelo estimado
    vA_mc: retornoA / visitasA, // media de los retornos vistos tras A
    modelo: { AB: pAB, B1: vB, B0: 1 - vB },
  };
}

/* ----------------------------------------------------------------------- *
 * 5. Control: SARSA, Q-learning, Expected SARSA y aprendizaje doble
 * ----------------------------------------------------------------------- */

/**
 * Selección ε-greedy con desempate ALEATORIO.
 *
 * Con probabilidad ε, una acción uniforme entre las `nAcciones` (la greedy
 * incluida, como en el libro); con probabilidad 1−ε, una maximizadora.
 *
 * Consumo del rng: un valor para la moneda de ε, más uno para el sorteo (el
 * de la acción uniforme, o el del desempate si hay empate en el argmax).
 *
 * @param {Array<number[]>} Q Tabla de valores de acción.
 * @param {number} s Estado.
 * @param {number} epsilon Tasa de exploración.
 * @param {object} rng Generador de `generador(semilla)`.
 * @param {number} nAcciones Acciones disponibles en `s`.
 * @returns {number} Índice de la acción elegida.
 */
export function politicaEpsilonGreedy(Q, s, epsilon, rng, nAcciones = Q[s].length) {
  if (rng.uniforme() < epsilon) return rng.entero(nAcciones);
  return argmax(Q[s], rng);
}

/** Tabla Q a cero, con una fila por estado y tantas columnas como acciones tenga. */
function tablaQ(entorno) {
  const Q = [];
  for (let s = 0; s < entorno.nEstados; s++) Q.push(new Array(entorno.nAcciones(s)).fill(0));
  return Q;
}

/** ε del episodio k (k empieza en 1), con o sin decaimiento. */
function epsilonDe(epsilon, decaeEpsilon, k) {
  return decaeEpsilon ? decaeEpsilon(k) : epsilon;
}

function validarControl(nombre, { alpha, episodios, rng }) {
  validarAlpha(alpha, nombre);
  if (!Number.isInteger(episodios) || episodios < 0) {
    throw new Error(`${nombre}: episodios debe ser un entero ≥ 0; recibido: ${episodios}`);
  }
  if (!rng) throw new Error(`${nombre}: hace falta un rng de generador(semilla)`);
}

function validarAlpha(alpha, nombre) {
  if (!Number.isFinite(alpha)) {
    throw new Error(`${nombre}: alpha debe ser un número finito; recibido: ${alpha}`);
  }
}

/**
 * SARSA — bucle de entrenamiento completo, ecuación (6.7).
 *
 * OJO: `sarsaEpisodio` es otra función (la actualización de un episodio ya
 * muestreado). Aquí se muestrea y se aprende a la vez, que es lo que necesita
 * el módulo 3.
 *
 * El orden es el del libro y hay que implementarlo tal cual: A' se elige ANTES
 * de la actualización y se USA en ella; después A ← A'. Escrito de otra forma
 * el algoritmo sigue «funcionando» pero deja de ser SARSA.
 *
 * @param {object} entorno Entorno simulable con acciones.
 * @param {object} opciones
 * @param {number} opciones.alpha Paso de aprendizaje (sin valor por omisión: en
 *   el acantilado es una elección de la página, no del libro).
 * @param {number} opciones.epsilon Tasa de exploración.
 * @param {number} opciones.episodios Episodios de entrenamiento.
 * @param {object} opciones.rng Generador de `generador(semilla)`.
 * @param {number} opciones.gamma Descuento.
 * @param {number} opciones.maxPasos Tope de pasos por episodio.
 * @param {Function|null} opciones.decaeEpsilon `(k) => número`, con k desde 1.
 * @returns {{Q: Array<number[]>, sumas: number[], pasos: number[], acciones0: number[], cortados: number}}
 */
export function sarsa(entorno, {
  alpha, epsilon, episodios, rng, gamma = 1, maxPasos = 2000, decaeEpsilon = null,
} = {}) {
  validarControl("sarsa", { alpha, episodios, rng });
  const Q = tablaQ(entorno);
  const sumas = [];
  const pasos = [];
  const acciones0 = [];
  let cortados = 0;

  for (let k = 1; k <= episodios; k++) {
    const eps = epsilonDe(epsilon, decaeEpsilon, k);
    let s = entorno.inicio(rng);
    let a = politicaEpsilonGreedy(Q, s, eps, rng, entorno.nAcciones(s));
    acciones0.push(a);
    let suma = 0;
    let t = 0;
    let terminado = false;

    for (; t < maxPasos && !terminado; t++) {
      const { s2, r, fin } = entorno.paso(s, a, rng);
      suma += r;
      if (fin) {
        Q[s][a] += alpha * (r - Q[s][a]); // Q(terminal, ·) = 0
        terminado = true;
        continue;
      }
      const a2 = politicaEpsilonGreedy(Q, s2, eps, rng, entorno.nAcciones(s2)); // A' primero
      Q[s][a] += alpha * (r + gamma * Q[s2][a2] - Q[s][a]);
      s = s2;
      a = a2;
    }

    if (!terminado) cortados++;
    sumas.push(suma);
    pasos.push(t);
  }
  return { Q, sumas, pasos, acciones0, cortados };
}

/**
 * Esqueleto común de Q-learning y Expected SARSA: los dos actualizan PRIMERO y
 * eligen la acción del paso siguiente DESPUÉS. Solo cambia el valor con el que
 * se hace bootstrapping desde S'.
 */
function controlConObjetivo(nombre, entorno, opciones, valorDeSiguiente) {
  const {
    alpha, epsilon, episodios, rng, gamma = 1, maxPasos = 2000, decaeEpsilon = null,
  } = opciones;
  validarControl(nombre, { alpha, episodios, rng });

  const Q = tablaQ(entorno);
  const sumas = [];
  const pasos = [];
  const acciones0 = [];
  let cortados = 0;

  for (let k = 1; k <= episodios; k++) {
    const eps = epsilonDe(epsilon, decaeEpsilon, k);
    let s = entorno.inicio(rng);
    let suma = 0;
    let t = 0;
    let terminado = false;

    for (; t < maxPasos && !terminado; t++) {
      const a = politicaEpsilonGreedy(Q, s, eps, rng, entorno.nAcciones(s));
      if (t === 0) acciones0.push(a);
      const { s2, r, fin } = entorno.paso(s, a, rng);
      suma += r;
      /* Se actualiza PRIMERO y la acción del paso siguiente se elige DESPUÉS:
         es lo que distingue a estos dos algoritmos de SARSA. */
      const objetivo = r + (fin ? 0 : gamma * valorDeSiguiente(Q, s2, eps));
      Q[s][a] += alpha * (objetivo - Q[s][a]);
      s = s2;
      terminado = fin;
    }

    if (!terminado) cortados++;
    sumas.push(suma);
    pasos.push(t);
  }
  return { Q, sumas, pasos, acciones0, cortados };
}

/**
 * Q-learning — bucle de entrenamiento, ecuación (6.8).
 *
 * El γ va FUERA del max: `r + γ max_a Q(s',a)`. La diapositiva 4_Tema4#slide-34
 * lo escribe una vez dentro del max (correcto porque γ ≥ 0, pero no estándar) y
 * dos líneas después fuera; aquí se escribe siempre en la forma estándar.
 *
 * @param {object} entorno Entorno simulable con acciones.
 * @param {object} opciones Los mismos que `sarsa`.
 * @returns {{Q: Array<number[]>, sumas: number[], pasos: number[], acciones0: number[], cortados: number}}
 */
export function qLearning(entorno, opciones = {}) {
  return controlConObjetivo("qLearning", entorno, opciones, (Q, s2) => Math.max(...Q[s2]));
}

/** E_π[Q(s,·)] bajo la política ε-greedy, repartiendo 1−ε entre las maximizadoras. */
function valorEsperadoEpsilonGreedy(fila, epsilon) {
  const n = fila.length;
  if (n === 0) return 0;
  const mejor = Math.max(...fila);
  const ganadoras = fila.filter((q) => q >= mejor - EPS_EMPATE).length;
  let esperanza = 0;
  for (const q of fila) {
    const p = epsilon / n + (q >= mejor - EPS_EMPATE ? (1 - epsilon) / ganadoras : 0);
    esperanza += p * q;
  }
  return esperanza;
}

/**
 * Expected SARSA — ecuación (6.9).
 *
 * Se mueve de forma determinista en la misma dirección en la que SARSA se mueve
 * en esperanza: elimina la varianza que introduce el sorteo de A_{t+1}. Aquí se
 * usa DENTRO de política (la esperanza se toma bajo la misma ε-greedy que se
 * está ejecutando), que es como lo usa el libro en el acantilado; con π greedy
 * y comportamiento exploratorio sería exactamente Q-learning.
 *
 * @param {object} entorno Entorno simulable con acciones.
 * @param {object} opciones Los mismos que `sarsa`.
 * @returns {{Q: Array<number[]>, sumas: number[], pasos: number[], acciones0: number[], cortados: number}}
 */
export function expectedSarsa(entorno, opciones = {}) {
  return controlConObjetivo(
    "expectedSarsa",
    entorno,
    opciones,
    (Q, s2, eps) => valorEsperadoEpsilonGreedy(Q[s2], eps),
  );
}

/**
 * Q-learning doble — ecuación (6.10).
 *
 * El comportamiento es ε-greedy sobre Q1 + Q2; una moneda de 0,5 decide QUÉ
 * TABLA se actualiza, y la tabla que se actualiza es la que aporta el argmax
 * mientras la otra aporta el valor. Ese cruce es todo el truco: el error que
 * hizo que una acción pareciera la mejor no se copia en su valor.
 *
 * @param {object} entorno Entorno simulable con acciones.
 * @param {object} opciones
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} opciones.epsilon Tasa de exploración.
 * @param {number} opciones.episodios Episodios de entrenamiento.
 * @param {object} opciones.rng Generador de `generador(semilla)`.
 * @param {number} opciones.gamma Descuento.
 * @param {number} opciones.maxPasos Tope de pasos por episodio.
 * @returns {{Q1: Array<number[]>, Q2: Array<number[]>, sumas: number[], pasos: number[], acciones0: number[], cortados: number}}
 */
export function qLearningDoble(entorno, {
  alpha, epsilon, episodios, rng, gamma = 1, maxPasos = 2000,
} = {}) {
  validarControl("qLearningDoble", { alpha, episodios, rng });
  const Q1 = tablaQ(entorno);
  const Q2 = tablaQ(entorno);
  const suma12 = (s) => Q1[s].map((q, a) => q + Q2[s][a]);

  const sumas = [];
  const pasos = [];
  const acciones0 = [];
  let cortados = 0;

  for (let k = 0; k < episodios; k++) {
    let s = entorno.inicio(rng);
    let suma = 0;
    let t = 0;
    let terminado = false;

    for (; t < maxPasos && !terminado; t++) {
      /* La selección ε-greedy va sobre Q1 + Q2, no sobre una de las dos. */
      const a = politicaEpsilonGreedy([suma12(s)], 0, epsilon, rng, entorno.nAcciones(s));
      if (t === 0) acciones0.push(a);
      const { s2, r, fin } = entorno.paso(s, a, rng);
      suma += r;

      const actualizaQ1 = rng.uniforme() < 0.5;
      const QA = actualizaQ1 ? Q1 : Q2; // la que se actualiza y elige el argmax
      const QB = actualizaQ1 ? Q2 : Q1; // la que evalúa
      const objetivo = r + (fin ? 0 : gamma * QB[s2][argmax(QA[s2], rng)]);
      QA[s][a] += alpha * (objetivo - QA[s][a]);

      s = s2;
      terminado = fin;
    }

    if (!terminado) cortados++;
    sumas.push(suma);
    pasos.push(t);
  }
  return { Q1, Q2, sumas, pasos, acciones0, cortados };
}

/**
 * Política greedy respecto de Q, con desempate DETERMINISTA.
 *
 * Aquí el desempate no es al azar a propósito: es una política que se PINTA,
 * no una que se ejecuta durante el aprendizaje, y el dibujo tiene que ser
 * reproducible.
 *
 * @param {Array<number[]>} Q Tabla de valores de acción.
 * @param {object} opciones
 * @param {string} opciones.desempate "primero" = el índice menor.
 * @returns {Array<number|null>} Una acción por estado; `null` si no tiene acciones.
 * @throws {Error} Si el modo de desempate es desconocido.
 */
export function politicaGreedyDe(Q, { desempate = "primero" } = {}) {
  if (desempate !== "primero") {
    throw new Error(`politicaGreedyDe: modo de desempate desconocido: ${desempate}`);
  }
  return Q.map((fila) => {
    if (fila.length === 0) return null;
    let mejor = 0;
    for (let a = 1; a < fila.length; a++) if (fila[a] > fila[mejor] + EPS_EMPATE) mejor = a;
    return mejor;
  });
}

/**
 * rng que se niega a funcionar: `seguirPolitica` solo tiene sentido en entornos
 * deterministas, y si el entorno intenta sortear algo hay que enterarse.
 */
const RNG_INERTE = new Proxy({}, {
  get() {
    return () => {
      throw new Error("seguirPolitica: el entorno consume azar; solo admite entornos deterministas");
    };
  },
});

/**
 * Sigue una política determinista desde el estado inicial del entorno.
 *
 * En un entorno determinista con política determinista, volver a pisar un
 * estado ya visitado significa ciclo infinito: se detecta así y se corta. Es
 * lo que pasa de verdad con la política greedy de SARSA en unas 6 de cada 50
 * ejecuciones del acantilado; no es un fallo del código.
 *
 * @param {object} entorno Entorno simulable DETERMINISTA.
 * @param {Array<number|null>} politica Una acción por estado.
 * @param {object} opciones
 * @param {number} opciones.maxPasos Tope de pasos.
 * @returns {{pasos: number, retorno: number, llega: boolean, camino: number[], ciclo: boolean}}
 */
export function seguirPolitica(entorno, politica, { maxPasos = 200 } = {}) {
  let s = entorno.inicio(RNG_INERTE);
  const camino = [s];
  const visitados = new Set([s]);
  let retorno = 0;
  let pasos = 0;
  let llega = false;
  let ciclo = false;

  while (pasos < maxPasos) {
    const a = politica[s];
    if (a === null || a === undefined) break;
    const { s2, r, fin } = entorno.paso(s, a, RNG_INERTE);
    retorno += r;
    pasos++;
    camino.push(s2);
    s = s2;
    if (fin) {
      llega = true;
      break;
    }
    if (visitados.has(s)) {
      ciclo = true;
      break;
    }
    visitados.add(s);
  }

  return { pasos, retorno, llega, camino, ciclo };
}

/**
 * Promedia varias ejecuciones independientes elemento a elemento.
 *
 * Es el ÚNICO sitio donde se promedia. La ejecución i usa `generador(semilla + i)`.
 *
 * @param {Function} fn `fn(rng, i)` → array de números (una serie por ejecución).
 * @param {object} opciones
 * @param {number} opciones.ejecuciones Número de ejecuciones.
 * @param {number} opciones.semilla Semilla base.
 * @returns {{media: number[], ejecuciones: number}}
 * @throws {Error} Si las series no tienen todas la misma longitud.
 */
export function promediarEjecuciones(fn, { ejecuciones, semilla } = {}) {
  if (!Number.isInteger(ejecuciones) || ejecuciones < 1) {
    throw new Error(`promediarEjecuciones: ejecuciones debe ser un entero ≥ 1; recibido: ${ejecuciones}`);
  }
  let media = null;
  for (let i = 0; i < ejecuciones; i++) {
    const serie = fn(generador(semilla + i), i);
    if (media === null) media = new Array(serie.length).fill(0);
    if (serie.length !== media.length) {
      throw new Error("promediarEjecuciones: las series no tienen la misma longitud");
    }
    for (let j = 0; j < serie.length; j++) media[j] += serie[j] / ejecuciones;
  }
  return { media, ejecuciones };
}

/**
 * Media móvil de ventana centrada, recortada en los extremos.
 *
 * @param {number[]} serie Serie de entrada.
 * @param {number} ventana Tamaño de la ventana.
 * @returns {number[]} Serie suavizada, de la misma longitud.
 * @throws {Error} Si la ventana no es un entero ≥ 1.
 */
export function mediaMovil(serie, ventana) {
  if (!Number.isInteger(ventana) || ventana < 1) {
    throw new Error(`mediaMovil: ventana debe ser un entero ≥ 1; recibido: ${ventana}`);
  }
  const radio = Math.floor(ventana / 2);
  return serie.map((_, i) => {
    const desde = Math.max(0, i - radio);
    const hasta = Math.min(serie.length - 1, i + radio);
    let suma = 0;
    for (let j = desde; j <= hasta; j++) suma += serie[j];
    return suma / (hasta - desde + 1);
  });
}

/* ----------------------------------------------------------------------- *
 * 6. Sesgo de maximización  (módulo 4)
 * ----------------------------------------------------------------------- */

/**
 * E[max de n muestras de N(media, sigma²)], por Monte Carlo sembrado.
 *
 * Es el sesgo aislado: las n acciones valen todas `media`, pero el máximo de
 * sus estimaciones ruidosas es mayor, y crece con n. El ancla de los tests es
 * el valor analítico de n = 2: media + sigma/√π.
 *
 * @param {object} opciones
 * @param {number} opciones.n Número de estimaciones sobre las que se maximiza.
 * @param {number} opciones.sigma Desviación típica del ruido.
 * @param {number} opciones.media Valor verdadero común.
 * @param {number} opciones.muestras Réplicas de Monte Carlo.
 * @param {object} opciones.rng Generador de `generador(semilla)`.
 * @returns {number} Estimación de la esperanza del máximo.
 * @throws {Error} Si `n`, `sigma`, `muestras` o `rng` no son válidos.
 */
export function esperanzaDelMaximo({ n, sigma, media = -0.1, muestras = 20000, rng } = {}) {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`esperanzaDelMaximo: n debe ser un entero ≥ 1; recibido: ${n}`);
  }
  if (!(sigma > 0)) {
    throw new Error(`esperanzaDelMaximo: sigma debe ser > 0; recibido: ${sigma}`);
  }
  if (!Number.isInteger(muestras) || muestras < 1) {
    throw new Error(`esperanzaDelMaximo: muestras debe ser un entero ≥ 1; recibido: ${muestras}`);
  }
  if (!rng) throw new Error("esperanzaDelMaximo: hace falta un rng de generador(semilla)");

  let suma = 0;
  for (let m = 0; m < muestras; m++) {
    let mejor = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = rng.normal(media, sigma);
      if (x > mejor) mejor = x;
    }
    suma += mejor;
  }
  return suma / muestras;
}
