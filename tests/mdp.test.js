/* Tests del motor de MDP.
 *
 * La mayoría son pruebas de contraste contra el material de clase: si el
 * código no reproduce lo que dice la diapositiva, el código está mal.
 *
 *   node --test tests/
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  rejilla3x3,
  rejillaNavegacion,
  ACCIONES_3X3,
  ACCIONES_NAV,
  politicaEquiprobable,
  politicaDeterminista,
  evaluarLineal,
  evaluarIterativa,
  iteracionValor,
  qDeV,
  politicaGreedy,
  numeroPoliticasOptimas,
  residuoOptimalidad,
  ramasBackup,
  estadosSucesores,
  probabilidad,
  cuentaTransiciones,
  resolverSistema,
  retornos,
  simularEpisodio,
} from "../assets/mdp.js";

import { generador, argmaxTodos } from "../assets/nucleo.js";

const a3 = (nombre) => ACCIONES_3X3.indexOf(nombre);
const aNav = (nombre) => ACCIONES_NAV.indexOf(nombre);
/** Índice interno a partir de la etiqueta que ve el alumno ("1".."16", "T"). */
const idx = (mdp, etiqueta) => mdp.etiquetas.indexOf(String(etiqueta));

/* ===================================================================== *
 * Rejilla 3×3 — Tema2_MDP#slide-8 y #slide-9
 * ===================================================================== */

test("3×3: la dinámica es una distribución de probabilidad válida", () => {
  const mdp = rejilla3x3();
  for (let s = 0; s < mdp.nEstados; s++) {
    if (mdp.esTerminal(s)) continue;
    for (let a = 0; a < mdp.nAcciones; a++) {
      const suma = mdp.P[s][a].reduce((acc, t) => acc + t.p, 0);
      assert.ok(
        Math.abs(suma - 1) < 1e-12,
        `p(·|${mdp.etiquetas[s]}, ${mdp.acciones[a]}) suma ${suma}`,
      );
    }
  }
});

test("3×3: las cuatro preguntas literales de #slide-8", () => {
  const mdp = rejilla3x3();
  const e = (n) => idx(mdp, n);

  // p(5, -1 | 2, abajo) = 1  → desde 2 hacia abajo se llega a 5 con r = -1
  assert.equal(probabilidad(mdp, e(5), -1, e(2), a3("abajo")), 1);

  // p(5, -1 | 2, izq) = 0    → desde 2 hacia la izquierda se llega a 1, no a 5
  assert.equal(probabilidad(mdp, e(5), -1, e(2), a3("izq")), 0);

  // p(5, 0 | 2, abajo) = 0   → la recompensa es -1 en toda transición, nunca 0
  assert.equal(probabilidad(mdp, e(5), 0, e(2), a3("abajo")), 0);

  // p(3, -1 | 3, dch) = 1    → rebote contra el borde derecho: se queda en 3
  assert.equal(probabilidad(mdp, e(3), -1, e(3), a3("dch")), 1);
});

test("3×3: 8 estados × 4 acciones = 32 transiciones (#slide-9)", () => {
  const mdp = rejilla3x3();
  assert.equal(cuentaTransiciones(mdp).pares, 32);
});

test("3×3: el estado terminal siempre vale 0 (#slide-15)", () => {
  const mdp = rejilla3x3();
  const pi = politicaEquiprobable(mdp);
  const v = evaluarLineal(mdp, pi, 1);
  assert.equal(v[mdp.geometria.terminal], 0);
});

test("3×3: resolver Bellman como sistema lineal y por iteración coincide", () => {
  const mdp = rejilla3x3();
  const pi = politicaEquiprobable(mdp);
  for (const gamma of [0.5, 0.9, 1]) {
    const lineal = evaluarLineal(mdp, pi, gamma);
    const iterativa = evaluarIterativa(mdp, pi, gamma, { tolerancia: 1e-12, maxBarridos: 20000 });
    assert.ok(lineal, `el sistema debería tener solución con γ = ${gamma}`);
    assert.ok(iterativa.convergido, `la iteración debería converger con γ = ${gamma}`);
    for (let s = 0; s < mdp.nEstados; s++) {
      assert.ok(
        Math.abs(lineal[s] - iterativa.v[s]) < 1e-6,
        `γ=${gamma}, estado ${mdp.etiquetas[s]}: ${lineal[s]} vs ${iterativa.v[s]}`,
      );
    }
  }
});

