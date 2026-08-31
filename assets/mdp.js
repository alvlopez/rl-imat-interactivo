/* ==========================================================================
   RL · IMAT — motor de MDP finitos (Tema 2)
   Sin dependencias. Módulo ES: se usa igual desde el navegador y desde node.

   Reproduce las dos rejillas del Tema 2:
     · rejilla3x3()        → Tema2_MDP#slide-8 y #slide-9
     · rejillaNavegacion() → Tema2_MDP#slide-17 y #slide-18
   ========================================================================== */

/* ----------------------------------------------------------------------- *
 * 1. Estructura de un MDP finito
 * ----------------------------------------------------------------------- */

/**
 * Un MDP se representa con la tabla de dinámica ya calculada:
 *   P[s][a] = [{ s2, r, p }, ...]   con  Σ p = 1
 * que es exactamente p(s',r|s,a) de Tema2_MDP#slide-6.
 */
export function crearMDP({ nombre, nEstados, acciones, etiquetas, terminales, P, geometria = null }) {
  return {
    nombre,
    nEstados,
    acciones,
    nAcciones: acciones.length,
    etiquetas,
    terminales: new Set(terminales),
    P,
    geometria,
    esTerminal(s) {
      return this.terminales.has(s);
    },
    /** Recompensa esperada de (s, a): Σ_{s',r} p(s',r|s,a) · r */
    recompensaEsperada(s, a) {
      return P[s][a].reduce((suma, t) => suma + t.p * t.r, 0);
    },
  };
}

/** Une transiciones que coinciden en (s', r) para que las probabilidades sumen bien. */
function combinar(transiciones) {
  const mapa = new Map();
  for (const t of transiciones) {
    if (t.p <= 0) continue;
    const clave = `${t.s2}|${t.r}`;
    const previo = mapa.get(clave);
    if (previo) previo.p += t.p;
    else mapa.set(clave, { s2: t.s2, r: t.r, p: t.p });
  }
  return [...mapa.values()].sort((a, b) => a.s2 - b.s2 || a.r - b.r);
}

/* ----------------------------------------------------------------------- *
 * 2. Rejilla 3x3 — Tema2_MDP#slide-8
 *
 *      1  2  3
 *      4  5  6
 *      7  8  T
 *
 *   R = -1 en toda transición · si salgo del tablero me quedo en el mismo
 *   estado · T es terminal.
 * ----------------------------------------------------------------------- */

export const ACCIONES_3X3 = ["arriba", "abajo", "izq", "dch"];

const DELTA_3X3 = {
  arriba: [-1, 0],
  abajo: [1, 0],
  izq: [0, -1],
  dch: [0, 1],
};

export function rejilla3x3() {
  const LADO = 3;
  const nEstados = 9;
  const TERMINAL = 8; // la celda "T", abajo a la derecha
  const etiquetas = ["1", "2", "3", "4", "5", "6", "7", "8", "T"];

  const fila = (s) => Math.floor(s / LADO);
  const col = (s) => s % LADO;

  const P = [];
  for (let s = 0; s < nEstados; s++) {
    P[s] = [];
    for (let a = 0; a < ACCIONES_3X3.length; a++) {
      if (s === TERMINAL) {
        P[s][a] = [];
        continue;
      }
      const [df, dc] = DELTA_3X3[ACCIONES_3X3[a]];
      const f = fila(s) + df;
      const c = col(s) + dc;
      const dentro = f >= 0 && f < LADO && c >= 0 && c < LADO;
      const s2 = dentro ? f * LADO + c : s; // rebote: me quedo donde estaba
      P[s][a] = combinar([{ s2, r: -1, p: 1 }]);
    }
  }

  return crearMDP({
    nombre: "Rejilla 3×3",
    nEstados,
    acciones: ACCIONES_3X3,
    etiquetas,
    terminales: [TERMINAL],
    P,
    geometria: {
      filas: LADO,
      columnas: LADO,
      posicion: (s) => ({ fila: fila(s), col: col(s) }),
      terminal: TERMINAL,
    },
  });
}

