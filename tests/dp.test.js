/* Tests del motor de programación dinámica del Tema 3 (`assets/dp.js`).
 *
 * No comprueban «que el código no falle»: comprueban que el código REPRODUCE
 * el material de clase y el libro. Cada test lleva el código de la aserción
 * del guion (`Interactivo/T3_recurso/guion-recurso.md`, §8 de cada módulo y
 * §C4) para que se pueda rastrear del número al párrafo que lo justifica.
 *
 *   cd Interactivo/web && npm test
 *
 * Cuatro decisiones del implementador que estos tests dan por buenas y
 * documentan donde se notan:
 *   1. La tolerancia 1e-3 de M1-A9 es inalcanzable (ver el test de M1-A9).
 *   2. La parada es «iterar mientras Δ > θ», no «hasta Δ < θ» estricto (M1-A6).
 *   3. En `iteracionPoliticaTruncada` la parada se comprueba tras la MEJORA (M5-A4).
 *   4. `politicaL`, `empatesGreedy` y `desempatar` devuelven 16 entradas,
 *      terminales incluidos, como el resto de `mdp.js` (test de contrato).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCIONES_GW,
  gridworld4x4,
  estadosNoTerminales,
  politicaL,
  evaluar,
  empatesGreedy,
  accionesOptimas,
  esOptima,
  desempatar,
  iteracionPolitica,
  distribucionRondas,
  iteracionPoliticaTruncada,
  costePorM,
  residuosGPI,
  trayectoriaGPI,
  distanciaMinima,
  alcanzaTerminal,
} from "../assets/dp.js";

import {
  politicaEquiprobable,
  politicaDeterminista,
  evaluarLineal,
  qDeV,
  iteracionValor,
  numeroPoliticasOptimas,
  residuoOptimalidad,
  probabilidad,
  simularEpisodio,
} from "../assets/mdp.js";

import { generador, coordenadasDosRectas } from "../assets/nucleo.js";

/* ===================================================================== *
 * Utilidades comunes
 * ===================================================================== */

const GAMMA = 1; // fijo en todo el Tema 3
const THETA = 1e-4;

/** El MDP es inmutable: ninguna función de `dp.js` lo modifica. */
const mdp = gridworld4x4();
const noTerminales = estadosNoTerminales(mdp);
const TERMINALES = [0, 15];

/** Índice de acción a partir de su nombre ("N", "S", "O", "E"). */
const acc = (nombre) => ACCIONES_GW.indexOf(nombre);
/** Conjunto de acciones como cadena ordenada, para comparar sin ambigüedad. */
const nombres = (lista) => lista.map((i) => ACCIONES_GW[i]).sort().join("");

/** Sucesiones caras que usan varios módulos: se calculan una sola vez. */
const piEquiprobable = politicaEquiprobable(mdp);
const evaluacion = evaluar(mdp, piEquiprobable, GAMMA, { theta: THETA });
const vPiExacta = evaluarLineal(mdp, piEquiprobable, GAMMA); // v_π sin truncar
const vOptima = iteracionValor(mdp, GAMMA, { tolerancia: 1e-12 }).v;
const optimas = accionesOptimas(mdp, GAMMA);

/** Acción determinista almacenada en una fila π(·|s). */
const accionDe = (pi, s) => pi[s].findIndex((p) => p > 0.999999);

/** π′ = π salvo en s0, donde toma a0 (la construcción del módulo 2). */
function politicaAlterada(base, s0, a0) {
  return politicaDeterminista(mdp, (s) => {
    if (mdp.esTerminal(s)) return null;
    return s === s0 ? a0 : accionDe(base, s);
  });
}

/** Comprueba V(s) estado a estado contra una función esperada. */
function comprobarValores(v, esperado, tol, etiqueta) {
  for (const s of noTerminales) {
    const objetivo = esperado(s);
    assert.ok(
      Math.abs(v[s] - objetivo) <= tol,
      `${etiqueta}: V(${s}) = ${v[s]}, se esperaba ${objetivo}`,
    );
  }
  for (const t of TERMINALES) assert.equal(v[t], 0, `${etiqueta}: V(terminal ${t}) ≠ 0`);
}

/* ===================================================================== *
 * El entorno — Sutton & Barto, Example 4.1 · 3_Tema3#slide-10
 * ===================================================================== */

test("entorno: 16 estados, terminales {0, 15} y 14 no terminales con transiciones", () => {
  assert.equal(mdp.nEstados, 16);
  assert.equal(mdp.nAcciones, 4);
  assert.deepEqual(ACCIONES_GW, ["N", "S", "O", "E"]);
  assert.deepEqual(TERMINALES.filter((s) => mdp.esTerminal(s)), TERMINALES);
  assert.equal(noTerminales.length, 14);
  assert.deepEqual(mdp.etiquetas[0], "T");
  assert.deepEqual(mdp.etiquetas[15], "T");
  assert.equal(mdp.etiquetas[7], "7");
  for (const s of noTerminales) {
    for (let a = 0; a < mdp.nAcciones; a++) {
      assert.equal(mdp.P[s][a].length, 1, `la dinámica debe ser determinista en (${s}, ${a})`);
    }
  }
  for (const t of TERMINALES) {
    for (let a = 0; a < mdp.nAcciones; a++) {
      assert.equal(mdp.P[t][a].length, 0, "los terminales son absorbentes: sin salidas");
    }
  }
});

test("entorno: rebote contra el borde — p(7,−1|7,E) = 1 y p(6,−1|5,E) = 1", () => {
  // Los dos ejemplos literales del libro (Example 4.1).
  assert.equal(probabilidad(mdp, 7, -1, 7, acc("E")), 1);
  assert.equal(probabilidad(mdp, 6, -1, 5, acc("E")), 1);
  // Y el rebote por arriba, que es el que crea los −∞ del módulo 2.
  assert.equal(probabilidad(mdp, 1, -1, 1, acc("N")), 1);
});

test("entorno: r = −1 en las 56 transiciones y p(·|s,a) suma 1", () => {
  let pares = 0;
  for (const s of noTerminales) {
    for (let a = 0; a < mdp.nAcciones; a++) {
      pares++;
      let suma = 0;
      for (const t of mdp.P[s][a]) {
        assert.equal(t.r, -1, `r ≠ −1 en (${s}, ${ACCIONES_GW[a]})`);
        suma += t.p;
      }
      assert.ok(Math.abs(suma - 1) < 1e-12);
    }
  }
  assert.equal(pares, 56); // 14 estados × 4 acciones
});

