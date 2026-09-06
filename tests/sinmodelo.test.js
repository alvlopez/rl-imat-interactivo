/* Tests del motor de RL sin modelo del Tema 4 (`assets/sinmodelo.js`).
 *
 * No comprueban «que el código no falle»: comprueban que el código REPRODUCE
 * el libro (Sutton & Barto §5 y §6) y el material de clase. Cada test lleva el
 * código de la aserción del guion (`Interactivo/T4_recurso/guion-tema4.md`, §8
 * de cada módulo y §C4) para poder rastrear del número al párrafo que lo
 * justifica.
 *
 *   cd Interactivo/web && npm test
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DOS CLASES DE TEST, y cada sección dice de cuál es
 *
 *   [C] CONTRASTE. No dependen del flujo aleatorio: equivalencias
 *       algebraicas, valores verdaderos, geometrías, valores analíticos.
 *       Tolerancia estricta (0, 1e-12 o 1e-9), y si falla uno hay un error de
 *       fondo, no una fluctuación.
 *
 *   [R] REPRODUCIBILIDAD. Promedios sobre ejecuciones sembradas. Tolerancia la
 *       que declare el guion; donde el guion no declara ninguna, se pone una
 *       razonable y se comenta por qué.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TRES ASERCIONES DEL GUION QUE SE ESCRIBEN CON EL VALOR DEL MOTOR
 *
 * El motor está bien y el guion arrastra números de una versión anterior. En
 * los tres casos el test lleva el valor del motor y un comentario:
 *
 *   M3-A7  ε decreciente: el guion dice SARSA −17,7 y «política larga en 39 de
 *          50»; el motor da −14,92 y 43 de 50.
 *   M3-A5  longitudes de la política greedy de SARSA: el guion dice 3 con 19
 *          pasos y 6 sin llegar; el motor da 2 con 19 y 7 sin llegar (los 41
 *          con 17 pasos sí coinciden).
 *   M4-A7  Q-learning doble: el guion dice «nunca pasa del 51 %»; el pico real
 *          es 52,5 %, así que la afirmación correcta es «no pasa del 53 %».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UNA ASERCIÓN DEL GUION QUE NO SE SOSTIENE  (errata del guion, no bug)
 *
 *   M3-A10 dice «ningún episodio alcanza los 2 000 pasos a partir del episodio
 *   50 con ε ≤ 0,2». Es falso: hay exactamente UNO en las seis campañas de 50
 *   ejecuciones × 500 episodios (SARSA, ε = 0,1, semilla 2064, episodio 491).
 *   Un paseo ε-greedy que supere los 2 000 pasos es perfectamente posible y el
 *   motor lo trata bien (lo cuenta en `cortados`); lo que hay que corregir es
 *   la redacción del guion. El test de abajo fija el hecho exacto para que
 *   cualquier cambio del motor que lo altere se note.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UNA DECISIÓN DEL IMPLEMENTADOR QUE ESTOS TESTS DOCUMENTAN
 *
 *   El α del modo por lotes. `prediccionPorLotes` trae α = 0,01 por omisión y
 *   su propia nota dice que con 100 episodios «α = 0,01 DIVERGE y α = 0,005
 *   converge». Con el método TD tampoco converge α = 0,005 (revienta con 87
 *   episodios) ni α = 0,004: el mayor que aguanta los 100 episodios del paseo
 *   es α = 0,002, que es el que usa el test de M2-A10. No es un fallo —el
 *   motor avisa con un error explícito en vez de devolver NaN— pero la nota
 *   del código se queda corta para TD.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  paseoAleatorio,
  cliffWalking,
  windyGridworld,
  VIENTO,
  mdpDosEstados,
  IZQUIERDA,
  DERECHA,
  rejilla3x3Permutada,
  muestrearEpisodio,
  loteEpisodios,
  tdCero,
  mcConstante,
  sarsaEpisodio,
  prediccionMC,
  prediccionTD,
  prediccionPorLotes,
  errorRMS,
  curvaRMS,
  EPISODIOS_PREDICTOR,
  resolverPredictor,
  politicaEpsilonGreedy,
  sarsa,
  qLearning,
  expectedSarsa,
  qLearningDoble,
  politicaGreedyDe,
  seguirPolitica,
  promediarEjecuciones,
  mediaMovil,
  esperanzaDelMaximo,
} from "../assets/sinmodelo.js";

import {
  ACCIONES_3X3,
  ACCIONES_NAV,
  rejilla3x3,
  politicaEquiprobable,
  evaluarLineal,
  qDeV,
  iteracionValor,
  politicaGreedy,
} from "../assets/mdp.js";

import { generador, argmax, argmaxTodos } from "../assets/nucleo.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

/* ===================================================================== *
 * Utilidades comunes
 * ===================================================================== */

const GAMMA = 1; // fijo en todo el Tema 4

/** Índice de acción de la rejilla 3×3 ("arriba", "abajo", "izq", "dch"). */
const acc3 = (nombre) => ACCIONES_3X3.indexOf(nombre);
/** Índice de acción de navegación ("N", "S", "O", "E"). */
const accNav = (nombre) => ACCIONES_NAV.indexOf(nombre);
/** Conjunto de acciones como cadena ordenada, para comparar sin ambigüedad. */
const nombres3 = (lista) => lista.map((a) => ACCIONES_3X3[a]).sort().join("|");

/** Comparación numérica con mensaje legible. */
function cerca(x, objetivo, tol, etiqueta) {
  assert.ok(
    Math.abs(x - objetivo) <= tol,
    `${etiqueta}: ${x}, se esperaba ${objetivo} (tolerancia ${tol})`,
  );
}

/** Comparación vectorial con mensaje legible. */
function cercaVector(v, esperado, tol, etiqueta) {
  assert.equal(v.length, esperado.length, `${etiqueta}: longitud`);
  esperado.forEach((x, i) => cerca(v[i], x, tol, `${etiqueta}[${i}]`));
}

/* ===================================================================== *
 * LOS ENTORNOS  [C]
 * Fuente: S&B Examples 6.2, 6.5, 6.6 y 6.7
 * ===================================================================== */

const paseo5 = paseoAleatorio();
const cliff = cliffWalking();
const windy = windyGridworld();

test("entorno: el paseo de 5 estados deja los dos terminales FUERA de [0, nEstados)", () => {
  /* Contrato del motor: `valoresVerdaderos` tiene exactamente un valor por
     estado no terminal, que es lo que exige el Example 6.2. Si los terminales
     ocupasen índice dentro del rango, el RMS se promediaría sobre 7 estados y
     no sobre 5. */
  assert.equal(paseo5.nEstados, 5);
  assert.equal(paseo5.estadoInicial, 2); // "C", el central
  assert.equal(paseo5.terminalIzquierda, 5);
  assert.equal(paseo5.terminalDerecha, 6);
  assert.deepEqual(paseo5.etiquetas, ["A", "B", "C", "D", "E"]);
  assert.equal(paseo5.valoresVerdaderos.length, 5);
  assert.equal(paseo5.nAcciones(0), 0, "es un proceso de recompensa: no hay decisiones");
  for (let s = 0; s < 5; s++) assert.equal(paseo5.esTerminal(s), false);
  assert.equal(paseo5.esTerminal(5), true);
  assert.equal(paseo5.esTerminal(6), true);
  // `vVerdadero` es un alias del MISMO array, no una copia (contrato del motor).
  assert.equal(paseo5.vVerdadero, paseo5.valoresVerdaderos);
});

test("M3-A1: Cliff Walking 4×12 con S=36, G=47, acantilado 37…46 y caída SIN terminar", () => {
  // Example 6.6, p. 154.
  assert.equal(cliff.nEstados, 48);
  assert.equal(cliff.geometria.filas, 4);
  assert.equal(cliff.geometria.columnas, 12);
  assert.equal(cliff.geometria.inicio, 36);
  assert.equal(cliff.geometria.meta, 47);
  assert.deepEqual(cliff.geometria.acantilado, [37, 38, 39, 40, 41, 42, 43, 44, 45, 46]);
  assert.equal(cliff.geometria.acantilado.length, 10);

  /* La comprobación que de verdad importa: caer al acantilado devuelve a S con
     r = −100 y `fin` FALSE. Es el error de implementación más frecuente de
     este entorno y cambia por completo las curvas del módulo 3. */
  const caida = cliff.paso(36, accNav("E"), null); // de S al acantilado
  assert.deepEqual(caida, { s2: 36, r: -100, fin: false });

  // r = −1 en toda transición que no sea una caída, y la meta sí termina.
  const paso = cliff.paso(36, accNav("N"), null);
  assert.deepEqual(paso, { s2: 24, r: -1, fin: false });
  const llegada = cliff.paso(35, accNav("S"), null); // (2,11) → G
  assert.deepEqual(llegada, { s2: 47, r: -1, fin: true });
  // Rebote contra el contorno: desde S hacia el oeste o hacia el sur no se mueve.
  assert.equal(cliff.paso(36, accNav("O"), null).s2, 36);
  assert.equal(cliff.paso(36, accNav("S"), null).s2, 36);
  assert.equal(cliff.esTerminal(47), true);
});