/* ----------------------------------------------------------------------- *
 * 3. Rejilla de navegación 4x4 — Tema2_MDP#slide-17
 *
 *       1   2   3*  4*        * viento (celdas 3 y 4)
 *       5   6   7   8·        · remolino (celda 8), R = -5 al entrar
 *       9  10*  11  12
 *      13  14*  15  16   T
 *
 *   Acciones {N, S, O, E} · R = -1 en general · rebote en el contorno.
 *
 *   SENTIDO DEL VIENTO — el enunciado dice "Viento Este" y "Viento Sur" sin
 *   precisar si el viento va hacia ese punto cardinal o viene de él. Lo fija
 *   la trayectoria T1 del Problema 3 de `Teoria/Problemas/Problemas.pdf`:
 *
 *       T1: (5,up), (1,right), (2,right), (3,right), (3,down), ...
 *                                          └─ desde 3 va al este y NO se mueve
 *
 *   La celda 4 existe, así que no es un rebote: solo puede ser la regla
 *   "en dirección opuesta al viento → 0.25 de no moverse". Por tanto el
 *   viento Este *procede* del este y sopla hacia el oeste (convención
 *   meteorológica). Igualmente, el viento Sur sopla hacia el norte.
 *   Se deja configurable por si el profesor prefiere el otro criterio.
 * ----------------------------------------------------------------------- */

export const ACCIONES_NAV = ["N", "S", "O", "E"];

const DELTA_NAV = { N: [-1, 0], S: [1, 0], O: [0, -1], E: [0, 1] };
const OPUESTA = { N: "S", S: "N", O: "E", E: "O" };

/** Celdas con viento, en etiquetas 1..16 tal y como aparecen en la diapositiva. */
export const CELDAS_VIENTO_ESTE = [3, 4];
export const CELDAS_VIENTO_SUR = [10, 14];
export const CELDA_REMOLINO = 8;
export const RECOMPENSA_REMOLINO = -5;

export function rejillaNavegacion({ vientoProcedente = true } = {}) {
  const FILAS = 4;
  const COLS = 4;
  const nCeldas = FILAS * COLS; // 16
  const TERMINAL = nCeldas; // índice 16 → la celda "T"
  const nEstados = nCeldas + 1;

  const etiquetas = [];
  for (let i = 1; i <= nCeldas; i++) etiquetas.push(String(i));
  etiquetas.push("T");

  const posicion = (s) =>
    s === TERMINAL
      ? { fila: FILAS - 1, col: COLS } // T va suelta a la derecha de la 16
      : { fila: Math.floor(s / COLS), col: s % COLS };

  const indiceDe = (fila, col) => {
    if (fila === FILAS - 1 && col === COLS) return TERMINAL;
    if (fila < 0 || fila >= FILAS || col < 0 || col >= COLS) return null;
    return fila * COLS + col;
  };

  /* Dirección HACIA LA QUE sopla el viento en cada celda con viento. */
  const sopla = new Map();
  const haciaEste = vientoProcedente ? "O" : "E";
  const haciaSur = vientoProcedente ? "N" : "S";
  CELDAS_VIENTO_ESTE.forEach((etiqueta) => sopla.set(etiqueta - 1, haciaEste));
  CELDAS_VIENTO_SUR.forEach((etiqueta) => sopla.set(etiqueta - 1, haciaSur));

  const iRemolino = CELDA_REMOLINO - 1;

  /** Un paso en la dirección dada, con rebote si se sale del mundo. */
  const paso = (s, dir) => {
    if (s === TERMINAL) return s;
    const { fila, col } = posicion(s);
    const [df, dc] = DELTA_NAV[dir];
    const destino = indiceDe(fila + df, col + dc);
    return destino === null ? s : destino;
  };

  /** Dos pasos seguidos: el segundo también rebota si toca el contorno. */
  const dobleP = (s, dir) => {
    const intermedio = paso(s, dir);
    return intermedio === TERMINAL ? TERMINAL : paso(intermedio, dir);
  };

  const recompensaDe = (s2) => (s2 === iRemolino ? RECOMPENSA_REMOLINO : -1);

  const P = [];
  for (let s = 0; s < nEstados; s++) {
    P[s] = [];
    for (let a = 0; a < ACCIONES_NAV.length; a++) {
      if (s === TERMINAL) {
        P[s][a] = [];
        continue;
      }
      const dir = ACCIONES_NAV[a];
      const viento = sopla.get(s) || null;
      let crudas;
      if (viento && viento === dir) {
        // a favor del viento: 0.25 de avanzar dos celdas
        crudas = [
          { s2: paso(s, dir), p: 0.75 },
          { s2: dobleP(s, dir), p: 0.25 },
        ];
      } else if (viento && OPUESTA[viento] === dir) {
        // contra el viento: 0.25 de no moverse
        crudas = [
          { s2: paso(s, dir), p: 0.75 },
          { s2: s, p: 0.25 },
        ];
      } else {
        crudas = [{ s2: paso(s, dir), p: 1 }];
      }
      P[s][a] = combinar(crudas.map((t) => ({ ...t, r: recompensaDe(t.s2) })));
    }
  }

  return crearMDP({
    nombre: "Navegación 4×4 con viento",
    nEstados,
    acciones: ACCIONES_NAV,
    etiquetas,
    terminales: [TERMINAL],
    P,
    geometria: {
      filas: FILAS,
      columnas: COLS + 1,
      posicion,
      terminal: TERMINAL,
      remolino: iRemolino,
      vientoEste: CELDAS_VIENTO_ESTE.map((n) => n - 1),
      vientoSur: CELDAS_VIENTO_SUR.map((n) => n - 1),
      soplaHacia: (s) => sopla.get(s) || null,
      vientoProcedente,
    },
  });
}