/* ===================================================================== *
 * MÓDULO 1 · Evaluación iterativa y el umbral θ
 * Fuente: figura 4.1 de Sutton & Barto · 3_Tema3#slide-10
 * ===================================================================== */

test("M1-A1: k = 1 vale −1 en los catorce estados (figura 4.1)", () => {
  comprobarValores(evaluacion.historial[1], () => -1, 0, "M1-A1");
});

test("M1-A2: k = 2 vale −7/4 en las esquinas cercanas y −2 en los otros diez", () => {
  /* El libro IMPRIME −1,7 en esa fila de la figura 4.1: es un truncamiento a
     una cifra decimal, no el valor. El valor exacto es −7/4 = −1,75, y estos
     tests comparan contra el cálculo, no contra la tabla impresa (guion,
     M1 §8, «trampa declarada»). Si alguien "arregla" esto a −1,7, rompe el
     motor para cuadrar con una errata tipográfica. */
  const cercanos = [1, 4, 11, 14];
  comprobarValores(
    evaluacion.historial[2],
    (s) => (cercanos.includes(s) ? -7 / 4 : -2),
    0,
    "M1-A2",
  );
  assert.equal(evaluacion.historial[2][1], -1.75);
});

test("M1-A3: k = 3 vale −39/16, −47/16, −23/8 y −3 según la celda", () => {
  const esperado = (s) => {
    if ([1, 4, 11, 14].includes(s)) return -39 / 16; // −2,4375 (el libro imprime −2,4)
    if ([2, 7, 8, 13].includes(s)) return -47 / 16; // −2,9375 (imprime −2,9)
    if ([5, 10].includes(s)) return -23 / 8; //        −2,875  (imprime −2,9)
    return -3; //                                     −3,0
  };
  comprobarValores(evaluacion.historial[3], esperado, 0, "M1-A3");
});

test("M1-A4: k = 10 reproduce las cinco fracciones exactas de la figura 4.1", () => {
  /* El guion escribe −8,35239… para el estado 2; la fracción que él mismo da,
     −136845/16384, vale −8,3523559…  La fracción es la buena (es lo que sale
     de diez barridos exactos); el decimal del guion tiene una errata. */
  const v = evaluacion.historial[10];
  const esperados = {
    1: -201129 / 32768,
    2: -136845 / 16384,
    3: -293841 / 32768,
    5: -253539 / 32768,
    6: -276163 / 32768,
  };
  for (const [s, objetivo] of Object.entries(esperados)) {
    assert.ok(
      Math.abs(v[s] - objetivo) < 1e-9,
      `M1-A4: V_10(${s}) = ${v[s]}, se esperaba ${objetivo}`,
    );
  }
  // La simetría de la rejilla: el estado 4 es el reflejado del 1, etc.
  for (const [a, b] of [[1, 4], [2, 8], [3, 12], [6, 9], [7, 13]]) {
    assert.ok(Math.abs(v[a] - v[b]) < 1e-12, `M1-A4: simetría rota entre ${a} y ${b}`);
  }
});

test("M1-A5: θ = 1e-4 síncrono → 173 barridos y mín_s V(s) = −21,99824…", () => {
  assert.equal(evaluacion.barridos, 173);
  assert.ok(evaluacion.convergido);
  const minimo = Math.min(...evaluacion.v);
  assert.ok(
    Math.abs(minimo - -21.99824) < 1e-5,
    `M1-A5: mín V = ${minimo}, se esperaba −21,99824…`,
  );
  assert.ok(minimo > -22, "la sucesión se acerca a −22 por arriba, nunca lo alcanza");
});

test("M1-A6: barridos por θ en modo síncrono → 1, 47, 89, 131, 173", () => {
  /* Criterio de parada: se itera MIENTRAS Δ > θ. Con la comparación estricta
     del pseudocódigo («hasta que Δ < θ») el caso θ = 1 no pararía nunca en
     esta rejilla, porque los primeros barridos tienen Δ exactamente 1, y esta
     aserción del guion sería inalcanzable. Es además la convención de
     `evaluarIterativa` en `mdp.js` (decisión 2 del implementador). */
  const barridos = [1, 1e-1, 1e-2, 1e-3, 1e-4].map(
    (theta) => evaluar(mdp, piEquiprobable, GAMMA, { theta }).barridos,
  );
  assert.deepEqual(barridos, [1, 47, 89, 131, 173]);
});

test("M1-A7: barridos por θ en modo in situ → 9, 36, 62, 88, 114", () => {
  const barridos = [1, 1e-1, 1e-2, 1e-3, 1e-4].map(
    (theta) => evaluar(mdp, piEquiprobable, GAMMA, { theta, modo: "insitu" }).barridos,
  );
  assert.deepEqual(barridos, [9, 36, 62, 88, 114]);
  // «In situ suele converger más rápido» (Sutton & Barto §4.1): 114 < 173.
  assert.ok(barridos[4] < 173);
});

test("M1-A8: in situ en k = 1 NO es la figura 4.1 (−1, −5/4, −21/16, −3/2)", () => {
  const v = evaluar(mdp, piEquiprobable, GAMMA, { theta: THETA, modo: "insitu" }).historial[1];
  assert.equal(v[1], -1);
  assert.equal(v[2], -5 / 4);
  assert.equal(v[3], -21 / 16);
  assert.equal(v[5], -3 / 2);
  // La prueba de que el orden fila-mayor propaga los valores nuevos:
  assert.notEqual(v[2], -1);
});

test("M1-A9: el límite es (0,−14,−20,−22,…), la fila k = ∞ de la figura 4.1", () => {
  const limite = [0, -14, -20, -22, -14, -18, -20, -20, -20, -20, -18, -14, -22, -20, -14, 0];
  const desviacion = Math.max(...limite.map((x, s) => Math.abs(evaluacion.v[s] - x)));

  /* TOLERANCIA: el guion pide 1e-3 y esa cifra es INALCANZABLE con θ = 1e-4;
     el propio guion se contradice, porque su M1-A5 ya lista mín V = −21,9982…,
     que dista 1,8·10⁻³ de −22. La desviación máxima real es 1,76·10⁻³, así que
     aquí se usa 2·10⁻³ (decisión 1 del implementador). Se fija además el valor
     de la desviación para que un cambio del motor que la empeore se note. */
  comprobarValores(evaluacion.v, (s) => limite[s], 2e-3, "M1-A9");
  assert.ok(desviacion > 1e-3, "con θ = 1e-4 la tolerancia 1e-3 del guion no se alcanza");
  assert.ok(desviacion < 1.8e-3, `desviación máxima ${desviacion}, se esperaba ≈1,76e-3`);

  // Contra los valores EXACTOS (evaluarLineal), el límite sí es entero:
  comprobarValores(vPiExacta, (s) => limite[s], 1e-9, "M1-A9 exacta");
});