test("entorno: el camino mínimo del Windy Gridworld es de 15 pasos (Example 6.5)", () => {
  /* [C] Comprobación cruzada de la geometría Y de la fila de vientos: el libro
     declara 15 pasos de S a G, así que si `VIENTO` estuviera mal leído de la
     figura de la p. 152, esta anchura de camino cambiaría. Se calcula con una
     anchura primero (BFS) sobre la dinámica determinista del propio entorno,
     sin escribir el camino a mano. */
  assert.deepEqual(VIENTO, [0, 0, 0, 1, 1, 1, 2, 2, 1, 0]);
  assert.equal(windy.geometria.inicio, 30);
  assert.equal(windy.geometria.meta, 37);

  const distancia = new Array(windy.nEstados).fill(Infinity);
  distancia[windy.geometria.inicio] = 0;
  const cola = [windy.geometria.inicio];
  while (cola.length > 0) {
    const s = cola.shift();
    if (windy.esTerminal(s)) continue;
    for (let a = 0; a < windy.nAcciones(s); a++) {
      const { s2 } = windy.paso(s, a, null);
      if (distancia[s2] > distancia[s] + 1) {
        distancia[s2] = distancia[s] + 1;
        cola.push(s2);
      }
    }
  }
  assert.equal(distancia[windy.geometria.meta], 15);
});

test("M4-A1: el MDP de dos estados es el del Example 6.7 (A con 2 acciones, B con n_B)", () => {
  const mdp2 = mdpDosEstados({ nB: 10 });
  assert.equal(mdp2.nAcciones(0), 2); // A
  assert.equal(mdp2.nAcciones(1), 10); // B
  assert.equal(mdp2.nAcciones(2), 0); // terminal: Q(terminal, ·) = 0 siempre
  assert.equal(mdp2.media, -0.1);
  assert.equal(mdp2.sigma, 1);
  // Izquierda lleva a B con r = 0; derecha termina con r = 0.
  assert.deepEqual(mdp2.paso(0, IZQUIERDA, null), { s2: 1, r: 0, fin: false });
  assert.deepEqual(mdp2.paso(0, DERECHA, null), { s2: 2, r: 0, fin: true });
  // Desde B cualquier acción termina, con recompensa normal.
  const desdeB = mdp2.paso(1, 3, generador(2026));
  assert.equal(desdeB.s2, 2);
  assert.equal(desdeB.fin, true);
  assert.ok(Number.isFinite(desdeB.r));
  /* Ir a la izquierda es SIEMPRE un error: su retorno esperado es la media
     (−0,1) y el de la derecha es 0. Es el enunciado del ejemplo. */
  assert.ok(mdp2.media < 0);
});

/* ===================================================================== *
 * MÓDULO 1 · De v a q: lo que el modelo hacía por ti   [C, todo exacto]
 * Fuente: S&B §5.2 y ec. (5.1) · 4_Tema4#slide-4 · entorno 2_Tema2_wclp#slide-6
 *
 * OJO CON LOS ÍNDICES: el guion habla de los estados por su ETIQUETA («el
 * estado 3»), y las etiquetas de `rejilla3x3()` son "1"…"8" y "T". El estado
 * de etiqueta 3 es el ÍNDICE 2.
 * ===================================================================== */

const ESTADO_3 = 2; // el de etiqueta "3", donde se permutan las acciones

const rejillaA = rejilla3x3();
const piEquiA = politicaEquiprobable(rejillaA);
const vA = evaluarLineal(rejillaA, piEquiA, GAMMA);
const qA = qDeV(rejillaA, vA, GAMMA);

const rejillaB = rejilla3x3Permutada(); // por omisión: estado 2, acciones abajo/izq
const piEquiB = politicaEquiprobable(rejillaB);
const vB = evaluarLineal(rejillaB, piEquiB, GAMMA);
const qB = qDeV(rejillaB, vB, GAMMA);

/** Política greedy respecto de v: pasa por q, que es lo que exige el modelo. */
const greedyDeV = (mdp, v) => politicaGreedy(mdp, qDeV(mdp, v, GAMMA));

test("M1-A1: v_π equiprobable del entorno A vale [−27, −25, −22,5, −25, −21,5, −16, −22,5, −16, 0]", () => {
  /* Se resuelve el sistema lineal (I − γP_π)v = r_π: exacto, no iterativo,
     porque los empates del argmax de M1-A7 tienen que ser fiables. La
     tolerancia es 1e-9 y no 0 porque la eliminación gaussiana deja residuo:
     v(6) sale −16,000000000000004. */
  cercaVector(vA, [-27, -25, -22.5, -25, -21.5, -16, -22.5, -16, 0], 1e-9, "M1-A1");
});

test("M1-A2: q_π(3,·) del entorno A es [−23,5, −17, −26, −23,5] y su argmax es {abajo}", () => {
  cercaVector(qA[ESTADO_3], [-23.5, -17, -26, -23.5], 1e-9, "M1-A2");
  assert.deepEqual(argmaxTodos(qA[ESTADO_3]), [acc3("abajo")]);
});

test("M1-A3: los dos entornos tienen v_π IDÉNTICA — máx|v_A − v_B| = 0, exacto", () => {
  /* LA ASERCIÓN CENTRAL DEL RECURSO. Si esto falla, el contraejemplo no
     demuestra nada: la demo entera se apoya en que dos entornos distintos
     comparten v_π. Con π equiprobable, P_π(s,·) es la media de las cuatro
     filas de P(s,·,·); permutar dos de esas filas no cambia la media, así que
     el sistema de Bellman es literalmente el mismo y la igualdad es EXACTA,
     bit a bit. Por eso aquí no hay tolerancia. */
  const maximo = Math.max(...vA.map((x, s) => Math.abs(x - vB[s])));
  assert.equal(maximo, 0, `M1-A3: máx|v_A − v_B| = ${maximo}, debe ser 0 exacto`);
  assert.deepEqual(vA, vB);
});

test("M1-A4: q_π(3,·) del entorno B es [−23,5, −26, −17, −23,5] y su argmax es {izq}", () => {
  // Las dos columnas permutadas: el −17 se ha mudado de `abajo` a `izq`.
  cercaVector(qB[ESTADO_3], [-23.5, -26, -17, -23.5], 1e-9, "M1-A4");
  assert.deepEqual(argmaxTodos(qB[ESTADO_3]), [acc3("izq")]);
});

test("M1-A5: la política greedy sobre v_π del entorno A da los ocho conjuntos del guion", () => {
  const esperada = [
    "abajo|dch", // estado 1
    "abajo", //     estado 2
    "abajo", //     estado 3
    "dch", //       estado 4
    "abajo|dch", // estado 5
    "abajo", //     estado 6
    "dch", //       estado 7
    "dch", //       estado 8
  ];
  const greedy = greedyDeV(rejillaA, vA);
  esperada.forEach((conjunto, s) => {
    assert.equal(nombres3(greedy[s]), conjunto, `M1-A5: greedy en el estado ${s + 1}`);
  });
  assert.deepEqual(greedy[8], [], "el terminal no tiene acción greedy");
});

test("M1-A6: la política greedy del entorno B solo se diferencia en el estado 3, donde da {izq}", () => {
  /* Es la conclusión del módulo: misma v_π, distinta política greedy. Ninguna
     regla que solo mire v_π puede acertar en los dos entornos. */
  const greedyA = greedyDeV(rejillaA, vA);
  const greedyB = greedyDeV(rejillaB, vB);
  for (let s = 0; s < 9; s++) {
    if (s === ESTADO_3) continue;
    assert.equal(nombres3(greedyB[s]), nombres3(greedyA[s]), `M1-A6: difieren en el estado ${s + 1}`);
  }
  assert.equal(nombres3(greedyB[ESTADO_3]), "izq");
  assert.equal(nombres3(greedyA[ESTADO_3]), "abajo");
});

test("M1-A7: solo los estados 1 y 5 tienen dos acciones maximizadoras; los otros seis, una", () => {
  // Vigila que `argmaxTodos` no rompa empates en silencio.
  const greedy = greedyDeV(rejillaA, vA);
  const conDos = [];
  for (let s = 0; s < 8; s++) {
    assert.ok(greedy[s].length >= 1);
    if (greedy[s].length > 1) conDos.push(s + 1); // etiqueta, no índice
  }
  assert.deepEqual(conDos, [1, 5]);
  for (const s of [0, 4]) assert.equal(greedy[s].length, 2);
});

test("M1-A8: v_* del entorno A es [−4, −3, −2, −3, −2, −1, −2, −1, 0] = −d(s)", () => {
  // d = distancia mínima al terminal; con r ≡ −1 y γ = 1, v_*(s) = −d(s).
  const vOptima = iteracionValor(rejillaA, GAMMA, { tolerancia: 1e-12 }).v;
  cercaVector(vOptima, [-4, -3, -2, -3, -2, -1, -2, -1, 0], 1e-9, "M1-A8");
});