test("3×3: con recompensa -1 por paso todos los valores son negativos y simétricos", () => {
  const mdp = rejilla3x3();
  const v = evaluarLineal(mdp, politicaEquiprobable(mdp), 1);
  for (let s = 0; s < mdp.nEstados; s++) {
    if (mdp.esTerminal(s)) continue;
    assert.ok(v[s] < 0, `v(${mdp.etiquetas[s]}) debería ser negativo`);
  }
  // la rejilla es simétrica respecto de la diagonal: v(3) = v(7), v(2) = v(4), v(6) = v(8)
  const par = (x, y) =>
    assert.ok(
      Math.abs(v[idx(mdp, x)] - v[idx(mdp, y)]) < 1e-9,
      `v(${x}) = ${v[idx(mdp, x)]} debería igualar v(${y}) = ${v[idx(mdp, y)]}`,
    );
  par(3, 7);
  par(2, 4);
  par(6, 8);
});

test("3×3: la política óptima llega al terminal en el mínimo número de pasos", () => {
  const mdp = rejilla3x3();
  const { v } = iteracionValor(mdp, 1);
  // distancia Manhattan hasta T, con recompensa -1 por paso
  const esperado = { 1: -4, 2: -3, 3: -2, 4: -3, 5: -2, 6: -1, 7: -2, 8: -1, T: 0 };
  for (const [etiqueta, valor] of Object.entries(esperado)) {
    assert.ok(
      Math.abs(v[idx(mdp, etiqueta)] - valor) < 1e-6,
      `v_*(${etiqueta}) = ${v[idx(mdp, etiqueta)]}, esperado ${valor}`,
    );
  }
});

/* ===================================================================== *
 * Rejilla de navegación 4×4 — Tema2_MDP#slide-17 y #slide-18
 * ===================================================================== */

test("navegación: la dinámica es una distribución de probabilidad válida", () => {
  const mdp = rejillaNavegacion();
  for (let s = 0; s < mdp.nEstados; s++) {
    if (mdp.esTerminal(s)) continue;
    for (let a = 0; a < mdp.nAcciones; a++) {
      const suma = mdp.P[s][a].reduce((acc, t) => acc + t.p, 0);
      assert.ok(
        Math.abs(suma - 1) < 1e-12,
        `p(·|${mdp.etiquetas[s]}, ${mdp.acciones[a]}) suma ${suma}`,
      );
    }
  }
});

test("navegación: PRUEBA DE ORO — el diagrama de backup del estado 1 es el de #slide-18", () => {
  const mdp = rejillaNavegacion();
  const ramas = ramasBackup(mdp, idx(mdp, 1));

  // La diapositiva dibuja cuatro ramas N, S, O, E, cada una con un único
  // sucesor y recompensa -1: N→1, S→5, O→1, E→2.
  const esperado = { N: "1", S: "5", O: "1", E: "2" };
  assert.equal(ramas.length, 4);
  for (const rama of ramas) {
    assert.equal(rama.nodos.length, 1, `la rama ${rama.accion} debería ser determinista`);
    assert.equal(rama.nodos[0].estado, esperado[rama.accion], `rama ${rama.accion}`);
    assert.equal(rama.nodos[0].recompensa, -1, `rama ${rama.accion}`);
    assert.equal(rama.nodos[0].probabilidad, 1, `rama ${rama.accion}`);
  }
});

test("navegación: la trayectoria T1 de Problemas.pdf fija el sentido del viento", () => {
  const mdp = rejillaNavegacion();
  // T1: ... (3, right) → el agente se queda en 3, y la celda 4 existe.
  // Solo es posible si ir al este desde 3 es ir CONTRA el viento.
  const quedarse = probabilidad(mdp, idx(mdp, 3), -1, idx(mdp, 3), aNav("E"));
  assert.equal(quedarse, 0.25, "desde 3 hacia el este debe haber 0.25 de no moverse");

  const avanzar = probabilidad(mdp, idx(mdp, 4), -1, idx(mdp, 3), aNav("E"));
  assert.equal(avanzar, 0.75, "desde 3 hacia el este debe haber 0.75 de llegar a 4");
});

test("navegación: a favor del viento hay 0.25 de avanzar dos celdas", () => {
  const mdp = rejillaNavegacion();
  // Viento Este procede del este → sopla hacia el oeste. Desde 3 al oeste:
  // 0.75 → 2 (una celda), 0.25 → 1 (dos celdas).
  assert.equal(probabilidad(mdp, idx(mdp, 2), -1, idx(mdp, 3), aNav("O")), 0.75);
  assert.equal(probabilidad(mdp, idx(mdp, 1), -1, idx(mdp, 3), aNav("O")), 0.25);

  // Viento Sur procede del sur → sopla hacia el norte. Desde 14 al norte:
  // 0.75 → 10, 0.25 → 6.
  assert.equal(probabilidad(mdp, idx(mdp, 10), -1, idx(mdp, 14), aNav("N")), 0.75);
  assert.equal(probabilidad(mdp, idx(mdp, 6), -1, idx(mdp, 14), aNav("N")), 0.25);
});

