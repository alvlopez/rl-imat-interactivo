/* Tests de la capa de idioma.
 *
 * El riesgo real de una traducción por diccionario no es que se rompa: es que
 * quede a medias sin que nadie se dé cuenta, porque las claves que faltan caen
 * al español y la página sigue funcionando. Estos tests hacen visible ese hueco.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { EN } from "../assets/en.js";
import { t, tLista, clavesDe, fijarIdiomaParaPruebas, IDIOMAS } from "../assets/i18n.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

const HTML = ["index.html", "tema1.html", "tema2.html", "tema3.html"];
const JS = readdirSync(join(RAIZ, "assets"))
  .filter((f) => f.endsWith(".js") && f !== "en.js" && f !== "i18n.js")
  .map((f) => join("assets", f));

/** Claves declaradas en el HTML con data-t / data-t-title / data-t-etiqueta. */
function clavesHtml() {
  const claves = new Map();
  for (const f of HTML) {
    const src = readFileSync(join(RAIZ, f), "utf8");
    for (const m of src.matchAll(/data-t(?:-title|-etiqueta)?="([^"]+)"/g)) {
      if (!claves.has(m[1])) claves.set(m[1], f);
    }
  }
  return claves;
}

/** Claves pedidas desde JS con t("…") o tLista("…"). */
function clavesJs() {
  const claves = new Map();
  for (const f of JS) {
    const src = readFileSync(join(RAIZ, f), "utf8");
    for (const m of src.matchAll(/\bt(?:Lista)?\(\s*"([^"]+)"/g)) {
      if (!claves.has(m[1])) claves.set(m[1], f);
    }
  }
  return claves;
}

/** Claves de cuestionario: <prefijo>.<i>.{enunciado,opciones,explicacion}. */
function clavesQuiz() {
  const claves = new Map();
  for (const f of JS) {
    const src = readFileSync(join(RAIZ, f), "utf8");
    for (const m of src.matchAll(/claves:\s*"([^"]+)"/g)) {
      const prefijo = m[1];
      // cuántas preguntas tiene ese bloque: se cuentan los `correcta:` que
      // hay entre este `crearQuiz(` y su cierre `], { claves: … }`.
      const cierre = src.indexOf(`claves: "${prefijo}"`);
      const apertura = src.lastIndexOf("crearQuiz(", cierre);
      const bloque = src.slice(apertura, cierre);
      const n = [...bloque.matchAll(/^\s*correcta:/gm)].length;
      assert.ok(n > 0, `no se han encontrado preguntas para ${prefijo}`);
      for (let i = 0; i < n; i++) {
        claves.set(`${prefijo}.${i}.enunciado`, f);
        claves.set(`${prefijo}.${i}.opciones`, f);
        claves.set(`${prefijo}.${i}.explicacion`, f);
      }
    }
  }
  return claves;
}

test("todas las claves del HTML tienen traducción inglesa", () => {
  const faltan = [...clavesHtml()]
    .filter(([clave]) => !(clave in EN))
    .map(([clave, f]) => `${clave}  (${f})`);
  assert.deepEqual(faltan, [], `sin traducir:\n  ${faltan.join("\n  ")}`);
});

test("todas las claves pedidas desde JS tienen traducción inglesa", () => {
  const faltan = [...clavesJs()]
    .filter(([clave]) => !(clave in EN))
    .map(([clave, f]) => `${clave}  (${f})`);
  assert.deepEqual(faltan, [], `sin traducir:\n  ${faltan.join("\n  ")}`);
});

test("todas las preguntas de los cuestionarios están traducidas", () => {
  const faltan = [...clavesQuiz()]
    .filter(([clave]) => !(clave in EN))
    .map(([clave, f]) => `${clave}  (${f})`);
  assert.deepEqual(faltan, [], `sin traducir:\n  ${faltan.join("\n  ")}`);
});