/* ----------------------------------------------------------------------- *
 * 4. Políticas
 * ----------------------------------------------------------------------- */

/** π(a|s) = 1/|A| para todo s. Es la política de referencia del tema. */
export function politicaEquiprobable(mdp) {
  const pi = [];
  for (let s = 0; s < mdp.nEstados; s++) {
    pi[s] = new Array(mdp.nAcciones).fill(1 / mdp.nAcciones);
  }
  return pi;
}

/** Política determinista a partir de una acción por estado. */
export function politicaDeterminista(mdp, accionDe) {
  const pi = [];
  for (let s = 0; s < mdp.nEstados; s++) {
    pi[s] = new Array(mdp.nAcciones).fill(0);
    const a = accionDe(s);
    if (a !== null && a !== undefined) pi[s][a] = 1;
    else pi[s].fill(1 / mdp.nAcciones);
  }
  return pi;
}

/** Normaliza las probabilidades de un estado para que sumen 1. */
export function normalizar(fila) {
  const suma = fila.reduce((a, b) => a + b, 0);
  if (suma <= 0) return fila.map(() => 1 / fila.length);
  return fila.map((x) => x / suma);
}

/* ----------------------------------------------------------------------- *
 * 5. Evaluación de política — las ecuaciones de Bellman
 * ----------------------------------------------------------------------- */

/**
 * Resuelve las ecuaciones de Bellman como sistema lineal (Tema2_MDP#slide-15):
 *   v = r_π + γ P_π v   →   (I − γ P_π) v = r_π
 * Devuelve null si el sistema es singular (p. ej. γ = 1 con una política que
 * nunca alcanza el terminal): ese caso también es informativo.
 */
export function evaluarLineal(mdp, pi, gamma) {
  const n = mdp.nEstados;
  const A = [];
  const b = new Array(n).fill(0);

  for (let s = 0; s < n; s++) {
    A[s] = new Array(n).fill(0);
    A[s][s] = 1;
    if (mdp.esTerminal(s)) continue; // v(T) = 0 siempre
    for (let a = 0; a < mdp.nAcciones; a++) {
      const prob = pi[s][a];
      if (prob <= 0) continue;
      for (const t of mdp.P[s][a]) {
        A[s][t.s2] -= gamma * prob * t.p;
        b[s] += prob * t.p * t.r;
      }
    }
  }
  return resolverSistema(A, b);
}

/** Eliminación gaussiana con pivoteo parcial. Devuelve null si es singular. */
export function resolverSistema(A, b) {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]]);

  for (let col = 0; col < n; col++) {
    let mejor = col;
    for (let f = col + 1; f < n; f++) {
      if (Math.abs(M[f][col]) > Math.abs(M[mejor][col])) mejor = f;
    }
    if (Math.abs(M[mejor][col]) < 1e-12) return null; // singular
    [M[col], M[mejor]] = [M[mejor], M[col]];

    const pivote = M[col][col];
    for (let f = col + 1; f < n; f++) {
      const factor = M[f][col] / pivote;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[f][c] -= factor * M[col][c];
    }
  }

  const x = new Array(n).fill(0);
  for (let f = n - 1; f >= 0; f--) {
    let suma = M[f][n];
    for (let c = f + 1; c < n; c++) suma -= M[f][c] * x[c];
    x[f] = suma / M[f][f];
  }
  return x;
}