test("M1-A10: v_π(s) es el negativo del número esperado de pasos hasta terminar", () => {
  const rng = generador(2026);
  const N = 3000;
  let pasos = 0;
  for (let i = 0; i < N; i++) {
    const episodio = simularEpisodio(mdp, piEquiprobable, 1, rng, { maxPasos: 5000 });
    assert.ok(episodio.terminado, "la política equiprobable termina con probabilidad 1");
    pasos += episodio.pasos.length;
  }
  const media = pasos / N;
  assert.ok(
    Math.abs(-media - vPiExacta[1]) < 0.6,
    `Monte Carlo dio −${media} pasos, v_π(1) = ${vPiExacta[1]}`,
  );
  assert.equal(vPiExacta[1], -14);
});

/* ===================================================================== *
 * MÓDULO 2 · Teorema de mejora de la política
 * Fuente: Sutton & Barto §4.2, ecs. (4.6)–(4.8) · 3_Tema3#slide-5
 * ===================================================================== */

const piL = politicaL(mdp);
const vL = evaluarLineal(mdp, piL, GAMMA);
const qL = qDeV(mdp, vL, GAMMA);

test("M2-A1: v_π de la política L vale fila(s) + columna(s) − 6", () => {
  comprobarValores(vL, (s) => Math.floor(s / 4) + (s % 4) - 6, 1e-9, "M2-A1");
  // La rejilla completa tal como aparece en pantalla:
  assert.deepEqual(
    vL,
    [0, -5, -4, -3, -5, -4, -3, -2, -4, -3, -2, -1, -3, -2, -1, 0],
  );
});

test("M2-A2: (1, O) mejora estrictamente — q = −1 > v_π(1) = −5 y Δv = +4 solo en 1", () => {
  assert.equal(qL[1][acc("O")], -1);
  assert.equal(vL[1], -5);
  const v2 = evaluarLineal(mdp, politicaAlterada(piL, 1, acc("O")), GAMMA);
  assert.equal(v2[1] - vL[1], 4);
  for (const s of noTerminales) {
    if (s !== 1) assert.equal(v2[s] - vL[s], 0, `M2-A2: cambia el estado ${s}`);
  }
});

test("M2-A3: (4, N) mejora estrictamente — q = −1 > v_π(4) = −5 y Δv = +4 solo en 4", () => {
  assert.equal(qL[4][acc("N")], -1);
  assert.equal(vL[4], -5);
  const v2 = evaluarLineal(mdp, politicaAlterada(piL, 4, acc("N")), GAMMA);
  assert.equal(v2[4] - vL[4], 4);
  for (const s of noTerminales) {
    if (s !== 4) assert.equal(v2[s] - vL[s], 0, `M2-A3: cambia el estado ${s}`);
  }
});

test("M2-A4: (5, E) es el caso de igualdad — q = v_π(5) = −4 y v_π′ = v_π en los catorce", () => {
  assert.equal(qL[5][acc("E")], -4);
  assert.equal(vL[5], -4);
  const v2 = evaluarLineal(mdp, politicaAlterada(piL, 5, acc("E")), GAMMA);
  comprobarValores(v2, (s) => vL[s], 1e-9, "M2-A4");
});

test("M2-A5: (6, E) es otro caso de igualdad — q = v_π(6) = −3 y v_π′ = v_π", () => {
  assert.equal(qL[6][acc("E")], -3);
  assert.equal(vL[6], -3);
  const v2 = evaluarLineal(mdp, politicaAlterada(piL, 6, acc("E")), GAMMA);
  comprobarValores(v2, (s) => vL[s], 1e-9, "M2-A5");
});

test("M2-A6: (2, O) empeora — q = −6 < v_π(2) = −4 y v_π′(2) = −6, resto igual", () => {
  assert.equal(qL[2][acc("O")], -6);
  assert.equal(vL[2], -4);
  const v2 = evaluarLineal(mdp, politicaAlterada(piL, 2, acc("O")), GAMMA);
  assert.equal(v2[2], -6);
  for (const s of noTerminales) {
    if (s !== 2) assert.equal(v2[s], vL[s], `M2-A6: cambia el estado ${s}`);
  }
});

test("M2-A7: (1, N) da −∞ — sistema singular y el estado 1 no alcanza el terminal", () => {
  assert.equal(qL[1][acc("N")], -6);
  assert.ok(qL[1][acc("N")] < vL[1]);
  const pi2 = politicaAlterada(piL, 1, acc("N"));
  assert.equal(evaluarLineal(mdp, pi2, GAMMA), null, "el sistema (I − P_π) debe ser singular");
  const llega = alcanzaTerminal(mdp, pi2);
  assert.equal(llega[1], false, "desde el 1 se rebota contra la pared para siempre");
  for (const s of noTerminales) {
    if (s !== 1) assert.equal(llega[s], true, `M2-A7: el estado ${s} sí debería terminar`);
  }
});

/** Clasificación de los 56 pares: la comparten M2-A8, M2-A9 y M2-A10. */
function clasificarPares() {
  const mejoran = [];
  const empatan = [];
  const empeoran = [];
  const infinitos = [];
  const contraejemplos = [];
  for (const s of noTerminales) {
    for (let a = 0; a < mdp.nAcciones; a++) {
      const clave = `${s},${ACCIONES_GW[a]}`;
      const diferencia = qL[s][a] - vL[s];
      if (diferencia > 1e-9) mejoran.push(clave);
      else if (diferencia >= -1e-9) empatan.push(clave);
      else empeoran.push(clave);

      const pi2 = politicaAlterada(piL, s, a);
      const v2 = evaluarLineal(mdp, pi2, GAMMA);
      const llega = alcanzaTerminal(mdp, pi2);
      if (noTerminales.some((x) => !llega[x])) infinitos.push(clave);

      // Hipótesis del teorema: q_π(s, π′(s)) ≥ v_π(s) ⟹ v_π′ ≥ v_π en todos.
      if (diferencia >= -1e-9) {
        if (v2 === null || noTerminales.some((x) => v2[x] < vL[x] - 1e-9)) {
          contraejemplos.push(clave);
        }
      }
    }
  }
  return { mejoran, empatan, empeoran, infinitos, contraejemplos };
}