test("M1-A9: q_π(s,a) = −1 + v_π(siguiente(s,a)) en los 32 pares del entorno A", () => {
  /* Consecuencia de r ≡ −1, γ = 1 y dinámica determinista. Es la identidad que
     hace legible la tabla de derivación del módulo, y de paso comprueba que
     `qDeV` no está haciendo nada raro. */
  let pares = 0;
  for (let s = 0; s < rejillaA.nEstados; s++) {
    if (rejillaA.esTerminal(s)) continue;
    for (let a = 0; a < rejillaA.nAcciones; a++) {
      assert.equal(rejillaA.P[s][a].length, 1, "la dinámica debe ser determinista");
      const destino = rejillaA.P[s][a][0].s2;
      cerca(qA[s][a], -1 + vA[destino], 1e-9, `M1-A9: q(${s},${ACCIONES_3X3[a]})`);
      pares++;
    }
  }
  assert.equal(pares, 32); // 8 estados no terminales × 4 acciones
});

test("M1-A10: las SEIS permutaciones de dos acciones del estado 3 dejan v_π invariante", () => {
  /* Lo que hace rigurosa la demo: el contraejemplo no es una casualidad
     numérica de la permutación elegida, es una propiedad de la política
     equiprobable. Se comprueban las C(4,2) = 6 permutaciones, exactas. */
  const permutaciones = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  for (const [a1, a2] of permutaciones) {
    const permutada = rejilla3x3Permutada({ estado: ESTADO_3, a1, a2 });
    const v = evaluarLineal(permutada, politicaEquiprobable(permutada), GAMMA);
    const maximo = Math.max(...vA.map((x, s) => Math.abs(x - v[s])));
    assert.equal(
      maximo,
      0,
      `M1-A10: permutar ${ACCIONES_3X3[a1]}/${ACCIONES_3X3[a2]} movió v_π en ${maximo}`,
    );
  }
  assert.equal(permutaciones.length, 6);
});

/* ===================================================================== *
 * LAS TRES PRIMITIVAS POR EPISODIO  [C]
 * Fuente: S&B ecs. (6.1), (6.2) y (6.7)
 *
 * Son la unidad testeable: los bucles de control las llaman en vez de
 * duplicar la regla. Aquí se comprueban con aritmética a mano.
 * ===================================================================== */

test("primitiva: tdCero aplica (6.2) con V(S_T) = 0 — solo cambia el último estado visitado", () => {
  /* Episodio S_0 = 0 → S_1 = 1 → terminal, con R_1 = 0 y R_2 = 1 (el paseo
     aleatorio que sale por la derecha). Con V ≡ 0 y α = 0,5:
       t = 0: V(0) += 0,5·(0 + V(1) − V(0)) = 0
       t = 1: V(1) += 0,5·(1 + 0 − 0) = 0,5   ← V(S_T) = 0 sale del formato */
  const V = [0, 0, 0];
  const episodio = { estados: [0, 1], acciones: [], recompensas: [0, 1], T: 2 };
  assert.equal(tdCero(V, episodio, { alpha: 0.5, gamma: 1 }), 2);
  assert.deepEqual(V, [0, 0.5, 0]);
});

test("primitiva: mcConstante aplica (6.1) con G_t, no con R_{t+1}", () => {
  /* Mismo episodio: G_0 = G_1 = 1 con γ = 1, así que MC mueve LOS DOS estados
     mientras TD solo movió uno. Es exactamente la diferencia que el módulo 2
     enseña con un episodio. */
  const V = [0, 0, 0];
  const episodio = { estados: [0, 1], acciones: [], recompensas: [0, 1], T: 2 };
  assert.equal(mcConstante(V, episodio, { alpha: 0.5, gamma: 1 }), 2);
  assert.deepEqual(V, [0.5, 0.5, 0]);

  // De primera visita: un estado repetido se actualiza una sola vez.
  const W = [0, 0, 0];
  const conRepeticion = { estados: [0, 1, 0], acciones: [], recompensas: [0, 0, 1], T: 3 };
  assert.equal(mcConstante(W, conRepeticion, { alpha: 0.5, primeraVisita: true }), 2);
  assert.equal(mcConstante([0, 0, 0], conRepeticion, { alpha: 0.5, primeraVisita: false }), 3);
});

test("primitiva: sarsaEpisodio aplica (6.7) con Q(S_T,·) = 0 y exige una acción por paso", () => {
  /* t = 0: Q(0,1) += 0,5·(−1 + Q(1,0) − Q(0,1)) = −0,5
     t = 1: Q(1,0) += 0,5·(5 + 0 − 0) = 2,5   ← el terminal aporta 0 */
  const Q = [[0, 0], [0, 0]];
  const episodio = { estados: [0, 1], acciones: [1, 0], recompensas: [-1, 5], T: 2 };
  assert.equal(sarsaEpisodio(Q, episodio, { alpha: 0.5, gamma: 1 }), 2);
  assert.deepEqual(Q, [[0, -0.5], [2.5, 0]]);

  assert.throws(
    () => sarsaEpisodio([[0]], { estados: [0], acciones: [], recompensas: [1], T: 1 }, { alpha: 0.5 }),
    /no trae una acción por paso/,
  );
});

/* ===================================================================== *
 * MÓDULO 2 · Monte Carlo frente a TD(0) en el paseo aleatorio
 * Fuente: S&B §6.2, §6.3, Examples 6.2 y 6.4, figura 6.2
 * ===================================================================== */

test("M2-A1 [C]: los valores verdaderos son (1/6, 2/6, 3/6, 4/6, 5/6)", () => {
  /* Example 6.2, p. 147, literal. El motor no los escribe a mano: los calcula
     como interpolación lineal entre las dos recompensas terminales, que es lo
     que vale v_π con γ = 1 y paseo simétrico. */
  cercaVector(paseo5.valoresVerdaderos, [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6], 1e-12, "M2-A1");
});

test("M2-A1 bis [C]: con 19 estados los valores van de −0,9 a 0,9 en pasos de 0,1", () => {
  // Example 7.1: mismo cálculo, r_izq = −1 y r_dch = +1.
  const paseo19 = paseoAleatorio({
    nEstados: 19, recompensaIzquierda: -1, recompensaDerecha: 1, valorInicial: 0,
  });
  const esperados = [];
  for (let s = 0; s < 19; s++) esperados.push(-0.9 + 0.1 * s);
  cercaVector(paseo19.valoresVerdaderos, esperados, 1e-12, "M2-A1 bis");
  assert.equal(paseo19.estadoInicial, 9); // el central
});

test("M2-A2 [C]: el error RMS de la inicialización V ≡ 0,5 es √((2/9)/4) = 0,235702", () => {
  /* Cálculo exacto: las desviaciones son (1/3, 1/6, 0, 1/6, 1/3) y la media de
     sus cuadrados es (2/9)/4·… — el valor cerrado es el que se compara. */
  const rms = errorRMS([0.5, 0.5, 0.5, 0.5, 0.5], paseo5.valoresVerdaderos);
  cerca(rms, Math.sqrt(2 / 9 / 4), 1e-12, "M2-A2 (valor cerrado)");
  cerca(rms, 0.235702, 1e-6, "M2-A2 (cifra del guion)");
});

test("M2-A3 [R]: tras UN episodio, TD(0) solo mueve un estado, y en ±α·0,5", () => {
  /* Ejercicio 6.3, p. 148: con V ≡ 0,5 todos los errores TD son cero salvo el
     de la última transición, la que entra en un terminal. Con semilla 2026 el
     paseo sale por la derecha, así que el que cambia es E: 0,5 + 0,1·0,5 = 0,55.
     Es reproducibilidad, pero el valor es exacto (0,55 sin tolerancia): solo
     depende de que el generador dé ese camino. */
  const { V } = prediccionTD(paseo5, { alpha: 0.1, episodios: 1, rng: generador(2026) });
  assert.deepEqual(V, [0.5, 0.5, 0.5, 0.5, 0.55]);
  const movidos = V.filter((x) => x !== 0.5);
  assert.equal(movidos.length, 1, "TD(0) tras un episodio solo puede mover un estado");
});

test("M2-A4 [R]: TD(0), α = 0,1, semilla 2026 — V tras 10 y tras 100 episodios", () => {
  // Tolerancia 1e-4, la que declara el guion (son cifras impresas a 4 decimales).
  const { historial } = prediccionTD(paseo5, { alpha: 0.1, episodios: 100, rng: generador(2026) });
  assert.equal(historial.length, 101, "el historial es [V_0, V_1, …, V_100]");
  cercaVector(historial[10], [0.2993, 0.4218, 0.4914, 0.5393, 0.6446], 1e-4, "M2-A4 (10 ep.)");
  cercaVector(historial[100], [0.1342, 0.3177, 0.4906, 0.6983, 0.8564], 1e-4, "M2-A4 (100 ep.)");
});

