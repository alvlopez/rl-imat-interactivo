/* Tests del motor de bandits.
 *
 * Comprueban que las curvas que verá el alumno reproducen los hechos que
 * afirman las diapositivas del Tema 1.
 *
 *   node --test tests/
 */

import test from "node:test";
import assert from "node:assert/strict";

import { generador } from "../assets/nucleo.js";
import {
  TIPOS, crearBandit, crearAgente, ejecutar, crearBanditManual,
  potencias, CURVAS_BARRIDO,
} from "../assets/bandits.js";

/** Media de la última décima parte de una curva: su nivel "ya estabilizado". */
function nivelFinal(serie) {
  const desde = Math.floor(serie.length * 0.9);
  let suma = 0;
  for (let i = desde; i < serie.length; i++) suma += serie[i];
  return suma / (serie.length - desde);
}

/* ===================================================================== *
 * El banco de pruebas — Tema1_Intro#slide-23
 * ===================================================================== */

test("banco de pruebas: q_*(a) ~ N(0,1) y R_t ~ N(q_*(a),1)", () => {
  const rngProblema = generador(11);
  const rngRuido = generador(12);
  const bandit = crearBandit({ k: 20000, rngProblema, rngRuido });

  const q = bandit.qEstrella;
  const media = q.reduce((a, b) => a + b, 0) / q.length;
  const varianza = q.reduce((acc, x) => acc + (x - media) ** 2, 0) / q.length;
  assert.ok(Math.abs(media) < 0.03, `media de q_* = ${media}`);
  assert.ok(Math.abs(Math.sqrt(varianza) - 1) < 0.03, `sd de q_* = ${Math.sqrt(varianza)}`);

  // las recompensas del brazo 0 se centran en su q_*
  let suma = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) suma += bandit.tirar(0);
  assert.ok(Math.abs(suma / N - q[0]) < 0.05, "la recompensa media debe converger a q_*(0)");
});

test("promedio muestral: Q_t(a) converge a q_*(a) (ley de los grandes números)", () => {
  const bandit = crearBandit({
    k: 3, rngProblema: generador(1), rngRuido: generador(2), qEstrella: [9.8, 9.2, 8.9],
  });
  const agente = crearAgente({ tipo: TIPOS.EPSILON, k: 3, epsilon: 1, rng: generador(3) });
  for (let i = 0; i < 30000; i++) {
    const a = agente.elegir();
    agente.actualizar(a, bandit.tirar(a));
  }
  [9.8, 9.2, 8.9].forEach((verdadero, a) => {
    assert.ok(
      Math.abs(agente.Q[a] - verdadero) < 0.05,
      `Q(${a}) = ${agente.Q[a]}, q_* = ${verdadero}`,
    );
  });
});

/* ===================================================================== *
 * Exploración vs. explotación — #slide-24 a #slide-26
 * ===================================================================== */

test("ε-greedy explora aproximadamente una fracción ε de los pasos", () => {
  const k = 10;
  const epsilon = 0.1;
  const agente = crearAgente({ tipo: TIPOS.EPSILON, k, epsilon, rng: generador(5) });
  // fijamos Q para que haya un único greedy claro y no haya empates
  for (let a = 0; a < k; a++) agente.Q[a] = a === 0 ? 10 : 0;

  let noGreedy = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) if (agente.elegir() !== 0) noGreedy++;
  // al explorar puede volver a caer en el brazo greedy: la fracción esperada
  // de acciones distintas de la greedy es ε·(k−1)/k
  const esperado = epsilon * (k - 1) / k;
  assert.ok(
    Math.abs(noGreedy / N - esperado) < 0.005,
    `exploró ${noGreedy / N}, esperado ${esperado}`,
  );
});

test("UCB prueba todos los brazos antes de repetir ninguno (#slide-26)", () => {
  const k = 10;
  const bandit = crearBandit({ k, rngProblema: generador(8), rngRuido: generador(9) });
  const agente = crearAgente({ tipo: TIPOS.UCB, k, c: 2, rng: generador(10) });
  const elegidos = new Set();
  for (let i = 0; i < k; i++) {
    const a = agente.elegir();
    assert.ok(!elegidos.has(a), `el brazo ${a} se repitió en el paso ${i}`);
    elegidos.add(a);
    agente.actualizar(a, bandit.tirar(a));
  }
  assert.equal(elegidos.size, k);
});