const pares = clasificarPares();

test("M2-A8: de los 56 pares, 2 mejoran, 22 empatan y 32 empeoran", () => {
  assert.equal(pares.mejoran.length + pares.empatan.length + pares.empeoran.length, 56);
  assert.equal(pares.mejoran.length, 2);
  assert.equal(pares.empatan.length, 22);
  assert.equal(pares.empeoran.length, 32);
  // Los dos que mejoran son exactamente M2-A2 y M2-A3:
  assert.deepEqual(pares.mejoran.sort(), ["1,O", "4,N"]);
});

test("M2-A9: 24 pares producen una π′ que no termina, y los 24 están entre los 32 que empeoran", () => {
  assert.equal(pares.infinitos.length, 24);
  const empeoran = new Set(pares.empeoran);
  for (const clave of pares.infinitos) {
    assert.ok(
      empeoran.has(clave),
      `M2-A9: el par ${clave} da −∞ sin empeorar, lo que contradiría el teorema`,
    );
  }
});

test("M2-A10: el teorema de mejora se cumple en los 56 pares, sin un solo contraejemplo", () => {
  /* Es el test más valioso del recurso: comprueba (4.7) ⟹ (4.8) por fuerza
     bruta sobre todos los cambios de una sola acción. */
  assert.deepEqual(pares.contraejemplos, []);
});

/* ===================================================================== *
 * MÓDULO 3 · Iteración de política y la última línea que no siempre para
 * Fuente: Sutton & Barto §4.3, caja de Policy Iteration, ejercicio 4.4
 * ===================================================================== */

const ipDeterminista = iteracionPolitica(mdp, GAMMA, { theta: THETA });

test("M3-A1: la ronda 1 cuesta 173 barridos y su política greedy ya es óptima", () => {
  const faseE = ipDeterminista.historial[0];
  const faseI = ipDeterminista.historial[1];
  assert.equal(faseE.fase, "E");
  assert.equal(faseE.barridosFase, 173);
  assert.equal(faseE.pi, null, "π_0 es la equiprobable: no hay acción almacenada todavía");

  const esperada = {
    1: "O", 2: "O", 3: "OS", 4: "N", 5: "NO", 6: "OS", 7: "S",
    8: "N", 9: "EN", 10: "ES", 11: "S", 12: "EN", 13: "E", 14: "E",
  };
  for (const s of noTerminales) {
    assert.equal(
      nombres(faseI.empates[s]),
      nombres(esperada[s].split("").map(acc)),
      `M3-A1: greedy en el estado ${s}`,
    );
  }
  assert.ok(esOptima(faseI.empates, optimas), "todas sus acciones deben ser óptimas");
});

test("M3-A2: v_* es el negativo de la distancia de Manhattan al terminal más próximo", () => {
  assert.deepEqual(
    vOptima.map((x) => Math.round(x)),
    [0, -1, -2, -3, -1, -2, -3, -2, -2, -3, -2, -1, -3, -2, -1, 0],
  );
  const d = distanciaMinima(mdp);
  comprobarValores(vOptima, (s) => -d[s], 1e-9, "M3-A2");
});

test("M3-A3: los catorce conjuntos A_*(s) de acciones óptimas", () => {
  const esperados = {
    1: "O", 2: "O", 3: "OS", 4: "N", 5: "NO", 6: "ENOS", 7: "S",
    8: "N", 9: "ENOS", 10: "ES", 11: "S", 12: "EN", 13: "E", 14: "E",
  };
  for (const s of noTerminales) {
    assert.equal(nombres(optimas[s]), esperados[s], `M3-A3: A_*(${s})`);
  }
  /* La ficha de teoría dice «6 estados con dos acciones óptimas»; es falso:
     los estados 6 y 9 tienen las CUATRO (guion, M3 §8, corrección). */
  assert.equal(optimas[6].length, 4);
  assert.equal(optimas[9].length, 4);
});

test("M3-A4: hay 256 políticas deterministas óptimas (2·2·4·4·2·2)", () => {
  assert.equal(numeroPoliticasOptimas(optimas), 256);
  const conEmpate = noTerminales.filter((s) => optimas[s].length > 1);
  assert.deepEqual(conEmpate, [3, 5, 6, 9, 10, 12]);
  assert.equal(
    conEmpate.reduce((producto, s) => producto * optimas[s].length, 1),
    2 * 2 * 4 * 4 * 2 * 2,
  );
});

test("M3-A6: desempate determinista y sin corrección → 3 rondas y 178 barridos", () => {
  assert.equal(ipDeterminista.rondas, 3);
  assert.equal(ipDeterminista.barridos, 178);
  assert.ok(ipDeterminista.parado);
  const evaluaciones = ipDeterminista.historial.filter((h) => h.fase === "E");
  assert.deepEqual(evaluaciones.map((h) => h.barridosFase), [173, 4, 1]);
});

test("M3-A7: desempate determinista CON la corrección del 4.4 → 2 rondas y 177 barridos", () => {
  const corregida = iteracionPolitica(mdp, GAMMA, { theta: THETA, correccion44: true });
  assert.equal(corregida.rondas, 2);
  assert.equal(corregida.barridos, 177);
  assert.ok(corregida.parado);
  // La corrección para antes: una ronda y un barrido menos que M3-A6.
  assert.equal(ipDeterminista.rondas - corregida.rondas, 1);
});

test("M3-A8: desempate aleatorio con corrección → 2 rondas con las 20 semillas", () => {
  for (let i = 0; i < 20; i++) {
    const semilla = 1000 + i;
    const corrida = iteracionPolitica(mdp, GAMMA, {
      theta: THETA, desempate: "aleatorio", correccion44: true, rng: generador(semilla),
    });
    assert.equal(corrida.rondas, 2, `M3-A8: la semilla ${semilla} dio ${corrida.rondas} rondas`);
    assert.ok(corrida.parado);
  }
});