/** Las siete curvas de la figura 6.2, promediadas sobre 100 ejecuciones. ≈35 ms. */
const ALFAS_MC = [0.01, 0.02, 0.03, 0.04];
const ALFAS_TD = [0.05, 0.1, 0.15];
const curvas = new Map();
for (const alpha of ALFAS_MC) {
  curvas.set(`mc${alpha}`, curvaRMS(paseo5, {
    metodo: "mc", alpha, episodios: 100, ejecuciones: 100, semilla: 2026,
  }).curva);
}
for (const alpha of ALFAS_TD) {
  curvas.set(`td${alpha}`, curvaRMS(paseo5, {
    metodo: "td", alpha, episodios: 100, ejecuciones: 100, semilla: 2026,
  }).curva);
}

test("M2-A5 [R]: RMS medio en el episodio 10 — los siete valores de la figura 6.2", () => {
  // Tolerancia 1e-3, la del guion. 100 ejecuciones, semillas 2026…2125.
  const esperados = {
    "mc0.01": 0.2133, "mc0.02": 0.1986, "mc0.03": 0.1889, "mc0.04": 0.1826,
    "td0.05": 0.1745, "td0.1": 0.1281, "td0.15": 0.0941,
  };
  for (const [clave, objetivo] of Object.entries(esperados)) {
    cerca(curvas.get(clave)[10], objetivo, 1e-3, `M2-A5 (${clave})`);
  }
});

test("M2-A6 [R]: RMS medio en el episodio 100 — MC sigue bajando y TD con α grande sube", () => {
  const esperados = {
    "mc0.01": 0.0986, "mc0.02": 0.0864, "mc0.03": 0.1, "mc0.04": 0.1146,
    "td0.05": 0.0324, "td0.1": 0.0531, "td0.15": 0.07,
  };
  for (const [clave, objetivo] of Object.entries(esperados)) {
    cerca(curvas.get(clave)[100], objetivo, 1e-3, `M2-A6 (${clave})`);
  }
  // La lectura: con α grande el error del episodio 100 es PEOR que con α pequeño.
  assert.ok(curvas.get("td0.15")[100] > curvas.get("td0.05")[100]);
  assert.ok(curvas.get("mc0.04")[100] > curvas.get("mc0.02")[100]);
});

test("M2-A7 [R]: TD con α = 0,05 queda por debajo de las CUATRO curvas de MC desde el episodio 5", () => {
  /* «TD was consistently better than MC on this task» (Example 6.2). Es la
     conclusión del libro, y aquí se comprueba episodio a episodio, no de
     media: 96 episodios × 4 curvas = 384 comparaciones estrictas. */
  const td = curvas.get("td0.05");
  for (let k = 5; k <= 100; k++) {
    for (const alpha of ALFAS_MC) {
      assert.ok(
        td[k] < curvas.get(`mc${alpha}`)[k],
        `M2-A7: en el episodio ${k}, TD(0,05) = ${td[k]} ≥ MC(${alpha}) = ${curvas.get(`mc${alpha}`)[k]}`,
      );
    }
  }
});

test("M2-A8 [R]: la curva de TD con α = 0,15 tiene su mínimo ANTES del episodio 100", () => {
  /* Ejercicio 6.5, p. 148: con paso constante los valores nunca se asientan,
     así que el error toca fondo y vuelve a subir. El mínimo está en el
     episodio 21 con esta semilla; lo que se afirma es que es < 100. */
  const curva = curvas.get("td0.15");
  const minimo = Math.min(...curva);
  const donde = curva.indexOf(minimo);
  assert.ok(donde < 100, `M2-A8: el mínimo está en el episodio ${donde}`);
  assert.equal(donde, 21);
  assert.ok(curva[100] > minimo, "después del mínimo el error vuelve a subir");
});

test("M2-A9 [C]: «You are the Predictor» — V(B) = 0,75, V(A)_TD = 0,75 y V(A)_MC = 0", () => {
  /* Example 6.4, p. 149. EXACTOS, sin tolerancia estadística: el motor calcula
     el punto fijo (equivalencia cierta para TD, media de retornos para MC) en
     vez de iterar la actualización por lotes hasta una tolerancia. */
  const { vB, vA_td, vA_mc, modelo } = resolverPredictor();
  assert.equal(vB, 0.75);
  assert.equal(vA_td, 0.75);
  assert.equal(vA_mc, 0);
  // Y el modelo de máxima verosimilitud que lo justifica: A→B con p = 1.
  assert.equal(modelo.AB, 1);
  assert.equal(modelo.B1, 0.75);
  assert.equal(modelo.B0, 0.25);
  // Los ocho episodios son los del libro: uno con A y siete que empiezan en B.
  assert.equal(EPISODIOS_PREDICTOR.length, 8);
  assert.equal(EPISODIOS_PREDICTOR.filter((ep) => ep[0][0] === "A").length, 1);
  const unos = EPISODIOS_PREDICTOR.filter((ep) => ep.at(-1)[1] === 1).length;
  assert.equal(unos, 6, "seis de los ocho episodios terminan con r = 1");
});

test("M2-A9 bis [C]: el punto fijo por lotes NO depende de α, como afirma §6.3", () => {
  /* «El resultado no depende de α mientras sea pequeño» es una afirmación del
     libro, no un detalle de implementación: se comprueba con el mismo lote y
     dos α que difieren en un factor 5. */
  const lote = prediccionTD(paseo5, { alpha: 0.1, episodios: 30, rng: generador(2026) }).episodios;
  for (const metodo of ["td", "mc"]) {
    const conAlfaGrande = prediccionPorLotes(paseo5, lote, { metodo, alpha: 0.005 });
    const conAlfaPequena = prediccionPorLotes(paseo5, lote, { metodo, alpha: 0.001 });
    const maximo = Math.max(...conAlfaGrande.V.map((x, s) => Math.abs(x - conAlfaPequena.V[s])));
    assert.ok(maximo < 2e-4, `M2-A9 bis: el punto fijo de ${metodo} se movió ${maximo} al cambiar α`);
    assert.ok(conAlfaGrande.convergido && conAlfaPequena.convergido);
  }
});

test("M2-A10 [R]: por lotes, el RMS de TD queda por debajo del de MC en los 100 episodios", () => {
  /* Figura 6.2, p. 149 (panel de batch updating).
     DOS DESVIACIONES DEL GUION, las dos declaradas:
     · α = 0,002 y no el 0,01 por omisión. Con 100 episodios la iteración por
       lotes suma los incrementos de todo el lote y diverge: el motor lanza un
       error explícito con 0,01, con 0,005 (a los 87 episodios) y con 0,004.
       0,002 es el mayor que aguanta los 100. El punto fijo no depende de α
       (test anterior), así que la comparación sigue siendo la del libro.
     · 10 ejecuciones y no las 100 del guion: el modo por lotes reprocesa el
       lote entero tras cada episodio y 100 ejecuciones cuestan ~15 s. Con 10
       la brecha entre las dos curvas ya es de varias desviaciones típicas
       (0,031 frente a 0,061 en el episodio 100), así que el test discrimina
       igual y la suite sigue siendo cómoda de ejecutar (~0,8 s). */
  const td = curvaRMS(paseo5, {
    metodo: "td", alpha: 0.002, episodios: 100, ejecuciones: 10, semilla: 2026, porLotes: true,
  }).curva;
  const mc = curvaRMS(paseo5, {
    metodo: "mc", alpha: 0.002, episodios: 100, ejecuciones: 10, semilla: 2026, porLotes: true,
  }).curva;
  for (let k = 1; k <= 100; k++) {
    assert.ok(td[k] < mc[k], `M2-A10: en el episodio ${k}, TD = ${td[k]} ≥ MC = ${mc[k]}`);
  }
  assert.ok(td[100] < 0.04 && mc[100] > 0.05, `M2-A10: TD ${td[100]} · MC ${mc[100]}`);
});

test("M2-A11 [C]: con la misma semilla, MC y TD ven EXACTAMENTE los mismos episodios", () => {
  /* Es el invariante que hace honesta la comparación del módulo 2: el muestreo
     no depende de V, así que la única diferencia entre las dos curvas es la
     regla de actualización. Comparación profunda, no estadística. */
  const mc = prediccionMC(paseo5, { alpha: 0.1, episodios: 50, rng: generador(2026) });
  const td = prediccionTD(paseo5, { alpha: 0.1, episodios: 50, rng: generador(2026) });
  assert.deepEqual(mc.episodios, td.episodios);
  assert.notDeepEqual(mc.V, td.V, "si las V coincidiesen, el módulo no compararía nada");
});

/* ===================================================================== *
 * MÓDULO 3 · SARSA frente a Q-learning en el borde del acantilado
 * Fuente: S&B §6.4, §6.5, Example 6.6 · 4_Tema4#slide-36 · Tema4_2#slide-18
 *
 * Salvo M3-A2 (geometría, [C]), todo este módulo es [R]: son medias sobre 50
 * ejecuciones sembradas 2026…2075, 500 episodios, γ = 1, Q inicial a cero.
 * ===================================================================== */

