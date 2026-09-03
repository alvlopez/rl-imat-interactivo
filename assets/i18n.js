/* ==========================================================================
   RL · IMAT — idioma de la interfaz
   Sin dependencias. Módulo ES: se usa igual desde el navegador y desde node.

   DISEÑO: el español NO vive aquí. Vive donde siempre, en el HTML y en las
   cadenas del JS, y es el idioma por defecto. Este módulo solo aporta una
   CAPA de traducción encima.

   Dos consecuencias buenas:
     · no hay dos copias del español que puedan desincronizarse;
     · si falta una clave en inglés, sale el español, no un hueco.

   En HTML se marca el bloque traducible con data-t="clave"; el valor del
   diccionario es HTML, así que <strong>, <em> y las fórmulas \(...\) pasan
   tal cual. En JS se envuelve la cadena: t("clave", "texto en español").
   ========================================================================== */

import { EN } from "./en.js";

export const IDIOMAS = { es: "Español", en: "English" };
const CLAVE_GUARDADO = "rl-imat-idioma";
const DICCIONARIOS = { es: {}, en: EN };

/** El español original de cada elemento, para poder volver a él. */
const originales = new WeakMap();

function leerGuardado() {
  try {
    return localStorage.getItem(CLAVE_GUARDADO);
  } catch {
    return null;                     // navegación privada, cookies bloqueadas…
  }
}

function guardar(valor) {
  try {
    if (valor) localStorage.setItem(CLAVE_GUARDADO, valor);
    else localStorage.removeItem(CLAVE_GUARDADO);
  } catch {
    /* sin persistencia; el parámetro de URL sigue funcionando */
  }
}

/**
 * Resuelve el idioma en el momento de cargar el módulo, para que los módulos
 * que usan t() en su nivel superior ya lo tengan resuelto.
 *
 * La URL manda sobre lo guardado: así se puede compartir un enlace directo
 * en inglés (tema1.html?idioma=en) sin depender de lo que el navegador tenga
 * almacenado.
 */
function resolverIdioma() {
  if (typeof location === "undefined") return "es";   // node, en los tests
  const deUrl = new URLSearchParams(location.search).get("idioma");
  if (deUrl && deUrl in IDIOMAS) return deUrl;
  const guardado = leerGuardado();
  if (guardado && guardado in IDIOMAS) return guardado;
  return "es";
}

let idioma = resolverIdioma();

export function idiomaActivo() {
  return idioma;
}

/** Solo para los tests: fija el idioma sin tocar el DOM ni el almacenamiento. */
export function fijarIdiomaParaPruebas(codigo) {
  idioma = codigo in IDIOMAS ? codigo : "es";
}

/**
 * Texto en el idioma activo.
 *
 * @param {string} clave      identificador estable, p. ej. "t1.m4.lectura"
 * @param {string} respaldo   el español, que es la fuente
 * @param {Object} [params]   sustituye {nombre} por su valor
 */
export function t(clave, respaldo, params) {
  let texto = DICCIONARIOS[idioma]?.[clave] ?? respaldo;
  if (params) {
    for (const [nombre, valor] of Object.entries(params)) {
      texto = texto.split(`{${nombre}}`).join(String(valor));
    }
  }
  return texto;
}

/**
 * Lista de textos en el idioma activo, para las opciones de una pregunta.
 * El diccionario guarda un array; si no hay entrada, devuelve el respaldo.
 */
export function tLista(clave, respaldo) {
  const valor = DICCIONARIOS[idioma]?.[clave];
  return Array.isArray(valor) ? valor : respaldo;
}

/** Todas las claves que conoce un idioma (lo usan los tests de cobertura). */
export function clavesDe(codigo) {
  return Object.keys(DICCIONARIOS[codigo] ?? {});
}

/**
 * Traduce el HTML ya presente en la página: los elementos con data-t y los
 * atributos title/aria-label con data-t-title / data-t-etiqueta.
 */
export function aplicarTraducciones(raiz = document) {
  const dicc = DICCIONARIOS[idioma] ?? {};

  raiz.querySelectorAll("[data-t]").forEach((el) => {
    if (!originales.has(el)) originales.set(el, el.innerHTML);
    const traducido = dicc[el.dataset.t];
    el.innerHTML = traducido ?? originales.get(el);
  });

  raiz.querySelectorAll("[data-t-title]").forEach((el) => {
    const clave = el.dataset.tTitle;
    if (dicc[clave]) el.title = dicc[clave];
  });

  raiz.querySelectorAll("[data-t-etiqueta]").forEach((el) => {
    const clave = el.dataset.tEtiqueta;
    if (dicc[clave]) el.setAttribute("aria-label", dicc[clave]);
  });

  document.documentElement.lang = idioma;
}

/**
 * Cambia de idioma recargando la página.
 *
 * Recargar es deliberado y no es pereza: la mitad del texto lo generan los
 * módulos al vuelo (lecturas, leyendas, ejes, cuestionarios), y hacer que
 * todos se repinten de forma reactiva sería una fuente permanente de bloques
 * a medio traducir. Una carga limpia en el otro idioma no puede quedar a
 * medias. El precio es perder el estado de las simulaciones, que se asume.
 */
export function cambiarIdioma(codigo) {
  if (!(codigo in IDIOMAS)) return;
  guardar(codigo);
  const url = new URL(location.href);
  url.searchParams.set("idioma", codigo);      // conserva tema y modo
  location.href = url.toString();
}

/** Botón de idioma para la barra de herramientas de la cabecera. */
export function crearBotonIdioma() {
  const otro = idioma === "es" ? "en" : "es";
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "boton-idioma";
  boton.textContent = otro === "en" ? "EN" : "ES";
  boton.title = idioma === "es" ? "Read this page in English" : "Leer esta página en español";
  boton.setAttribute("aria-label", boton.title);
  boton.addEventListener("click", () => cambiarIdioma(otro));
  return boton;
}