test("M3-A9: con desempate aleatorio, desde la ronda 3 V ya es v_* y cada ronda cuesta 1 barrido", () => {
  const corrida = iteracionPolitica(mdp, GAMMA, {
    theta: THETA, desempate: "aleatorio", rng: generador(7), maxRondas: 10,
  });
  const evaluaciones = corrida.historial.filter((h) => h.fase === "E");
  assert.ok(evaluaciones.length >= 4, "con esta semilla no debería parar tan pronto");
  for (let ronda = 2; ronda < evaluaciones.length; ronda++) {
    const maxDif = Math.max(...noTerminales.map((s) => Math.abs(evaluaciones[ronda].v[s] - vOptima[s])));
    assert.ok(maxDif < 1e-9, `M3-A9: en la ronda ${ronda + 1}, V dista ${maxDif} de v_*`);
    assert.equal(evaluaciones[ronda].barridosFase, 1);
    assert.equal(evaluaciones[ronda].delta, 0);
  }
});

/* La curva empírica: 200 repeticiones, ~0,35 s. Se calcula una vez. */
const curva = distribucionRondas(mdp, GAMMA, { repeticiones: 200, semilla: 2026, theta: THETA });

test("M3-A5: la probabilidad de parar en una ronda es 1/256 y la media teórica, 258 rondas", () => {
  const politicas = numeroPoliticasOptimas(optimas);
  assert.equal(1 / politicas, 1 / 256);
  assert.equal(2 + politicas, 258); // las dos primeras rondas son deterministas
  // El experimento no puede contradecir la teoría: media empírica de rondas − 2
  // frente a las 256 de la geométrica (tolerancia estadística amplia, R = 200).
  assert.ok(
    Math.abs(curva.media - 2 - 256) < 130,
    `M3-A5: media empírica ${curva.media}, teórica 258`,
  );
  assert.equal(Math.min(...curva.rondas) >= 2, true);
});

test("M3-A10: distribucionRondas(semilla 2026, 200 rep.) da una media en [200, 330]", () => {
  assert.equal(curva.rondas.length, 200);
  assert.ok(curva.media >= 200 && curva.media <= 330, `M3-A10: media ${curva.media}`);
  assert.equal(curva.acumulada.at(-1), 1, "la acumulada debe terminar en 1");
  assert.ok(curva.mediana > 0 && curva.mediana <= Math.max(...curva.rondas));
  // Monótona no decreciente, como toda función de distribución.
  for (let i = 1; i < curva.acumulada.length; i++) {
    assert.ok(curva.acumulada[i] >= curva.acumulada[i - 1]);
  }
});

/* ===================================================================== *
 * MÓDULO 4 · La política óptima aparece antes
 * Fuente: Sutton & Barto §4.4 y el pie de la figura 4.1
 * ===================================================================== */

/** Estados cuya política greedy respecto a V_k admite alguna acción subóptima. */
const subOptimos = (k) => {
  const greedy = empatesGreedy(mdp, evaluacion.historial[k], GAMMA);
  return noTerminales.filter((s) => greedy[s].some((a) => !optimas[s].includes(a)));
};

test("M4-A1: estados con acción greedy subóptima → 12, 8, 2, 0 y 0 para todo k ≥ 3", () => {
  assert.equal(subOptimos(0).length, 12);
  assert.equal(subOptimos(1).length, 8);
  assert.equal(subOptimos(2).length, 2);
  assert.equal(subOptimos(3).length, 0);
  for (let k = 3; k <= 173; k++) {
    assert.equal(subOptimos(k).length, 0, `M4-A1: reaparece una acción subóptima en k = ${k}`);
  }
  /* En k = 0 no son 14 sino 12: en los estados 6 y 9 las cuatro acciones son
     óptimas, así que la greedy de V ≡ 0 tampoco se equivoca ahí. */
  assert.deepEqual(subOptimos(0).includes(6), false);
  assert.deepEqual(subOptimos(0).includes(9), false);
});

test("M4-A2: máx_s |v_3(s) − v_π(s)| = 19,0 exacto (v_3(3) = −3 frente a v_π(3) = −22)", () => {
  /* Contra v_π EXACTA (evaluarLineal). Si se compara contra el iterado de
     θ = 1e-4 sale 18,99824…, que se sale de la tolerancia 1e-3 que pide el
     guion: es la misma trampa que M1-A9. */
  const v3 = evaluacion.historial[3];
  const maximo = Math.max(...noTerminales.map((s) => Math.abs(v3[s] - vPiExacta[s])));
  assert.ok(Math.abs(maximo - 19) < 1e-3, `M4-A2: máxima diferencia ${maximo}`);
  assert.equal(v3[3], -3);
  assert.equal(vPiExacta[3], -22);
});

test("M4-A3: en k = 2, los estados 3, 6, 9 y 12 llevan las cuatro flechas; solo 3 y 12 son subóptimos", () => {
  const greedy = empatesGreedy(mdp, evaluacion.historial[2], GAMMA);
  const conCuatro = noTerminales.filter((s) => greedy[s].length === 4);
  assert.deepEqual(conCuatro, [3, 6, 9, 12]);
  assert.deepEqual(subOptimos(2), [3, 12]);
});

test("M4-A4: en k = 3, Π_3(3) = A_*(3) = {S, O}", () => {
  const greedy = empatesGreedy(mdp, evaluacion.historial[3], GAMMA);
  assert.equal(nombres(greedy[3]), "OS");
  assert.equal(nombres(optimas[3]), "OS");
});

test("M4-A5: en k = 3, Π_3 ⊊ A_* en los estados 6 y 9 y aun así esOptima da true", () => {
  const greedy = empatesGreedy(mdp, evaluacion.historial[3], GAMMA);
  assert.equal(nombres(greedy[6]), "OS");
  assert.equal(nombres(optimas[6]), "ENOS");
  assert.equal(nombres(greedy[9]), "EN");
  assert.equal(nombres(optimas[9]), "ENOS");

  // El criterio es CONTENCIÓN, no igualdad (guion, M4 §6).
  assert.equal(esOptima(greedy, optimas), true);
  const hayIgualdad = noTerminales.every((s) => nombres(greedy[s]) === nombres(optimas[s]));
  assert.equal(
    hayIgualdad,
    false,
    "si esto fuese true, el test ya no distinguiría contención de igualdad",
  );
});

test("M4-A6: la evaluación completa cuesta 173 barridos (coincide con M1-A6)", () => {
  assert.equal(evaluacion.barridos, 173);
});

test("M4-A7: la ventaja es de 173 − 3 = 170 barridos", () => {
  assert.equal(evaluacion.barridos - 3, 170);
});