const TOPE_PASOS = 2000; // el tope por episodio que declara el guion

/** Política determinista «sube a la fila f, ve al este, baja a la meta». */
function politicaPorFila(f) {
  const politica = new Array(cliff.nEstados).fill(accNav("N"));
  for (let s = 0; s < cliff.nEstados; s++) {
    const fila = Math.floor(s / 12);
    const columna = s % 12;
    if (columna < 11) politica[s] = fila > f ? accNav("N") : accNav("E");
    else politica[s] = accNav("S");
  }
  return politica;
}

/** Reparto de longitudes: {17: 41, 19: 2, noLlega: 7}. */
function reparto(longitudes) {
  const cuenta = {};
  for (const l of longitudes) {
    const clave = l === null ? "noLlega" : String(l);
    cuenta[clave] = (cuenta[clave] ?? 0) + 1;
  }
  return cuenta;
}

const campanas = new Map();

/**
 * Una campaña del acantilado: `ejecuciones` entrenamientos independientes con
 * semillas `semilla + i`. Devuelve la media de los episodios 100-500 (la
 * métrica del guion), el reparto de longitudes de la política greedy final y
 * los episodios que llegaron al tope. Se cachea porque varios tests comparten
 * la misma campaña y cada una cuesta ~50 ms.
 */
function campana(algoritmo, opciones = {}) {
  const {
    alpha = 0.5, epsilon = 0.1, decae = false,
    episodios = 500, ejecuciones = 50, semilla = 2026,
  } = opciones;
  const clave = [algoritmo.name, alpha, epsilon, decae, episodios, ejecuciones, semilla].join("|");
  if (campanas.has(clave)) return campanas.get(clave);

  const medias = [];
  const longitudes = [];
  const cortes = [];
  for (let i = 0; i < ejecuciones; i++) {
    const salida = algoritmo(cliff, {
      alpha,
      epsilon,
      episodios,
      rng: generador(semilla + i),
      maxPasos: TOPE_PASOS,
      decaeEpsilon: decae ? (k) => epsilon / k : null,
    });
    const tramo = salida.sumas.slice(99); // episodios 100 a 500, ambos incluidos
    medias.push(tramo.reduce((a, b) => a + b, 0) / tramo.length);
    const seguimiento = seguirPolitica(cliff, politicaGreedyDe(salida.Q));
    longitudes.push(seguimiento.llega ? seguimiento.pasos : null);
    salida.pasos.forEach((p, k) => {
      if (p >= TOPE_PASOS) cortes.push({ semilla: semilla + i, episodio: k + 1 });
    });
  }
  const resultado = {
    media: medias.reduce((a, b) => a + b, 0) / ejecuciones,
    longitudes,
    reparto: reparto(longitudes),
    cortes,
  };
  campanas.set(clave, resultado);
  return resultado;
}

test("M3-A2 [C]: los tres caminos de la geometría — 13, 15 y 17 pasos por las filas 2, 1 y 0", () => {
  /* No está en el libro: es derivación de la geometría, y por eso se comprueba
     siguiendo políticas escritas a mano en vez de creerse el número. El de 15
     pasos (fila 1) es el camino intermedio que NINGÚN método aprende. */
  const esperado = { 2: 13, 1: 15, 0: 17 };
  for (const [fila, pasos] of Object.entries(esperado)) {
    const r = seguirPolitica(cliff, politicaPorFila(Number(fila)));
    assert.equal(r.llega, true, `M3-A2: la política de la fila ${fila} no llega a G`);
    assert.equal(r.pasos, pasos, `M3-A2: fila ${fila}`);
    assert.equal(r.retorno, -pasos, "con r = −1 por paso el retorno es −pasos");
    assert.equal(r.ciclo, false);
  }
});

test("M3-A3 [R]: con ε = 0,1 la media de los episodios 100-500 es −27,8 (SARSA) y −49,4 (Q-learning)", () => {
  /* El guion declara −27,3 y −50,0 con tolerancia 1,5, y el motor da −27,81 y
     −49,37: dentro de la tolerancia. Reproduce el «≈−25» y «≈−50» de la figura
     de 4_Tema4#slide-36. Se comprueba además contra el valor del motor con una
     tolerancia estrecha (0,05), para que una regresión que mueva los números
     sin salirse del 1,5 del guion también se note. */
  const s = campana(sarsa);
  const q = campana(qLearning);
  cerca(s.media, -27.3, 1.5, "M3-A3 (SARSA, cifra del guion)");
  cerca(q.media, -50, 1.5, "M3-A3 (Q-learning, cifra del guion)");
  cerca(s.media, -27.81, 0.05, "M3-A3 (SARSA, valor del motor)");
  cerca(q.media, -49.37, 0.05, "M3-A3 (Q-learning, valor del motor)");
  assert.ok(s.media > q.media, "SARSA rinde MEJOR que Q-learning durante el aprendizaje");
});

test("M3-A4 [R]: con ε = 0 los dos dan −13,0 y los dos aprenden el camino de 13 pasos, 50/50", () => {
  /* Ejercicio 6.12, p. 154, y una de las dos preguntas abiertas del módulo:
     la diferencia entre SARSA y Q-learning la crea la exploración, no el
     álgebra. Tolerancia 0,1: el óptimo es exactamente −13 y lo único que puede
     separar de él es algún episodio inicial que aún no lo haya encontrado
     (Q-learning se queda en −13,01). */
  const s = campana(sarsa, { epsilon: 0 });
  const q = campana(qLearning, { epsilon: 0 });
  cerca(s.media, -13, 0.1, "M3-A4 (SARSA)");
  cerca(q.media, -13, 0.1, "M3-A4 (Q-learning)");
  assert.deepEqual(s.reparto, { 13: 50 });
  assert.deepEqual(q.reparto, { 13: 50 });
});

test("M3-A5 [R]: con ε = 0,1, Q-learning aprende 13 pasos en 50/50 y SARSA 17 en 41 (2 con 19, 7 sin llegar)", () => {
  /* CORRECCIÓN DEL GUION: la tabla del guion dice «41 con 17, 3 con 19 y 6 que
     no alcanzan la meta». El motor da 41 / 2 / 7. El 41 coincide; los otros dos
     números son los del motor y son los que valen (el guion arrastra una
     versión anterior). Son cuentas EXACTAS sobre 50 ejecuciones sembradas, no
     medias: o salen o no salen.
     Que una política greedy no alcance la meta no es un fallo del código: pasa
     de verdad en los estados que la exploración casi nunca visita. */
  const q = campana(qLearning);
  assert.deepEqual(q.reparto, { 13: 50 }, "Q-learning aprende q_* en las 50");
  const s = campana(sarsa);
  assert.deepEqual(s.reparto, { 17: 41, 19: 2, noLlega: 7 });
  assert.equal(s.longitudes.filter((l) => l === 13).length, 0, "SARSA no aprende el camino del borde");
});

test("M3-A6 [R]: la brecha entre los dos métodos crece con ε, y Q-learning siempre por debajo", () => {
  // Los cinco pares del guion, tolerancia 10 % (la que él declara).
  const esperados = [
    { epsilon: 0, sarsa: -13.0, q: -13.0 },
    { epsilon: 0.05, sarsa: -22.0, q: -29.9 },
    { epsilon: 0.1, sarsa: -27.3, q: -50.0 },
    { epsilon: 0.2, sarsa: -44.0, q: -105.5 },
    { epsilon: 0.5, sarsa: -146.5, q: -636.5 },
  ];
  const brechas = [];
  for (const { epsilon, sarsa: eS, q: eQ } of esperados) {
    const s = campana(sarsa, { epsilon }).media;
    const q = campana(qLearning, { epsilon }).media;
    cerca(s, eS, Math.abs(eS) * 0.1, `M3-A6: SARSA con ε = ${epsilon}`);
    cerca(q, eQ, Math.abs(eQ) * 0.1, `M3-A6: Q-learning con ε = ${epsilon}`);
    assert.ok(s >= q - 1e-9, `M3-A6: con ε = ${epsilon} Q-learning debería ir por debajo`);
    brechas.push(s - q);
  }
  for (let i = 1; i < brechas.length; i++) {
    assert.ok(
      brechas[i] > brechas[i - 1],
      `M3-A6: la brecha no crece al pasar de ε = ${esperados[i - 1].epsilon} a ${esperados[i].epsilon}`,
    );
  }
});