/**
 * Evaluación iterativa de la política: barridos síncronos.
 * Guarda el historial completo para poder enseñarlos uno a uno en clase.
 */
export function evaluarIterativa(mdp, pi, gamma, { tolerancia = 1e-8, maxBarridos = 2000 } = {}) {
  let v = new Array(mdp.nEstados).fill(0);
  const historial = [v.slice()];
  let barridos = 0;
  let delta = Infinity;

  while (delta > tolerancia && barridos < maxBarridos) {
    const nuevo = new Array(mdp.nEstados).fill(0);
    delta = 0;
    for (let s = 0; s < mdp.nEstados; s++) {
      if (mdp.esTerminal(s)) continue;
      let acumulado = 0;
      for (let a = 0; a < mdp.nAcciones; a++) {
        const prob = pi[s][a];
        if (prob <= 0) continue;
        for (const t of mdp.P[s][a]) {
          acumulado += prob * t.p * (t.r + gamma * v[t.s2]);
        }
      }
      nuevo[s] = acumulado;
      delta = Math.max(delta, Math.abs(nuevo[s] - v[s]));
    }
    v = nuevo;
    historial.push(v.slice());
    barridos++;
  }
  return { v, historial, barridos, convergido: delta <= tolerancia };
}

/** q_π(s,a) = Σ p(s',r|s,a) [ r + γ v_π(s') ] — Tema2_MDP#slide-14 */
export function qDeV(mdp, v, gamma) {
  const q = [];
  for (let s = 0; s < mdp.nEstados; s++) {
    q[s] = new Array(mdp.nAcciones).fill(0);
    if (mdp.esTerminal(s)) continue;
    for (let a = 0; a < mdp.nAcciones; a++) {
      q[s][a] = mdp.P[s][a].reduce((suma, t) => suma + t.p * (t.r + gamma * v[t.s2]), 0);
    }
  }
  return q;
}

/* ----------------------------------------------------------------------- *
 * 6. Optimalidad — Tema2_MDP#slide-19 a #slide-21
 * ----------------------------------------------------------------------- */

/** Iteración de valor: v_*(s) = max_a Σ p(s',r|s,a)[r + γ v_*(s')] */
export function iteracionValor(mdp, gamma, { tolerancia = 1e-10, maxBarridos = 5000 } = {}) {
  let v = new Array(mdp.nEstados).fill(0);
  const historial = [v.slice()];
  let barridos = 0;
  let delta = Infinity;

  while (delta > tolerancia && barridos < maxBarridos) {
    const nuevo = new Array(mdp.nEstados).fill(0);
    delta = 0;
    for (let s = 0; s < mdp.nEstados; s++) {
      if (mdp.esTerminal(s)) continue;
      let mejor = -Infinity;
      for (let a = 0; a < mdp.nAcciones; a++) {
        const valor = mdp.P[s][a].reduce((suma, t) => suma + t.p * (t.r + gamma * v[t.s2]), 0);
        if (valor > mejor) mejor = valor;
      }
      nuevo[s] = mejor;
      delta = Math.max(delta, Math.abs(nuevo[s] - v[s]));
    }
    v = nuevo;
    historial.push(v.slice());
    barridos++;
  }
  return { v, historial, barridos, convergido: delta <= tolerancia };
}

/**
 * Política greedy respecto de q. Devuelve TODOS los empates por estado:
 * es la respuesta a "¿puede haber varias políticas óptimas?" (#slide-19).
 */
export function politicaGreedy(mdp, q, tolerancia = 1e-9) {
  const politica = [];
  for (let s = 0; s < mdp.nEstados; s++) {
    if (mdp.esTerminal(s)) {
      politica[s] = [];
      continue;
    }
    const mejor = Math.max(...q[s]);
    politica[s] = q[s]
      .map((valor, a) => (valor >= mejor - tolerancia ? a : -1))
      .filter((a) => a >= 0);
  }
  return politica;
}

/** Cuenta cuántas políticas deterministas óptimas distintas hay. */
export function numeroPoliticasOptimas(politicaConEmpates) {
  return politicaConEmpates.reduce(
    (producto, acciones) => producto * (acciones.length || 1),
    1,
  );
}