/* Claves que se piden con plantilla —t(`t2.accion.${id}`)— y que por tanto no
 * aparecen literales en el código. Se declaran aquí a mano, a propósito: así el
 * test de huérfanas sigue sirviendo para todo lo demás en vez de rendirse. Si
 * se añade otro prefijo dinámico, hay que añadirlo también aquí. */
const PREFIJOS_DINAMICOS = [
  "t2.accion.",   // nombreAccion() en tema2.js
  "t2.dir.",      // nombreDir() en tema2.js
];

test("no hay claves inglesas huérfanas", () => {
  // Una clave que ya nadie usa es texto muerto que se queda desincronizado.
  const usadas = new Set([
    ...clavesHtml().keys(),
    ...clavesJs().keys(),
    ...clavesQuiz().keys(),
  ]);
  const huerfanas = Object.keys(EN).filter(
    (k) => !usadas.has(k) && !PREFIJOS_DINAMICOS.some((p) => k.startsWith(p)),
  );
  assert.deepEqual(huerfanas, [], `sobran en en.js:\n  ${huerfanas.join("\n  ")}`);
});

test("los prefijos dinámicos declarados se usan de verdad", () => {
  // Contrapartida del test anterior: si un prefijo deja de usarse, que se note.
  const fuentes = JS.map((f) => readFileSync(join(RAIZ, f), "utf8")).join("\n");
  for (const prefijo of PREFIJOS_DINAMICOS) {
    assert.ok(
      fuentes.includes("`" + prefijo),
      `el prefijo dinámico «${prefijo}» ya no se usa en ningún módulo`,
    );
    assert.ok(
      Object.keys(EN).some((k) => k.startsWith(prefijo)),
      `el prefijo dinámico «${prefijo}» no tiene ninguna clave en en.js`,
    );
  }
});

test("las listas de opciones traducidas conservan la longitud", () => {
  // Si una lista inglesa tuviera otra longitud, `correcta` apuntaría a otra
  // opción. i18n.js se protege quedándose con el español, pero eso deja la
  // pregunta a medio traducir: mejor que falle el test.
  const malas = [];
  for (const [clave, valor] of Object.entries(EN)) {
    if (!clave.endsWith(".opciones")) continue;
    if (!Array.isArray(valor)) {
      malas.push(`${clave}: no es una lista`);
    } else if (valor.length !== 4) {
      malas.push(`${clave}: ${valor.length} opciones, se esperaban 4`);
    }
  }
  assert.deepEqual(malas, []);
});

test("ninguna traducción inglesa está vacía ni ha quedado en español obvio", () => {
  const sospechosas = [];
  for (const [clave, valor] of Object.entries(EN)) {
    const textos = Array.isArray(valor) ? valor : [valor];
    for (const texto of textos) {
      if (!texto || !texto.trim()) sospechosas.push(`${clave}: vacía`);
      // Palabras que en inglés no deberían aparecer nunca. Se excluyen las
      // claves donde un término español es deliberado (nombres propios).
      if (/\b(el|la|los|las|una|para|porque|cuando|aunque)\b/.test(texto) &&
          !clave.startsWith("t1.m1.explicacion")) {
        sospechosas.push(`${clave}: parece español → «${texto.slice(0, 60)}…»`);
      }
    }
  }
  assert.deepEqual(sospechosas, []);
});

test("t() cae al respaldo español cuando falta la clave", () => {
  fijarIdiomaParaPruebas("en");
  assert.equal(t("clave.que.no.existe", "texto español"), "texto español");
  assert.equal(t("nav.inicio", "Inicio"), "Home");
  fijarIdiomaParaPruebas("es");
  assert.equal(t("nav.inicio", "Inicio"), "Inicio", "en español manda el respaldo");
});

test("t() sustituye los parámetros {nombre}", () => {
  fijarIdiomaParaPruebas("es");
  assert.equal(t("x", "hay {n} de {total}", { n: 3, total: 7 }), "hay 3 de 7");
  assert.equal(t("x", "{a} y {a}", { a: "eco" }), "eco y eco");
  fijarIdiomaParaPruebas("es");
});