test("M3-A7 [R]: con ε_k = ε_0/k, SARSA da −14,9 y su política greedy sigue siendo la larga en 43 de 50", () => {
  /* CORRECCIÓN DEL GUION: el guion dice «SARSA −17,7» y «39 de 50»; el motor da
     −14,92 y 43 de 50. Se escribe el valor del motor (el guion arrastra
     números de una versión anterior). El de Q-learning, −13,16, también difiere
     del −13,7 del guion, pero dentro de la tolerancia 1,5 que M3-A3 declara
     para esta métrica; se fija con la tolerancia estrecha del motor.

     Es la comprobación de la afirmación de Tema4_2_ModelFree#slide-18 («si ε se
     fuese reduciendo gradualmente, ambos convergerían a π_*»): es cierta en el
     límite y NO se observa en 500 episodios, que es justo lo que enseña el
     módulo. «Política larga» = política greedy que no es la de 13 pasos. */
  const s = campana(sarsa, { epsilon: 0.1, decae: true });
  const q = campana(qLearning, { epsilon: 0.1, decae: true });
  cerca(s.media, -14.92, 0.05, "M3-A7 (SARSA)");
  cerca(q.media, -13.16, 0.05, "M3-A7 (Q-learning)");

  const noSonLaCorta = s.longitudes.filter((l) => l !== 13).length;
  assert.equal(noSonLaCorta, 43, "M3-A7: ejecuciones de SARSA con política greedy distinta de la de 13 pasos");
  assert.deepEqual(s.reparto, { 13: 7, 15: 39, 17: 4 });
  // Con ε decreciente los dos mejoran respecto de ε = 0,1 fijo (M3-A3).
  assert.ok(s.media > campana(sarsa).media);
  assert.ok(q.media > campana(qLearning).media);
});

test("M3-A8 [R]: SARSA se degrada con α grande y Q-learning apenas se mueve", () => {
  /* Observación de §6.6, p. 156. Cinco valores por método, tolerancia 10 %
     (la del guion). Lo cualitativo se comprueba aparte: el rango de las cinco
     medias de Q-learning es menor que 2, mientras SARSA cae más de 60. */
  const esperados = [
    { alpha: 0.1, sarsa: -29.3, q: -50.9 },
    { alpha: 0.3, sarsa: -24.8, q: -49.8 },
    { alpha: 0.5, sarsa: -27.3, q: -50.0 },
    { alpha: 0.8, sarsa: -47.5, q: -49.7 },
    { alpha: 1.0, sarsa: -101.3, q: -50.5 },
  ];
  const mediasQ = [];
  const mediasS = [];
  for (const { alpha, sarsa: eS, q: eQ } of esperados) {
    const s = campana(sarsa, { alpha }).media;
    const q = campana(qLearning, { alpha }).media;
    cerca(s, eS, Math.abs(eS) * 0.1, `M3-A8: SARSA con α = ${alpha}`);
    cerca(q, eQ, Math.abs(eQ) * 0.1, `M3-A8: Q-learning con α = ${alpha}`);
    mediasS.push(s);
    mediasQ.push(q);
  }
  assert.ok(Math.max(...mediasQ) - Math.min(...mediasQ) < 2, "Q-learning apenas depende de α");
  assert.ok(mediasS[0] - mediasS[4] > 60, "SARSA sí se degrada con α grande");
});

test("M3-A10 [R]: un solo episodio de 25 000 llega al tope de 2 000 pasos — la aserción del guion NO se sostiene", () => {
  /* EL GUION DICE: «ningún episodio alcanza los 2 000 pasos a partir del
     episodio 50 con ε ≤ 0,2». ES FALSO, y no es un bug del motor: en las seis
     campañas (3 valores de ε × 2 métodos, 50 × 500 episodios cada una) hay
     EXACTAMENTE UNO, y está en el episodio 491, muy por encima del 50:
         SARSA · ε = 0,1 · semilla 2064 · episodio 491 · 2 000 pasos
     Un paseo ε-greedy que supere los 2 000 pasos es perfectamente posible; el
     motor lo trata bien (lo cuenta en `cortados` y registra la suma tal cual).
     Lo que hay que corregir es la redacción del guion: «a lo sumo un episodio
     de cada 25 000». El test fija el hecho exacto para que se note cualquier
     cambio. */
  const todos = [];
  for (const epsilon of [0.05, 0.1, 0.2]) {
    for (const algoritmo of [sarsa, qLearning]) {
      for (const corte of campana(algoritmo, { epsilon }).cortes) {
        todos.push({ algoritmo: algoritmo.name, epsilon, ...corte });
      }
    }
  }
  assert.deepEqual(todos, [
    { algoritmo: "sarsa", epsilon: 0.1, semilla: 2064, episodio: 491 },
  ]);
});

test("M3-A9 [C]: el acantilado es determinista y los dos métodos parten del mismo estado del generador", () => {
  /* Invariante A/B del módulo: `cliffWalking().paso` NO consume azar (se
     comprueba con un generador que revienta si alguien lo toca), así que toda
     la diferencia observada entre SARSA y Q-learning viene de la regla y de la
     selección de acciones, no de que hayan visto entornos distintos. Y con la
     misma semilla las dos empiezan eligiendo la misma acción. */
  const rngInerte = new Proxy({}, {
    get() {
      return () => {
        throw new Error("el entorno ha consumido azar");
      };
    },
  });
  for (let s = 0; s < cliff.nEstados; s++) {
    if (cliff.esTerminal(s)) continue;
    for (let a = 0; a < 4; a++) cliff.paso(s, a, rngInerte); // no debe lanzar
  }
  const opciones = (rng) => ({ alpha: 0.5, epsilon: 0.1, episodios: 5, rng });
  assert.equal(
    sarsa(cliff, opciones(generador(2026))).acciones0[0],
    qLearning(cliff, opciones(generador(2026))).acciones0[0],
  );
});

test("contraste [C]: Expected SARSA con ε = 0 ES Q-learning (§6.6), y con ε > 0 no lo es", () => {
  /* Contraste algebraico, no estadístico: con la política greedy la esperanza
     E_π[Q(S',·)] es max_a Q(S',a), así que las dos reglas coinciden. Comparten
     además el consumo del generador (el mismo esqueleto `controlConObjetivo`),
     de modo que las trayectorias son idénticas.
     La igualdad de Q no es exacta bit a bit —la esperanza se calcula como
     Σ_a p·q sobre las maximizadoras, y con 3 empatadas (1/3)·q sumado tres
     veces no da q en coma flotante—, pero la diferencia máxima es 2,3e-13. */
  const opciones = (rng) => ({ alpha: 0.5, epsilon: 0, episodios: 200, rng });
  const q = qLearning(cliff, opciones(generador(2026)));
  const e = expectedSarsa(cliff, opciones(generador(2026)));
  assert.deepEqual(e.sumas, q.sumas, "las trayectorias deben ser las mismas");
  assert.deepEqual(e.pasos, q.pasos);
  let maximo = 0;
  for (let s = 0; s < cliff.nEstados; s++) {
    for (let a = 0; a < 4; a++) maximo = Math.max(maximo, Math.abs(e.Q[s][a] - q.Q[s][a]));
  }
  assert.ok(maximo < 1e-9, `con ε = 0 las dos tablas difieren en ${maximo}`);

  // Con ε = 0,1 ya no coinciden: la esperanza reparte peso entre las no greedy.
  const q1 = qLearning(cliff, { alpha: 0.5, epsilon: 0.1, episodios: 200, rng: generador(2026) });
  const e1 = expectedSarsa(cliff, { alpha: 0.5, epsilon: 0.1, episodios: 200, rng: generador(2026) });
  assert.notDeepEqual(e1.Q, q1.Q);
});

/* ===================================================================== *
 * MÓDULO 4 · El max engaña: sesgo de maximización y aprendizaje doble
 * Fuente: S&B §6.7, Example 6.7, figura 6.5
 * ===================================================================== */

/** Curva «fracción de veces que se toma izquierda en A», episodio a episodio. */
const curvasM4 = new Map();
function curvaIzquierda(algoritmo, { nB = 10, ejecuciones = 2000, episodios = 300, semilla = 2026 } = {}) {
  const clave = [algoritmo.name, nB, ejecuciones, episodios, semilla].join("|");
  if (curvasM4.has(clave)) return curvasM4.get(clave);
  const entorno = mdpDosEstados({ nB });
  const { media } = promediarEjecuciones(
    (rng) => algoritmo(entorno, { alpha: 0.1, epsilon: 0.1, episodios, rng })
      .acciones0.map((a) => (a === IZQUIERDA ? 1 : 0)),
    { ejecuciones, semilla },
  );
  curvasM4.set(clave, media);
  return media;
}
const pico = (curva) => ({ valor: Math.max(...curva), episodio: curva.indexOf(Math.max(...curva)) + 1 });

test("M4-A2 [C]: el óptimo es tomar izquierda el 5 % de las veces, que es ε/2 con dos acciones", () => {
  /* Línea de referencia de la figura 6.5, p. 157. Es aritmética de la política
     ε-greedy, no simulación del MDP: con ε = 0,1 y dos acciones, la greedy se
     toma con probabilidad 1 − ε + ε/2 y la otra con ε/2 = 0,05. Se comprueba
     sobre `politicaEpsilonGreedy` con una Q en la que gana la derecha. */
  const Q = [[0, 1]]; // izquierda 0, derecha 1
  const rng = generador(2026);
  const N = 200000;
  let izquierdas = 0;
  for (let i = 0; i < N; i++) {
    if (politicaEpsilonGreedy(Q, 0, 0.1, rng, 2) === IZQUIERDA) izquierdas++;
  }
  // 4σ ≈ 0,002 con N = 200 000; la tolerancia 0,003 es holgada y sigue siendo
  // incompatible con cualquier implementación que reparta ε de otra forma.
  cerca(izquierdas / N, 0.05, 0.003, "M4-A2");
});