test("la política greedy pura se estanca en un subóptimo (#slide-24)", () => {
  const resultados = ejecutar({
    configuraciones: [
      { id: "greedy", tipo: TIPOS.EPSILON, epsilon: 0, alpha: null, q0: 0 },
      { id: "eps01", tipo: TIPOS.EPSILON, epsilon: 0.1, alpha: null, q0: 0 },
    ],
    pasos: 1000, ejecuciones: 300, semilla: 2026,
  });
  const [greedy, eps01] = resultados;
  const optimoGreedy = nivelFinal(greedy.optimo);
  const optimoEps = nivelFinal(eps01.optimo);

  assert.ok(optimoGreedy < 0.5, `greedy alcanzó ${optimoGreedy} de acción óptima`);
  assert.ok(optimoEps > 0.75, `ε=0.1 alcanzó ${optimoEps} de acción óptima`);
  assert.ok(optimoEps > optimoGreedy + 0.3, "ε=0.1 debería superar claramente a greedy");
});

test("ε = 0.1 en 1000 pasos reproduce el nivel de la figura del libro (~1.4)", () => {
  const [eps01] = ejecutar({
    configuraciones: [{ id: "eps01", tipo: TIPOS.EPSILON, epsilon: 0.1, alpha: null, q0: 0 }],
    pasos: 1000, ejecuciones: 400, semilla: 7,
  });
  const nivel = nivelFinal(eps01.recompensa);
  // la diapositiva indica que el óptimo de este problema es 1.54
  assert.ok(nivel > 1.25 && nivel < 1.5, `recompensa media final = ${nivel}`);
});

test("a la larga ε = 0.01 supera a ε = 0.1: responde a la pregunta de #slide-24", () => {
  const resultados = ejecutar({
    configuraciones: [
      { id: "eps01", tipo: TIPOS.EPSILON, epsilon: 0.1, alpha: null, q0: 0 },
      { id: "eps001", tipo: TIPOS.EPSILON, epsilon: 0.01, alpha: null, q0: 0 },
    ],
    pasos: 12000, ejecuciones: 150, semilla: 99,
  });
  const [eps01, eps001] = resultados;

  // a los 1000 pasos (lo que muestra la figura del libro) todavía gana ε = 0.1
  const enMil = (serie) => serie.slice(900, 1000).reduce((a, b) => a + b, 0) / 100;
  assert.ok(enMil(eps01.optimo) > enMil(eps001.optimo), "a los 1000 pasos debería ir ganando ε=0.1");

  // pero al final del horizonte largo el cruce ya se ha producido
  assert.ok(
    nivelFinal(eps001.optimo) > nivelFinal(eps01.optimo),
    `cruce no observado: ε=0.01 → ${nivelFinal(eps001.optimo)}, ε=0.1 → ${nivelFinal(eps01.optimo)}`,
  );
});

test("los valores iniciales optimistas exploran aun siendo greedy (#slide-25)", () => {
  const resultados = ejecutar({
    configuraciones: [
      { id: "optimista", tipo: TIPOS.OPTIMISTA, epsilon: 0, alpha: 0.1, q0: 5 },
      { id: "realista", tipo: TIPOS.EPSILON, epsilon: 0.1, alpha: 0.1, q0: 0 },
    ],
    pasos: 1000, ejecuciones: 300, semilla: 4,
  });
  const [optimista, realista] = resultados;

  // al principio el optimista va PEOR (se dedica a explorar)
  const alPrincipio = (serie) => serie.slice(0, 50).reduce((a, b) => a + b, 0) / 50;
  assert.ok(
    alPrincipio(optimista.optimo) < alPrincipio(realista.optimo),
    "el optimista debería empezar peor: está explorando",
  );
  // y al final va MEJOR
  assert.ok(
    nivelFinal(optimista.optimo) > nivelFinal(realista.optimo),
    `optimista ${nivelFinal(optimista.optimo)} vs realista ${nivelFinal(realista.optimo)}`,
  );
});

/* ===================================================================== *
 * No estacionariedad — responde a #slide-21, #slide-25 y #slide-26
 * ===================================================================== */