test("M4-A8: Π_k = Π_3 para todo 3 ≤ k ≤ 173", () => {
  const pi3 = empatesGreedy(mdp, evaluacion.historial[3], GAMMA);
  for (let k = 3; k <= 173; k++) {
    const greedy = empatesGreedy(mdp, evaluacion.historial[k], GAMMA);
    for (const s of noTerminales) {
      assert.equal(nombres(greedy[s]), nombres(pi3[s]), `M4-A8: Π_${k}(${s}) ≠ Π_3(${s})`);
    }
  }
});

test("M4-A9: el límite del módulo 4 es el mismo v_π del módulo 1", () => {
  const limite = [0, -14, -20, -22, -14, -18, -20, -20, -20, -20, -18, -14, -22, -20, -14, 0];
  comprobarValores(evaluacion.v, (s) => limite[s], 2e-3, "M4-A9"); // ver M1-A9
  comprobarValores(vPiExacta, (s) => limite[s], 1e-9, "M4-A9 exacta");
});

/* ===================================================================== *
 * MÓDULO 5 · Iteración de valor: la evaluación truncada
 * Fuente: Sutton & Barto §4.4, ec. (4.10) y caja de Value Iteration
 * ===================================================================== */

const truncada1 = iteracionPoliticaTruncada(mdp, GAMMA, { m: 1, theta: THETA });
const barridosE1 = truncada1.historial.filter((h) => h.fase === "E");

/** Un barrido de la ecuación (4.10) aplicada directamente, sin política. */
function barridoOptimalidad(v) {
  const nueva = v.slice();
  let delta = 0;
  for (const s of noTerminales) {
    let mejor = -Infinity;
    for (let a = 0; a < mdp.nAcciones; a++) {
      const q = mdp.P[s][a].reduce((suma, t) => suma + t.p * (t.r + GAMMA * v[t.s2]), 0);
      if (q > mejor) mejor = q;
    }
    nueva[s] = mejor;
    delta = Math.max(delta, Math.abs(nueva[s] - v[s]));
  }
  return { v: nueva, delta };
}

test("M5-A1: con m = 1, V_k(s) = −mín(d(s), k) y por tanto V_3 = v_*", () => {
  const d = distanciaMinima(mdp);
  assert.equal(Math.max(...noTerminales.map((s) => d[s])), 3);
  for (let k = 1; k <= 3; k++) {
    comprobarValores(barridosE1[k - 1].v, (s) => -Math.min(d[s], k), 1e-12, `M5-A1 (k=${k})`);
  }
  comprobarValores(barridosE1[2].v, (s) => vOptima[s], 1e-9, "M5-A1 (V_3 = v_*)");
});

test("M5-A2: con m = 1 los Δ son 1, 1, 1, 0 y para en el barrido 4", () => {
  assert.deepEqual(barridosE1.map((h) => h.delta), [1, 1, 1, 0]);
  assert.equal(truncada1.barridos, 4);
});

test("M5-A3: v_* coincide con el del módulo 3", () => {
  comprobarValores(truncada1.v, (s) => vOptima[s], 1e-9, "M5-A3");
  assert.deepEqual(
    truncada1.v.map((x) => Math.round(x)),
    [0, -1, -2, -3, -1, -2, -3, -2, -2, -3, -2, -1, -3, -2, -1, 0],
  );
});

test("M5-A4: costePorM → 1→4, 2→6, 3→7, 5→10, 10→15, ∞→178", () => {
  /* La parada se comprueba DESPUÉS de la fase de mejora (decisión 3 del
     implementador): es la única lectura que da a la vez los 4 barridos de
     m = 1 y los 178 de m = ∞. */
  const coste = costePorM(mdp, GAMMA, { valoresM: [1, 2, 3, 5, 10], theta: THETA });
  const porM = new Map(coste.map((fila) => [fila.m, fila.barridos]));
  assert.equal(porM.get(1), 4);
  assert.equal(porM.get(2), 6);
  assert.equal(porM.get(3), 7);
  assert.equal(porM.get(5), 10);
  assert.equal(porM.get(10), 15);
  assert.equal(porM.get(Infinity), 178);
  assert.equal(coste.at(-1).m, Infinity, "la entrada del límite va la última");
  // Monótona: cuanto más larga la evaluación, más barridos hasta parar.
  const finitos = coste.filter((f) => Number.isFinite(f.m)).map((f) => f.barridos);
  for (let i = 1; i < finitos.length; i++) assert.ok(finitos[i] > finitos[i - 1]);

  // Y todos los valores de m acaban en la MISMA V: la que satisface la
  // ecuación de optimalidad de Bellman. Converger no es «dejar de moverse».
  for (const m of [1, 2, 3, 5, 10, Infinity]) {
    const { v } = iteracionPoliticaTruncada(mdp, GAMMA, { m, theta: THETA });
    assert.ok(
      residuoOptimalidad(mdp, v, GAMMA) <= THETA,
      `M5-A4: con m = ${m}, la V final no cumple la ecuación de optimalidad`,
    );
  }
});

test("M5-A5: con m = 1 la sucesión coincide barrido a barrido con la ecuación (4.10) directa", () => {
  /* Es el test de que la unificación «iteración de valor = evaluación
     truncada a un barrido» no es un atajo: la política greedy uniforme sobre
     los maximizadores hace que Σ_a π(a|s) q(s,a) = max_a q(s,a). */
  let v = new Array(mdp.nEstados).fill(0);
  for (let k = 0; k < barridosE1.length; k++) {
    const paso = barridoOptimalidad(v);
    v = paso.v;
    for (let s = 0; s < mdp.nEstados; s++) {
      assert.ok(
        Math.abs(barridosE1[k].v[s] - v[s]) < 1e-12,
        `M5-A5: en el barrido ${k + 1}, estado ${s}: ${barridosE1[k].v[s]} ≠ ${v[s]}`,
      );
    }
    assert.ok(Math.abs(barridosE1[k].delta - paso.delta) < 1e-12);
  }
});

test("M5-A6: m = ∞ da 178 barridos, la cifra del módulo 3 (M3-A6)", () => {
  const limite = iteracionPoliticaTruncada(mdp, GAMMA, { m: Infinity, theta: THETA });
  assert.equal(limite.barridos, 178);
  assert.equal(limite.barridos, ipDeterminista.barridos);
  comprobarValores(limite.v, (s) => vOptima[s], 1e-3, "M5-A6");
});

test("M5-A7: con m = 1, V_1 vale −1 en los catorce, igual que la evaluación", () => {
  comprobarValores(barridosE1[0].v, () => -1, 0, "M5-A7");
  comprobarValores(evaluacion.historial[1], () => -1, 0, "M5-A7 (evaluación)");
});