/** ¿Satisface v la ecuación de optimalidad de Bellman? (comprobación de los tests) */
export function residuoOptimalidad(mdp, v, gamma) {
  let peor = 0;
  for (let s = 0; s < mdp.nEstados; s++) {
    if (mdp.esTerminal(s)) {
      peor = Math.max(peor, Math.abs(v[s]));
      continue;
    }
    let mejor = -Infinity;
    for (let a = 0; a < mdp.nAcciones; a++) {
      const valor = mdp.P[s][a].reduce((suma, t) => suma + t.p * (t.r + gamma * v[t.s2]), 0);
      if (valor > mejor) mejor = valor;
    }
    peor = Math.max(peor, Math.abs(mejor - v[s]));
  }
  return peor;
}

/* ----------------------------------------------------------------------- *
 * 7. Diagramas de backup — Tema2_MDP#slide-16 a #slide-18
 * ----------------------------------------------------------------------- */

/**
 * Ramas del diagrama de backup de un estado, listas para dibujar.
 * Para el estado 1 de la rejilla de navegación devuelve exactamente el árbol
 * de #slide-18: N→1, S→5, O→1, E→2, todos con r = −1.
 */
export function ramasBackup(mdp, s) {
  if (mdp.esTerminal(s)) return [];
  return mdp.acciones.map((nombre, a) => ({
    accion: nombre,
    nodos: mdp.P[s][a].map((t) => ({
      estado: mdp.etiquetas[t.s2],
      indice: t.s2,
      recompensa: t.r,
      probabilidad: t.p,
    })),
  }));
}

/** ¿De qué estados necesito el valor para actualizar v(s)? (pregunta típica de examen) */
export function estadosSucesores(mdp, s) {
  const conjunto = new Set();
  for (let a = 0; a < mdp.nAcciones; a++) {
    for (const t of mdp.P[s][a]) conjunto.add(t.s2);
  }
  return [...conjunto].sort((x, y) => x - y);
}

/* ----------------------------------------------------------------------- *
 * 8. Simulación de episodios y retorno — Tema2_MDP#slide-10
 * ----------------------------------------------------------------------- */

/**
 * Genera una trayectoria siguiendo π desde s0.
 * Devuelve los pasos {s, a, r, s2} y el retorno descontado de cada instante.
 */
export function simularEpisodio(mdp, pi, s0, rng, { maxPasos = 200 } = {}) {
  const pasos = [];
  let s = s0;
  for (let k = 0; k < maxPasos && !mdp.esTerminal(s); k++) {
    const a = rng.categorica(pi[s]);
    const transiciones = mdp.P[s][a];
    const t = transiciones[rng.categorica(transiciones.map((x) => x.p))];
    pasos.push({ s, a, r: t.r, s2: t.s2 });
    s = t.s2;
  }
  return { pasos, terminado: mdp.esTerminal(s), estadoFinal: s };
}

/**
 * G_t para cada instante de una lista de recompensas.
 * G_t = R_{t+1} + γ R_{t+2} + ... (Tema2_MDP#slide-10)
 */
export function retornos(recompensas, gamma) {
  const g = new Array(recompensas.length).fill(0);
  let acumulado = 0;
  for (let t = recompensas.length - 1; t >= 0; t--) {
    acumulado = recompensas[t] + gamma * acumulado;
    g[t] = acumulado;
  }
  return g;
}

/* ----------------------------------------------------------------------- *
 * 9. Consultas sobre la dinámica — Tema2_MDP#slide-8
 * ----------------------------------------------------------------------- */

/** p(s', r | s, a) tal cual lo preguntan las diapositivas. */
export function probabilidad(mdp, s2, r, s, a) {
  if (mdp.esTerminal(s)) return 0;
  const encontrada = mdp.P[s][a].find((t) => t.s2 === s2 && t.r === r);
  return encontrada ? encontrada.p : 0;
}

/** Número total de transiciones (s,a) del MDP: el "cubo" de #slide-9. */
export function cuentaTransiciones(mdp) {
  let pares = 0;
  let ramas = 0;
  for (let s = 0; s < mdp.nEstados; s++) {
    if (mdp.esTerminal(s)) continue;
    pares += mdp.nAcciones;
    for (let a = 0; a < mdp.nAcciones; a++) ramas += mdp.P[s][a].length;
  }
  return { pares, ramas };
}
