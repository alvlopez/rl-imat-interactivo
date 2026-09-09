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

/* TODAS las páginas con cuestionario, no solo las tres primeras. Hasta el T5 (2.ª
   parte) este fichero solo miraba `tema1`, `tema2` y `tema3`, así que la mitad del
   sitio no estaba vigilada: mismo olvido que el del array `HTML` de i18n en el T3.
   Una página nueva entra AQUÍ. */
const PAGINAS = ["assets/tema1.js", "assets/tema2.js", "assets/tema3.js",
                 "assets/tema4.js", "assets/tema4b.js", "assets/tema5.js",
                 "assets/tema5b.js"];

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

  for (const fichero of PAGINAS) {
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

/* ---------------------------------------------------------------------------
 * Los bancos de preguntas en español, comprobados sobre el fuente.
 *
 * Los tests de arriba prueban que `barajarOpciones` conserva la correcta para
 * CUALQUIER pregunta; lo que no vigilaba nadie es que las preguntas escritas
 * estén bien formadas. `tests/i18n.test.js` exige cuatro opciones a las listas
 * INGLESAS, pero el español vive en el código y no se comprobaba: una pregunta
 * española con tres opciones y su traducción con cuatro renderiza distinto en
 * cada idioma, y ningún test lo veía.
 * ------------------------------------------------------------------------- */

/** Cuenta los elementos de nivel 1 de un literal de array, saltando cadenas.
 *  El sitio escribe **coma final** en estos literales, así que un elemento solo
 *  cuenta si se ha abierto contenido desde la coma anterior. */
function elementosDelArray(src, aperturaCorchete) {
  let profundidad = 0, elementos = 0, abierto = false, comilla = null;
  for (let i = aperturaCorchete; i < src.length; i++) {
    const c = src[i];
    if (comilla) {
      if (c === "\\") i++;
      else if (c === comilla) comilla = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { comilla = c; abierto = true; continue; }
    if (c === "[" || c === "(" || c === "{") { profundidad++; abierto = true; continue; }
    if (c === ")" || c === "}") { profundidad--; continue; }
    if (c === "]") {
      profundidad--;
      if (profundidad === 0) return abierto ? elementos + 1 : elementos;
      continue;
    }
    if (c === "," && profundidad === 1) {
      if (abierto) elementos++;
      abierto = false;
      continue;
    }
    if (!/\s/.test(c)) abierto = true;
  }
  return -1;   // corchete sin cerrar
}

test("toda pregunta española tiene cuatro opciones y una `correcta` que existe", () => {
  const malas = [];
  for (const fichero of PAGINAS) {
    const src = readFileSync(join(RAIZ, fichero), "utf8");
    for (const m of src.matchAll(/opciones:\s*\[/g)) {
      const n = elementosDelArray(src, m.index + m[0].length - 1);
      const linea = src.slice(0, m.index).split("\n").length;
      if (n !== 4) malas.push(`${fichero}:${linea} tiene ${n} opciones, se esperaban 4`);
    }
    for (const m of src.matchAll(/correcta:\s*(-?\d+)/g)) {
      const v = Number(m[1]);
      const linea = src.slice(0, m.index).split("\n").length;
      if (v < 0 || v > 3) malas.push(`${fichero}:${linea} tiene correcta: ${v}, fuera de 0-3`);
    }
    const nOpciones = [...src.matchAll(/opciones:\s*\[/g)].length;
    const nCorrectas = [...src.matchAll(/correcta:\s*-?\d+/g)].length;
    if (nOpciones !== nCorrectas) {
      malas.push(`${fichero}: ${nOpciones} listas de opciones y ${nCorrectas} campos correcta`);
    }
  }
  assert.deepEqual(malas, [], `bancos mal formados:\n  ${malas.join("\n  ")}`);
});