test("con entorno cambiante el paso constante sigue al óptimo y el promedio muestral no", () => {
  const resultados = ejecutar({
    configuraciones: [
      { id: "muestral", tipo: TIPOS.EPSILON, epsilon: 0.1, alpha: null, q0: 0 },
      { id: "constante", tipo: TIPOS.EPSILON, epsilon: 0.1, alpha: 0.1, q0: 0 },
    ],
    pasos: 8000, ejecuciones: 150, semilla: 31, deriva: 0.01,
  });
  const [muestral, constante] = resultados;

  assert.ok(
    nivelFinal(constante.optimo) > nivelFinal(muestral.optimo) + 0.1,
    `α constante ${nivelFinal(constante.optimo)} debería superar al promedio muestral ${nivelFinal(muestral.optimo)}`,
  );
  assert.ok(
    nivelFinal(constante.recompensa) > nivelFinal(muestral.recompensa),
    "también en recompensa media",
  );
});

test("sin deriva, el promedio muestral no es peor que el paso constante", () => {
  const resultados = ejecutar({
    configuraciones: [
      { id: "muestral", tipo: TIPOS.EPSILON, epsilon: 0.1, alpha: null, q0: 0 },
      { id: "constante", tipo: TIPOS.EPSILON, epsilon: 0.1, alpha: 0.1, q0: 0 },
    ],
    pasos: 4000, ejecuciones: 200, semilla: 32, deriva: 0,
  });
  const [muestral, constante] = resultados;
  assert.ok(
    nivelFinal(muestral.optimo) >= nivelFinal(constante.optimo) - 0.02,
    "en un problema estacionario el promedio muestral debería aguantar la comparación",
  );
});

/* ===================================================================== *
 * Gradient bandits — #slide-28
 * ===================================================================== */

test("el baseline protege al gradient bandit de un desplazamiento de la recompensa", () => {
  // la diapositiva compara N(4,1) con N(0,1): sin baseline el rendimiento cae
  const resultados = ejecutar({
    configuraciones: [
      { id: "con", tipo: TIPOS.GRADIENTE, alpha: 0.1, conBaseline: true },
      { id: "sin", tipo: TIPOS.GRADIENTE, alpha: 0.1, conBaseline: false },
    ],
    pasos: 1000, ejecuciones: 250, semilla: 55, mediaQ: 4,
  });
  const [con, sin] = resultados;
  assert.ok(
    nivelFinal(con.optimo) > nivelFinal(sin.optimo) + 0.2,
    `con baseline ${nivelFinal(con.optimo)}, sin baseline ${nivelFinal(sin.optimo)}`,
  );
});

test("el gradient bandit mantiene una distribución de probabilidad válida", () => {
  const bandit = crearBandit({ k: 10, rngProblema: generador(3), rngRuido: generador(4) });
  const agente = crearAgente({ tipo: TIPOS.GRADIENTE, k: 10, alpha: 0.1, rng: generador(5) });
  for (let i = 0; i < 2000; i++) {
    const a = agente.elegir();
    agente.actualizar(a, bandit.tirar(a));
  }
  const suma = Array.from(agente.pi).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(suma - 1) < 1e-9, `las probabilidades suman ${suma}`);
  assert.ok(Array.from(agente.pi).every((p) => p >= 0), "ninguna probabilidad puede ser negativa");
  // el brazo verdaderamente mejor debe acabar con la preferencia más alta
  const mejorPreferencia = agente.H.indexOf(Math.max(...agente.H));
  assert.equal(mejorPreferencia, bandit.mejorAccion());
});

/* ===================================================================== *
 * Estudio de parámetros — #slide-29
 * ===================================================================== */

test("los rangos del estudio de parámetros son potencias de dos", () => {
  assert.deepEqual(potencias(-3, 1), [0.125, 0.25, 0.5, 1, 2]);
  for (const curva of CURVAS_BARRIDO) {
    assert.ok(curva.valores.length >= 5, `${curva.id} tiene pocos puntos`);
    assert.ok(curva.parametro.length <= 2, `${curva.id}: el símbolo del parámetro es largo`);
    const cfg = curva.config(curva.valores[0]);
    assert.ok(cfg.tipo, `${curva.id} no produce una configuración válida`);
  }
});

test("la curva de ε-greedy tiene un máximo interior (no es monótona)", () => {
  const valores = [1 / 128, 1 / 32, 1 / 8, 1 / 4];
  const medias = valores.map((epsilon) => ejecutar({
    configuraciones: [{ id: "e", tipo: TIPOS.EPSILON, epsilon, alpha: null, q0: 0 }],
    pasos: 1000, ejecuciones: 200, semilla: 17,
  })[0].recompensaTotal);

  const mejor = medias.indexOf(Math.max(...medias));
  assert.ok(
    mejor > 0 && mejor < medias.length - 1,
    `el óptimo debería estar en el interior del rango; medias = ${medias.map((m) => m.toFixed(3))}`,
  );
});