test("navegación: el remolino da recompensa -5 al entrar en el estado 8", () => {
  const mdp = rejillaNavegacion();
  // Desde 7 hacia el este se entra en el remolino (8).
  assert.equal(probabilidad(mdp, idx(mdp, 8), -5, idx(mdp, 7), aNav("E")), 1);
  assert.equal(probabilidad(mdp, idx(mdp, 8), -1, idx(mdp, 7), aNav("E")), 0);
  // Desde 4 hacia el sur también.
  assert.equal(probabilidad(mdp, idx(mdp, 8), -5, idx(mdp, 4), aNav("S")), 1);
});

test("navegación: solo se llega al terminal desde 16 yendo al este", () => {
  const mdp = rejillaNavegacion();
  const T = mdp.geometria.terminal;
  let entradas = 0;
  for (let s = 0; s < mdp.nEstados; s++) {
    if (mdp.esTerminal(s)) continue;
    for (let a = 0; a < mdp.nAcciones; a++) {
      if (mdp.P[s][a].some((t) => t.s2 === T)) {
        entradas++;
        assert.equal(mdp.etiquetas[s], "16");
        assert.equal(mdp.acciones[a], "E");
      }
    }
  }
  assert.equal(entradas, 1);
});

test("navegación: el ejercicio abierto de #slide-18 — backup de los estados 3 y 4", () => {
  const mdp = rejillaNavegacion();

  // Estado 3 (viento): N y S deterministas; O y E con la rama del viento.
  const r3 = Object.fromEntries(ramasBackup(mdp, idx(mdp, 3)).map((r) => [r.accion, r.nodos]));
  assert.deepEqual(r3.N.map((n) => n.estado), ["3"]); // rebota contra el borde superior
  assert.deepEqual(r3.S.map((n) => n.estado), ["7"]);
  assert.deepEqual(r3.O.map((n) => n.estado).sort(), ["1", "2"]); // a favor: 1 o 2 celdas
  assert.deepEqual(r3.E.map((n) => n.estado).sort(), ["3", "4"]); // en contra: puede no moverse

  // Estado 4 (viento, esquina): hacia el este solo puede rebotar, así que las
  // dos ramas del viento colapsan en una sola de probabilidad 1.
  const r4 = Object.fromEntries(ramasBackup(mdp, idx(mdp, 4)).map((r) => [r.accion, r.nodos]));
  assert.deepEqual(r4.O.map((n) => n.estado).sort(), ["2", "3"]);
  assert.equal(r4.E.length, 1, "desde 4 hacia el este todo acaba en 4");
  assert.equal(r4.E[0].estado, "4");
  assert.equal(r4.E[0].probabilidad, 1);
  assert.equal(r4.S[0].estado, "8");
  assert.equal(r4.S[0].recompensa, -5, "bajar desde 4 mete al agente en el remolino");
});

test("navegación: los sucesores del estado 11 son los de la pregunta 3 de Problemas.pdf", () => {
  const mdp = rejillaNavegacion();
  const sucesores = estadosSucesores(mdp, idx(mdp, 11)).map((s) => mdp.etiquetas[s]);
  // 11 no tiene viento: N→7, S→15, O→10, E→12
  assert.deepEqual(sucesores.sort((a, b) => Number(a) - Number(b)), ["7", "10", "12", "15"].sort((a, b) => Number(a) - Number(b)));
});

/* ===================================================================== *
 * Optimalidad
 * ===================================================================== */

test("iteración de valor: la solución satisface la ecuación de optimalidad", () => {
  for (const mdp of [rejilla3x3(), rejillaNavegacion()]) {
    for (const gamma of [0.9, 1]) {
      const { v, convergido } = iteracionValor(mdp, gamma);
      assert.ok(convergido, `${mdp.nombre} con γ=${gamma} debería converger`);
      const residuo = residuoOptimalidad(mdp, v, gamma);
      assert.ok(residuo < 1e-6, `${mdp.nombre} γ=${gamma}: residuo ${residuo}`);
    }
  }
});