test("M4-A3 [C]: E[max] de dos normales vale μ + σ/√π = 0,46419 — el valor analítico", () => {
  /* El único valor exacto del módulo y el ancla del generador normal: si
     Box-Muller estuviera mal, es lo primero que falla. Tolerancia 1e-2 con
     200 000 muestras, la que declara el guion (el error de Monte Carlo con esa
     n es ~0,003). */
  const analitico = -0.1 + 1 / Math.sqrt(Math.PI);
  cerca(analitico, 0.46419, 1e-5, "M4-A3 (la cifra del guion es el valor analítico)");
  const estimado = esperanzaDelMaximo({ n: 2, sigma: 1, muestras: 200000, rng: generador(2026) });
  cerca(estimado, analitico, 1e-2, "M4-A3");
});

test("M4-A4 [R]: E[max] vale −0,10, 1,06, 1,44 y 1,77 para n = 1, 5, 10 y 20", () => {
  /* Tolerancia 0,03 con 20 000 muestras, la del guion. El 1,44 de n = 10 es el
     número que se cita en la lectura del módulo: diez acciones que valen todas
     −0,1 y cuyo máximo estimado vale +1,44. */
  const esperados = { 1: -0.1, 5: 1.06, 10: 1.44, 20: 1.77 };
  for (const [n, objetivo] of Object.entries(esperados)) {
    const x = esperanzaDelMaximo({ n: Number(n), sigma: 1, muestras: 20000, rng: generador(2026) });
    cerca(x, objetivo, 0.03, `M4-A4: n = ${n}`);
  }
});

test("M4-A5 [R]: E[max] es estrictamente creciente en n y en σ", () => {
  // Propiedad del máximo de muestras i.i.d.; misma semilla en todos los puntos.
  const porN = [1, 2, 3, 5, 10, 20].map(
    (n) => esperanzaDelMaximo({ n, sigma: 1, muestras: 20000, rng: generador(2026) }),
  );
  for (let i = 1; i < porN.length; i++) {
    assert.ok(porN[i] > porN[i - 1], `M4-A5: no crece en n entre ${porN[i - 1]} y ${porN[i]}`);
  }
  const porSigma = [0.5, 1, 2, 4].map(
    (sigma) => esperanzaDelMaximo({ n: 10, sigma, muestras: 20000, rng: generador(2026) }),
  );
  for (let i = 1; i < porSigma.length; i++) {
    assert.ok(porSigma[i] > porSigma[i - 1], "M4-A5: no crece en σ");
  }
  // Con n = 1 no hay sesgo: el máximo de una muestra es insesgado.
  cerca(porN[0], -0.1, 0.03, "M4-A5: n = 1 sin sesgo");
});

test("M4-A6 [R]: Q-learning arranca en el 50 %, llega al 94 % hacia el episodio 22 y baja al 12 %", () => {
  /* Figura 6.5, p. 157: pico ≈95 % y descenso. Tolerancia 3 puntos, la del
     guion. 2 000 ejecuciones (el libro promedia 10 000; ver M4-A9). */
  const curva = curvaIzquierda(qLearning);
  cerca(curva[0], 0.5, 0.03, "M4-A6: episodio 1");
  const { valor, episodio } = pico(curva);
  cerca(valor, 0.94, 0.03, "M4-A6: pico");
  assert.ok(Math.abs(episodio - 22) <= 3, `M4-A6: el pico está en el episodio ${episodio}`);
  cerca(curva[299], 0.12, 0.03, "M4-A6: episodio 300");
});

test("M4-A7 [R]: Q-learning doble no pasa del 53 % y termina en el 6,5 %", () => {
  /* CORRECCIÓN DEL GUION: dice «nunca pasa del 51 %»; el pico real del motor es
     52,5 % (en el episodio 4). La afirmación correcta —y la que debe aparecer
     en la página— es «no pasa del 53 %». Se escribe el umbral del motor: bajar
     la tolerancia para salvar el 51 % sería tapar el número, no comprobarlo.
     El primer episodio sí sale en el 50 %, y eso depende de que los empates del
     argmax se deshagan al azar (pie de la figura 6.5). */
  const curva = curvaIzquierda(qLearningDoble);
  cerca(curva[0], 0.5, 0.03, "M4-A7: episodio 1");
  const { valor } = pico(curva);
  assert.ok(valor <= 0.53, `M4-A7: el pico del doble es ${valor}, debería no pasar del 53 %`);
  cerca(valor, 0.525, 0.01, "M4-A7: pico (valor del motor)");
  cerca(curva[299], 0.07, 0.03, "M4-A7: episodio 300");
  // Y el contraste que sostiene el módulo: el pico del doble es muchísimo menor.
  assert.ok(pico(curvaIzquierda(qLearning)).valor - valor > 0.35);
});

test("M4-A8 [R]: el pico de Q-learning crece con n_B (63, 87, 94, 96 %) y el del doble no se mueve", () => {
  /* Es la aserción que justifica que n_B sea el control protagonista del
     módulo: el libro no publica cuántas acciones tiene B. Tolerancia 4 puntos,
     la del guion. */
  const esperados = { 2: 0.63, 5: 0.87, 10: 0.94, 20: 0.96 };
  const picos = [];
  for (const [nB, objetivo] of Object.entries(esperados)) {
    const simple = pico(curvaIzquierda(qLearning, { nB: Number(nB) })).valor;
    cerca(simple, objetivo, 0.04, `M4-A8: pico de Q-learning con n_B = ${nB}`);
    picos.push(simple);
    const doble = pico(curvaIzquierda(qLearningDoble, { nB: Number(nB) })).valor;
    // Mismo umbral corregido que en M4-A7 (el guion dice 51 %).
    assert.ok(doble <= 0.53, `M4-A8: el doble llega al ${doble} con n_B = ${nB}`);
  }
  for (let i = 1; i < picos.length; i++) {
    assert.ok(picos[i] > picos[i - 1], "M4-A8: el sesgo debe crecer con n_B");
  }
});

test("M4-A9 [R]: el pico con 2 000 y con 5 000 ejecuciones coincide dentro de 0,5 puntos", () => {
  // Justifica bajar de las 10 000 ejecuciones del libro a las 2 000 de la página.
  const con2000 = pico(curvaIzquierda(qLearning)).valor;
  const con5000 = pico(curvaIzquierda(qLearning, { ejecuciones: 5000 })).valor;
  cerca(con2000, con5000, 0.005, "M4-A9");
});

test("M4-A10 [C]: E[Q2(A*)] = q(A*) con Q1 y Q2 independientes — la afirmación que sostiene el método", () => {
  /* S&B §6.7, p. 157. Con 100 000 muestras sintéticas y n = 10: el valor que
     Q2 asigna a la acción elegida por Q1 es insesgado, mientras que el máximo
     de Q1 vale 1,44 (el sesgo de M4-A4). Es el mecanismo del aprendizaje doble
     aislado del algoritmo: separar quién elige de quién evalúa. */
  const rng = generador(2026);
  const n = 10;
  const q = -0.1;
  const M = 100000;
  let sumaCruzada = 0;
  let sumaMaximo = 0;
  for (let m = 0; m < M; m++) {
    const Q1 = [];
    const Q2 = [];
    for (let i = 0; i < n; i++) {
      Q1.push(rng.normal(q, 1));
      Q2.push(rng.normal(q, 1));
    }
    const aEstrella = argmax(Q1, rng);
    sumaCruzada += Q2[aEstrella]; // quien elige no evalúa: insesgado
    sumaMaximo += Q1[aEstrella]; // quien elige evalúa: sesgado
  }
  cerca(sumaCruzada / M, q, 0.02, "M4-A10: E[Q2(A*)]");
  cerca(sumaMaximo / M, 1.44, 0.03, "M4-A10: E[max Q1] (el sesgo, para contraste)");
});

/* ===================================================================== *
 * CONTRATO DEL MOTOR Y REPRODUCIBILIDAD
 * ===================================================================== */

const FUENTE = readFileSync(join(RAIZ, "assets", "sinmodelo.js"), "utf8");

test("contrato: `sinmodelo.js` no usa el azar global del lenguaje", () => {
  // Toda la aleatoriedad entra por `generador(semilla)`; si no, nada sería
  // reproducible. La cadena se compone para que este test no se autodelate.
  assert.equal(FUENTE.includes(["Math", "random"].join(".")), false);
});