/* ===================================================================== *
 * Bandit manual — el ejemplo del jamón, #slide-17
 * ===================================================================== */

test("bandit manual: valores del ejemplo del jamón y regret bien contado", () => {
  const bandit = crearBanditManual({ qEstrella: [9.8, 9.2, 8.9], semilla: 1 });
  assert.equal(bandit.k, 3);
  assert.equal(bandit.accionOptima, 0, "el mejor jamón es el primero, q_* = 9.8");

  // tirando siempre del mejor brazo el regret es exactamente 0
  for (let i = 0; i < 25; i++) bandit.tirar(0);
  assert.ok(Math.abs(bandit.regret) < 1e-12, `regret = ${bandit.regret}`);
  assert.equal(bandit.N[0], 25);
  assert.ok(Math.abs(bandit.Q[0] - 9.8) < 0.2, `Q(0) = ${bandit.Q[0]}`);

  // cada tirada de un brazo peor añade exactamente la diferencia de q_*
  bandit.tirar(2);
  assert.ok(Math.abs(bandit.regret - (9.8 - 8.9)) < 1e-9, `regret = ${bandit.regret}`);
});

test("bandit manual: la estimación se actualiza de forma incremental", () => {
  const bandit = crearBanditManual({ qEstrella: [5, 1], sigmaR: 0, semilla: 3 });
  // sin ruido, la primera tirada fija la estimación exacta
  bandit.tirar(0);
  assert.ok(Math.abs(bandit.Q[0] - 5) < 1e-9);
  bandit.tirar(1);
  assert.ok(Math.abs(bandit.Q[1] - 1) < 1e-9);
  assert.equal(bandit.tiradas, 2);
  assert.ok(Math.abs(bandit.recompensaMedia - 3) < 1e-9);
});

/* ===================================================================== *
 * Reproducibilidad
 * ===================================================================== */

test("dos ejecuciones con la misma semilla dan exactamente lo mismo", () => {
  const config = {
    configuraciones: [{ id: "e", tipo: TIPOS.EPSILON, epsilon: 0.1, alpha: null, q0: 0 }],
    pasos: 300, ejecuciones: 20, semilla: 12345,
  };
  const [a] = ejecutar(config);
  const [b] = ejecutar(config);
  for (let i = 0; i < 300; i++) {
    assert.equal(a.recompensa[i], b.recompensa[i], `difieren en el paso ${i}`);
    assert.equal(a.optimo[i], b.optimo[i], `difieren en el paso ${i}`);
  }
});

test("todas las configuraciones se enfrentan al mismo problema", () => {
  // `ejecutar` siembra el generador del PROBLEMA con la misma semilla para
  // todas las configuraciones, así que todas ven los mismos q_*(a). Lo que sí
  // difiere es el generador de cada AGENTE (se siembra por índice), para que
  // dos configuraciones iguales sean dos muestras independientes y no una
  // repetición exacta.
  const semillaProblema = 4242;
  const a = crearBandit({ k: 10, rngProblema: generador(semillaProblema), rngRuido: generador(1) });
  const b = crearBandit({ k: 10, rngProblema: generador(semillaProblema), rngRuido: generador(2) });
  assert.deepEqual(Array.from(a.qEstrella), Array.from(b.qEstrella));
  assert.equal(a.mejorAccion(), b.mejorAccion());

  const distinto = crearBandit({ k: 10, rngProblema: generador(semillaProblema + 1), rngRuido: generador(1) });
  assert.notDeepEqual(Array.from(a.qEstrella), Array.from(distinto.qEstrella));
});

test("la deriva mueve los valores verdaderos y puede cambiar cuál es el mejor brazo", () => {
  const bandit = crearBandit({
    k: 10, rngProblema: generador(70), rngRuido: generador(71), deriva: 0.05,
  });
  const inicial = Array.from(bandit.qEstrella);
  const mejorInicial = bandit.mejorAccion();
  let cambios = 0;
  for (let i = 0; i < 4000; i++) {
    bandit.derivar();
    if (bandit.mejorAccion() !== mejorInicial) cambios++;
  }
  assert.notDeepEqual(Array.from(bandit.qEstrella), inicial, "los q_* deberían haberse movido");
  assert.ok(cambios > 0, "con deriva suficiente el brazo óptimo debería cambiar alguna vez");
});