test("tLista devuelve el respaldo si la entrada no es una lista", () => {
  fijarIdiomaParaPruebas("en");
  const respaldo = ["a", "b"];
  assert.deepEqual(tLista("nav.inicio", respaldo), respaldo, "una cadena no vale");
  assert.deepEqual(tLista("no.existe", respaldo), respaldo);
  fijarIdiomaParaPruebas("es");
});

test("el catálogo de idiomas y el diccionario son coherentes", () => {
  assert.deepEqual(Object.keys(IDIOMAS), ["es", "en"]);
  assert.equal(clavesDe("es").length, 0, "el español no vive en un diccionario");
  assert.ok(clavesDe("en").length > 100, "el inglés parece incompleto");
});

/* ======================================================================= *
 * Notación: subíndices escritos con guion bajo literal
 *
 * Fuera de \(...\) el guion bajo no compone nada: «v_π» se lee en pantalla
 * tal cual, con el guion, y eso rompe la regla de que los símbolos coincidan
 * carácter a carácter con los de la diapositiva. La forma correcta en texto
 * que va al DOM —y también en los rótulos de los SVG, que aceptan la misma
 * marca— es v<sub>π</sub>. Este test es la red para que no vuelva a colarse,
 * en español y en inglés a la vez.
 * ======================================================================= */

const SUBINDICE_CRUDO = /[A-Za-zπΠ]_[πk*0-9]/;

/* Las cajas de pseudocódigo son transcripción literal en monoespaciado: ahí
 * Σ_{s',r}, argmax_a y π_* comparten una misma convención de texto plano y
 * subrayar solo π_* la rompería. Se dejan fuera a propósito. */
const CAJAS_PSEUDOCODIGO = ["t3.b6.caja", "t3.m3.caja", "t3.m5.caja"];

/** Deja solo lo que llega a la pantalla como texto: sin LaTeX ni comentarios. */
function soloInterfaz(src) {
  return src
    .replace(/\\\[[\s\S]*?\\\]/g, " ")                   // LaTeX de bloque
    .replace(/\\\([\s\S]*?\\\)/g, " ")                   // LaTeX en línea
    .replace(/<!--[\s\S]*?-->/g, " ")                    // comentarios HTML
    .replace(/<pre[\s\S]*?<\/pre>/g, " ")                // cajas de pseudocódigo
    .replace(/\/\*[\s\S]*?\*\//g, " ")                   // comentarios JS de bloque
    .replace(/(^|[^:])\/\/.*$/gm, "$1")                  // comentarios JS de línea
    .replace(/\b[A-Z][A-Z0-9]*(_[A-Z0-9]+)+\b/g, " ");   // IDENTIFICADORES_ASI
}

/** Las líneas de un texto que llevan un subíndice sin marcar. */
function lineasSospechosas(texto) {
  return soloInterfaz(texto)
    .split("\n")
    .filter((linea) => SUBINDICE_CRUDO.test(linea))
    .map((linea) => linea.trim().slice(0, 90));
}

test("el español no escribe subíndices con guion bajo fuera de LaTeX", () => {
  const malas = [];
  for (const f of [...HTML, ...JS]) {
    for (const linea of lineasSospechosas(readFileSync(join(RAIZ, f), "utf8"))) {
      malas.push(`${f}: ${linea}`);
    }
  }
  assert.deepEqual(malas, [], `usa <sub>…</sub>:\n  ${malas.join("\n  ")}`);
});

test("el inglés no escribe subíndices con guion bajo fuera de LaTeX", () => {
  const malas = [];
  for (const [clave, valor] of Object.entries(EN)) {
    if (CAJAS_PSEUDOCODIGO.includes(clave)) continue;
    for (const texto of Array.isArray(valor) ? valor : [valor]) {
      for (const linea of lineasSospechosas(texto)) malas.push(`${clave}: ${linea}`);
    }
  }
  assert.deepEqual(malas, [], `usa <sub>…</sub>:\n  ${malas.join("\n  ")}`);
});
