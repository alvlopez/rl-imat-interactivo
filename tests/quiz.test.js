/* Tests del barajado de opciones de los cuestionarios.
 *
 * Las preguntas se redactan con la correcta en la primera posición, y
 * `crearQuiz` las baraja al renderizar. El riesgo de ese barajado es evidente:
 * si `correcta` no se remapea bien, el sitio marca como error una respuesta
 * acertada. El primer test de aquí es el que impide exactamente eso.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { barajarOpciones, generador } from "../assets/nucleo.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

const PREGUNTA = {
  enunciado: "¿Qué mide el regret?",
  opciones: ["la correcta", "distractor 1", "distractor 2", "distractor 3"],
  correcta: 0,
  explicacion: "porque sí",
};

test("la opción correcta sigue siendo el mismo texto después de barajar", () => {
  const rng = generador(7);
  for (let i = 0; i < 500; i++) {
    const barajada = barajarOpciones(PREGUNTA, rng);
    assert.equal(
      barajada.opciones[barajada.correcta],
      PREGUNTA.opciones[PREGUNTA.correcta],
      "el índice `correcta` ha dejado de apuntar al texto correcto",
    );
  }
});

test("el invariante se mantiene con la correcta en cualquier posición de partida", () => {
  const rng = generador(11);
  for (let origen = 0; origen < 4; origen++) {
    const entrada = { ...PREGUNTA, correcta: origen };
    for (let i = 0; i < 200; i++) {
      const barajada = barajarOpciones(entrada, rng);
      assert.equal(barajada.opciones[barajada.correcta], entrada.opciones[origen]);
    }
  }
});

test("las opciones barajadas son una permutación exacta de las originales", () => {
  const rng = generador(13);
  for (let i = 0; i < 300; i++) {
    const barajada = barajarOpciones(PREGUNTA, rng);
    assert.equal(barajada.opciones.length, PREGUNTA.opciones.length);
    assert.deepEqual(
      [...barajada.opciones].sort(),
      [...PREGUNTA.opciones].sort(),
      "el barajado ha perdido, duplicado o alterado alguna opción",
    );
  }
});

test("la correcta cae en las cuatro posiciones con frecuencia parecida", () => {
  const rng = generador(17);
  const cuentas = [0, 0, 0, 0];
  const n = 20000;
  for (let i = 0; i < n; i++) cuentas[barajarOpciones(PREGUNTA, rng).correcta]++;

  const esperado = n / 4;
  cuentas.forEach((c, i) => {
    // Tolerancia holgada (±15 %): esto vigila un sesgo sistemático, no debe
    // fallar por azar. La desviación típica aquí es ~0,9 % de `esperado`.
    assert.ok(
      Math.abs(c - esperado) < esperado * 0.15,
      `posición ${i}: ${c} de ${n} esperando ~${esperado}`,
    );
  });
});

test("los distractores tampoco conservan siempre el mismo orden relativo", () => {
  const rng = generador(19);
  const ordenes = new Set();
  for (let i = 0; i < 200; i++) {
    ordenes.add(barajarOpciones(PREGUNTA, rng).opciones.join("|"));
  }
  // Con 4 opciones hay 24 permutaciones; basta comprobar que no se queda en las 4
  // que resultarían de mover solo la correcta y dejar los distractores en orden.
  assert.ok(ordenes.size > 8, `solo salieron ${ordenes.size} órdenes distintos`);
});

test("una pregunta de dos opciones también se baraja bien", () => {
  const rng = generador(23);
  const binaria = { opciones: ["sí", "no"], correcta: 0 };
  const cuentas = [0, 0];
  for (let i = 0; i < 4000; i++) {
    const b = barajarOpciones(binaria, rng);
    assert.equal(b.opciones[b.correcta], "sí");
    cuentas[b.correcta]++;
  }
  assert.ok(Math.abs(cuentas[0] - cuentas[1]) < 500, `sesgo: ${cuentas}`);
});

test("barajarOpciones no muta la pregunta original", () => {
  const rng = generador(29);
  const entrada = { ...PREGUNTA, opciones: [...PREGUNTA.opciones] };
  const copia = JSON.parse(JSON.stringify(entrada));
  barajarOpciones(entrada, rng);
  assert.deepEqual(entrada, copia);
});

test("ninguna pregunta del sitio cita sus opciones por letra o por posición", () => {
  // Si una explicación dijera «como se ve en la opción b)», el barajado la
  // convertiría en mentira. Este test es el guardián de esa suposición.
  const prohibido =
    /\b(opci[óo]n(es)?\s+[a-d]\)?|la\s+[a-d]\)|primera\s+opci[óo]n|segunda\s+opci[óo]n|tercera\s+opci[óo]n|[úu]ltima\s+opci[óo]n|respuesta\s+[a-d]\))/i;

  for (const fichero of ["assets/tema1.js", "assets/tema2.js", "assets/tema3.js"]) {
    const fuente = readFileSync(join(RAIZ, fichero), "utf8");
    fuente.split("\n").forEach((linea, i) => {
      if (!/enunciado:|explicacion:|^\s*["`']/.test(linea)) return;
      const encontrado = linea.match(prohibido);
      assert.equal(
        encontrado,
        null,
        `${fichero}:${i + 1} cita una opción por posición (“${encontrado?.[0]}”), ` +
          "incompatible con el barajado",
      );
    });
  }
});