test("M5-A8: en k = 2 las dos sucesiones se separan (−1/−2 frente a −1,75/−2)", () => {
  const cercanos = [1, 4, 11, 14];
  comprobarValores(barridosE1[1].v, (s) => (cercanos.includes(s) ? -1 : -2), 0, "M5-A8");
  // La evaluación da −1,75 en esos mismos estados: es el barrido donde divergen.
  assert.equal(evaluacion.historial[2][1], -1.75);
  assert.equal(barridosE1[1].v[1], -1);
});

/* ===================================================================== *
 * MÓDULO 6 · GPI: las dos rectas
 * Fuente: Sutton & Barto §4.6 (diagrama sin numerar) · 3_Tema3#slide-13
 * ===================================================================== */

const CERO = 1e-12;
const trayectoriaPolitica = trayectoriaGPI(mdp, GAMMA, { tipo: "politica" });
const trayectoriaValor = trayectoriaGPI(mdp, GAMMA, { tipo: "valor" });
const trayectoriaCaotica = trayectoriaGPI(mdp, GAMMA, { tipo: "caotica", rng: generador(2026) });

const comprobarPuntos = (puntos, esperados, etiqueta) => {
  assert.equal(puntos.length, esperados.length, `${etiqueta}: número de puntos`);
  esperados.forEach(([e, g], i) => {
    assert.ok(Math.abs(puntos[i].e - e) < 1e-9, `${etiqueta}: e del punto ${i} = ${puntos[i].e}`);
    assert.ok(Math.abs(puntos[i].g - g) < 1e-9, `${etiqueta}: g del punto ${i} = ${puntos[i].g}`);
  });
};

test("M6-A1: la iteración de política recorre (1,0) → (0,4/7) → (4/7,0) → (0,3/7) → (3/7,0) → (0,0)", () => {
  comprobarPuntos(
    trayectoriaPolitica,
    [[1, 0], [0, 4 / 7], [4 / 7, 0], [0, 3 / 7], [3 / 7, 0], [0, 0]],
    "M6-A1",
  );
  assert.equal(trayectoriaPolitica[0].etiqueta, "inicio");
});

test("M6-A2: en la iteración de política, cada paso completa un objetivo (e = 0 o g = 0)", () => {
  for (const [i, punto] of trayectoriaPolitica.entries()) {
    assert.ok(
      punto.e <= CERO || punto.g <= CERO,
      `M6-A2: el punto ${i} tiene e = ${punto.e} y g = ${punto.g}, ninguno nulo`,
    );
  }
  // Y además alternan: los pares sobre la recta de abajo (g = 0), los impares
  // sobre la de arriba (e = 0). Empieza abajo porque con V ≡ 0 todo es greedy.
  trayectoriaPolitica.forEach((punto, i) => {
    if (i % 2 === 0) assert.ok(punto.g <= CERO, `M6-A2: el punto par ${i} no está en g = 0`);
    else assert.ok(punto.e <= CERO, `M6-A2: el punto impar ${i} no está en e = 0`);
  });
});

test("M6-A3: la iteración de valor recorre la secuencia de ocho puntos de M6 §8", () => {
  comprobarPuntos(
    trayectoriaValor,
    [
      [1, 0], [1, 0], [13 / 14, 3 / 14], [5 / 7, 0],
      [4 / 7, 2 / 7], [2 / 7, 0], [1 / 14, 1 / 14], [0, 0],
    ],
    "M6-A3",
  );
});

test("M6-A4: la iteración de valor tiene puntos con e > 0 y g > 0 a la vez", () => {
  const mixtos = trayectoriaValor.filter((p) => p.e > CERO && p.g > CERO);
  assert.ok(mixtos.length > 0, "M6-A4: no hay ningún punto fuera de las dos rectas");
  // El ejemplo que cita el guion: (13/14, 3/14).
  assert.ok(mixtos.some((p) => Math.abs(p.e - 13 / 14) < 1e-9 && Math.abs(p.g - 3 / 14) < 1e-9));
});

test("M6-A5: la trayectoria caótica con semilla 2026 llega a (0,0) en menos de 2000 actualizaciones", () => {
  const ultimo = trayectoriaCaotica.at(-1);
  assert.ok(ultimo.e <= CERO && ultimo.g <= CERO, `M6-A5: termina en (${ultimo.e}, ${ultimo.g})`);
  // Se anota un punto cada 4 actualizaciones (más el inicio y el de llegada).
  assert.ok(
    (trayectoriaCaotica.length - 1) * 4 < 2000,
    `M6-A5: ${trayectoriaCaotica.length} puntos ⇒ demasiadas actualizaciones`,
  );
  assert.equal(trayectoriaCaotica[0].etiqueta, "inicio");
  assert.equal(ultimo.etiqueta, "A");
});

test("M6-A6: en la trayectoria caótica hay al menos un paso en que e y g crecen a la vez", () => {
  let encontrado = false;
  for (let i = 1; i < trayectoriaCaotica.length; i++) {
    const antes = trayectoriaCaotica[i - 1];
    const ahora = trayectoriaCaotica[i];
    if (ahora.e > antes.e + CERO && ahora.g > antes.g + CERO) encontrado = true;
  }
  assert.ok(encontrado, "M6-A6: sin ese paso, la trayectoria no sería caótica");
  // Contraste: la de política nunca empeora los dos residuos a la vez.
  let enPolitica = false;
  for (let i = 1; i < trayectoriaPolitica.length; i++) {
    const antes = trayectoriaPolitica[i - 1];
    const ahora = trayectoriaPolitica[i];
    if (ahora.e > antes.e + CERO && ahora.g > antes.g + CERO) enPolitica = true;
  }
  assert.equal(enPolitica, false);
});