test("contrato: `sinmodelo.js` no toca el DOM — es matemática pura y testeable", () => {
  for (const prohibida of ["document", "window", "SVG", "createElement"]) {
    assert.equal(
      FUENTE.includes(prohibida),
      false,
      `contrato: el motor menciona «${prohibida}»; debe seguir siendo puro`,
    );
  }
});

test("contrato: `muestrearEpisodio` consume EXACTAMENTE un valor del rng por paso en el paseo", () => {
  /* Es el contrato con `npasos.js` (ficha `contrato-motores.md` §2.2): un valor
     de más y cambian todos los números reproducibles de las dos páginas. Se
     comprueba con un generador falso que cuenta llamadas y siempre va a la
     derecha: desde C (índice 2) son tres pasos y tres consumos. */
  let llamadas = 0;
  const rngContador = {
    uniforme() {
      llamadas++;
      return 0.1; // < 0,5 ⇒ siempre a la derecha
    },
  };
  const episodio = muestrearEpisodio(paseoAleatorio(), null, null, rngContador);
  assert.deepEqual(episodio.estados, [2, 3, 4]);
  assert.deepEqual(episodio.recompensas, [0, 0, 1]);
  assert.deepEqual(episodio.acciones, [], "un proceso de recompensa no tiene acciones");
  assert.equal(episodio.T, 3);
  assert.equal(episodio.truncado, false);
  assert.equal(llamadas, 3, "un valor del rng por paso, ni uno más");
  // `inicio()` del paseo es determinista: no consume nada.
  assert.equal(paseo5.inicio(), 2);
});

test("contrato: `loteEpisodios` usa UN generador para todo el lote, no uno por repetición", () => {
  /* Condición del libro para el barrido de la figura 7.2: las repeticiones
     tienen que ver caminos distintos. Si se reiniciase el generador por fila,
     las dos filas serían idénticas y la comparación entre valores de n dejaría
     de tener sentido. */
  const lote = loteEpisodios(paseo5, null, null, { repeticiones: 2, episodios: 5 });
  assert.equal(lote.length, 2);
  assert.equal(lote[0].length, 5);
  assert.notDeepEqual(lote[0], lote[1]);
  // Y con la misma semilla, el lote entero se repite.
  assert.deepEqual(
    loteEpisodios(paseo5, null, null, { repeticiones: 2, episodios: 5 }),
    lote,
  );
  assert.equal(
    JSON.stringify(loteEpisodios(paseo5, null, null, { semilla: 7, repeticiones: 2, episodios: 5 })) === JSON.stringify(lote),
    false,
    "semillas distintas deben dar lotes distintos",
  );
});

test("contrato: `politicaGreedyDe` desempata al ÍNDICE MENOR, de forma determinista", () => {
  // Es una política que se PINTA, no una que se ejecuta: el dibujo tiene que
  // ser reproducible. Y los estados sin acciones devuelven null, no 0.
  const Q = [[0, 0, 0, 0], [1, 5, 5, 2], [], [3, 1]];
  assert.deepEqual(politicaGreedyDe(Q), [0, 1, null, 0]);
  assert.throws(() => politicaGreedyDe(Q, { desempate: "aleatorio" }), /desempate desconocido/);
});

test("contrato: `seguirPolitica` detecta ciclos y rechaza los entornos que consumen azar", () => {
  /* En un entorno determinista con política determinista, volver a pisar un
     estado ya visitado significa ciclo infinito. Es lo que le pasa de verdad a
     7 de las 50 políticas greedy de SARSA (M3-A5). */
  const enCirculo = new Array(cliff.nEstados).fill(accNav("N"));
  enCirculo[36] = accNav("N");
  enCirculo[24] = accNav("S");
  const r = seguirPolitica(cliff, enCirculo);
  assert.equal(r.ciclo, true);
  assert.equal(r.llega, false);
  assert.ok(r.pasos < 200, "el ciclo se corta en cuanto se repite un estado");

  assert.throws(
    () => seguirPolitica(mdpDosEstados(), [IZQUIERDA, 0, null]),
    /solo admite entornos deterministas/,
  );
});

test("contrato: `mediaMovil` recorta la ventana en los extremos", () => {
  assert.deepEqual(mediaMovil([1, 2, 3, 4, 5], 3), [1.5, 2, 3, 4, 4.5]);
  assert.deepEqual(mediaMovil([1, 2, 3], 1), [1, 2, 3]);
  assert.throws(() => mediaMovil([1, 2], 0), /ventana debe ser un entero ≥ 1/);
});

test("contrato: los parámetros no publicados por el libro no tienen valor por omisión", () => {
  /* Los cinco parámetros que la página elige (α del acantilado, número de
     ejecuciones promediadas…) están declarados en la página, no escondidos en
     el motor: llamar sin ellos tiene que fallar, no adivinar. */
  assert.throws(() => sarsa(cliff, { epsilon: 0.1, episodios: 1, rng: generador(1) }), /alpha/);
  assert.throws(() => qLearning(cliff, { epsilon: 0.1, episodios: 1, rng: generador(1) }), /alpha/);
  assert.throws(() => expectedSarsa(cliff, { epsilon: 0.1, episodios: 1, rng: generador(1) }), /alpha/);
  assert.throws(() => qLearningDoble(cliff, { epsilon: 0.1, episodios: 1, rng: generador(1) }), /alpha/);
  assert.throws(
    () => curvaRMS(paseo5, { metodo: "td", alpha: 0.1, episodios: 1, semilla: 1 }),
    /ejecuciones debe ser un entero ≥ 1/,
  );
  assert.throws(() => promediarEjecuciones(() => [0], { semilla: 1 }), /ejecuciones/);
});

test("contrato: las entradas inválidas se rechazan con un mensaje claro, antes de calcular", () => {
  assert.throws(() => paseoAleatorio({ nEstados: 0 }), /nEstados debe ser un entero ≥ 1/);
  assert.throws(() => paseoAleatorio({ nEstados: 4.5 }), /nEstados debe ser un entero ≥ 1/);
  assert.throws(() => mdpDosEstados({ nB: 0 }), /nB debe ser un entero ≥ 1/);
  assert.throws(() => mdpDosEstados({ sigma: 0 }), /sigma debe ser > 0/);
  assert.throws(() => rejilla3x3Permutada({ estado: 99 }), /estado fuera de rango/);
  assert.throws(() => rejilla3x3Permutada({ a1: 9 }), /acción fuera de rango/);
  assert.throws(
    () => prediccionMC(paseo5, { alpha: 0.1, episodios: 1, rng: generador(1), visitas: "ultima" }),
    /visitas debe ser "primera" o "cada"/,
  );
  assert.throws(
    () => prediccionPorLotes(paseo5, [], { metodo: "dp" }),
    /metodo debe ser "mc" o "td"/,
  );
  assert.throws(() => curvaRMS(cliff, { metodo: "td", alpha: 0.1, episodios: 1, ejecuciones: 1, semilla: 1 }),
    /no conoce sus valores verdaderos/);
  assert.throws(
    () => muestrearEpisodio(cliff, null, null, generador(1)),
    /el entorno tiene acciones y no se ha dado política/,
  );
  assert.throws(() => errorRMS([], [], []), /no hay estados sobre los que promediar/);
  assert.throws(() => esperanzaDelMaximo({ n: 2, sigma: 1 }), /hace falta un rng/);
  // Y el aviso de divergencia del modo por lotes, en vez de devolver NaN.
  const lote = prediccionTD(paseo5, { alpha: 0.1, episodios: 100, rng: generador(2026) }).episodios;
  assert.throws(
    () => prediccionPorLotes(paseo5, lote, { metodo: "td", alpha: 0.01 }),
    /la iteración diverge/,
  );
});

test("reproducibilidad: la misma semilla da exactamente el mismo resultado dos veces", () => {
  const dosVeces = (f) => assert.deepEqual(f(), f());
  dosVeces(() => prediccionTD(paseo5, { alpha: 0.1, episodios: 30, rng: generador(2026) }).V);
  dosVeces(() => prediccionMC(paseo5, { alpha: 0.1, episodios: 30, rng: generador(2026) }).V);
  dosVeces(() => sarsa(cliff, { alpha: 0.5, epsilon: 0.1, episodios: 30, rng: generador(2026) }).sumas);
  dosVeces(() => qLearning(cliff, { alpha: 0.5, epsilon: 0.1, episodios: 30, rng: generador(2026) }).sumas);
  dosVeces(() => qLearningDoble(mdpDosEstados(), {
    alpha: 0.1, epsilon: 0.1, episodios: 50, rng: generador(2026),
  }).acciones0);
  dosVeces(() => [esperanzaDelMaximo({ n: 10, sigma: 1, muestras: 500, rng: generador(2026) })]);

  // Y la semilla hace algo: con otra, los resultados cambian.
  assert.notDeepEqual(
    sarsa(cliff, { alpha: 0.5, epsilon: 0.1, episodios: 30, rng: generador(2026) }).sumas,
    sarsa(cliff, { alpha: 0.5, epsilon: 0.1, episodios: 30, rng: generador(7) }).sumas,
  );
});