test("v_* domina a v_π para cualquier política (definición de óptima, #slide-19)", () => {
  const mdp = rejillaNavegacion();
  const gamma = 0.95;
  const { v: vOptimo } = iteracionValor(mdp, gamma);
  const vEquiprobable = evaluarLineal(mdp, politicaEquiprobable(mdp), gamma);
  const rng = generador(7);
  const vAleatoria = evaluarLineal(
    mdp,
    politicaDeterminista(mdp, () => rng.entero(mdp.nAcciones)),
    gamma,
  );

  for (let s = 0; s < mdp.nEstados; s++) {
    assert.ok(vOptimo[s] >= vEquiprobable[s] - 1e-8, `v_* < v_π equiprobable en ${mdp.etiquetas[s]}`);
    if (vAleatoria) {
      assert.ok(vOptimo[s] >= vAleatoria[s] - 1e-8, `v_* < v_π aleatoria en ${mdp.etiquetas[s]}`);
    }
  }
});

test("empates del argmax: hay más de una política óptima en la rejilla 3×3", () => {
  const mdp = rejilla3x3();
  const { v } = iteracionValor(mdp, 1);
  const q = qDeV(mdp, v, 1);
  const greedy = politicaGreedy(mdp, q);

  // Desde el estado 5 (centro) bajar y ir a la derecha son igual de buenos.
  const desde5 = greedy[idx(mdp, 5)].map((a) => mdp.acciones[a]).sort();
  assert.deepEqual(desde5, ["abajo", "dch"]);
  assert.ok(numeroPoliticasOptimas(greedy) > 1, "debería haber varias políticas óptimas");
});

test("argmaxTodos detecta los empates", () => {
  assert.deepEqual(argmaxTodos([1, 3, 3, 2]), [1, 2]);
  assert.deepEqual(argmaxTodos([5, 1, 2]), [0]);
});

/* ===================================================================== *
 * Álgebra y retorno
 * ===================================================================== */

test("resolverSistema resuelve un sistema conocido y detecta la singularidad", () => {
  // 2x + y = 5 ; x - y = 1  →  x = 2, y = 1
  const x = resolverSistema([[2, 1], [1, -1]], [5, 1]);
  assert.ok(Math.abs(x[0] - 2) < 1e-12);
  assert.ok(Math.abs(x[1] - 1) < 1e-12);
  assert.equal(resolverSistema([[1, 1], [2, 2]], [1, 2]), null);
});

test("retornos: G_t = R_{t+1} + γ G_{t+1} (#slide-10)", () => {
  const g = retornos([-1, -1, -1], 0.5);
  assert.ok(Math.abs(g[2] - -1) < 1e-12);
  assert.ok(Math.abs(g[1] - -1.5) < 1e-12);
  assert.ok(Math.abs(g[0] - -1.75) < 1e-12);

  // sin descuento, el retorno es la suma de recompensas
  const sinDescuento = retornos([-1, -1, -1, -1], 1);
  assert.equal(sinDescuento[0], -4);
});

test("simularEpisodio termina y su retorno concuerda con v_π en promedio", () => {
  const mdp = rejilla3x3();
  const pi = politicaEquiprobable(mdp);
  const gamma = 0.9;
  const v = evaluarLineal(mdp, pi, gamma);
  const rng = generador(20260831);

  const inicio = 0; // estado "1"
  let suma = 0;
  const N = 4000;
  for (let k = 0; k < N; k++) {
    const { pasos, terminado } = simularEpisodio(mdp, pi, inicio, rng, { maxPasos: 500 });
    assert.ok(terminado, "el episodio debería alcanzar el terminal");
    suma += retornos(pasos.map((p) => p.r), gamma)[0];
  }
  const media = suma / N;
  assert.ok(
    Math.abs(media - v[inicio]) < 0.25,
    `Monte Carlo dio ${media}, v_π(1) = ${v[inicio]}`,
  );
});

/* ===================================================================== *
 * Reproducibilidad
 * ===================================================================== */

test("el generador con la misma semilla produce la misma secuencia", () => {
  const a = generador(42);
  const b = generador(42);
  for (let i = 0; i < 100; i++) assert.equal(a.uniforme(), b.uniforme());

  const c = generador(43);
  assert.notEqual(generador(42).uniforme(), c.uniforme());
});

test("el generador normal tiene media y desviación correctas", () => {
  const rng = generador(1);
  const N = 60000;
  let suma = 0;
  let suma2 = 0;
  for (let i = 0; i < N; i++) {
    const x = rng.normal(2, 3);
    suma += x;
    suma2 += x * x;
  }
  const media = suma / N;
  const desviacion = Math.sqrt(suma2 / N - media * media);
  assert.ok(Math.abs(media - 2) < 0.06, `media ${media}`);
  assert.ok(Math.abs(desviacion - 3) < 0.06, `desviación ${desviacion}`);
});