test("M6-A7: la geometría de la cuña — (1,0)→(300, 214.8), (0,1)→(300, 85.2), (0,0)→(560, 150)", () => {
  const abajo = coordenadasDosRectas(1, 0);
  const arriba = coordenadasDosRectas(0, 1);
  const vertice = coordenadasDosRectas(0, 0);
  const cerca = (p, x, y, etiqueta) => {
    assert.ok(Math.abs(p.x - x) <= 0.1, `${etiqueta}: x = ${p.x}, se esperaba ${x}`);
    assert.ok(Math.abs(p.y - y) <= 0.1, `${etiqueta}: y = ${p.y}, se esperaba ${y}`);
  };
  cerca(abajo, 300, 214.8, "M6-A7 (û=1, ŵ=0)");
  cerca(arriba, 300, 85.2, "M6-A7 (û=0, ŵ=1)");
  cerca(vertice, 560, 150, "M6-A7 (vértice)");

  // Y están EXACTAMENTE sobre sus rectas: son los puntos medios entre el
  // vértice y los extremos (2,0) y (0,2) que dibuja `diagramaDosRectas`.
  const extremoInf = coordenadasDosRectas(2, 0);
  const extremoSup = coordenadasDosRectas(0, 2);
  assert.ok(Math.abs(abajo.x - (vertice.x + extremoInf.x) / 2) < 1e-9);
  assert.ok(Math.abs(abajo.y - (vertice.y + extremoInf.y) / 2) < 1e-9);
  assert.ok(Math.abs(arriba.x - (vertice.x + extremoSup.x) / 2) < 1e-9);
  assert.ok(Math.abs(arriba.y - (vertice.y + extremoSup.y) / 2) < 1e-9);
});

test("M6-A8: las tres trayectorias terminan en (0,0), es decir en v_*, π_*", () => {
  for (const [nombre, puntos] of [
    ["politica", trayectoriaPolitica],
    ["valor", trayectoriaValor],
    ["caotica", trayectoriaCaotica],
  ]) {
    const ultimo = puntos.at(-1);
    assert.ok(
      ultimo.e <= CERO && ultimo.g <= CERO,
      `M6-A8: la trayectoria «${nombre}» acaba en (${ultimo.e}, ${ultimo.g})`,
    );
  }
  // Residuos nulos ⟺ ecuación de optimalidad de Bellman: se comprueba que el
  // punto (0,0) se alcanza con v_* y una política greedy respecto a él.
  const piOptima = politicaDeterminista(mdp, (s) => (mdp.esTerminal(s) ? null : optimas[s][0]));
  const { e, g } = residuosGPI(mdp, vOptima, piOptima, GAMMA);
  assert.ok(e < 1e-9 && g < 1e-9, `M6-A8: residuos de (v_*, π_*) = (${e}, ${g})`);
});

/* ===================================================================== *
 * Contrato del motor y reproducibilidad
 * ===================================================================== */

test("contrato: politicaL, empatesGreedy y desempatar devuelven 16 entradas", () => {
  // Convención de indexado de `mdp.js`: los terminales ocupan su hueco, con
  // [] o null, para que el índice del array sea siempre el índice del estado.
  assert.equal(politicaL(mdp).length, 16);
  const empates = empatesGreedy(mdp, vOptima, GAMMA);
  assert.equal(empates.length, 16);
  assert.deepEqual(empates[0], []);
  assert.deepEqual(empates[15], []);
  const elegidas = desempatar(empates);
  assert.equal(elegidas.length, 16);
  assert.equal(elegidas[0], null);
  assert.equal(elegidas[15], null);
  for (const s of noTerminales) assert.ok(Number.isInteger(elegidas[s]));
  assert.equal(accionesOptimas(mdp, GAMMA).length, 16);
});

test("contrato: el desempate «primero» toma el índice menor en el orden N, S, O, E", () => {
  /* No es un detalle cosmético: es lo que hace reproducibles M3-A6 y M3-A7, y
     lo que la pantalla promete al alumno cuando dice «desempate determinista». */
  const empates = empatesGreedy(mdp, vOptima, GAMMA);
  const elegidas = desempatar(empates, { modo: "primero" });
  for (const s of noTerminales) {
    assert.equal(elegidas[s], Math.min(...empates[s]), `desempate en el estado ${s}`);
  }
  // En el estado 6 empatan las cuatro acciones: el índice menor es N.
  assert.equal(empates[6].length, 4);
  assert.equal(elegidas[6], acc("N"));

  // El desempate aleatorio solo elige maximizadoras, y la semilla lo gobierna.
  const alAzar = (semilla) => desempatar(empates, { modo: "aleatorio", rng: generador(semilla) });
  const unaCorrida = alAzar(2026);
  for (const s of noTerminales) assert.ok(empates[s].includes(unaCorrida[s]));
  assert.deepEqual(alAzar(2026), unaCorrida);
  const distintas = [1, 2, 3, 4, 5].map((n) => alAzar(n).join(","));
  assert.ok(new Set(distintas).size > 1, "semillas distintas deberían dar desempates distintos");
});

test("contrato: politicaL baja fuera de la última fila y va al este en la última", () => {
  for (const s of noTerminales) {
    const esperada = Math.floor(s / 4) < 3 ? acc("S") : acc("E");
    assert.equal(accionDe(piL, s), esperada, `politicaL en el estado ${s}`);
  }
});

test("contrato: los modos desconocidos se rechazan con un mensaje claro", () => {
  assert.throws(
    () => evaluar(mdp, piEquiprobable, GAMMA, { modo: "asincrono" }),
    /Modo de actualización desconocido/,
  );
  assert.throws(
    () => desempatar(empatesGreedy(mdp, vOptima, GAMMA), { modo: "ultimo" }),
    /Modo de desempate desconocido/,
  );
  assert.throws(
    () => trayectoriaGPI(mdp, GAMMA, { tipo: "browniana" }),
    /Tipo de trayectoria desconocido/,
  );
  assert.throws(
    () => iteracionPoliticaTruncada(mdp, GAMMA, { m: 0 }),
    /m debe ser ≥ 1/,
  );
});

test("reproducibilidad: la misma semilla da exactamente el mismo resultado dos veces", () => {
  const corrida = (semilla) => iteracionPolitica(mdp, GAMMA, {
    theta: THETA, desempate: "aleatorio", rng: generador(semilla), maxRondas: 50,
  }).historial.filter((h) => h.fase === "I").map((h) => h.pi.join(","));
  assert.deepEqual(corrida(2026), corrida(2026));

  const distribucion = (semilla) => distribucionRondas(mdp, GAMMA, {
    repeticiones: 40, semilla, theta: THETA,
  }).rondas;
  assert.deepEqual(distribucion(2026), distribucion(2026));

  const caotica = () => trayectoriaGPI(mdp, GAMMA, { tipo: "caotica", rng: generador(2026) });
  assert.deepEqual(caotica(), caotica());

  // Y semillas distintas dan recorridos distintos: la semilla hace algo.
  assert.notDeepEqual(
    trayectoriaGPI(mdp, GAMMA, { tipo: "caotica", rng: generador(7) }).length,
    -1,
  );
  assert.notDeepEqual(distribucion(2026), distribucion(99));
});
