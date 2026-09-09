/* ==========================================================================
   RL · IMAT — Tema 5 (2.ª parte): métodos de gradiente de política
   Comportamiento de los seis módulos de tema5b.html.

   Motor separado de interfaz: TODA la matemática vive en assets/politica.js y
   en assets/politica-worker.js —que no tocan el DOM y se prueban desde node—.
   Aquí solo se pinta y se escucha.

   CINCO DECISIONES DE ESTE FICHERO QUE CONVIENE LEER ANTES DE TOCAR NADA

   1. LOS RÓTULOS QUE VAN DENTRO DE UN <text> DE SVG SON UNICODE PLANO, NO
      LaTeX. KaTeX sustituye \(...\) por un <span>, que SVG no sabe dibujar, y
      el rótulo desaparece sin avisar. Así que los ejes dicen «G₀: retorno
      total del episodio» y no «\(G_0\)», y la notación exacta va en el título
      de la caja, que sí es HTML. Lo mismo vale para las anotaciones.

   2. LAS NOTAS CONDICIONALES SE SINCRONIZAN EN LA CONSTRUCCIÓN, no solo en el
      evento. Cada módulo tiene una función `sincronizar()` que decide qué
      paneles se ven, y se llama una vez al construir y otra en cada cambio.
      En el Tema 5 (1.ª parte) dos notas contradictorias nacían visibles a la
      vez porque su `ver()` estaba solo dentro del manejador.

   3. EL WORKER SE CONSTRUYE DE VERDAD. Los módulos 3, 4, 5 y 6 pasan por
      `assets/politica-worker.js`, con barra de progreso; si el navegador no
      admite Workers se cae al hilo principal importando el mismo módulo, que
      exporta `calcularTanda`. No hay ningún interruptor de depuración: si
      hace falta desactivarlo para capturar en headless, se restaura.

   4. LOS MÓDULOS 1 Y 2 NO SIMULAN NADA. Forma cerrada y diferencias finitas:
      por debajo de 5 ms, sin Worker y sin semilla. Se dice en pantalla.

   5. «LOS MISMOS EPISODIOS» NO EXISTE. Las variantes de una tanda comparten
      LA SEMILLA de cada ejecución, no la trayectoria: en REINFORCE los
      episodios los genera la política que se está actualizando. El único
      sitio donde los episodios se comparten literalmente es el estudio del
      estimador con θ congelado del módulo 4, que recibe la lista.

   Diapositivas: 5_Tema_5_2#slide-1 a #slide-20 (MaterialAlvaro).
   Libro: Sutton & Barto, capítulo 13.
   ========================================================================== */

import {
  iniciarPagina, graficaLineas, rejilla, crearQuiz, pintar, generador,
  num, numMat, pct, tono, alCambiarTema, renderizarMatematicas, leyenda,
  deslizador, COLORES_SERIE,
} from "./nucleo.js";

import { t } from "./i18n.js";

import {
  pasilloCorto, rejillaCruz, J, optimoExacto, valoresExactos, gradienteJ,
  ladoDerechoTeorema, constanteProporcionalidad, gradLogPi, probabilidades,
  thetaDeP, mediaVarianzaTermino, actualizacionEsperada, episodio,
  reinforceLineaBase, histograma, UMBRAL_COLAPSO,
} from "./politica.js";

iniciarPagina();

/* ======================================================================= *
 * 0. Utilidades comunes
 * ======================================================================= */

const $ = (sel) => document.querySelector(sel);

/** Repintar los SVG cuando cambia el tema (llevan colores ya resueltos). */
const repintadores = [];
alCambiarTema(() => repintadores.forEach((fn) => fn()));

/** ¿Pantalla estrecha? Decide cuántas ejecuciones se dibujan en el módulo 6. */
const enMovil = () => (typeof window !== "undefined" && window.innerWidth < 620);

/* --- semilla de la página: la consumen los módulos 3, 4, 5 y 6 ---------- */

const entradaSemilla = $("#semilla");
const oyentesSemilla = [];
const semillaActual = () => {
  const n = parseInt(entradaSemilla.value, 10);
  return Number.isFinite(n) && n > 0 ? n : 2026;
};
entradaSemilla.addEventListener("change", () => oyentesSemilla.forEach((fn) => fn()));

/* --- construcción de interfaz ------------------------------------------ */

/** Caja `.viz` con su título y su pie; devuelve las tres partes. */
function caja(zona, tituloHtml, { conPie = false } = {}) {
  const div = document.createElement("div");
  div.className = "viz";
  if (tituloHtml) {
    const titulo = document.createElement("p");
    titulo.className = "viz-titulo";
    titulo.innerHTML = tituloHtml;
    div.appendChild(titulo);
    renderizarMatematicas(titulo);
  }
  const cuerpo = document.createElement("div");
  div.appendChild(cuerpo);
  let pie = null;
  if (conPie) {
    pie = document.createElement("p");
    pie.className = "suave";
    pie.style.margin = ".5rem 0 0";
    pie.style.fontSize = ".8rem";
    div.appendChild(pie);
  }
  zona.appendChild(div);
  return { cuerpo, pie, caja: div };
}

/** Escribe un pie de gráfica que puede llevar notación. */
function fijarPie(pie, html) {
  if (!pie) return;
  pie.innerHTML = html;
  renderizarMatematicas(pie);
}

/** Mensaje de «todavía no hay datos» dentro de una caja de gráfica. */
function vacia(cuerpo, mensaje) {
  const p = document.createElement("p");
  p.className = "suave";
  p.style.margin = "1.4rem 0";
  p.style.textAlign = "center";
  p.innerHTML = mensaje;
  cuerpo.replaceChildren(p);
  renderizarMatematicas(p);
}

/** Párrafo suelto con clase; devuelve el nodo para poder actualizarlo. */
function parrafo(zona, clase, html) {
  const p = document.createElement("p");
  p.className = clase;
  p.innerHTML = html;
  zona.appendChild(p);
  renderizarMatematicas(p);
  return p;
}

/** Recuadro `.aviso` (div, para que admita varios párrafos). */
function aviso(zona, html) {
  const div = document.createElement("div");
  div.className = "aviso";
  div.innerHTML = html;
  div.style.margin = ".6rem 0";
  zona.appendChild(div);
  renderizarMatematicas(div);
  return div;
}

/**
 * Muestra u oculta un nodo.
 *
 * Se toca `style.display` y no el atributo `hidden`: los selectores de
 * `estilo.css` que fijan `display` —`.control` es `flex`— ganan a la regla
 * `[hidden]` de la hoja del navegador, y el nodo se seguía viendo.
 */
function ver(nodo, visible) {
  if (nodo) nodo.style.display = visible ? "" : "none";
}

/** Fila `.controles` vacía. */
function panelControles(zona) {
  const div = document.createElement("div");
  div.className = "controles";
  zona.appendChild(div);
  return div;
}

/** Control con deslizador y su valor al lado. */
function controlDeslizador(panel, opciones) {
  const {
    etiqueta, min, max, paso = 1, valor,
    formato = (v) => String(v), alCambiar = () => {},
  } = opciones;

  const div = document.createElement("div");
  div.className = "control";
  const label = document.createElement("label");
  label.className = "literal";                 // sin mayúsculas: lleva notación
  const texto = document.createElement("span");
  texto.innerHTML = etiqueta;
  const salida = document.createElement("span");
  salida.className = "valor";
  label.append(texto, document.createTextNode(" "), salida);

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(paso);
  input.value = String(valor);

  div.append(label, input);
  panel.appendChild(div);
  renderizarMatematicas(label);

  deslizador(input, salida, alCambiar, formato);

  return {
    input,
    caja: div,
    fijar(v) {
      input.value = String(v);
      salida.textContent = formato(v);
    },
    habilitar(activo) {
      input.disabled = !activo;
      div.style.opacity = activo ? "1" : "0.45";
    },
  };
}

/** Grupo de botones que se comporta como un grupo de radio. */
function grupoRadio(panel, etiqueta, opciones, valorInicial, alElegir) {
  const div = document.createElement("div");
  div.className = "control";
  const label = document.createElement("label");
  label.className = "literal";                 // sin mayúsculas: lleva notación
  label.innerHTML = etiqueta;
  const fila = document.createElement("div");
  fila.className = "grupo-botones";
  div.append(label, fila);
  panel.appendChild(div);
  renderizarMatematicas(label);

  const botones = opciones.map((op) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = op.texto;
    if (op.titulo) b.title = op.titulo;
    b.addEventListener("click", () => {
      if (b.disabled) return;
      marcar(op.valor);
      alElegir(op.valor);
    });
    fila.appendChild(b);
    return { boton: b, valor: op.valor };
  });

  function marcar(valor) {
    botones.forEach((x) => x.boton.setAttribute("aria-pressed", String(x.valor === valor)));
  }
  marcar(valorInicial);
  renderizarMatematicas(fila);
  return { marcar, caja: div };
}

/** Botón suelto dentro de su propio `.control` (para alinearlo con el resto). */
function botonControl(panel, etiqueta, alPulsar) {
  const div = document.createElement("div");
  div.className = "control";
  const label = document.createElement("label");
  label.innerHTML = "&nbsp;";
  const b = document.createElement("button");
  b.type = "button";
  b.innerHTML = etiqueta;
  b.addEventListener("click", alPulsar);
  div.append(label, b);
  panel.appendChild(div);
  renderizarMatematicas(b);
  return b;
}

/** Bloque `.metricas`; devuelve un objeto id → nodo de la cifra. */
function metricas(zona, lista) {
  const div = document.createElement("div");
  div.className = "metricas";
  const cifras = {};
  for (const m of lista) {
    const c = document.createElement("div");
    c.className = "metrica";
    const e = document.createElement("div");
    e.className = "etiq literal";              // sin mayúsculas: lleva notación
    e.innerHTML = m.etiqueta;
    const v = document.createElement("div");
    v.className = "cifra";
    v.textContent = "—";
    const g = document.createElement("div");
    g.className = "suave";
    g.style.fontSize = ".75rem";
    g.innerHTML = m.glosa || "";
    c.append(e, v, g);
    div.appendChild(c);
    cifras[m.id] = v;
    cifras[`${m.id}$caja`] = c;
    cifras[`${m.id}$glosa`] = g;
  }
  zona.appendChild(div);
  renderizarMatematicas(div);
  return cifras;
}

/** Cifra de métrica que lleva notación: hay que tipografiarla, no volcarla. */
function fijarCifra(nodo, html) {
  nodo.innerHTML = html;
  renderizarMatematicas(nodo);
}

/** Leyenda de series con sus fórmulas ya tipografiadas por KaTeX. */
function conLeyenda(zona, series) {
  const bloque = leyenda(series);
  zona.appendChild(bloque);
  renderizarMatematicas(bloque);
  return bloque;
}

/**
 * Tabla `.datos` dentro de su `.tabla-scroll`.
 *
 * Devuelve `{ actualizar(filas), cabecera(celdas) }`: las filas son listas de
 * HTML, una por celda. El `position: relative` del envoltorio lo pone
 * `estilo.css` y no es decorativo (MathML oculto de KaTeX).
 */
function tablaDatos(zona, { cabecera, clase = "datos", texto = false }) {
  const envoltorio = document.createElement("div");
  envoltorio.className = "tabla-scroll";
  const tabla = document.createElement("table");
  tabla.className = `${clase}${texto ? " texto" : ""}`;
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  tabla.append(thead, tbody);
  envoltorio.appendChild(tabla);
  zona.appendChild(envoltorio);

  function ponerCabecera(celdas) {
    const tr = document.createElement("tr");
    for (const celda of celdas) {
      const th = document.createElement("th");
      th.innerHTML = celda;                    // sin uppercase: lleva notación
      tr.appendChild(th);
    }
    thead.replaceChildren(tr);
    renderizarMatematicas(thead);
  }
  ponerCabecera(cabecera);

  return {
    tabla,
    caja: envoltorio,
    cabecera: ponerCabecera,
    actualizar(filas) {
      tbody.replaceChildren();
      for (const fila of filas) {
        const f = document.createElement("tr");
        if (fila.destacada) f.className = "destacada";
        for (const celda of (fila.celdas || fila)) {
          const td = document.createElement("td");
          td.innerHTML = celda;
          f.appendChild(td);
        }
        tbody.appendChild(f);
      }
      renderizarMatematicas(tbody);
    },
  };
}

/** Barra de progreso; devuelve la función que la mueve. */
function barraProgreso(zona) {
  const barra = document.createElement("div");
  barra.className = "barra-progreso";
  const relleno = document.createElement("i");
  barra.appendChild(relleno);
  zona.appendChild(barra);
  return {
    caja: barra,
    fijar(fraccion) {
      relleno.style.width = `${Math.round(Math.max(0, Math.min(1, fraccion)) * 100)}%`;
    },
  };
}

/** El mismo color, con transparencia (atenuar series sin tocar nucleo.js). */
function conAlfa(color, alfa) {
  const limpio = String(color || "").trim();
  if (limpio.startsWith("#")) {
    const cuerpo = limpio.slice(1);
    const completo = cuerpo.length === 3
      ? cuerpo.split("").map((c) => c + c).join("")
      : cuerpo;
    const n = parseInt(completo, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
  }
  const numeros = limpio.match(/\d+(\.\d+)?/g);
  if (numeros && numeros.length >= 3) {
    return `rgba(${numeros[0]},${numeros[1]},${numeros[2]},${alfa})`;
  }
  return limpio;
}

/**
 * Arranca `fn` la primera vez que `nodo` entra en el viewport.
 *
 * Presupuesto de primera carga (§C6 del guion): al abrir la página no se
 * lanza ningún Worker. Los módulos 1 y 2 se dibujan al instante y los cuatro
 * caros esperan a que alguien mire.
 */
function alEntrarEnPantalla(nodo, fn) {
  if (typeof IntersectionObserver !== "function") {
    fn();
    return;
  }
  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (entrada.isIntersecting) {
        observador.disconnect();
        fn();
        return;
      }
    }
  }, { rootMargin: "200px" });
  observador.observe(nodo);
}

/* --- notación y constantes que se repiten en toda la página ------------- */

/** p⋆ = 2 − √2 = 0,5857864376… (aserción C1-2; S&B p. 345, «about 0.59»). */
const P_ESTRELLA = 2 - Math.SQRT2;
/** J(p⋆) = −(6 + 4√2) = −11,6568542495… (C1-3; S&B p. 345, «about −11.6»). */
const V_ESTRELLA = -(6 + 4 * Math.SQRT2);
/** La ε-greedy hacia la izquierda del Ejemplo 13.1: J(0,05) = −82,105… */
const P0 = 0.05;
const J_INICIAL = -82.10526315789474;

/**
 * Nombre traducible de una acción del motor.
 *
 * Los identificadores del motor son índices y NO se traducen; esto es su
 * rótulo. Se escribe con `case` y claves literales a propósito: el test de
 * idioma busca las claves con una expresión regular sobre el código, y una
 * clave construida con plantilla no la vería.
 *
 * ⚠ En inglés la brújula es N/S/W/E, como en el resto del sitio.
 */
function nombreAccionPolitica(entorno, i) {
  switch (entorno.acciones[i]) {
    case "derecha": return t("t5b.accion.derecha", "derecha");
    case "izquierda": return t("t5b.accion.izquierda", "izquierda");
    case "norte": return t("t5b.accion.norte", "norte");
    case "sur": return t("t5b.accion.sur", "sur");
    case "oeste": return t("t5b.accion.oeste", "oeste");
    case "este": return t("t5b.accion.este", "este");
    default: return entorno.acciones[i];
  }
}

/** Vector de dos o cuatro componentes, tipografiado con `numMat()`. */
function vectorMat(v, decimales = 4) {
  return `\\([${Array.from(v).map((x) => numMat(x, decimales)).join(",\\;")}]^\\top\\)`;
}

/* ======================================================================= *
 * MÓDULO 1 — ¿Puede ser óptima una política estocástica?
 *
 * Barrido de parámetros sobre forma cerrada. NO SIMULA NADA: 199 evaluaciones
 * de J y un sistema lineal de 3 × 3 o 4 × 4, por debajo de 1 ms. No consume
 * semilla, y el test comprueba que dos semillas dan lo mismo bit a bit.
 * ======================================================================= */

/** Dirección del MOVIMIENTO de cada acción, para las flechas de la rejilla. */
const DIR_PASILLO = [["E", "O"], ["O", "E"], ["E", "O"]];   // ⚠ el estado 1 va invertido
const DIR_CRUZ = ["N", "S", "O", "E"];

function modulo1() {
  const zonaControles = $("#m1-controles");
  const zonaViz1 = $("#m1-viz1");
  const zonaViz2 = $("#m1-viz2");
  const zonaMetricas = $("#m1-metricas");
  const zonaFicha = $("#m1-ficha");
  const zonaTabla = $("#m1-tabla");
  const zonaPaneles = $("#m1-paneles");
  const zonaLectura = $("#m1-lectura");

  /* --- estado del módulo --- */
  let p = 0.5;
  let tipo = "pasilloCorto";
  let alias = true;
  const ent = () => (tipo === "pasilloCorto" ? pasilloCorto({ alias }) : rejillaCruz({ alias }));
  const esCruz = () => tipo === "rejillaCruz";

  /* --- textos de encuadre --- */

  /* La explicación del pasillo vive en el HTML; la de la cruz la sustituye,
     y se inserta ANTES de los controles para ocupar su mismo sitio. */
  const explicacionPasillo = $("#m1 [data-t=\"t5b.m1.explicacion\"]");
  const explicacionCruz = document.createElement("p");
  explicacionCruz.className = "explicacion";
  explicacionCruz.innerHTML = t("t5b.m1.explicacionCruz",
    "Cuatro brazos alrededor de una meta central, \\(-1\\) por paso, cuatro acciones. Desde cada "
    + "brazo hay <strong>una</strong> acción que lleva a la meta; las otras tres chocan con el muro "
    + "y solo gastan un paso. Y otra vez lo mismo: <strong>los cuatro brazos tienen las mismas "
    + "características</strong>, así que hay <strong>una</strong> distribución sobre las cuatro "
    + "acciones para cuatro situaciones que piden cuatro acciones distintas. El episodio empieza en "
    + "uno de los cuatro brazos con igual probabilidad.");
  zonaControles.appendChild(explicacionCruz);
  renderizarMatematicas(explicacionCruz);

  const notaCruz = aviso(zonaControles, t("t5b.m1.notaCruz",
    "<strong>Esta rejilla no está en Sutton &amp; Barto ni en las diapositivas: se ha diseñado para "
    + "esta asignatura.</strong> Existe porque el pasillo corto es un caso muy particular —las "
    + "acciones invertidas de la celda del medio— y con un solo caso es fácil pensar que el óptimo "
    + "estocástico es una rareza. Aquí el mecanismo es otro, la simetría, y el resultado es el "
    + "mismo."));

  aviso(zonaControles, t("t5b.m1.notaExacto",
    "Este módulo <strong>no simula nada</strong>: todos los números son exactos, resueltos en forma "
    + "cerrada. No dependen de la semilla y salen iguales en cualquier ordenador."));

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  const mandoP = controlDeslizador(panel, {
    etiqueta: t("t5b.m1.pLabel", "\\(p\\): probabilidad de la acción marcada"),
    min: 1, max: 99, paso: 1, valor: 50,
    formato: (v) => num(v / 100, 2),
    alCambiar: (v) => { p = v / 100; dibujar(); },
  });
  const mandoEntorno = grupoRadio(panel, t("t5b.m1.entornoLabel", "Entorno"), [
    { valor: "pasilloCorto", texto: t("t5b.m1.entornoPasillo", "Pasillo corto (Sutton &amp; Barto)") },
    { valor: "rejillaCruz", texto: t("t5b.m1.entornoCruz", "Rejilla en cruz (de la asignatura)") },
  ], tipo, (v) => { tipo = v; dibujar(); });
  const mandoEstados = grupoRadio(panel,
    t("t5b.m1.estadosLabel", "Características del estado"), [
      { valor: "alias", texto: t("t5b.m1.estadosAlias", "indistinguibles") },
      { valor: "dist", texto: t("t5b.m1.estadosDist", "distinguibles") },
    ], "alias", (v) => { alias = v === "alias"; dibujar(); });
  botonControl(panel, t("t5b.m1.reiniciar", "Valores por omisión"), () => {
    p = 0.5; tipo = "pasilloCorto"; alias = true;
    mandoP.fijar(50); mandoEntorno.marcar(tipo); mandoEstados.marcar("alias");
    dibujar();
  });

  /* --- visualizaciones --- */

  const viz1 = caja(zonaViz1, t("t5b.m1.viz1", "El entorno, y la política con la \\(p\\) actual"));
  vacia(viz1.cuerpo, t("t5b.m1.viz1vacio", "Dibujando el entorno…"));
  const viz2 = caja(zonaViz2, t("t5b.m1.viz2", "El rendimiento en función de la probabilidad"),
    { conPie: true });
  vacia(viz2.cuerpo, t("t5b.m1.viz2vacio", "Mueve \\(p\\) para ver la curva."));

  const cifras = metricas(zonaMetricas, [
    { id: "J", etiqueta: t("t5b.m1.mJ", "\\(J(\\theta)\\) con la \\(p\\) actual") },
    { id: "optimo", etiqueta: t("t5b.m1.mOptimo", "\\(p^\\star\\) óptima") },
    { id: "valorOptimo", etiqueta: t("t5b.m1.mValorOptimo", "\\(J(p^\\star)\\)") },
    { id: "perdida", etiqueta: t("t5b.m1.mPerdida", "Pérdida por no distinguir los estados") },
  ]);

  const notaExtremo = aviso(zonaMetricas, t("t5b.m1.notaExtremo",
    "El óptimo está en el extremo del intervalo: la política óptima es determinista."));

  /* --- ficha de valores exactos y tabla comparativa --- */

  const ficha = tablaDatos(zonaFicha, { cabecera: ["Estado"] });
  const tituloFicha = document.createElement("p");
  tituloFicha.className = "viz-titulo";
  tituloFicha.innerHTML = t("t5b.m1.fichaCab",
    "Valores exactos con la \\(p\\) actual: \\(\\eta(s)\\), \\(\\mu(s)\\), \\(v_\\pi(s)\\) y "
    + "\\(q_\\pi(s,a)\\)");
  zonaFicha.insertBefore(tituloFicha, ficha.caja);
  renderizarMatematicas(tituloFicha);

  const tituloTabla = document.createElement("p");
  tituloTabla.className = "viz-titulo";
  tituloTabla.innerHTML = t("t5b.m1.tablaEntornosCab", "Los dos entornos, comparados");
  zonaTabla.appendChild(tituloTabla);
  const tablaEntornos = tablaDatos(zonaTabla, {
    texto: true,
    cabecera: [
      "&nbsp;",
      t("t5b.m1.colPasillo", "Pasillo corto"),
      t("t5b.m1.colCruz", "Rejilla en cruz"),
    ],
  });
  tablaEntornos.actualizar([
    [t("t5b.m1.filaOrigen", "Origen"),
      "<strong>Sutton &amp; Barto</strong>, Ejemplo 13.1, p. 345",
      `<strong>${t("t5b.m1.propio", "propio de la asignatura")}</strong>`],
    [t("t5b.m1.filaEstados", "Estados no terminales"), "3", "4"],
    [t("t5b.m1.filaAcciones", "Acciones"), "2", "4"],
    ["\\(d'\\)", "2", "4"],
    [t("t5b.m1.filaAlias", "De dónde viene el <em>aliasing</em>"),
      t("t5b.m1.aliasPasillo",
        "las tres celdas comparten características <strong>y una de ellas tiene las acciones "
        + "invertidas</strong>"),
      t("t5b.m1.aliasCruz",
        "las cuatro celdas comparten características <strong>y cada una pide una acción "
        + "distinta</strong>")],
    /* ⚠ Las filas dicen PARA QUÉ MODO valen. Sin eso la tabla se contradecía:
       afirmaba a la vez que con estados distinguibles el óptimo es determinista
       y vale −3, y que toda política determinista vale −∞ — que solo es cierto
       con las características compartidas. La tabla NO depende del conmutador
       (compara los dos entornos, no los dos modos), así que la aclaración va en
       el rótulo de cada fila. */
    [t("t5b.m1.filaOptimo", "Óptimo dentro de la clase, con estados <strong>indistinguibles</strong>"),
      `\\(p^\\star = 2-\\sqrt2 = ${numMat(P_ESTRELLA, 10)}\\ldots\\), \\(J = -(6+4\\sqrt2) = `
      + `${numMat(V_ESTRELLA, 10)}\\ldots\\)`,
      "\\(p^\\star = 1/4\\), \\(J = -4\\)"],
    [t("t5b.m1.filaOptimoDist", "Óptimo con estados <strong>distinguibles</strong>"),
      t("t5b.m1.detMenos3", "determinista, \\(J = -3\\)"),
      t("t5b.m1.detMenos1", "determinista, \\(J = -1\\)")],
    /* ⚠ Los dos números del paréntesis van por `numMat()` y no escritos a
       mano: con la coma decimal fija, la capa inglesa mostraba «−11,66» al
       lado de un «−8.6569» con punto. */
    [t("t5b.m1.filaPerdida", "Pérdida por <em>aliasing</em>: lo que cuesta pasar de una fila a la otra"),
      `<strong>\\(${numMat(V_ESTRELLA + 3, 4)}\\)</strong> `
      + `<span class="suave">(\\(${numMat(V_ESTRELLA, 2)}\\) `
      + `${t("t5b.m1.frenteA", "frente a")} \\(-3\\))</span>`,
      `<strong>\\(-3\\)</strong> `
      + `<span class="suave">(\\(-4\\) ${t("t5b.m1.frenteA", "frente a")} \\(-1\\))</span>`],
    [t("t5b.m1.filaDeterministas",
      "Políticas deterministas, con estados <strong>indistinguibles</strong>"),
    t("t5b.m1.aInfinito", "\\(J\\to-\\infty\\) en los dos extremos"),
    t("t5b.m1.aInfinito", "\\(J\\to-\\infty\\) en los dos extremos")],
  ]);

  /* --- paneles --- */

  const panelDeterministas = aviso(zonaPaneles, t("t5b.m1.panelDeterministas",
    "Lleva \\(p\\) a los dos extremos y mira el número. Con \\(p\\to1\\) el agente rebota entre la "
    + "primera celda y la segunda <strong>para siempre</strong>, porque en la segunda <em>derecha</em> "
    + "lo devuelve a la primera. Con \\(p\\to0\\) se queda pegado a la primera celda, contra la pared. "
    + "\\(J(p)\\to-\\infty\\) en los dos casos: <strong>bajo esta parametrización, ninguna política "
    + "determinista termina</strong>, y el óptimo tiene que ser estocástico. Ese es el argumento "
    + "entero, y es más fuerte que el que da el libro."));
  const panelDeterministasCruz = aviso(zonaPaneles, t("t5b.m1.panelDeterministasCruz",
    "Cualquier política determinista elige <strong>una</strong> de las cuatro acciones, y entonces "
    + "tres de los cuatro brazos no salen nunca: \\(J = -\\infty\\). Y el óptimo estocástico es "
    + "exactamente <strong>la política uniforme</strong>, \\(p = 1/4\\), con \\(J = -4\\): cuatro "
    + "pasos de media, uno por acción probada."));
  const panelAlias = aviso(zonaPaneles, t("t5b.m1.panelAlias",
    "Ahora los demás estados usan su acción correcta y \\(p\\) gobierna solo uno. Mira lo que ha "
    + "pasado con la curva: <strong>el máximo se ha ido al extremo</strong>, y la política óptima ha "
    + "pasado a ser <strong>determinista</strong>. La diferencia entre los dos máximos —\\(-11{,}66\\) "
    + "frente a \\(-3\\)— es lo que cuesta <strong>no poder distinguir los estados</strong>. Es "
    + "importante no llevarse la conclusión equivocada: en un MDP finito con estados distinguibles "
    + "<strong>siempre</strong> hay una política óptima determinista, y el libro lo sabe; por eso "
    + "habla siempre de la mejor política <strong>aproximada</strong>. Aquí solo se libera un estado: "
    + "liberar los tres pediría tres deslizadores."));
  const panelAliasCruz = aviso(zonaPaneles, t("t5b.m1.panelAliasCruz",
    "Lo mismo aquí: con los otros tres brazos resueltos, el óptimo se va a \\(p = 1\\) y vale "
    + "\\(-1\\), un paso por episodio. Frente a los \\(-4\\) de antes."));

  /* --- lectura --- */

  zonaLectura.classList.add("siempre");
  zonaLectura.innerHTML = t("t5b.m1.lectura1",
    "Cuando las características <strong>no distinguen</strong> los estados, la mejor política puede "
    + "ser estocástica, y no por poco: en el pasillo corto <strong>ninguna</strong> política "
    + "determinista termina —las dos ramas de la curva caen a \\(-\\infty\\)— y el óptimo está en "
    + "\\(p^\\star = 2-\\sqrt2 \\approx 0{,}59\\), con \\(J = -(6+4\\sqrt2) \\approx -11{,}66\\).");
  renderizarMatematicas(zonaLectura);
  const lectura2 = document.createElement("p");
  lectura2.className = "explicacion siempre";
  lectura2.innerHTML = t("t5b.m1.lectura2",
    "Eso <strong>no</strong> quiere decir que en un MDP finito el óptimo pueda ser estocástico: es "
    + "una consecuencia de la <strong>aproximación</strong>. Con los estados distinguibles, el mismo "
    + "pasillo tiene óptimo determinista y vale \\(-3\\); la diferencia, casi nueve pasos por "
    + "episodio, es el precio del <em>aliasing</em>.");
  zonaLectura.after(lectura2);
  renderizarMatematicas(lectura2);

  /* --- dibujo --- */

  /**
   * Las celdas de la rejilla, con la política de la p actual encima.
   *
   * Las flechas apuntan en la dirección del MOVIMIENTO, no en la del nombre de
   * la acción: es lo único que hace visible que en la celda del medio del
   * pasillo `derecha` mueve a la izquierda. La segunda flecha solo se dibuja
   * si su acción tiene probabilidad no nula (en modo «distinguibles» hay
   * estados con una sola acción posible).
   */
  function celdas(entorno) {
    const marcada = entorno.accionMarcada;
    const theta = thetaDeP(entorno, p);
    /* Orden de acciones por probabilidad. No es un argmax sobre valores: es
       ordenar la distribución para decidir el grosor visual, y los empates los
       rompe el orden fijo de las acciones del motor. */
    const ordenar = (pi) => Array.from(pi.keys()).sort((a, b) => pi[b] - pi[a]);

    if (entorno.tipo === "pasilloCorto") {
      const lista = [];
      for (let s = 0; s < 3; s++) {
        const pi = probabilidades(entorno, theta, s);
        const orden = ordenar(pi);
        lista.push({
          fila: 0, col: s,
          /* El rótulo va en la ESQUINA y no en el centro: `rejilla` dibuja la
             subetiqueta y las flechas en la misma banda cuando hay etiqueta
             centrada, y la probabilidad se montaba encima de las puntas. */
          /* La tercera celda se rotula «→ G» y no con un punto: es la única
             desde la que se toca la meta, y es lo que hay que ver. */
          esquina: s === 0 ? "S" : (s === 1 ? t("t5b.m1.invertido", "invertido") : "→ G"),
          subetiqueta: pct(pi[marcada], 0),
          borde: s === 1 ? tono("--acento") : null,
          titulo: s === 1
            ? t("t5b.m1.tituloInvertido",
              "Aquí las acciones están invertidas: derecha mueve a la izquierda")
            : `${nombreAccionPolitica(entorno, marcada)}: ${pct(pi[marcada], 0)}`,
          flechas: [DIR_PASILLO[s][orden[0]]],
          flechas2: pi[orden[1]] > 0 ? [DIR_PASILLO[s][orden[1]]] : null,
        });
      }
      lista.push({
        fila: 0, col: 3, etiqueta: t("t5b.m1.meta", "G"),
        color: tono("--ok-bg"), esquina: "G",
      });
      return lista;
    }

    /* Rejilla en cruz: esquinas de muro, meta en el centro y cuatro brazos.
       El brazo s se rotula con el punto cardinal en que está, que es el
       nombre de la acción de índice ACCION_DEL_BRAZO[s]. */
    const POS = [[0, 1], [1, 0], [1, 2], [2, 1]];
    const ACCION_DEL_BRAZO = [0, 2, 3, 1];       // norte, oeste, este, sur
    const SALIDA = [1, 3, 2, 0];                 // la acción que sale de cada brazo
    const lista = [];
    for (const [fila, col] of [[0, 0], [0, 2], [2, 0], [2, 2]]) {
      lista.push({
        fila, col, atenuada: true, tamano: 11,
        etiqueta: t("t5b.m1.muro", "muro"),
      });
    }
    lista.push({
      fila: 1, col: 1, etiqueta: t("t5b.m1.meta", "G"),
      color: tono("--ok-bg"), esquina: "G",
    });
    POS.forEach(([fila, col], s) => {
      const pi = probabilidades(entorno, theta, s);
      const orden = ordenar(pi);
      lista.push({
        fila, col,
        esquina: nombreAccionPolitica(entorno, ACCION_DEL_BRAZO[s]),
        subetiqueta: pct(pi[marcada], 0),
        titulo: t("t5b.m1.tituloBrazo", "De aquí se sale con {a} ({p})", {
          a: nombreAccionPolitica(entorno, SALIDA[s]),
          p: pct(pi[SALIDA[s]], 0),
        }),
        flechas: [DIR_CRUZ[orden[0]]],
        flechas2: pi[orden[1]] > 0 ? [DIR_CRUZ[orden[1]]] : null,
      });
    });
    return lista;
  }

  function dibujarViz1() {
    const entorno = ent();
    pintar(viz1.cuerpo, rejilla({
      celdas: celdas(entorno),
      lado: esCruz() ? 84 : 92,
    }));
  }

  function dibujarViz2() {
    const entorno = ent();
    const x = [];
    const y = [];
    for (let i = 1; i <= 199; i++) {
      const q = i * 0.005;
      x.push(q);
      y.push(J(entorno, q));
    }
    const optimo = optimoExacto(entorno);
    const anotaciones = [{ x: p, texto: `p = ${num(p, 2)}` }];
    if (!esCruz() && alias) {
      anotaciones.push(
        { x: 0.95, texto: t("t5b.m1.anotGreedyDer", "ε-greedy derecha (p = 0,95)") },
        { x: 0.05, texto: t("t5b.m1.anotGreedyIzq", "ε-greedy izquierda (p = 0,05)") },
      );
    }
    const serie = {
      nombre: t("t5b.m1.serieJ", "\\(J(p)\\)"),
      color: tono(COLORES_SERIE[0]), y, x, grosor: 2.6,
    };
    pintar(viz2.cuerpo, graficaLineas([serie], {
      ancho: 660, alto: 320,
      ejeX: t("t5b.m1.viz2x", "p: probabilidad de la acción marcada"),
      ejeY: t("t5b.m1.viz2y", "J(θ) = v<sub>π</sub>(s<sub>0</sub>)"),
      /* ⚠ `ventanaY`: este es el caso para el que existe. J(p) NO TIENE MÍNIMO
         —cae a −∞ en los dos extremos—, así que estirar el eje no significa
         nada: el suelo lo fijaría el punto de muestreo más extremo (−800 en
         p = 0,005) y aplastaría contra el techo justo lo que el módulo enseña.
         El rango es una ventana deliberada, y `graficaLineas` corta las dos
         ramas en el borde en vez de dejarlas pintar sobre el eje.
         yMax en 0 —J nunca es positivo— para que la línea del óptimo no quede
         pegada al borde superior. */
      yMin: esCruz() ? -40 : -100,
      yMax: 0,
      ventanaY: true,
      ticksX: [0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => ({ valor: v, etiqueta: num(v, 1) })),
      formatoY: (v) => num(v, 0),
      anotaciones,
      anotacionesY: Number.isFinite(optimo.J)
        ? [{ y: optimo.J, texto: t("t5b.m1.anotOptimo", "óptimo dentro de la clase") }]
        : [],
    }));
    fijarPie(viz2.pie, t("t5b.m1.viz2runs", "Cálculo exacto · sin simulación"));
  }

  /** Forma exacta del óptimo, según entorno y modo. */
  function formaExacta(entorno) {
    if (entorno.tipo === "pasilloCorto") {
      return entorno.alias
        ? { p: "\\(2-\\sqrt2\\)", J: "\\(-(6+4\\sqrt2)\\)" }
        : { p: "\\(p\\to0^+\\)", J: "\\(-3\\)" };
    }
    return entorno.alias
      ? { p: "\\(1/4\\)", J: "\\(-4\\)" }
      : { p: "\\(1\\)", J: "\\(-1\\)" };
  }

  function dibujarMetricas() {
    const entorno = ent();
    const valorJ = J(entorno, p);
    if (!Number.isFinite(valorJ)) {
      fijarCifra(cifras.J, t("t5b.m1.mJinfinito", "\\(-\\infty\\): el episodio no termina"));
    } else if (Math.abs(valorJ) > 1e4) {
      fijarCifra(cifras.J, t("t5b.m1.mJenorme", "peor que \\(-10\\,000\\)"));
    } else {
      fijarCifra(cifras.J, `\\(${numMat(valorJ, 4)}\\)`);
    }
    const optimo = optimoExacto(entorno);
    const forma = formaExacta(entorno);
    fijarCifra(cifras.optimo, `\\(${numMat(optimo.p, 7)}\\)`);
    fijarCifra(cifras["optimo$glosa"],
      t("t5b.m1.mOptimoExacto", "forma exacta: {v}", { v: forma.p }));
    fijarCifra(cifras.valorOptimo, `\\(${numMat(optimo.J, 7)}\\)`);
    fijarCifra(cifras["valorOptimo$glosa"],
      t("t5b.m1.mValorOptimoExacto", "forma exacta: {v}", { v: forma.J }));

    const conAliasing = optimoExacto(esCruz() ? rejillaCruz({}) : pasilloCorto({}));
    const sinAliasing = optimoExacto(esCruz()
      ? rejillaCruz({ alias: false })
      : pasilloCorto({ alias: false }));
    fijarCifra(cifras.perdida, `\\(${numMat(conAliasing.J - sinAliasing.J, 4)}\\)`);
  }

  function dibujarFicha() {
    const entorno = ent();
    const v = valoresExactos(entorno, p);
    const marcada = entorno.accionMarcada;
    const cabecera = [t("t5b.m1.colEstado", "Estado"), "\\(\\eta(s)\\)", "\\(\\mu(s)\\)",
      "\\(v_\\pi(s)\\)"];
    if (entorno.tipo === "pasilloCorto") {
      cabecera.push(
        `\\(q_\\pi(s,\\text{${nombreAccionPolitica(entorno, marcada)}})\\)`,
        `\\(q_\\pi(s,\\text{${nombreAccionPolitica(entorno, 1 - marcada)}})\\)`,
      );
    } else {
      for (let a = 0; a < entorno.nAcciones; a++) {
        cabecera.push(`\\(q_\\pi(s,\\text{${nombreAccionPolitica(entorno, a)}})\\)`);
      }
    }
    ficha.cabecera(cabecera);

    const nombreEstado = (s) => (entorno.tipo === "pasilloCorto"
      ? (s === 1 ? `${s} · ${t("t5b.m1.invertido", "invertido")}` : String(s))
      : `${s} · ${nombreAccionPolitica(entorno, [0, 2, 3, 1][s])}`);

    const filas = [];
    for (let s = 0; s < entorno.nEstados; s++) {
      const fila = [nombreEstado(s), `\\(${numMat(v.eta[s], 4)}\\)`,
        `\\(${numMat(v.mu[s], 4)}\\)`, `\\(${numMat(v.v[s], 4)}\\)`];
      if (entorno.tipo === "pasilloCorto") {
        fila.push(`\\(${numMat(v.q[s][marcada], 4)}\\)`,
          `\\(${numMat(v.q[s][1 - marcada], 4)}\\)`);
      } else {
        for (let a = 0; a < entorno.nAcciones; a++) fila.push(`\\(${numMat(v.q[s][a], 4)}\\)`);
      }
      filas.push(fila);
    }
    ficha.actualizar(filas);
  }

  /**
   * Qué paneles se ven. Se llama al construir Y en cada cambio: si viviera
   * solo dentro del manejador, los dos pares contradictorios nacerían
   * visibles a la vez.
   */
  function sincronizar() {
    ver(explicacionPasillo, !esCruz());
    ver(explicacionCruz, esCruz());
    ver(notaCruz, esCruz());
    ver(panelDeterministas, alias && !esCruz());
    ver(panelDeterministasCruz, alias && esCruz());
    ver(panelAlias, !alias && !esCruz());
    ver(panelAliasCruz, !alias && esCruz());
    ver(notaExtremo, optimoExacto(ent()).extremo);
  }

  function dibujar() {
    sincronizar();
    dibujarViz1();
    dibujarViz2();
    dibujarMetricas();
    dibujarFicha();
  }

  repintadores.push(dibujar);
  dibujar();

  crearQuiz($("#m1-quiz"), [
    {
      enunciado: "En el pasillo corto del Ejemplo 13.1, la mejor política dentro de la clase "
        + "considerada es estocástica. ¿Por qué?",
      opciones: [
        "Porque las características no distinguen los tres estados, así que hay una sola "
        + "probabilidad para tres situaciones distintas, y una de ellas tiene las acciones "
        + "invertidas.",
        "Porque el MDP no es markoviano: el estado siguiente depende de por dónde se ha pasado "
        + "antes.",
        "Porque las recompensas son estocásticas y una política determinista no puede "
        + "promediarlas.",
        "Porque el entorno es episódico y sin descuento, y con \\(\\gamma = 1\\) el óptimo de un "
        + "MDP siempre puede ser estocástico.",
      ],
      correcta: 0,
      explicacion: "Todo el ejemplo vive del <em>aliasing</em>: el libro define "
        + "\\(x(s,\\text{derecha}) = [1,0]^\\top\\) y \\(x(s,\\text{izquierda}) = [0,1]^\\top\\) "
        + "<strong>para los tres estados</strong>, y por eso el agente solo puede tener una \\(p\\). "
        + "El MDP <strong>sí</strong> es markoviano y sus transiciones son deterministas; lo que no "
        + "es markoviana es la representación. Las recompensas son \\(-1\\) siempre, sin ruido. Y "
        + "\\(\\gamma = 1\\) no tiene nada que ver: en un MDP finito con estados distinguibles "
        + "<strong>siempre</strong> existe una política óptima determinista, y en este mismo "
        + "pasillo, si se distinguen los estados, el óptimo es (derecha, izquierda, derecha) y vale "
        + "\\(-3\\).",
    },
    {
      enunciado: "En este pasillo, ¿qué le pasa a una política que va a la derecha con "
        + "probabilidad 1?",
      opciones: [
        "Que no termina nunca: rebota entre la primera celda y la segunda, y su rendimiento es "
        + "\\(-\\infty\\).",
        "Que llega a la meta en tres pasos, que es el mínimo posible.",
        "Que llega a la meta, pero más despacio que la política óptima estocástica.",
        "Que es equivalente a una \\(\\varepsilon\\)-<em>greedy</em> con \\(\\varepsilon\\) muy "
        + "pequeño, y alcanza aproximadamente \\(-44\\).",
      ],
      correcta: 0,
      explicacion: "En la segunda celda las acciones están invertidas, así que ir siempre a la "
        + "derecha te devuelve a la primera celda una y otra vez: el episodio no acaba. La curva lo "
        + "enseña cayendo a \\(-\\infty\\) por su rama derecha. Tres pasos es lo que consigue la "
        + "política determinista <strong>si se distinguen los estados</strong>, que no es el caso. Y "
        + "\\(-44{,}21\\) es el valor de \\(p = 0{,}95\\), la \\(\\varepsilon\\)-<em>greedy</em> con "
        + "\\(\\varepsilon = 0{,}1\\) que marca el libro en su gráfica: es finito precisamente "
        + "porque <strong>no</strong> es determinista.",
    },
    {
      enunciado: "En la rejilla en cruz, con los cuatro brazos indistinguibles, ¿cuál es la "
        + "política óptima dentro de la clase parametrizada, y cuánto vale?",
      opciones: [
        "La uniforme sobre las cuatro acciones, con \\(J = -4\\): de media hacen falta cuatro "
        + "pasos, uno por acción probada.",
        "La que da toda la probabilidad a la acción que resuelve el brazo más frecuente, con "
        + "\\(J = -1\\).",
        "No hay óptimo: cualquier política estocástica vale lo mismo por simetría.",
        "La que reparte la probabilidad en proporción a la distancia de cada brazo a la meta.",
      ],
      correcta: 0,
      explicacion: "Los cuatro brazos son simétricos y cada uno pide una acción distinta, así que "
        + "el tiempo esperado es \\(\\frac14\\sum_a 1/\\pi(a)\\); esa suma se minimiza en la "
        + "uniforme, y da cuatro pasos. \\(-1\\) es lo que se consigue <strong>si los brazos se "
        + "distinguen</strong>, con la política determinista correcta en cada uno. Y no todas las "
        + "estocásticas valen igual: en cuanto una acción se lleva más probabilidad que las otras, "
        + "los brazos que necesitan las demás tardan más, y el promedio empeora. Las cuatro "
        + "distancias a la meta son idénticas: un paso.",
    },
  ], { claves: "t5b.m1.quiz" });
}

/* ======================================================================= *
 * MÓDULO 2 — El teorema del gradiente, término a término
 *
 * Documento reactivo sobre forma cerrada. Los dos lados de (13.5) se calculan
 * POR CAMINOS INDEPENDIENTES: el izquierdo por diferencias finitas sobre J y
 * el derecho por la suma del teorema. 91 sistemas de 3 × 3: bajo 5 ms.
 * ======================================================================= */

function modulo2() {
  const zonaControles = $("#m2-controles");
  const zonaViz1 = $("#m2-viz1");
  const zonaViz2 = $("#m2-viz2");
  const zonaViz3 = $("#m2-viz3");
  const zonaMetricas = $("#m2-metricas");
  const zonaPaneles = $("#m2-paneles");
  const zonaLectura = $("#m2-lectura");

  /* Este módulo trabaja SOLO sobre el pasillo corto (§12 del guion). */
  const entorno = pasilloCorto({});

  /* --- estado del módulo --- */
  let p = 0.5;
  let conConstante = true;

  aviso(zonaControles, t("t5b.m2.notaRango",
    "El rango es más estrecho que en el módulo anterior: cerca de los extremos \\(J\\) se dispara y "
    + "la diferencia finita deja de ser fiable."));
  aviso(zonaControles, t("t5b.m2.notaSoloPasillo",
    "Este módulo trabaja solo sobre el <strong>pasillo corto</strong>; en la rejilla en cruz la "
    + "comprobación sale igual, y el motor la sabe hacer."));

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  const mandoP = controlDeslizador(panel, {
    etiqueta: t("t5b.m2.pLabel", "\\(p = \\pi(\\text{derecha}\\mid s,\\theta)\\)"),
    min: 5, max: 95, paso: 1, valor: 50,
    formato: (v) => num(v / 100, 2),
    alCambiar: (v) => { p = v / 100; dibujar(); },
  });
  const mandoConstante = grupoRadio(panel,
    t("t5b.m2.constanteLabel", "Constante de proporcionalidad"), [
      { valor: "con", texto: t("t5b.m2.constanteCon", "con la constante") },
      { valor: "sin", texto: t("t5b.m2.constanteSin", "sin la constante") },
    ], "con", (v) => { conConstante = v === "con"; dibujar(); });
  botonControl(panel, t("t5b.m2.reiniciar", "Valores por omisión"), () => {
    p = 0.5; conConstante = true;
    mandoP.fijar(50); mandoConstante.marcar("con");
    dibujar();
  });

  /* --- Viz 1: la fórmula viva ------------------------------------------ */

  const viz1 = caja(zonaViz1, t("t5b.m2.formulaVivaCab",
    "El teorema, con sus tres piezas y sus números"));
  const formula = document.createElement("div");
  formula.style.display = "flex";
  formula.style.flexWrap = "wrap";
  formula.style.alignItems = "center";
  formula.style.justifyContent = "center";
  formula.style.gap = ".55rem";
  formula.style.margin = ".4rem 0";
  viz1.cuerpo.appendChild(formula);

  /**
   * Una pieza de la fórmula viva: símbolo arriba, valor debajo, glosa al pie.
   *
   * Los dos recuadros de color de `5_Tema_5_2#slide-8` van DENTRO del símbolo
   * del lado derecho, no como piezas sueltas: separarlos obligaría a
   * inventarse un valor numérico para cada mitad, y el número que existe es el
   * del producto. La leyenda de los colores va debajo, escrita.
   */
  function pieza(simbolo, glosa) {
    const div = document.createElement("div");
    div.style.textAlign = "center";
    div.style.padding = ".45rem .1rem";
    div.style.minWidth = "0";
    const s = document.createElement("div");
    s.innerHTML = simbolo;
    const v = document.createElement("div");
    v.className = "cifra";
    v.style.fontFamily = "var(--mono)";
    v.style.fontSize = "1rem";
    v.style.fontWeight = "700";
    v.style.marginTop = ".3rem";
    v.textContent = "—";
    const g = document.createElement("div");
    g.className = "suave";
    g.style.fontSize = ".72rem";
    g.style.maxWidth = "24ch";
    g.style.margin = ".15rem auto 0";
    g.innerHTML = glosa;
    div.append(s, v, g);
    formula.appendChild(div);
    renderizarMatematicas(div);
    return v;
  }
  function operador(texto) {
    const div = document.createElement("div");
    div.style.fontSize = "1.3rem";
    div.innerHTML = texto;
    formula.appendChild(div);
    return div;
  }

  const recuadro = (color, contenido) => `<span style="display:inline-block;border:2px solid `
    + `${color};border-radius:5px;padding:.1rem .3rem">${contenido}</span>`;

  const valIzq = pieza("\\(\\nabla J(\\theta)\\)",
    t("t5b.m2.glosaIzq", "por diferencias finitas"));
  /* ⚠ El conector y la pieza de la constante son CONDICIONALES. Con «sin la
     constante» la fórmula escribía «[2,0000, −2,0000] = 1 · [0,166667, …]»,
     con un signo de igual, y rotulaba ese 1 como «longitud media del
     episodio» mientras la métrica de veinte píxeles más abajo decía 12: la
     misma pantalla daba dos valores para la misma constante y afirmaba que
     2 = 0,1667. Sin la constante lo que hay es exactamente el ∝ del libro. */
  const conector = operador("=");
  const valConstante = pieza("\\(\\sum_s \\eta(s)\\)",
    t("t5b.m2.glosaConstante", "longitud media del episodio"));
  const porSigno = operador("·");
  const valDerecho = pieza(
    recuadro(tono("--mal"), "\\(\\sum_s \\mu(s) \\sum_a q_\\pi(s,a)\\)")
    + recuadro(tono("--ok"), "\\(\\nabla\\pi(a\\mid s,\\theta)\\)"),
    t("t5b.m2.glosaDerecho", "lado derecho de (13.5)"));

  const leyendaColores = document.createElement("p");
  leyendaColores.className = "suave";
  leyendaColores.style.fontSize = ".8rem";
  leyendaColores.style.margin = ".2rem 0 0";
  leyendaColores.innerHTML = `<span style="color:${tono("--mal")}">■</span> `
    + t("t5b.m2.rojo",
      "lo que se estima muestreando: por eso hace falta seguir \\(\\pi\\)")
    + `<br><span style="color:${tono("--ok")}">■</span> `
    + t("t5b.m2.verde",
      "lo único que hay que derivar: es donde aparece la parametrización");
  viz1.cuerpo.appendChild(leyendaColores);
  renderizarMatematicas(leyendaColores);

  /* --- Viz 2: la tabla término a término ------------------------------- */

  const tituloTabla = document.createElement("p");
  tituloTabla.className = "viz-titulo";
  tituloTabla.innerHTML = t("t5b.m2.viz2", "Término a término, estado por estado");
  zonaViz2.appendChild(tituloTabla);
  renderizarMatematicas(tituloTabla);
  const tabla = tablaDatos(zonaViz2, {
    cabecera: [
      t("t5b.m2.colEstado", "Estado"), "\\(\\eta(s)\\)", "\\(\\mu(s)\\)",
      "\\(q_\\pi(s,\\text{der})\\)", "\\(q_\\pi(s,\\text{izq})\\)",
      "\\(\\nabla\\pi(\\text{der}\\mid s,\\theta)\\)",
      "\\(\\nabla\\pi(\\text{izq}\\mid s,\\theta)\\)",
      t("t5b.m2.colAportacion", "aportación al sumatorio"),
    ],
  });

  /* --- Viz 3: los dos lados en función de p ---------------------------- */

  const viz3 = caja(zonaViz3, t("t5b.m2.viz3", "Los dos lados de la ecuación, punto a punto"),
    { conPie: true });
  vacia(viz3.cuerpo, t("t5b.m2.viz3vacio", "Mueve \\(p\\) para dibujar los dos lados."));

  const cifras = metricas(zonaMetricas, [
    { id: "izq", etiqueta: t("t5b.m2.mIzq", "\\(\\nabla J(\\theta)\\), por diferencias finitas") },
    { id: "der", etiqueta: t("t5b.m2.mDer", "Lado derecho de (13.5)") },
    { id: "constante", etiqueta: t("t5b.m2.mConstante", "Constante de proporcionalidad"),
      glosa: t("t5b.m2.mConstanteGlosa",
        "= longitud media del episodio = \\(-J(\\theta)\\)") },
    { id: "cociente", etiqueta: t("t5b.m2.mCociente", "Cociente entre los dos lados") },
  ]);

  /* --- paneles --- */

  const panelElegibilidad = document.createElement("div");
  panelElegibilidad.className = "aviso";
  panelElegibilidad.style.margin = ".6rem 0";
  panelElegibilidad.innerHTML = `${t("t5b.m2.panelElegibilidad",
    "El trozo verde es lo único que depende de la parametrización, y para la softmax lineal tiene "
    + "forma cerrada: <strong>la característica de la acción tomada menos la característica media "
    + "bajo la política</strong>. En este pasillo, con \\(x(s,\\text{derecha}) = [1,0]^\\top\\) y "
    + "\\(x(s,\\text{izquierda}) = [0,1]^\\top\\), sale esto:")
  }<p class="ecuacion">\\[ \\nabla\\ln\\pi(\\text{derecha}\\mid s,\\theta) = (1-p)\\begin{bmatrix}1\\\\-1\\end{bmatrix},`
    + ` \\qquad \\nabla\\ln\\pi(\\text{izquierda}\\mid s,\\theta) = p\\begin{bmatrix}-1\\\\1\\end{bmatrix} \\]</p>`;
  zonaPaneles.appendChild(panelElegibilidad);
  renderizarMatematicas(panelElegibilidad);

  parrafo(zonaPaneles, "explicacion", t("t5b.m2.panelElegibilidad2",
    "Fíjate en algo que se ve aquí y en ningún otro sitio: <strong>los dos gradientes son múltiplos "
    + "de \\([1,-1]^\\top\\)</strong>. Eso quiere decir que, hagas lo que hagas, \\(\\theta_r + "
    + "\\theta_\\ell\\) <strong>no cambia nunca</strong> durante el entrenamiento, y que el único "
    + "grado de libertad real es la diferencia \\(\\theta_r - \\theta_\\ell = \\ln\\frac{p}{1-p}\\). "
    + "Dos parámetros, un grado de libertad. En los módulos siguientes vas a ver moverse esa "
    + "diferencia, y solo esa."));

  parrafo(zonaPaneles, "explicacion", t("t5b.m2.panelDF",
    "El lado izquierdo se calcula sin tocar el teorema: se evalúa \\(J\\) con la fórmula cerrada en "
    + "\\(\\theta\\pm h\\,e_i\\) y se hace \\((J(\\theta+h e_i) - J(\\theta - h e_i))/2h\\), con "
    + "\\(h = 10^{-5}\\). Es una diferencia finita centrada, cuyo error es del orden de \\(h^2\\). "
    + "<strong>Si los dos lados coinciden a seis decimales, no es porque se hayan calculado igual: "
    + "es porque el teorema es cierto.</strong>"));

  const panelSinConstante = aviso(zonaPaneles, t("t5b.m2.panelSinConstante",
    "Sin la constante, los dos lados <strong>no</strong> coinciden, y el cociente entre ellos es "
    + "exactamente la longitud media del episodio. Con \\(p = 0{,}5\\) son 12 pasos, y el cociente "
    + "es 12. Para el algoritmo esto da igual, porque cualquier constante se absorbe en "
    + "\\(\\alpha\\) —que es arbitrario—, y por eso el libro escribe \\(\\propto\\) y sigue. Pero si "
    + "lo que quieres es comprobar el teorema, la constante está y hay que ponerla."));

  parrafo(zonaPaneles, "explicacion", t("t5b.m2.panelMu",
    "\\(\\mu(s)\\) no es una elección tuya: sale de contar. \\(\\eta(s)\\) es el número esperado de "
    + "pasos que un episodio pasa en \\(s\\), y \\(\\mu(s)\\) es \\(\\eta(s)\\) normalizado. Con "
    + "\\(p = 0{,}5\\) el pasillo da \\(\\eta = (6,\\,4,\\,2)\\) y \\(\\mu = (1/2,\\,1/3,\\,1/6)\\): "
    + "la mitad del tiempo se pasa en la primera celda, y solo una sexta parte en la tercera, que es "
    + "la que toca la meta. Ahí está el problema de este entorno en un número."));

  /* --- lectura --- */

  zonaLectura.classList.add("siempre");
  zonaLectura.innerHTML = t("t5b.m2.lectura1",
    "El teorema sirve porque en su lado derecho <strong>no aparece \\(\\nabla\\mu\\)</strong>: la "
    + "distribución de estados está, pero <strong>sin derivar</strong>. Por eso se puede estimar el "
    + "gradiente sin conocer la dinámica del entorno — y por eso hay que <strong>seguir "
    + "\\(\\pi\\)</strong> para muestrear, que es lo que hace estos métodos dentro de política.");
  renderizarMatematicas(zonaLectura);
  const lectura2 = document.createElement("p");
  lectura2.className = "explicacion siempre";
  lectura2.innerHTML = t("t5b.m2.lectura2",
    "El \\(\\propto\\) esconde un número concreto: <strong>la longitud media del episodio</strong>. "
    + "Con \\(\\theta = 0\\) el gradiente vale \\([2,-2]^\\top\\), el lado derecho "
    + "\\([1/6,-1/6]^\\top\\), y entre ellos hay exactamente 12, que son los 12 pasos que dura de "
    + "media un episodio con \\(p = 0{,}5\\). Para el algoritmo da igual porque se absorbe en "
    + "\\(\\alpha\\); para entender la fórmula, no.");
  zonaLectura.after(lectura2);
  renderizarMatematicas(lectura2);

  /* --- dibujo --- */

  /** Los dos lados del teorema en un punto, por caminos independientes. */
  function ladosEn(q) {
    const theta = thetaDeP(entorno, q);
    const izquierdo = gradienteJ(entorno, theta);          // diferencias finitas sobre J
    const derecho = ladoDerechoTeorema(entorno, theta);    // la suma de (13.5)
    const constante = constanteProporcionalidad(entorno, theta);
    return { theta, izquierdo, derecho, constante };
  }

  function dibujarFormula() {
    const { izquierdo, derecho, constante } = ladosEn(p);
    valIzq.textContent = `[${num(izquierdo[0], 4)}, ${num(izquierdo[1], 4)}]`;
    valConstante.textContent = num(constante, 4);
    valDerecho.textContent = `[${num(derecho[0], 6)}, ${num(derecho[1], 6)}]`;
    /* Sin la constante, la fórmula que queda es el ∝ del libro: se quita la
       pieza y el producto, y el conector deja de ser un igual. */
    conector.textContent = conConstante ? "=" : "∝";
    ver(valConstante.parentElement, conConstante);
    ver(porSigno, conConstante);
  }

  function dibujarTabla() {
    const { theta, derecho, constante } = ladosEn(p);
    const v = valoresExactos(entorno, p);
    const filas = [];
    const total = [0, 0];
    for (let s = 0; s < entorno.nEstados; s++) {
      const pi = probabilidades(entorno, theta, s);
      const gDer = gradLogPi(entorno, theta, s, 0);
      const gIzq = gradLogPi(entorno, theta, s, 1);
      /* ∇π = π ∇ln π (identidad ∇ln x = ∇x/x: nunca se divide por π). */
      const nablaDer = [pi[0] * gDer[0], pi[0] * gDer[1]];
      const nablaIzq = [pi[1] * gIzq[0], pi[1] * gIzq[1]];
      const aportacion = [
        v.mu[s] * (v.q[s][0] * nablaDer[0] + v.q[s][1] * nablaIzq[0]),
        v.mu[s] * (v.q[s][0] * nablaDer[1] + v.q[s][1] * nablaIzq[1]),
      ];
      total[0] += aportacion[0];
      total[1] += aportacion[1];
      filas.push([
        s === 1 ? `1 · ${t("t5b.m1.invertido", "invertido")}` : String(s),
        `\\(${numMat(v.eta[s], 4)}\\)`,
        `\\(${numMat(v.mu[s], 4)}\\)`,
        `\\(${numMat(v.q[s][0], 4)}\\)`,
        `\\(${numMat(v.q[s][1], 4)}\\)`,
        vectorMat(nablaDer),
        vectorMat(nablaIzq),
        vectorMat(aportacion),
      ]);
    }
    filas.push({
      destacada: true,
      celdas: [
        `<strong>${t("t5b.m2.filaTotal", "total")}</strong>`,
        `\\(${numMat(constante, 4)}\\)`, "\\(1\\)", "—", "—", "—", "—",
        `<strong>${vectorMat(derecho, 6)}</strong>`,
      ],
    });
    tabla.actualizar(filas);
  }

  function dibujarViz3() {
    const x = [];
    const yIzq = [];
    const yDer = [];
    for (let i = 5; i <= 95; i++) {
      const q = i / 100;
      const { izquierdo, derecho, constante } = ladosEn(q);
      x.push(q);
      yIzq.push(izquierdo[0]);
      yDer.push((conConstante ? constante : 1) * derecho[0]);
    }
    const series = [
      { nombre: t("t5b.m2.serieIzq", "\\(\\nabla J(\\theta)\\) por diferencias finitas"),
        color: tono(COLORES_SERIE[0]), x, y: yIzq, grosor: 3 },
      { nombre: conConstante
        ? t("t5b.m2.serieDer", "lado derecho de (13.5) × constante")
        : t("t5b.m2.serieDerSin", "lado derecho de (13.5), sin la constante"),
      color: tono(COLORES_SERIE[1]), x, y: yDer, grosor: 2, discontinua: true },
    ];
    pintar(viz3.cuerpo, graficaLineas(series, {
      ancho: 660, alto: 300,
      ejeX: t("t5b.m2.viz3x", "p"),
      ejeY: t("t5b.m2.viz3y", "primera componente del gradiente"),
      lineaCero: true,
      ticksX: [0.1, 0.3, 0.5, 0.7, 0.9].map((v) => ({ valor: v, etiqueta: num(v, 1) })),
      anotaciones: [{
        x: P_ESTRELLA,
        texto: t("t5b.m2.anotCero", "aquí el gradiente es cero: el óptimo del módulo 1"),
      }],
    }));
    conLeyenda(viz3.cuerpo, series);
    fijarPie(viz3.pie, t("t5b.m2.viz3runs", "Cálculo exacto · sin simulación"));
  }

  function dibujarMetricas() {
    const { izquierdo, derecho, constante } = ladosEn(p);
    const factor = conConstante ? constante : 1;
    fijarCifra(cifras.izq, vectorMat(izquierdo, 6));
    /* El lado derecho se enseña SIN la constante —es lo que vale la suma de
       (13.5), y es la aserción C2-4—; quien lleva o no la constante es el
       cociente de abajo, que es lo que el botón cambia. */
    fijarCifra(cifras.der, vectorMat(derecho, 6));
    fijarCifra(cifras.constante, `\\(${numMat(constante, 6)}\\)`);
    const cociente = Math.abs(factor * derecho[0]) > 1e-12
      ? izquierdo[0] / (factor * derecho[0])
      : NaN;
    fijarCifra(cifras.cociente, Number.isFinite(cociente)
      ? `\\(${numMat(cociente, 6)}\\)`
      : "—");
  }

  /** Sincroniza el único panel condicional. Se llama al construir también. */
  function sincronizar() {
    ver(panelSinConstante, !conConstante);
  }

  function dibujar() {
    sincronizar();
    dibujarFormula();
    dibujarTabla();
    dibujarViz3();
    dibujarMetricas();
  }

  repintadores.push(dibujar);
  dibujar();

  crearQuiz($("#m2-quiz"), [
    {
      enunciado: "¿Qué problema resuelve exactamente el teorema del gradiente de la política?",
      opciones: [
        "Que en su lado derecho no aparece el gradiente de la distribución de estados, así que no "
        + "hay que derivar algo que depende de la dinámica del entorno.",
        "Que elimina la distribución de estados de la fórmula, así que el gradiente se puede "
        + "estimar con transiciones tomadas de cualquier manera.",
        "Que sustituye la función de valor de acción por el retorno observado, que sí se puede "
        + "muestrear.",
        "Que garantiza que el ascenso de gradiente converge a la política óptima global, "
        + "independientemente de la parametrización.",
      ],
      correcta: 0,
      explicacion: "El teorema deja \\(\\mu(s)\\) en la fórmula pero <strong>fuera del "
        + "gradiente</strong>: eso es lo que lo hace utilizable, porque la dependencia de la "
        + "política sobre la distribución de estados es cosa del entorno y no la conocemos. "
        + "\\(\\mu\\) no desaparece, y precisamente por eso los estados hay que muestrearlos "
        + "<strong>siguiendo \\(\\pi\\)</strong> — es lo que hace que estos métodos sean dentro de "
        + "política. Sustituir \\(q_\\pi(S_t,A_t)\\) por \\(G_t\\) es el paso siguiente, el que da "
        + "REINFORCE, y viene después. Y no hay ninguna garantía de óptimo global: REINFORCE "
        + "converge a un óptimo <strong>local</strong>.",
    },
    {
      enunciado: "El teorema se escribe con \\(\\propto\\) y no con \\(=\\). ¿Qué falta?",
      opciones: [
        "Una constante que, en el caso episódico, es la longitud media del episodio; en el caso "
        + "continuado vale 1 y la relación es una igualdad.",
        "El factor \\(\\gamma^t\\), que aparece luego en los pseudocódigos y que el enunciado del "
        + "teorema omite.",
        "Una constante desconocida que depende del entorno y que por eso hay que estimar junto con "
        + "el gradiente.",
        "Nada: el \\(\\propto\\) es una convención tipográfica y las dos expresiones son iguales.",
      ],
      correcta: 0,
      explicacion: "El libro dice cuál es la constante y no es un misterio: la longitud media del "
        + "episodio en el caso episódico, y 1 en el continuado. Para el algoritmo da igual, porque "
        + "cualquier constante se absorbe en el paso \\(\\alpha\\), que es arbitrario — pero al "
        + "comprobar el teorema con números hay que ponerla, y aquí has visto el cociente valer "
        + "exactamente 12. El \\(\\gamma^t\\) es otra cosa: aparece porque el texto trabaja con "
        + "\\(\\gamma = 1\\) y los recuadros dan la versión general. Y no hay nada que estimar: la "
        + "constante se conoce.",
    },
    {
      enunciado: "En este pasillo, ¿qué es \\(\\mu(s)\\) y de dónde sale?",
      opciones: [
        "La fracción del tiempo que un episodio pasa en cada celda siguiendo \\(\\pi\\); sale de "
        + "normalizar el número esperado de visitas \\(\\eta(s)\\), y la fija el entorno junto con "
        + "la política.",
        "Una distribución de pesos que elige el diseñador para decidir qué estados le importan más "
        + "al medir el error.",
        "La distribución estacionaria de la cadena de Markov inducida por \\(\\pi\\), que existe "
        + "porque el proceso es ergódico.",
        "La probabilidad de que el episodio empiece en cada estado, que aquí es 1 para la primera "
        + "celda y 0 para las demás.",
      ],
      correcta: 0,
      explicacion: "\\(\\mu(s) = \\eta(s)/\\sum_{s'}\\eta(s')\\) con \\(\\eta(s)\\) el número "
        + "esperado de pasos en \\(s\\) por episodio: es un resultado de la dinámica y la política, "
        + "no una elección. La distribución de pesos elegida por el diseñador es la del error "
        + "cuadrático ponderado del tema anterior — mismo símbolo, otro concepto, y la confusión es "
        + "fácil porque el material usa \\(\\mu\\) para las dos cosas. La distribución "
        + "<strong>estacionaria</strong> es la del caso continuado, no la del episódico. Y la "
        + "distribución inicial es \\(h(s)\\), que aparece dentro del cálculo de \\(\\eta\\) pero no "
        + "es \\(\\mu\\): aquí \\(\\mu\\) no es \\((1,0,0)\\) sino \\((1/2,1/3,1/6)\\).",
    },
  ], { claves: "t5b.m2.quiz" });
}

/* ======================================================================= *
 * El Worker de los módulos 3, 4, 5 y 6
 *
 * Patrón de `politica-worker.js`: { tarea, id, config } de entrada y
 * { tipo, id, … } de salida, con una sola tarea, "tanda". Si el navegador no
 * admite Workers el cálculo se hace en el hilo principal —la página se congela
 * unos segundos, pero no se queda sin dato— importando el mismo módulo, que
 * exporta `calcularTanda`.
 *
 * ⚠ AQUÍ NO HAY NINGÚN INTERRUPTOR DE DEPURACIÓN. En el Tema 5 (1.ª parte) se
 * quedó publicado un `worker = null` puesto a mano para poder capturar en
 * headless: la página funcionaba, congelándose, y la revisión visual no lo
 * detectó. Si hace falta desactivarlo para probar, se restaura antes de
 * entregar.
 * ======================================================================= */

let worker = null;
try {
  worker = new Worker(new URL("./politica-worker.js", import.meta.url), { type: "module" });
} catch {
  worker = null;
}

let siguienteId = 1;
const enCurso = new Map();

if (worker) {
  worker.onmessage = (evento) => {
    const { tipo, id, fraccion, resultado, mensaje } = evento.data;
    const tarea = enCurso.get(id);
    if (!tarea) return;
    if (tipo === "progreso") tarea.alProgresar?.(fraccion);
    else if (tipo === "listo") { enCurso.delete(id); tarea.resolver(resultado); }
    else if (tipo === "error") { enCurso.delete(id); tarea.rechazar(new Error(mensaje)); }
  };
  worker.onerror = () => { worker = null; };
}

/** Lanza una tanda en el Worker; si no hay Worker, en el hilo principal. */
function calcularTanda(config, alProgresar) {
  if (!worker) {
    return import("./politica-worker.js").then((mod) => {
      const resultado = mod.calcularTanda(config, alProgresar);
      alProgresar(1);
      return resultado;
    });
  }
  const id = siguienteId++;
  return new Promise((resolver, rechazar) => {
    enCurso.set(id, { resolver, rechazar, alProgresar });
    worker.postMessage({ tarea: "tanda", id, config });
  });
}

/* --- ayudas de estadística sobre las curvas devueltas ------------------- */

const media = (a) => (a.length ? Array.from(a).reduce((x, y) => x + y, 0) / a.length : 0);
const desviacion = (a) => {
  const m = media(a);
  return Math.sqrt(Array.from(a).reduce((x, y) => x + (y - m) * (y - m), 0) / (a.length || 1));
};
/** Media de los últimos `k` elementos de una curva. */
const mediaFinal = (curva, k) => media(Array.from(curva).slice(Math.max(0, curva.length - k)));
/** Primer episodio (base 1) en que la curva pasa por encima del umbral. */
function primerEpisodioPorEncima(curva, umbral) {
  for (let i = 0; i < curva.length; i++) if (curva[i] > umbral) return i + 1;
  return null;
}
/** Los valores de una ventana de episodios [desde, hasta) de todas las ejecuciones. */
function ventana(curvas, desde, hasta) {
  const salida = [];
  for (const c of curvas) {
    for (let i = desde; i < Math.min(hasta, c.length); i++) salida.push(c[i]);
  }
  return salida;
}

/**
 * Serie de polígono de frecuencias a partir de un histograma del motor.
 *
 * Las colas se suman al intervalo del extremo correspondiente —y el eje lo
 * rotula, «≤ −200»— para que la serie represente TODAS las muestras: es lo que
 * pide el módulo 3, y `histograma()` las devuelve aparte justamente para que
 * la interfaz decida.
 */
function poligonoFrecuencias(h) {
  const y = Array.from(h.relativas);
  if (h.n > 0) {
    y[0] += h.colaIzq / h.n;
    y[y.length - 1] += h.colaDch / h.n;
  }
  return { x: Array.from(h.centros), y };
}

/* ======================================================================= *
 * MÓDULO 3 — REINFORCE: el estimador correcto y lento
 *
 * Parámetro → curva, con una segunda vista de distribución. Reproduce la
 * Figura 13.1 con el mando puesto: el paso, la inicialización, el número de
 * ejecuciones promediadas y —el cuarto control, excepción declarada— el tope
 * de pasos por episodio, que NO es un detalle de implementación.
 * ======================================================================= */

const ALFAS_M3 = [12, 13, 14];          // exponentes: α = 2^−k
const EPISODIOS_M3 = 1000;

/**
 * Rótulos de las tres series y de las tres ventanas, con clave LITERAL.
 *
 * No se construyen con plantilla —`t(\`t5b.m3.serieA${k}\`)`— a propósito: el
 * test de idioma busca las claves con una expresión regular sobre el código y
 * una clave dinámica se le escapa, así que su traducción quedaría huérfana.
 */
const NOMBRE_ALFA_M3 = {
  12: () => t("t5b.m3.serieA12", "\\(\\alpha = 2^{-12}\\)"),
  13: () => t("t5b.m3.serieA13", "\\(\\alpha = 2^{-13}\\)"),
  14: () => t("t5b.m3.serieA14", "\\(\\alpha = 2^{-14}\\)"),
};
const NOMBRE_VENTANA_M3 = [
  () => t("t5b.m3.serieVentana1", "episodios 1-100"),
  () => t("t5b.m3.serieVentana2", "episodios 451-550"),
  () => t("t5b.m3.serieVentana3", "episodios 901-1000"),
];

function modulo3() {
  const zonaControles = $("#m3-controles");
  const zonaViz1 = $("#m3-viz1");
  const zonaViz2 = $("#m3-viz2");
  const zonaMetricas = $("#m3-metricas");
  const zonaPaneles = $("#m3-paneles");
  const zonaLectura = $("#m3-lectura");

  /* --- estado del módulo --- */
  let alfa = "todas";                   // "todas" | 12 | 13 | 14
  let ejecuciones = 100;
  let inicio = "libro";                 // "libro" (p₀ = 0,05) | "cero" (θ = 0)
  let tope = 500;

  const p0De = () => (inicio === "libro" ? P0 : 0.5);
  const seleccionados = () => (alfa === "todas" ? ALFAS_M3 : [alfa]);

  const cache = new Map();
  const enMarcha = new Set();
  let error = null;
  let arrancado = false;
  const clave = (k) => `${semillaActual()}|${k}|${ejecuciones}|${inicio}|${tope}`;

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  const mandoAlfa = grupoRadio(panel, t("t5b.m3.alphaLabel", "Paso \\(\\alpha\\)"), [
    { valor: 14, texto: "\\(2^{-14}\\)" },
    { valor: 13, texto: "\\(2^{-13}\\)" },
    { valor: 12, texto: "\\(2^{-12}\\)" },
    { valor: "todas", texto: t("t5b.m3.alphaTres", "las tres") },
  ], alfa, (v) => { alfa = v; pedir(); });
  const mandoEjecuciones = grupoRadio(panel,
    t("t5b.m3.ejecucionesLabel", "Ejecuciones promediadas"), [
      { valor: 1, texto: "1" },
      { valor: 10, texto: "10" },
      { valor: 100, texto: "100" },
    ], ejecuciones, (v) => { ejecuciones = v; pedir(); });
  const mandoInicio = grupoRadio(panel,
    t("t5b.m3.thetaLabel", "Inicialización de \\(\\theta\\)"), [
      { valor: "libro", texto: t("t5b.m3.thetaLibro", "\\(p_0 = 0{,}05\\) (como la figura)") },
      { valor: "cero", texto: t("t5b.m3.thetaCero", "\\(\\theta = 0\\) (como el pseudocódigo)") },
    ], inicio, (v) => { inicio = v; pedir(); });
  botonControl(panel, t("t5b.m3.calcular", "Calcular"), () => pedir());
  botonControl(panel, t("t5b.m3.reiniciar", "Valores por omisión"), () => {
    alfa = "todas"; ejecuciones = 100; inicio = "libro"; tope = 500;
    mandoAlfa.marcar(alfa); mandoEjecuciones.marcar(ejecuciones);
    mandoInicio.marcar(inicio); mandoTope.marcar(tope);
    pedir();
  });

  /* --- visualizaciones y métricas --- */

  const viz1 = caja(zonaViz1, t("t5b.m3.viz1", "Retorno por episodio"), { conPie: true });
  vacia(viz1.cuerpo, t("t5b.m3.viz1vacio", "Pulsa <strong>Calcular</strong> para lanzar la tanda."));
  const progreso = barraProgreso(viz1.caja);
  const viz2 = caja(zonaViz2, t("t5b.m3.viz2", "La dispersión que la media esconde"),
    { conPie: true });
  vacia(viz2.cuerpo, t("t5b.m3.viz2vacio",
    "Lanza la tanda para ver la distribución de \\(G_0\\)."));

  const cifras = metricas(zonaMetricas, [
    { id: "final", etiqueta: t("t5b.m3.mFinal",
      "\\(G_0\\) medio en los últimos 100 episodios") },
    { id: "desv", etiqueta: t("t5b.m3.mDesv",
      "Desviación típica de \\(G_0\\) en los últimos 100 episodios") },
    { id: "cruce", etiqueta: t("t5b.m3.mCruce",
      "Primer episodio con media por encima de \\(-15\\)") },
    { id: "pfinal", etiqueta: t("t5b.m3.mPfinal", "\\(p\\) media al final"),
      glosa: t("t5b.m3.mPfinalGlosa", "el óptimo es \\(2-\\sqrt2 = 0{,}5858\\)") },
    { id: "truncados", etiqueta: t("t5b.m3.mTruncados",
      "Episodios truncados por el tope de pasos") },
  ]);
  const notaMetricas = parrafo(zonaMetricas, "suave", "");

  /* --- paneles --- */

  aviso(zonaPaneles, t("t5b.m3.panelTheta",
    "⚠ <strong>El libro no dice con qué \\(\\theta\\) empieza esta figura, y las dos opciones no "
    + "son compatibles.</strong> Su pseudocódigo dice «inicializa \\(\\theta\\), <em>p. ej.</em>, a "
    + "0», y con \\(\\theta = 0\\) se tiene \\(p = 0{,}5\\) y un retorno esperado de "
    + "<strong>\\(-12\\)</strong>: la curva arrancaría casi pegada a la línea de \\(v_*(s_0)\\) y no "
    + "habría nada que aprender. Pero <strong>la figura del libro arranca alrededor de "
    + "\\(-90\\)</strong>, y para eso hace falta empezar con \\(p_0\\) cerca de \\(0{,}045\\). Esta "
    + "página <strong>elige</strong> \\(p_0 = 0{,}05\\) —que es exactamente la política "
    + "\\(\\varepsilon\\)-<em>greedy</em> hacia la izquierda del Ejemplo 13.1, con "
    + "\\(J = -82{,}11\\)— y te deja el otro botón para que veas la diferencia. <strong>Con "
    + "\\(\\theta = 0\\) las curvas no se parecen a las del libro, y no es un fallo: es que el libro "
    + "no declara su inicialización.</strong>"));

  /* El tope es un CONTROL: el texto lleva el valor vivo, como el pie de la
     gráfica y la glosa de la métrica. En indicativo fijo se contradecía con el
     conmutador que está tres líneas más abajo. */
  const panelTope = aviso(zonaPaneles, "");

  aviso(zonaPaneles, t("t5b.m3.panelTopeHallazgo",
    "⚠ <strong>Y aquí el tope no es un detalle de implementación: es la ordenada de la curva que se "
    + "estanca.</strong> El experimento del libro tiene que cortar los episodios en algún sitio, y "
    + "<strong>su pie no lo declara</strong>. Con un tope de 500 pasos las tres curvas salen como en "
    + "la Figura 13.1 —\\(2^{-12}\\) estancada en <strong>−40,1</strong>, \\(2^{-13}\\) la mejor en "
    + "<strong>−12,3</strong>, \\(2^{-14}\\) en <strong>−15,0</strong>—; con un tope de 10.000 la "
    + "figura <strong>no se reproduce en absoluto</strong> —<strong>−611</strong>, "
    + "<strong>−112</strong> y −15,0— y hasta se invierte el orden de los tres pasos, que es lo "
    + "único que el libro afirma explícitamente en el pie de la Figura 13.2. Pulsa el botón y "
    + "compruébalo: <strong>el tope es un hiperparámetro del experimento del libro, y es uno de los "
    + "que no publica</strong>."));

  /* El cuarto control va AQUÍ, debajo de su panel y fuera de la fila de
     controles: es una excepción declarada al presupuesto de tres, y sin él la
     página afirmaría el hallazgo de arriba sin dejar comprobarlo. */
  const panelTopeControl = panelControles(zonaPaneles);
  const mandoTope = grupoRadio(panelTopeControl,
    t("t5b.m3.topeLabel", "Tope de pasos por episodio"), [
      { valor: 500, texto: t("t5b.m3.tope500", "500 (reproduce la figura)") },
      { valor: 10000, texto: t("t5b.m3.tope10000", "10.000") },
    ], tope, (v) => { tope = v; pedir(); });

  parrafo(zonaPaneles, "explicacion", t("t5b.m3.panelOnPolicy",
    "<code>5_Tema_5_2#slide-10</code> pregunta al aula: <strong>«¿on-policy u off-policy? ¿online u "
    + "offline?»</strong>. <strong>Es dentro de política y fuera de línea.</strong> Dentro de "
    + "política porque el episodio se genera siguiendo la misma \\(\\pi\\) que se está actualizando: "
    + "es lo que exige el paso del teorema a la muestra, «si se sigue \\(\\pi\\), los estados "
    + "aparecen en esas proporciones». Fuera de línea porque \\(G_t\\) es el retorno "
    + "<strong>completo</strong> desde \\(t\\), así que no se puede actualizar nada hasta que el "
    + "episodio termina."));

  const panelAlpha = parrafo(zonaPaneles, "explicacion", t("t5b.m3.panelAlpha",
    "Las tres curvas son las de la figura del libro. La de paso mayor, \\(2^{-12}\\), se mueve más "
    + "rápido al principio <strong>y luego se queda</strong> en torno a \\(-40\\); la de paso menor, "
    + "\\(2^{-14}\\), avanza despacio pero avanza. Baja las ejecuciones promediadas a 10 y a 1 y "
    + "verás por qué el libro necesita 100: con una sola ejecución no se puede decidir cuál de las "
    + "tres es mejor."));

  /* Este panel se muestra con CUALQUIER α elegido, así que sus cifras son las
     de la tanda que hay delante, no las de 2⁻¹³. */
  const panelVarianza = parrafo(zonaPaneles, "explicacion", "");

  const panelEstancamiento = aviso(zonaPaneles, t("t5b.m3.panelEstancamiento",
    "⚠ Ese estancamiento en \\(-40\\) que dibuja el libro <strong>no es lo que parece</strong>, y "
    + "merece la pena mirarlo de cerca porque es un hallazgo de esta página. No es que las cien "
    + "ejecuciones se queden a medio camino: la <strong>mediana</strong> acaba en \\(p = 0{,}578\\), "
    + "es decir, casi en el óptimo \\(2-\\sqrt2 = 0{,}586\\), y la media de <strong>94</strong> de "
    + "las 100 ejecuciones es \\(-11{,}81\\), <strong>prácticamente</strong> \\(v_*(s_0) = "
    + "-11{,}66\\). Lo que hay son <strong>seis "
    + "ejecuciones colapsadas de cien, y las seis hacia \\(p\\to1\\)</strong> —cuatro de ellas en "
    + "\\(p = 1\\) exacto—. Esas seis, y solo esas, arrastran la media a \\(-40{,}09\\). Es decir: "
    + "<strong>el paso \\(2^{-12}\\) no aprende peor; aprende igual y de vez en cuando se "
    + "despeña</strong>, que es exactamente el fenómeno del módulo 6 — y está dentro de la figura "
    + "que se proyecta en clase, sin que nadie lo diga. <em>(Medido con los valores por omisión: "
    + "1000 episodios, 100 ejecuciones, tope de 500 pasos, semilla 2026.)</em>"));

  const panelEstancamiento2 = parrafo(zonaPaneles, "suave", t("t5b.m3.panelEstancamiento2",
    "Y hay una segunda mitad. Si en vez de aplicar las \\(T\\) actualizaciones de un episodio una a "
    + "una —el orden del recuadro del libro— se <strong>acumula el incremento y se aplica una sola "
    + "vez</strong> por episodio, con \\(2^{-12}\\) <strong>no colapsa ninguna ejecución</strong>: "
    + "veinte de veinte llegan, con una media de \\(-11{,}98\\). O sea que el estancamiento de la "
    + "Figura 13.1 <strong>lo produce el orden de actualización del propio recuadro</strong>, no el "
    + "tamaño del paso. ⚠ <strong>Esto no se puede comprobar desde aquí</strong>: este módulo "
    + "actualiza siempre paso a paso, como el libro, y el orden acumulado —con su control— está en "
    + "el <a href=\"#m6\">módulo 6</a>, donde se explica por qué."));

  parrafo(zonaPaneles, "suave", t("t5b.m3.notaOrden",
    "Las actualizaciones de un episodio se aplican una a una, en el orden en que las escribe el "
    + "libro; el retorno \\(G_t\\), en cambio, se calcula con las recompensas <strong>ya "
    + "observadas</strong>."));
  parrafo(zonaPaneles, "suave", t("t5b.m3.notaSoloPasillo",
    "Este módulo reproduce una figura concreta del libro y trabaja solo sobre el <strong>pasillo "
    + "corto</strong>: hacerlo en dos entornos duplicaría el coste sin responder nada nuevo."));
  const notaCortada = aviso(zonaPaneles, "");

  /* --- lectura --- */

  /* La lectura 1 lleva CIFRAS VIVAS: cinco controles y la semilla las cambian,
     y las métricas de al lado enseñan el valor real. En indicativo fijo se
     contradecían al primer clic. */
  zonaLectura.classList.add("siempre");
  const lectura2 = document.createElement("p");
  lectura2.className = "explicacion siempre";
  lectura2.innerHTML = t("t5b.m3.lectura2",
    "Y la media de cien esconde algo más que ruido. Con \\(\\alpha = 2^{-12}\\), la curva se estanca "
    + "en \\(-40\\) <strong>no porque las cien aprendan a medias, sino porque seis de ellas colapsan "
    + "hacia \\(p\\to1\\)</strong>: las otras 94 acaban en \\(-11{,}81\\), <strong>prácticamente</strong> "
    + "el óptimo \\(-11{,}66\\). <strong>El estancamiento que el libro dibuja es un colapso de "
    + "política, y desaparece si el incremento del episodio se aplica de una vez en lugar de paso a "
    + "paso.</strong> Es el módulo 6, dentro de la figura del módulo 3.");
  zonaLectura.after(lectura2);
  renderizarMatematicas(lectura2);

  /* --- cálculo --- */

  function pedir() {
    arrancado = true;
    sincronizar();
    dibujar();
    for (const k of seleccionados()) {
      const c = clave(k);
      if (cache.has(c) || enMarcha.has(c)) continue;
      enMarcha.add(c);
      error = null;
      progreso.fijar(0);
      calcularTanda({
        entorno: "pasilloCorto", algoritmo: "reinforce",
        episodios: EPISODIOS_M3, ejecuciones, semilla: semillaActual(),
        p0: p0De(), alphaTheta: 2 ** -k, maxPasos: tope,
      }, (fraccion) => progreso.fijar(fraccion))
        .then((resultado) => {
          cache.set(c, resultado);
          enMarcha.delete(c);
          dibujar();
        })
        .catch((e) => {
          error = e.message;
          enMarcha.delete(c);
          dibujar();
        });
    }
  }

  const datosDe = (k) => cache.get(clave(k)) || null;

  /* --- dibujo --- */

  function dibujarViz1() {
    const series = [];
    for (const k of ALFAS_M3) {
      if (!seleccionados().includes(k)) continue;
      const d = datosDe(k);
      const color = tono(COLORES_SERIE[ALFAS_M3.indexOf(k)]);
      series.push({
        nombre: NOMBRE_ALFA_M3[k](),
        color, y: d ? d.curvas["reinforce.G0"] : [],
      });
    }
    const hayDatos = series.some((s) => s.y.length);
    if (!hayDatos) {
      vacia(viz1.cuerpo, error
        ? t("t5b.m3.error", "El cálculo ha fallado: {m}", { m: error })
        : t("t5b.m3.viz1vacio", "Pulsa <strong>Calcular</strong> para lanzar la tanda."));
    } else {
      pintar(viz1.cuerpo, graficaLineas(series, {
        ancho: 660, alto: 320,
        ejeX: t("t5b.m3.viz1x", "Episodio"),
        ejeY: t("t5b.m3.viz1y", "G₀: retorno total del episodio"),
        yMin: -95, yMax: -5,
        ticksX: [1, 200, 400, 600, 800, 1000].map((v) => ({ valor: v, etiqueta: String(v) })),
        formatoY: (v) => num(v, 0),
        anotacionesY: [{ y: V_ESTRELLA, texto: t("t5b.m3.anotVestrella", "v*(s₀)") }],
      }));
      conLeyenda(viz1.cuerpo, series);
    }
    const enCola = seleccionados().some((k) => enMarcha.has(clave(k)));
    fijarPie(viz1.pie, enCola
      ? t("t5b.m3.progreso", "Simulando… {n} ejecuciones por cada paso", { n: ejecuciones })
      : t("t5b.m3.viz1runs", "Media de {n} ejecuciones · semilla {s} · tope de {tope} pasos",
        { n: ejecuciones, s: semillaActual(), tope: num(tope, 0) }));
    ver(progreso.caja, enCola);
  }

  const VENTANAS = [[0, 100], [450, 550], [900, 1000]];

  function dibujarViz2() {
    if (alfa === "todas") {
      vacia(viz2.cuerpo, t("t5b.m3.viz2unaSola",
        "Elige un solo \\(\\alpha\\) para ver su distribución."));
      fijarPie(viz2.pie, "");
      return;
    }
    const d = datosDe(alfa);
    if (!d) {
      vacia(viz2.cuerpo, t("t5b.m3.viz2vacio",
        "Lanza la tanda para ver la distribución de \\(G_0\\)."));
      fijarPie(viz2.pie, "");
      return;
    }
    const curvas = d.porEjecucion.reinforce.curvaG0;
    const series = [];
    const anotaciones = [];
    VENTANAS.forEach(([desde, hasta], i) => {
      const muestras = ventana(curvas, desde, hasta);
      const h = histograma(muestras, { min: -200, max: -5, nIntervalos: 40 });
      const { x, y } = poligonoFrecuencias(h);
      series.push({
        nombre: NOMBRE_VENTANA_M3[i](),
        color: tono(COLORES_SERIE[i]), x, y, grosor: 2,
      });
      if (h.media >= -200 && h.media <= -5) {
        anotaciones.push({ x: h.media, texto: num(h.media, 1) });
      }
    });
    pintar(viz2.cuerpo, graficaLineas(series, {
      ancho: 660, alto: 300,
      ejeX: t("t5b.m3.viz2x", "G₀"),
      ejeY: t("t5b.m3.viz2y", "frecuencia relativa"),
      yMin: 0,
      ticksX: [
        { valor: -200, etiqueta: t("t5b.m3.colaIzq", "≤ −200") },
        { valor: -150, etiqueta: "−150" }, { valor: -100, etiqueta: "−100" },
        { valor: -50, etiqueta: "−50" }, { valor: -5, etiqueta: "−5" },
      ],
      formatoY: (v) => num(v, 2),
      anotaciones,
    }));
    conLeyenda(viz2.cuerpo, series);
    fijarPie(viz2.pie, t("t5b.m3.viz2runs",
      "{n} ejecuciones × 100 episodios por ventana · las anotaciones marcan la media",
      { n: d.ejecuciones }));
  }

  function dibujarMetricas() {
    /* Con «las tres» las cifras son las de 2⁻¹³, que es el paso que el pie de
       la Figura 13.2 declara mejor de los tres. Se dice, para que nadie las
       atribuya a la curva equivocada. */
    const k = alfa === "todas" ? 13 : alfa;
    const d = datosDe(k);
    notaMetricas.innerHTML = t("t5b.m3.notaMetricas",
      "Las cifras son las de \\(\\alpha = 2^{-{k}}\\).", { k });
    renderizarMatematicas(notaMetricas);
    if (!d) {
      for (const id of ["final", "desv", "cruce", "pfinal", "truncados"]) {
        fijarCifra(cifras[id], "—");
      }
      return;
    }
    const curva = d.curvas["reinforce.G0"];
    const ultimos = ventana(d.porEjecucion.reinforce.curvaG0, 900, 1000);
    fijarCifra(cifras.final, `\\(${numMat(mediaFinal(curva, 100), 2)}\\)`);
    fijarCifra(cifras.desv, `\\(${numMat(desviacion(ultimos), 2)}\\)`);
    const cruce = primerEpisodioPorEncima(curva, -15);
    fijarCifra(cifras.cruce, cruce === null
      ? t("t5b.m3.noCruza", "no llega en 1000 episodios")
      : String(cruce));
    fijarCifra(cifras.pfinal, `\\(${numMat(media(d.porEjecucion.reinforce.pFinal), 4)}\\)`);
    fijarCifra(cifras.truncados, num(d.truncados.reinforce, 0));
    fijarCifra(cifras["truncados$glosa"], t("t5b.m3.truncGlosa",
      "de {total} · tope de {tope} pasos",
      { total: num(d.ejecuciones * EPISODIOS_M3, 0), tope: num(tope, 0) }));
  }

  /**
   * Los textos que dependen de un control o de la tanda que hay delante.
   *
   * Son tres —el panel del tope, el de la varianza y la primera lectura— y los
   * tres decían un número fijo que cinco controles y la semilla cambian. Aquí
   * se escriben con el valor vivo, y cuando todavía no hay tanda declaran con
   * qué configuración valen las cifras que enseñan.
   */
  function textosVivos() {
    panelTope.innerHTML = t("t5b.m3.panelTope",
      "Los episodios se cortan a <strong>{tope} pasos</strong> —el conmutador está justo debajo—. "
      + "Hace falta, porque con \\(p\\) muy cerca de 0 o de 1 el episodio puede no terminar nunca. "
      + "Cuando uno se corta, el retorno se calcula sobre los pasos dados —así que <strong>queda "
      + "sobreestimado</strong>, menos negativo de lo que le correspondería— y el contador de arriba "
      + "dice cuántas veces ha pasado.", { tope: num(tope, 0) });
    renderizarMatematicas(panelTope);

    const k = alfa === "todas" ? 13 : alfa;
    const d = datosDe(k);
    const curvas = d ? d.porEjecucion.reinforce.curvaG0 : null;
    const sigmaIni = curvas ? desviacion(ventana(curvas, 0, 100)) : null;
    const sigmaFin = curvas ? desviacion(ventana(curvas, 900, 1000)) : null;
    const g0 = d ? mediaFinal(d.curvas["reinforce.G0"], 100) : null;

    panelVarianza.innerHTML = d
      ? t("t5b.m3.panelVarianza",
        "Aquí está lo que la figura del libro no puede enseñar. La curva de arriba es una media; la "
        + "distribución de abajo es lo que hay <strong>detrás</strong> de cada punto de esa media. "
        + "Mira las tres ventanas. La anchura <strong>sí</strong> se reduce al aprender —con el "
        + "\\(\\alpha = 2^{-{k}}\\) que tienes puesto, la desviación típica de \\(G_0\\) pasa de "
        + "<strong>{s1}</strong> en los cien primeros episodios a <strong>{s3}</strong> en los cien "
        + "últimos—, pero fíjate en la comparación que importa: al final esa desviación sigue siendo "
        + "<strong>del orden del propio retorno medio, {g0}</strong>. El estimador de REINFORCE no "
        + "es incorrecto —su esperanza es la dirección del gradiente, y eso lo comprobaste en el "
        + "módulo 2—, es <strong>ruidoso incluso cuando ya ha aprendido</strong>: cada episodio da "
        + "un retorno muy distinto y el parámetro se mueve a tirones. Por eso hace falta un paso "
        + "pequeño, y por eso se necesitan cientos de episodios para algo que en el módulo 1 se "
        + "resolvía moviendo un deslizador.",
        { k, s1: num(sigmaIni, 2), s3: num(sigmaFin, 2), g0: num(g0, 2) })
      : t("t5b.m3.panelVarianzaVacio",
        "Aquí está lo que la figura del libro no puede enseñar. La curva de arriba es una media; la "
        + "distribución de abajo es lo que hay <strong>detrás</strong> de cada punto de esa media. "
        + "Lanza la tanda y compara la anchura de las tres ventanas.");
    renderizarMatematicas(panelVarianza);

    const cv = d && g0 ? Math.abs(sigmaFin / g0) : null;
    zonaLectura.innerHTML = d
      ? t("t5b.m3.lectura1",
        "El estimador de REINFORCE apunta, en media, en la dirección correcta —eso lo comprobaste en "
        + "el módulo 2— y aun así el algoritmo tarda cientos de episodios en un problema de tres "
        + "estados. <strong>Lo que lo hace lento no es un sesgo, es la varianza</strong>: con la "
        + "configuración que tienes ahora, al final del entrenamiento la desviación típica de "
        + "\\(G_0\\) es <strong>{s}</strong> frente a un retorno medio de <strong>{g0}</strong>, un "
        + "coeficiente de variación de <strong>{cv}</strong>. Con una señal así de ruidosa hay que "
        + "dar pasos pequeños, y por eso la curva de una sola ejecución no se parece a la media de "
        + "cien.",
        { s: num(sigmaFin, 2), g0: num(g0, 2), cv: num(cv, 2) })
      : t("t5b.m3.lectura1Vacio",
        "El estimador de REINFORCE apunta, en media, en la dirección correcta —eso lo comprobaste en "
        + "el módulo 2— y aun así el algoritmo tarda cientos de episodios en un problema de tres "
        + "estados. <strong>Lo que lo hace lento no es un sesgo, es la varianza</strong>: lanza la "
        + "tanda y compara aquí la desviación típica final de \\(G_0\\) con el propio retorno medio. "
        + "Con una señal así de ruidosa hay que dar pasos pequeños, y por eso la curva de una sola "
        + "ejecución no se parece a la media de cien.");
    renderizarMatematicas(zonaLectura);
  }

  function sincronizar() {
    textosVivos();
    ver(panelAlpha, alfa === "todas");
    ver(panelVarianza, alfa !== "todas");
    const conDoceava = alfa === "todas" || alfa === 12;
    ver(panelEstancamiento, conDoceava);
    ver(panelEstancamiento2, conDoceava);
    let cortadas = 0;
    for (const k of seleccionados()) cortadas += datosDe(k)?.cortadas?.reinforce || 0;
    if (cortadas > 0) {
      notaCortada.innerHTML = t("t5b.m3.cortada",
        "{n} ejecuciones cortadas por desbordamiento de \\(\\theta\\).", { n: cortadas });
      renderizarMatematicas(notaCortada);
    }
    ver(notaCortada, cortadas > 0);
  }

  function dibujar() {
    sincronizar();
    dibujarViz1();
    dibujarViz2();
    dibujarMetricas();
  }

  /* Cambiar la semilla vacía la caché, pero NO relanza un módulo que nadie ha
     mirado todavía: si no, tocar la semilla en la portada dispararía las cuatro
     tandas de la página de golpe. */
  oyentesSemilla.push(() => { cache.clear(); if (arrancado) pedir(); });
  repintadores.push(dibujar);
  dibujar();
  /* Nada de Worker al cargar la página: arranca al entrar en el viewport. */
  alEntrarEnPantalla($("#m3"), pedir);

  crearQuiz($("#m3-quiz"), [
    {
      enunciado: "REINFORCE estima el gradiente por Monte Carlo. ¿Qué se sigue de eso?",
      opciones: [
        "Que el estimador es insesgado pero de varianza alta, y por eso el aprendizaje es lento y "
        + "necesita mucha experiencia.",
        "Que el estimador es muy eficiente y necesita poca experiencia, porque cada episodio aporta "
        + "el retorno completo.",
        "Que el estimador está sesgado por usar una muestra del retorno en lugar de \\(q_\\pi\\), y "
        + "converge a un punto distinto del óptimo.",
        "Que el estimador solo es válido si el episodio tiene longitud fija, porque si no los "
        + "retornos no son comparables.",
      ],
      correcta: 0,
      explicacion: "\\(\\mathbb E_\\pi[G_t\\mid S_t,A_t] = q_\\pi(S_t,A_t)\\): sustituir "
        + "\\(q_\\pi\\) por \\(G_t\\) <strong>no introduce sesgo</strong>, y el libro dice que la "
        + "actualización esperada por episodio va en la misma dirección que el gradiente del "
        + "rendimiento. Lo que introduce es <strong>varianza</strong>, y por eso el propio libro "
        + "remata que «como método Monte Carlo, REINFORCE puede tener varianza alta y por tanto "
        + "aprender despacio». Que el retorno completo llegue de golpe no lo hace eficiente: lo hace "
        + "ruidoso, como se ve en la distribución de \\(G_0\\). Y la longitud del episodio no tiene "
        + "por qué ser fija; aquí varía mucho, y precisamente eso es parte del ruido.",
    },
    {
      enunciado: "¿Por qué la figura del libro promedia sobre 100 ejecuciones?",
      opciones: [
        "Porque una sola ejecución es tan ruidosa que no permite comparar entre sí los tres pasos.",
        "Porque el algoritmo es determinista y las 100 ejecuciones sirven para comprobar que no hay "
        + "errores de implementación.",
        "Porque cada ejecución usa un entorno distinto, y hay que promediar sobre entornos para que "
        + "el resultado sea general.",
        "Porque con menos ejecuciones el estimador del gradiente estaría sesgado.",
      ],
      correcta: 0,
      explicacion: "Baja el control de ejecuciones a 1 y compara: la traza de una sola ejecución "
        + "sube y baja tanto que la comparación entre pasos deja de tener sentido. El algoritmo "
        + "<strong>no</strong> es determinista: la política es estocástica y el retorno depende del "
        + "episodio que salga. El entorno es siempre el mismo pasillo. Y promediar ejecuciones no "
        + "cambia el sesgo del estimador del gradiente —que es cero—; cambia la <strong>varianza de "
        + "la curva que se dibuja</strong>.",
    },
    {
      enunciado: "El pseudocódigo del libro dice «inicializa \\(\\theta\\), <em>p. ej.</em>, a 0», "
        + "y esta página empieza con \\(p_0 = 0{,}05\\). ¿Por qué?",
      opciones: [
        "Porque con \\(\\theta = 0\\) el retorno esperado ya es \\(-12\\), casi el óptimo, y la "
        + "figura del libro arranca alrededor de \\(-90\\): la inicialización del recuadro y la de "
        + "la figura no son compatibles, y el libro no declara cuál usó.",
        "Porque con \\(\\theta = 0\\) la softmax no está definida y hay que empezar fuera del "
        + "origen.",
        "Porque \\(p_0 = 0{,}05\\) es la única inicialización con la que REINFORCE converge; con "
        + "\\(\\theta = 0\\) el algoritmo diverge.",
        "Porque el libro usa \\(p_0 = 0{,}05\\) y lo dice en el pie de la Figura 13.1.",
      ],
      correcta: 0,
      explicacion: "Con \\(\\theta = 0\\) las dos preferencias son iguales, \\(p = 0{,}5\\) y el "
        + "retorno esperado es \\(-12\\), a menos de medio paso del óptimo \\(-11{,}66\\): no habría "
        + "nada que aprender, y la figura del libro empieza noventa unidades más abajo. La softmax "
        + "con \\(\\theta = 0\\) está perfectamente definida y da la distribución uniforme. Con "
        + "\\(\\theta = 0\\) el algoritmo converge igual, solo que parte de un sitio donde ya casi "
        + "ha llegado — puedes comprobarlo con el botón. Y el pie de la Figura 13.1 <strong>no "
        + "dice</strong> con qué \\(\\theta\\) empieza: esa es exactamente la ambigüedad.",
    },
  ], { claves: "t5b.m3.quiz" });
}

/* ======================================================================= *
 * MÓDULO 4 — La línea base: qué toca y qué no toca
 *
 * A/B con la misma semilla —NO con los mismos episodios: en REINFORCE los
 * genera la política que se actualiza— más un documento reactivo con la media
 * y la varianza exactas del estimador, sin simular.
 *
 * La Viz 2 sí comparte episodios literalmente, y por eso va en el hilo
 * principal: 10 000 episodios con θ congelado, los mismos para las tres
 * líneas base. Ahí se mide EL ESTIMADOR, no el algoritmo.
 * ======================================================================= */

const EPISODIOS_M4 = 1000;
const EJECUCIONES_M4 = 100;
const TOPE_M4 = 500;
const EPISODIOS_ESTIMADOR = 10000;

function modulo4() {
  const zonaControles = $("#m4-controles");
  const zonaViz1 = $("#m4-viz1");
  const zonaViz2 = $("#m4-viz2");
  const zonaTabla = $("#m4-tabla");
  const zonaMetricas = $("#m4-metricas");
  const zonaPaneles = $("#m4-paneles");
  const zonaLectura = $("#m4-lectura");

  const entorno = pasilloCorto({});
  const theta0 = thetaDeP(entorno, P0);

  /* --- estado del módulo --- */
  let base = "estado";                 // "cero" | "estado" | "accion"
  let expTheta = 9;                    // α^θ = 2^−9, el de la Figura 13.2
  let expW = 6;                        // α^w = 2^−6, el de la Figura 13.2

  const cache = new Map();
  const enMarcha = new Set();
  let error = null;
  let arrancado = false;

  /** Configuración de la variante elegida y de la referencia sin línea base. */
  function configuracion(cual) {
    const comun = {
      entorno: "pasilloCorto", episodios: EPISODIOS_M4, ejecuciones: EJECUCIONES_M4,
      semilla: semillaActual(), p0: P0, maxPasos: TOPE_M4, w0: 0,
    };
    if (cual === "referencia") {
      return { ...comun, algoritmo: "reinforce", alphaTheta: 2 ** -13 };
    }
    if (base === "cero") {
      return { ...comun, algoritmo: "reinforce", alphaTheta: 2 ** -expTheta };
    }
    return {
      ...comun, algoritmo: "reinforceLineaBase", base,
      alphaTheta: 2 ** -expTheta, alphaW: 2 ** -expW,
    };
  }
  const variante = (cual) => (cual === "referencia" || base === "cero"
    ? "reinforce" : "reinforceLineaBase");
  const clave = (cual) => (cual === "referencia"
    ? `${semillaActual()}|ref`
    : `${semillaActual()}|${base}|${expTheta}|${base === "cero" ? "-" : expW}`);

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  const mandoBase = grupoRadio(panel, t("t5b.m4.baseLabel", "Línea base"), [
    { valor: "cero", texto: t("t5b.m4.baseNinguna", "ninguna (\\(b = 0\\))") },
    { valor: "estado", texto: t("t5b.m4.baseEstado", "\\(b(S_t) = \\hat v(S_t,w)\\)") },
    { valor: "accion", texto: t("t5b.m4.baseAccion", "\\(b(S_t,A_t)\\): una por acción") },
  ], base, (v) => { base = v; pedir(); });
  const mandoTheta = grupoRadio(panel,
    t("t5b.m4.alphaThetaLabel", "Paso de la política (\\(\\alpha^\\theta\\))"), [
      { valor: 13, texto: "\\(2^{-13}\\)" },
      { valor: 9, texto: "\\(2^{-9}\\)" },
    ], expTheta, (v) => { expTheta = v; pedir(); });
  const mandoW = grupoRadio(panel,
    t("t5b.m4.alphaWLabel", "Paso del valor (\\(\\alpha^{w}\\))"), [
      { valor: 8, texto: "\\(2^{-8}\\)" },
      { valor: 6, texto: "\\(2^{-6}\\)" },
      { valor: 4, texto: "\\(2^{-4}\\)" },
    ], expW, (v) => { expW = v; pedir(); });
  botonControl(panel, t("t5b.m4.calcular", "Calcular"), () => pedir());
  botonControl(panel, t("t5b.m4.reiniciar", "Valores por omisión"), () => {
    base = "estado"; expTheta = 9; expW = 6;
    mandoBase.marcar(base); mandoTheta.marcar(expTheta); mandoW.marcar(expW);
    pedir();
  });

  parrafo(zonaControles, "suave", t("t5b.m4.notaAproximador",
    "Con la línea base del estado, \\(\\hat v(s,w) = w\\) es <strong>un solo número</strong> para "
    + "los tres estados, con \\(d = 1\\) y \\(\\nabla\\hat v(s,w) = 1\\): es exactamente lo que hace "
    + "el libro en la Figura 13.2. \\(w_0 = 0\\), el «e.g., to 0» de su recuadro."));
  parrafo(zonaControles, "suave", t("t5b.m4.notaSemilla",
    "Las variantes arrancan con la misma semilla y la misma política; a partir de la primera "
    + "actualización distinta, los episodios ya no son los mismos."));

  /* --- visualizaciones y métricas --- */

  const viz1 = caja(zonaViz1, t("t5b.m4.viz1", "Retorno por episodio, con y sin línea base"),
    { conPie: true });
  vacia(viz1.cuerpo, t("t5b.m4.viz1vacio", "Pulsa <strong>Calcular</strong> para lanzar la tanda."));
  const progreso = barraProgreso(viz1.caja);

  const viz2 = caja(zonaViz2, t("t5b.m4.viz2",
    "El estimador del gradiente: dónde está su media y cuánto se dispersa"), { conPie: true });
  vacia(viz2.cuerpo, t("t5b.m4.viz2vacio", "Lanza la tanda para ver las distribuciones."));
  parrafo(zonaViz2, "suave", t("t5b.m4.viz2nota",
    "\\(\\theta\\) congelado en su valor inicial y 10.000 episodios <strong>compartidos por las "
    + "tres líneas base</strong>: aquí se mide <strong>el estimador</strong>, no el algoritmo. Y "
    + "\\(w\\) va congelada en su punto fijo, no aprendiéndose: con el orden del recuadro de la "
    + "p. 352 la \\(w\\) aprendida queda correlacionada con el retorno de su propio episodio y la "
    + "comparación dejaría de medir lo que dice medir."));

  const cifras = metricas(zonaMetricas, [
    { id: "finalCon", etiqueta: t("t5b.m4.mFinalCon", "\\(G_0\\) medio final, con línea base") },
    { id: "finalSin", etiqueta: t("t5b.m4.mFinalSin", "\\(G_0\\) medio final, sin línea base") },
    { id: "cruceCon", etiqueta: t("t5b.m4.mCruceCon",
      "Primer episodio por encima de \\(-15\\), con línea base") },
    { id: "cruceSin", etiqueta: t("t5b.m4.mCruceSin",
      "Primer episodio por encima de \\(-15\\), sin línea base") },
    { id: "ratioVar", etiqueta: t("t5b.m4.mRatioVar",
      "Varianza del estimador, con línea base ÷ sin ella") },
  ]);

  /* --- panel exacto --- */

  parrafo(zonaTabla, "explicacion", t("t5b.m4.panelExactoIntro",
    "La parte de la respuesta que no necesita simulación. Con \\(q_\\pi\\) conocido, la media y la "
    + "varianza del término del gradiente en cada estado se calculan a mano. Fíjate en la columna de "
    + "la media: <strong>es la misma con \\(b = 0\\) y con \\(b = v_\\pi(s)\\)</strong>, y por eso no "
    + "tiene columna propia."));
  const tablaExacta = tablaDatos(zonaTabla, {
    cabecera: [
      t("t5b.m4.colEstado", "Estado"),
      t("t5b.m4.colMedia", "Media del término"),
      t("t5b.m4.colVar0", "Varianza con \\(b=0\\)"),
      t("t5b.m4.colVarV", "Varianza con \\(b = v_\\pi(s)\\)"),
      t("t5b.m4.colBopt", "\\(b\\) que minimiza la varianza"),
    ],
  });
  parrafo(zonaTabla, "suave", t("t5b.m4.panelExactoP",
    "Evaluado en \\(p = p_0 = 0{,}05\\), la política de partida de las curvas de arriba. En "
    + "\\(p = 0{,}5\\) —el deslizador del módulo 1— la varianza con \\(b = v_\\pi(s)\\) es "
    + "<strong>exactamente cero</strong> en los tres estados, porque ahí, y solo ahí, \\(v_\\pi(s)\\) "
    + "coincide con la línea base óptima."));
  parrafo(zonaTabla, "explicacion", t("t5b.m4.panelExactoNota",
    "Y una sorpresa que el libro no menciona: <strong>la línea base que minimiza la varianza no es "
    + "\\(v_\\pi(s)\\)</strong>, sino \\((1-p)\\,q_\\pi(s,\\text{der}) + p\\,q_\\pi(s,\\text{izq})\\) "
    + "— una media de los valores de acción ponderada al revés. Coinciden solo cuando "
    + "\\(p = 1/2\\). \\(v_\\pi(s)\\) no es la línea base óptima: es una que se puede aprender "
    + "fácilmente y que funciona muy bien."));

  /* --- paneles --- */

  const panelAccion = aviso(zonaPaneles, t("t5b.m4.panelAccion",
    "Esta línea base aprende <strong>dos</strong> números en vez de uno: la media de los retornos "
    + "observados después de ir a la derecha y la media después de ir a la izquierda. Suena "
    + "razonable, y en el examen aparece con la coletilla de que introduciría «un sesgo asumible que "
    + "cambia solo al inicio la dirección». Mira la curva. <strong>En este entorno no hay sesgo "
    + "asumible que valga: se cancela el gradiente entero.</strong> Cuando los dos números llegan a "
    + "su equilibrio, la actualización <strong>esperada</strong> del actor es <strong>exactamente "
    + "cero para cualquier \\(p\\)</strong>: la diferencia entre las dos líneas base es justo la "
    + "cantidad que la política estaba usando para decidir hacia dónde moverse, y al restarla no "
    + "queda nada."));
  const panelAccion2 = aviso(zonaPaneles, t("t5b.m4.panelAccion2",
    "Y ahora lo que de verdad pasa, que es peor y más interesante que quedarse quieto. "
    + "<strong>Esperanza cero no es estar parado.</strong> El gradiente esperado se anula, pero "
    + "<strong>la varianza no se ha ido a ninguna parte</strong>: la política sigue recibiendo "
    + "empujones grandes en direcciones que ya no llevan a ningún sitio, y lo que hace es "
    + "<strong>difundir</strong> — un paseo aleatorio en el espacio de parámetros, sin nada que la "
    + "devuelva al centro. Y como los dos extremos son absorbentes —en \\(p = 0\\) y \\(p = 1\\) el "
    + "gradiente se apaga y el episodio no acaba—, la política termina pegada a uno de ellos. "
    + "Medido: <strong>la mediana de \\(p\\) acaba en 0,0000, 94 de 100 ejecuciones por debajo de "
    + "0,01, y el retorno medio final es \\(-470{,}71\\)</strong>, frente a los \\(-82{,}11\\) de los "
    + "que partía. <strong>No se queda plana: se destruye.</strong>"));
  const panelAccion3 = parrafo(zonaPaneles, "suave", t("t5b.m4.panelAccion3",
    "Que la culpa es de la difusión y no de otra cosa se puede comprobar: si en lugar de aprenderlos "
    + "se <strong>congelan</strong> los dos números en su equilibrio exacto —con lo que la esperanza "
    + "es cero desde el primer episodio— la política se va igual, y entonces hacia \\(p = 1\\). Lo "
    + "único que decide a qué extremo va es por dónde empiece a derivar."));

  parrafo(zonaPaneles, "suave", t("t5b.m4.panelSesgoW",
    "Una precisión fina, que se ve al medir y no se ve en la teoría. La línea base <strong>no "
    + "sesga</strong> mientras no dependa de la acción — pero la condición del libro es sobre una "
    + "línea base que no dependa <strong>de la acción ni de la muestra</strong>. Y en el recuadro de "
    + "la p. 352, \\(w\\) se actualiza <strong>dentro del mismo episodio</strong> cuyo retorno se "
    + "está usando: absorbe parte de \\(G_t\\) y queda correlacionada con los \\(G_{t+1}, "
    + "G_{t+2}\\ldots\\) del propio episodio. Medido sobre 10.000 episodios: con \\(w\\) "
    + "<strong>congelada</strong> en su punto fijo, la diferencia entre las medias de las dos "
    + "distribuciones es de \\(-0{,}17\\) errores típicos —cero, como exige la teoría—; con \\(w\\) "
    + "<strong>aprendida</strong> con el orden del recuadro, es de \\(-16{,}6\\). <strong>No "
    + "contradice a Sutton &amp; Barto</strong>: es la diferencia entre la línea base ideal del "
    + "teorema y la línea base que un algoritmo incremental puede permitirse. En la práctica "
    + "compensa de sobra, y por eso el libro lo escribe así."));

  parrafo(zonaPaneles, "suave", t("t5b.m4.panelAccionMatiz",
    "Un matiz para no ir más lejos de lo que va el libro: lo que Sutton &amp; Barto demuestra es que "
    + "una línea base que <strong>no</strong> dependa de la acción <strong>no</strong> sesga. Eso es "
    + "una condición <strong>suficiente</strong>, no necesaria, y él mismo cita en sus notas trabajos "
    + "que construyen líneas base dependientes de la acción sin introducir sesgo. Lo que este módulo "
    + "enseña es que <strong>la primera línea base por acción que a uno se le ocurre sí rompe el "
    + "algoritmo</strong>, y de una forma bastante peor que un sesgo pequeño."));

  parrafo(zonaPaneles, "explicacion", t("t5b.m4.panelDos",
    "«Tenemos dos hiperparámetros», dice la diapositiva, y no dice cuáles. Son "
    + "\\(\\alpha^\\theta\\), el paso de la política, y \\(\\alpha^{w}\\), el del valor. El libro "
    + "avisa de que <strong>no cuesta lo mismo elegirlos</strong>: para el del valor hay reglas "
    + "prácticas en el caso lineal; para el de la política es mucho menos claro, porque su mejor "
    + "valor depende del rango de las recompensas y de la parametrización. Y en la propia figura del "
    + "libro está el dato que nadie comenta: el \\(\\alpha^\\theta\\) que va bien <strong>con</strong> "
    + "línea base es \\(2^{-9}\\), <strong>dieciséis veces mayor</strong> que el mejor \\(\\alpha\\) "
    + "sin ella. Reducir la varianza no solo acelera: permite dar pasos más grandes."));

  const panelDemo = document.createElement("div");
  panelDemo.className = "aviso";
  panelDemo.style.margin = ".6rem 0";
  panelDemo.innerHTML = `${t("t5b.m4.panelDemo", "La condición, entera, en tres pasos:")}`
    + "<p class=\"ecuacion\">\\[ \\sum_a b(s)\\,\\nabla\\pi(a\\mid s,\\theta) = b(s)\\sum_a\\nabla\\pi(a\\mid s,\\theta)"
    + " = b(s)\\,\\nabla\\!\\!\\sum_a \\pi(a\\mid s,\\theta) = b(s)\\,\\nabla 1 = \\mathbf 0 \\]</p>"
    + `<p>${t("t5b.m4.panelDemo2",
      "<strong>El primer paso es el que se rompe si \\(b\\) depende de la acción</strong>: entonces "
      + "\\(b\\) no sale como factor común de la suma, y el término ya no se anula.")}</p>`;
  zonaPaneles.appendChild(panelDemo);
  renderizarMatematicas(panelDemo);

  parrafo(zonaPaneles, "suave", t("t5b.m4.notaTope",
    "El tope por episodio es de <strong>500 pasos</strong>, el mismo del módulo 3 y por la misma "
    + "razón; allí está explicado, y allí se puede conmutar. Aquí no: con 10.000 la curva sin línea "
    + "base no llega a cruzar \\(-15\\) en 1000 episodios y la comparación de la Figura 13.2 deja de "
    + "tener sentido."));
  const notaCortada = aviso(zonaPaneles, "");

  /* --- lectura --- */

  zonaLectura.classList.add("siempre");
  zonaLectura.innerHTML = t("t5b.m4.lectura1",
    "Una línea base que no dependa de la acción <strong>no mueve la media</strong> del estimador del "
    + "gradiente —lo has visto: las dos distribuciones tienen la misma media— y <strong>le recorta "
    + "la dispersión</strong>. Por eso acelera, y por eso permite además un paso dieciséis veces "
    + "mayor.");
  renderizarMatematicas(zonaLectura);
  const lectura2 = document.createElement("p");
  lectura2.className = "explicacion siempre";
  lectura2.innerHTML = t("t5b.m4.lectura2",
    "La condición «que no dependa de la acción» no es un tecnicismo. Con una línea base por acción "
    + "—la media de los retornos tras cada una, que parece razonable— la actualización "
    + "<strong>esperada</strong> se anula por completo en este entorno. Y eso <strong>no</strong> "
    + "deja al algoritmo quieto: le quita la señal y le deja el ruido, así que la política difunde "
    + "hasta pegarse a un extremo. El retorno acaba en \\(-470\\), cinco veces peor que el de la "
    + "política de partida.");
  zonaLectura.after(lectura2);
  renderizarMatematicas(lectura2);

  /* --- el estudio del estimador con θ congelado (hilo principal) --------- */

  let estimador = null;

  /**
   * Media y varianza empíricas del incremento por episodio, con θ congelado y
   * las tres líneas base sobre LOS MISMOS episodios.
   *
   * Es el único sitio de la página donde los episodios se comparten de verdad,
   * y se puede porque θ no se mueve: se está midiendo el estimador. Las w van
   * congeladas en su punto fijo exacto, no aprendiéndose.
   */
  function calcularEstimador() {
    if (estimador && estimador.semilla === semillaActual()) return estimador;
    const v = valoresExactos(entorno, P0);
    let wEstado = 0;
    for (let s = 0; s < entorno.nEstados; s++) wEstado += v.mu[s] * v.v[s];
    const wAccion = new Float64Array(entorno.nAcciones);
    for (let a = 0; a < entorno.nAcciones; a++) {
      let acumulado = 0;
      for (let s = 0; s < entorno.nEstados; s++) acumulado += v.mu[s] * v.q[s][a];
      wAccion[a] = acumulado;
    }
    const rng = generador(semillaActual());
    const episodios = [];
    for (let k = 0; k < EPISODIOS_ESTIMADOR; k++) {
      episodios.push(episodio(entorno, theta0, rng, { maxPasos: TOPE_M4 }));
    }
    const comun = { alphaTheta: 1, congelarTheta: true, alphaW: 0 };
    const sin = reinforceLineaBase(entorno, theta0, episodios, { ...comun, base: "cero" });
    const estado = reinforceLineaBase(entorno, theta0, episodios,
      { ...comun, base: "estado", w0: wEstado });
    const accion = reinforceLineaBase(entorno, theta0, episodios,
      { ...comun, base: "accion", w0: wAccion });
    estimador = {
      semilla: semillaActual(),
      wEstado,
      series: {
        cero: sin.incrementos, estado: estado.incrementos, accion: accion.incrementos,
      },
    };
    return estimador;
  }

  /* --- cálculo de las tandas --- */

  function pedir() {
    arrancado = true;
    sincronizar();
    dibujar();
    for (const cual of ["referencia", "elegida"]) {
      const c = clave(cual);
      if (cache.has(c) || enMarcha.has(c)) continue;
      enMarcha.add(c);
      error = null;
      progreso.fijar(0);
      calcularTanda(configuracion(cual), (fraccion) => progreso.fijar(fraccion))
        .then((resultado) => {
          cache.set(c, resultado);
          enMarcha.delete(c);
          dibujar();
        })
        .catch((e) => {
          error = e.message;
          enMarcha.delete(c);
          dibujar();
        });
    }
  }
  const datosDe = (cual) => cache.get(clave(cual)) || null;

  /* --- dibujo --- */

  function dibujarViz1() {
    const ref = datosDe("referencia");
    const ele = datosDe("elegida");
    const series = [
      { nombre: t("t5b.m4.serieSin", "sin línea base · \\(\\alpha = 2^{-13}\\)"),
        color: tono(COLORES_SERIE[1]),
        y: ref ? ref.curvas["reinforce.G0"] : [] },
      /* ⚠ Los parámetros NO se pueden llamar `w`: `t()` sustituye por nombre y
         se comería el `{w}` de `\alpha^{w}`, dejando `\alpha^6`. */
      { nombre: t("t5b.m4.serieCon",
        "con la línea base elegida · \\(\\alpha^\\theta = 2^{-{at}}\\), "
        + "\\(\\alpha^{w} = 2^{-{aw}}\\)",
        { at: expTheta, aw: expW }),
      color: tono(COLORES_SERIE[2]),
      y: ele ? ele.curvas[`${variante("elegida")}.G0`] : [] },
    ];
    if (!series.some((s) => s.y.length)) {
      vacia(viz1.cuerpo, error
        ? t("t5b.m4.error", "El cálculo ha fallado: {m}", { m: error })
        : t("t5b.m4.viz1vacio", "Pulsa <strong>Calcular</strong> para lanzar la tanda."));
    } else {
      /* Suelo de −95, el de la Figura 13.2. Con la línea base POR ACCIÓN la
         curva baja de −470; el estirado lo hace `graficaLineas`, que trata el
         rango como un mínimo y no como un recorte. */
      pintar(viz1.cuerpo, graficaLineas(series, {
        ancho: 660, alto: 320,
        ejeX: t("t5b.m4.viz1x", "Episodio"),
        ejeY: t("t5b.m4.viz1y", "G₀: retorno total del episodio"),
        yMin: -95, yMax: -5,
        ticksX: [1, 200, 400, 600, 800, 1000].map((v) => ({ valor: v, etiqueta: String(v) })),
        formatoY: (v) => num(v, 0),
        anotacionesY: [{ y: V_ESTRELLA, texto: t("t5b.m4.anotVestrella", "v*(s₀)") }],
      }));
      conLeyenda(viz1.cuerpo, series);
    }
    const enCola = enMarcha.size > 0;
    fijarPie(viz1.pie, t("t5b.m4.viz1runs",
      "Media de 100 ejecuciones · <strong>misma semilla para las dos curvas</strong>, no los mismos "
      + "episodios · semilla {s}", { s: semillaActual() }));
    ver(progreso.caja, enCola);
  }

  function dibujarViz2() {
    /* Los 10 000 episodios del estimador cuestan un segundo largo en el hilo
       principal: no se calculan al cargar la página, solo cuando el módulo ya
       ha arrancado (entrar en el viewport o pulsar «Calcular»). */
    if (!arrancado) {
      vacia(viz2.cuerpo, t("t5b.m4.viz2vacio", "Lanza la tanda para ver las distribuciones."));
      fijarPie(viz2.pie, "");
      return null;
    }
    const e = calcularEstimador();
    /* Siempre «sin línea base» y siempre la de estado —es la que sostiene la
       métrica del cociente de varianzas— más la por acción si está elegida. */
    const cuales = base === "accion" ? ["cero", "estado", "accion"] : ["cero", "estado"];
    const referencia = e.series.cero;
    const centro = media(referencia);
    const sigma = desviacion(referencia);
    const min = centro - 3 * sigma;
    const max = centro + 3 * sigma;
    const series = [];
    const anotaciones = [];
    cuales.forEach((cual, i) => {
      const h = histograma(e.series[cual], { min, max, nIntervalos: 40 });
      const { x, y } = poligonoFrecuencias(h);
      const nombre = cual === "cero"
        ? t("t5b.m4.distSin", "\\(b = 0\\)")
        : (cual === "estado"
          ? t("t5b.m4.distEstado", "\\(b(S_t)\\)")
          : t("t5b.m4.distAccion", "\\(b(S_t,A_t)\\)"));
      series.push({ nombre, color: tono(COLORES_SERIE[i]), x, y, grosor: 2 });
      if (h.media >= min && h.media <= max) {
        anotaciones.push({ x: h.media, texto: num(h.media, 1) });
      }
    });
    pintar(viz2.cuerpo, graficaLineas(series, {
      ancho: 660, alto: 300,
      ejeX: t("t5b.m4.viz2x", "primera componente del incremento"),
      ejeY: t("t5b.m4.viz2y", "frecuencia relativa"),
      yMin: 0,
      ticksX: [min, centro - 1.5 * sigma, centro, centro + 1.5 * sigma, max]
        .map((v, i) => ({
          valor: v,
          etiqueta: i === 0 ? `≤ ${num(v, 0)}` : (i === 4 ? `≥ ${num(v, 0)}` : num(v, 0)),
        })),
      formatoY: (v) => num(v, 2),
      anotaciones,
    }));
    conLeyenda(viz2.cuerpo, series);
    fijarPie(viz2.pie, t("t5b.m4.viz2runs",
      "{n} episodios sembrados con la semilla {s}, los mismos para todas las líneas base · "
      + "\\(\\theta\\) y \\(w\\) congeladas",
      { n: num(EPISODIOS_ESTIMADOR, 0), s: semillaActual() }));
    /* La métrica del cociente sigue al control: con «una por acción» compara
       ESA, no la de estado. Sin línea base no hay nada que comparar, y se
       enseña la de estado diciéndolo en la glosa. */
    const cual = base === "cero" ? "estado" : base;
    return { referencia, comparada: e.series[cual], cual };
  }

  function dibujarTabla() {
    const theta = thetaDeP(entorno, P0);
    const v = valoresExactos(entorno, P0);
    const filas = [];
    let mediaTotal = 0;
    let var0Total = 0;
    let varVTotal = 0;
    for (let s = 0; s < entorno.nEstados; s++) {
      const sinBase = mediaVarianzaTermino(entorno, theta, s, 0);
      const conV = mediaVarianzaTermino(entorno, theta, s, v.v[s]);
      mediaTotal += v.mu[s] * sinBase.media;
      var0Total += v.mu[s] * sinBase.varianza;
      varVTotal += v.mu[s] * conV.varianza;
      filas.push([
        s === 1 ? `1 · ${t("t5b.m1.invertido", "invertido")}` : String(s),
        `\\(${numMat(sinBase.media, 4)}\\)`,
        `\\(${numMat(sinBase.varianza, 4)}\\)`,
        `\\(${numMat(conV.varianza, 4)}\\)`,
        sinBase.bOptimo === null ? "—" : `\\(${numMat(sinBase.bOptimo, 4)}\\)`,
      ]);
    }
    filas.push({
      destacada: true,
      celdas: [
        `<strong>${t("t5b.m4.filaTotal", "total, ponderado por \\(\\mu(s)\\)")}</strong>`,
        `\\(${numMat(mediaTotal, 4)}\\)`,
        `\\(${numMat(var0Total, 4)}\\)`,
        `\\(${numMat(varVTotal, 4)}\\)`,
        "—",
      ],
    });
    tablaExacta.actualizar(filas);
  }

  function dibujarMetricas(distribuciones) {
    const ref = datosDe("referencia");
    const ele = datosDe("elegida");
    fijarCifra(cifras.finalCon, ele
      ? `\\(${numMat(mediaFinal(ele.curvas[`${variante("elegida")}.G0`], 100), 2)}\\)` : "—");
    fijarCifra(cifras.finalSin, ref
      ? `\\(${numMat(mediaFinal(ref.curvas["reinforce.G0"], 100), 2)}\\)` : "—");
    const cruce = (d, clave) => {
      if (!d) return "—";
      const e = primerEpisodioPorEncima(d.curvas[clave], -15);
      return e === null ? t("t5b.m4.noLlega", "no llega") : String(e);
    };
    fijarCifra(cifras.cruceCon, cruce(ele, `${variante("elegida")}.G0`));
    fijarCifra(cifras.cruceSin, cruce(ref, "reinforce.G0"));
    if (!distribuciones) {
      fijarCifra(cifras.ratioVar, "—");
      fijarCifra(cifras["ratioVar$glosa"], "");
      return;
    }
    const varSin = desviacion(distribuciones.referencia) ** 2;
    const varCon = desviacion(distribuciones.comparada) ** 2;
    fijarCifra(cifras.ratioVar, varSin > 0 ? `\\(${numMat(varCon / varSin, 3)}\\)` : "—");
    fijarCifra(cifras["ratioVar$glosa"], distribuciones.cual === "accion"
      ? t("t5b.m4.mRatioVarAccion",
        "con \\(b(S_t,A_t)\\), \\(\\theta\\) y \\(w\\) congeladas")
      : (base === "cero"
        ? t("t5b.m4.mRatioVarSinBase",
          "sin línea base no hay nada que comparar: se enseña la de \\(b(S_t)\\)")
        : t("t5b.m4.mRatioVarGlosa",
          "con \\(b(S_t)\\), \\(\\theta\\) y \\(w\\) congeladas")));
  }

  function sincronizar() {
    ver(panelAccion, base === "accion");
    ver(panelAccion2, base === "accion");
    ver(panelAccion3, base === "accion");
    mandoW.caja.style.opacity = base === "cero" ? "0.45" : "1";
    const cortadas = (datosDe("referencia")?.cortadas?.reinforce || 0)
      + (datosDe("elegida")?.cortadas?.[variante("elegida")] || 0);
    if (cortadas > 0) {
      notaCortada.innerHTML = t("t5b.m4.cortada",
        "{n} ejecuciones cortadas por desbordamiento.", { n: cortadas });
      renderizarMatematicas(notaCortada);
    }
    ver(notaCortada, cortadas > 0);
  }

  function dibujar() {
    sincronizar();
    dibujarViz1();
    const distribuciones = dibujarViz2();
    dibujarTabla();
    dibujarMetricas(distribuciones);
  }

  oyentesSemilla.push(() => { cache.clear(); estimador = null; if (arrancado) pedir(); });
  repintadores.push(dibujar);
  /* El estado de las notas condicionales se fija AQUÍ, no solo dentro del
     manejador: si no, los tres paneles de la línea base por acción nacerían
     visibles con la línea base de estado seleccionada. */
  sincronizar();
  dibujarTabla();
  dibujarMetricas(null);
  ver(progreso.caja, false);
  alEntrarEnPantalla($("#m4"), pedir);

  crearQuiz($("#m4-quiz"), [
    {
      enunciado: "¿Cuál es la condición exacta para que una línea base no cambie el valor esperado "
        + "de la actualización?",
      opciones: [
        "Que no dependa de la acción. Puede ser cualquier función del estado, incluso una variable "
        + "aleatoria.",
        "Que sea una estimación insesgada de \\(v_\\pi(s)\\); si no lo es, el gradiente se "
        + "desplaza.",
        "Que sea constante en el tiempo y en el estado, porque solo así sale factor común del "
        + "sumatorio.",
        "Que sea no negativa, para que la resta \\(G_t - b(S_t)\\) no cambie el signo del retorno.",
      ],
      correcta: 0,
      explicacion: "La demostración usa que \\(\\sum_a\\nabla\\pi(a\\mid s,\\theta) = \\nabla 1 = "
        + "0\\), y para sacar \\(b\\) como factor común de esa suma basta con que no dependa de "
        + "\\(a\\). Del estado puede depender todo lo que quiera, y el libro añade que incluso puede "
        + "ser aleatoria. No hace falta que estime bien \\(v_\\pi\\): una línea base mala no sesga, "
        + "solo reduce menos la varianza — de hecho \\(b = 0\\) es una línea base perfectamente "
        + "válida, y es REINFORCE a secas. Tampoco hace falta que sea constante en el estado; al "
        + "contrario, el libro insiste en que <strong>debe</strong> variar con el estado para ser "
        + "útil. Y el signo del retorno no pinta nada: lo que importa es la media del producto.",
    },
    {
      enunciado: "En este pasillo, con una línea base que aprende un número por acción, ¿qué le "
        + "ocurre al aprendizaje?",
      opciones: [
        "Se destruye: la actualización esperada se anula, pero la varianza no, así que la política "
        + "difunde sin nada que la centre y acaba pegada a un extremo.",
        "Se acelera todavía más, porque dos números estiman mejor el retorno que uno solo.",
        "Converge igual, pero a una política ligeramente distinta de \\(2-\\sqrt2\\).",
        "Se queda exactamente donde estaba: con gradiente esperado nulo, la política no se mueve "
        + "más.",
      ],
      correcta: 0,
      explicacion: "El equilibrio de esos dos números es la media de \\(q_\\pi(s,a)\\) ponderada por "
        + "\\(\\mu(s)\\) para cada acción, y su diferencia es exactamente la cantidad que la política "
        + "estaba usando para decidir hacia dónde moverse: la resta cancela el gradiente "
        + "<strong>esperado</strong> entero, para cualquier \\(p\\). Pero esperanza cero no es estar "
        + "quieto — la varianza sigue ahí, la política hace un paseo aleatorio y los dos extremos son "
        + "absorbentes, así que acaba pegada a uno: la mediana de \\(p\\) termina en 0,00 y el "
        + "retorno medio en \\(-470\\), muy por debajo del \\(-82\\) de partida. No es que estime "
        + "mejor: estimar <strong>por acción</strong> borra la única información que distingue una "
        + "acción de la otra. Y tampoco es una desviación pequeña del óptimo.",
    },
    {
      enunciado: "En la figura del libro, el paso de la política con línea base es \\(2^{-9}\\) y "
        + "sin ella \\(2^{-13}\\). ¿Qué explica esa diferencia?",
      opciones: [
        "Que al reducir la varianza del estimador se pueden dar pasos mayores sin que las "
        + "actualizaciones se descontrolen.",
        "Que con línea base el gradiente estimado es mayor en módulo, y hay que compensarlo con un "
        + "paso también mayor.",
        "Que \\(\\alpha^\\theta\\) y \\(\\alpha^{w}\\) tienen que sumar aproximadamente el paso que "
        + "se usaría sin línea base.",
        "Que es una convención del libro para que las dos curvas quepan en la misma escala.",
      ],
      correcta: 0,
      explicacion: "Con un estimador ruidoso hay que dar pasos pequeños para que el ruido se "
        + "promedie; al restar la línea base, la dispersión cae y el mismo paso deja de ser peligroso "
        + "—de hecho se puede multiplicar por dieciséis. El módulo lo enseña en la distribución del "
        + "estimador: la media es la misma y la anchura, no. El módulo del gradiente esperado "
        + "<strong>no</strong> cambia: eso es justamente lo que dice la condición de la línea base. "
        + "Los dos pasos son independientes y no se suman ni se reparten. Y no es una convención "
        + "gráfica: el pie de la figura dice que el paso sin línea base es el que mejor funciona, a "
        + "la potencia de dos más próxima.",
    },
  ], { claves: "t5b.m4.quiz" });
}

/* ======================================================================= *
 * MÓDULO 5 — Actor-crítico: el mismo número, como línea base y como crítico
 *
 * A/B con la misma semilla y un panel exacto que dice, sin simular, hacia
 * dónde empuja la actualización esperada de cada variante. El panel es lo que
 * convierte el módulo en un argumento y no en una anécdota.
 * ======================================================================= */

const EPISODIOS_M5 = 500;
const EJECUCIONES_M5 = 50;
const TOPE_M5 = 1000;
const ALPHA_THETA_M5 = 2 ** -9;         // el de la Figura 13.2; aquí NO es un control

function modulo5() {
  const zonaControles = $("#m5-controles");
  const zonaViz1 = $("#m5-viz1");
  const zonaViz2 = $("#m5-viz2");
  const zonaTabla = $("#m5-tabla");
  const zonaMetricas = $("#m5-metricas");
  const zonaPaneles = $("#m5-paneles");
  const zonaLectura = $("#m5-lectura");

  const entorno = pasilloCorto({});

  /* --- estado del módulo --- */
  let uso = "dos";                      // "base" | "critico" | "dos"
  let capacidad = "unNumero";           // "unNumero" | "porEstado"
  let expW = 4;                         // α^w = 2⁻⁴ (⚑ del motor: con 2⁻⁶ la
  /*                                       combinación «línea base + uno por
                                           estado» se rompe y el módulo abriría
                                           con ruido en vez de con su lección) */

  const cache = new Map();
  const enMarcha = new Set();
  let error = null;
  let arrancado = false;

  const variantes = () => (uso === "dos"
    ? ["lineaBase", "actorCritico"]
    : [uso === "base" ? "lineaBase" : "actorCritico"]);
  const clave = () => `${semillaActual()}|${uso}|${capacidad}|${expW}`;

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  const mandoUso = grupoRadio(panel, t("t5b.m5.usoLabel", "Uso del valor aprendido"), [
    { valor: "base", texto: t("t5b.m5.usoBase", "como línea base (REINFORCE con línea base)") },
    { valor: "critico", texto: t("t5b.m5.usoCritico", "como crítico (actor-crítico a un paso)") },
    { valor: "dos", texto: t("t5b.m5.usoDos", "los dos, misma semilla") },
  ], uso, (v) => { uso = v; pedir(); });
  const mandoCapacidad = grupoRadio(panel,
    t("t5b.m5.capacidadLabel", "Capacidad del aproximador de valor"), [
      { valor: "unNumero", texto: t("t5b.m5.capUno",
        "un solo número, \\(\\hat v(s,w) = w\\)") },
      { valor: "porEstado", texto: t("t5b.m5.capTres", "uno por estado") },
    ], capacidad, (v) => { capacidad = v; pedir(); });
  const mandoW = grupoRadio(panel,
    t("t5b.m5.alphaWLabel", "Paso del valor (\\(\\alpha^{w}\\))"), [
      { valor: 8, texto: "\\(2^{-8}\\)" },
      { valor: 6, texto: "\\(2^{-6}\\)" },
      { valor: 4, texto: "\\(2^{-4}\\)" },
    ], expW, (v) => { expW = v; pedir(); });
  botonControl(panel, t("t5b.m5.calcular", "Calcular"), () => pedir());
  botonControl(panel, t("t5b.m5.reiniciar", "Valores por omisión"), () => {
    uso = "dos"; capacidad = "unNumero"; expW = 4;
    mandoUso.marcar(uso); mandoCapacidad.marcar(capacidad); mandoW.marcar(expW);
    pedir();
  });

  parrafo(zonaControles, "suave", t("t5b.m5.notaAlphaTheta",
    "\\(\\alpha^\\theta = 2^{-9}\\), el de la Figura 13.2, y <strong>no es un control</strong>: con "
    + "tres controles ya se llega al presupuesto, y el papel del paso de la política es el módulo 6. "
    + "\\(w_0 = 0\\) en las dos capacidades."));
  parrafo(zonaControles, "suave", t("t5b.m5.notaSemilla",
    "Las dos variantes arrancan con la misma semilla y la misma política; a partir del primer paso "
    + "las trayectorias divergen, porque cada una ya ha actualizado la política a su manera."));

  /* --- visualizaciones y métricas --- */

  const viz1 = caja(zonaViz1, t("t5b.m5.viz1", "Retorno por episodio"), { conPie: true });
  vacia(viz1.cuerpo, t("t5b.m5.viz1vacio", "Pulsa <strong>Calcular</strong> para lanzar la tanda."));
  const progreso = barraProgreso(viz1.caja);
  const viz2 = caja(zonaViz2, t("t5b.m5.viz2", "A dónde lleva cada variante la política"),
    { conPie: true });
  vacia(viz2.cuerpo, t("t5b.m5.viz2vacio", "Lanza la tanda para ver a dónde va \\(p\\)."));

  const cifras = metricas(zonaMetricas, [
    { id: "finalBase", etiqueta: t("t5b.m5.mFinalBase", "\\(G_0\\) medio final, línea base") },
    { id: "finalCritico", etiqueta: t("t5b.m5.mFinalCritico", "\\(G_0\\) medio final, crítico") },
    { id: "pBase", etiqueta: t("t5b.m5.mPbase", "\\(p\\) final, línea base") },
    { id: "pCritico", etiqueta: t("t5b.m5.mPcritico", "\\(p\\) final, crítico") },
    { id: "truncados", etiqueta: t("t5b.m5.mTruncados",
      "Episodios truncados por el tope de 1000 pasos") },
  ]);

  /* --- panel exacto --- */

  parrafo(zonaTabla, "explicacion", t("t5b.m5.panelExactoIntro",
    "Esto no se simula: se calcula. Para cada variante, hacia dónde empuja la actualización "
    + "<strong>esperada</strong> del actor con la \\(p\\) de partida."));
  /* La columna del w NO es decorativa: sin ella la tabla no decía con qué
     valor se evalúa cada fila, y la nota de más abajo —«con w = 0 la
     actualización esperada es cero»— parecía contradecir la tercera fila, que
     se evalúa en el punto fijo w = J(p₀) y vale [78, −78]. */
  const tablaExacta = tablaDatos(zonaTabla, {
    cabecera: [
      t("t5b.m5.colVariante", "Variante"), "\\(d\\)",
      t("t5b.m5.colW", "\\(w\\) con el que se evalúa (su punto fijo)"),
      t("t5b.m5.colActualizacion", "Actualización esperada del actor"),
      t("t5b.m5.colPuntoFijo", "Punto fijo de la política"),
    ],
  });
  parrafo(zonaTabla, "suave", t("t5b.m5.panelExactoP",
    "Evaluado en \\(p = p_0 = 0{,}05\\), la política con la que arrancan las cuatro. Este módulo no "
    + "tiene deslizador de \\(p\\) —el del módulo 1 sirve para recorrer la curva—, y las cuatro "
    + "filas se evalúan en el mismo punto para que sean comparables. La tercera fila apunta a "
    + "\\(p = 1\\) <strong>para cualquier \\(p\\)</strong>, no solo para esta."));
  parrafo(zonaTabla, "explicacion", t("t5b.m5.panelExactoNota",
    "Fíjate en la tercera fila. Con un crítico de un solo número, casi todos los errores TD valen "
    + "\\(-1\\): el crítico predice el mismo valor antes y después, y la recompensa es siempre "
    + "\\(-1\\). El único paso distinto es <strong>el que entra en la meta</strong>, donde el error "
    + "es \\(-1-w\\), y con \\(w\\) negativo eso es una sorpresa <strong>positiva</strong> y grande. "
    + "Ese paso es <em>derecha</em> en la tercera celda… y como las tres celdas comparten política, "
    + "refuerza <em>derecha</em> <strong>en todas</strong>, incluida la del medio, donde "
    + "<em>derecha</em> te lleva hacia atrás. La actualización esperada apunta a \\(p = 1\\) para "
    + "cualquier \\(p\\), y \\(J(1) = -\\infty\\). <em>(Derivación de esta página; el libro no "
    + "analiza este entorno con actor-crítico.)</em>"));

  /* --- paneles --- */

  aviso(zonaPaneles, t("t5b.m5.panelFrase",
    "La frase completa, que es la más importante del tema y no está en ninguna diapositiva: «Aunque "
    + "el método REINFORCE con línea base aprende a la vez una política y una función de valor, "
    + "<strong>no lo consideramos un método actor-crítico, porque su función de valor se usa solo "
    + "como línea base y no como crítico</strong>. Es decir, no se usa para hacer <em>bootstrap</em> "
    + "[…]. Es una distinción útil, porque <strong>solo a través del <em>bootstrap</em> introducimos "
    + "sesgo y una dependencia asintótica de la calidad de la aproximación de funciones</strong>.» "
    + "(Sutton &amp; Barto, §13.5, p. 353.)"));

  parrafo(zonaPaneles, "explicacion", t("t5b.m5.panelGana",
    "Que en este entorno salga mal no quiere decir que el método sea malo, y conviene no llevarse "
    + "esa conclusión. El actor-crítico gana dos cosas reales que aquí no se ven porque el pasillo es "
    + "diminuto: es <strong>totalmente en línea e incremental</strong> —actualiza en cada paso, no "
    + "espera al final del episodio, y por eso vale también para tareas continuadas— y su objetivo a "
    + "un paso tiene <strong>mucha menos varianza</strong> que un retorno completo. Lo que este "
    + "módulo muestra es lo que <strong>paga</strong> por eso, y que el precio lo fija el crítico: "
    + "con un peso por estado, la misma actualización lleva la política al mismo sitio que REINFORCE "
    + "con línea base."));

  /* Resumido a lo que este módulo añade —cuál de los dos se ejecuta y por
     qué— con enlace al bloque, que es donde están enfrentados enteros. Antes
     repetía el bloque casi literalmente. */
  aviso(zonaPaneles, t("t5b.m5.panelVersiones",
    "⚠ <strong>Hay dos pseudocódigos distintos de actor-crítico en el material y ninguna baraja "
    + "avisa.</strong> Los tienes enfrentados en <a href=\"#b9\">Actor-crítico</a>, con sus seis "
    + "diferencias. <strong>Lo que se ejecuta aquí es el del libro</strong> (recuadro de la p. 354), "
    + "por tres razones que también están allí; la de peso en este módulo es que el del "
    + "<code>#slide-17</code> <strong>no dice qué hacer al llegar al estado terminal</strong>, y en "
    + "este pasillo esa es la única transición que lleva información."));

  /* ⚠ El guion escribe aquí «la variante que se destruye no corta ni uno» y
     «unos 104 pasos», y esas dos cifras son de R5-8, medidas con α^w = 2⁻⁶.
     Con el α^w = 2⁻⁴ que el propio guion fijó después como valor por omisión
     (§D0.6) salen 3 episodios cortados de 25 000 y unos 147 pasos. Se escribe
     lo medido, DECLARANDO la configuración, y se reporta la discrepancia: la
     conclusión —que lo que se ve es el algoritmo y no el tope— no cambia. */
  aviso(zonaPaneles, t("t5b.m5.panelTope",
    "El tope por episodio es de <strong>1000 pasos</strong>, por si la política se va a un extremo "
    + "y el episodio no acaba nunca. El contador de arriba dice cuántos se han cortado —y cambia con "
    + "los controles—, pero la respuesta interesante ya se ve con los valores por omisión: "
    + "<strong>la variante que se destruye casi no corta ninguno</strong>. Con «los dos», crítico de "
    + "un solo número y \\(\\alpha^{w} = 2^{-4}\\), son <strong>3 episodios de 25.000</strong>: el "
    + "actor-crítico no llega a \\(p = 1\\), se para en torno a <strong>0,98</strong> y sus episodios "
    + "duran del orden de <strong>ciento cincuenta pasos</strong> —malísimo comparado con los 11,7 "
    + "del óptimo, pero muy lejos del tope—. <strong>Lo que ves en la curva es el algoritmo, no el "
    + "tope.</strong>"));

  parrafo(zonaPaneles, "suave", t("t5b.m5.notaWcero",
    "Un detalle bonito del arranque, y conviene no confundirlo con la tabla: las cuatro filas de "
    + "arriba se evalúan en el <strong>punto fijo</strong> de \\(w\\), que es a donde llega el "
    + "crítico; pero el algoritmo <strong>empieza</strong> en \\(w_0 = 0\\). Y con \\(w = 0\\) "
    + "exactamente, la actualización esperada del actor en la variante de crítico —que vale "
    + "\\((1-p)(-w)\\)— es <strong>cero</strong>: el algoritmo no se mueve hasta que \\(w\\) baja."));
  /**
   * El aviso de la casilla que el valor por omisión esquiva.
   *
   * El α^w por omisión es 2⁻⁴ y no el 2⁻⁶ de la Figura 13.2 porque con 2⁻⁶ la
   * combinación «línea base + uno por estado» se rompe. Pero esa casilla está
   * a dos clics, así que cuando el alumno llega a ella la página le dice qué
   * está viendo: no es un fallo, es la otra mitad de la lección — un
   * aproximador demasiado lento también hace daño, y por una razón distinta de
   * la del *bootstrap*.
   */
  const panelCritLento = aviso(zonaPaneles, t("t5b.m5.panelCriticoLento",
    "⚠ <strong>Estás en la casilla que el valor por omisión esquiva, y merece una explicación.</strong> "
    + "Con un \\(\\alpha^{w}\\) pequeño el valor aprende <strong>demasiado despacio</strong> para el "
    + "\\(\\alpha^\\theta = 2^{-9}\\) de la política: la línea base llega tarde, no recorta la "
    + "varianza a tiempo y el ruido se lleva la política a un extremo. Con \\(\\alpha^{w} = 2^{-6}\\) "
    + "y un peso por estado son <strong>8 de 50 ejecuciones colapsadas</strong> y \\(G_0 = "
    + "-170{,}60\\); con \\(2^{-8}\\), \\(-288{,}95\\) con un solo número y \\(-446{,}86\\) con uno "
    + "por estado. <strong>Esto también es una lección, no un fallo</strong>, y es distinta de la del "
    + "módulo: allí lo que hace daño es el <em>bootstrap</em> con un crítico incapaz; aquí, un "
    + "aproximador capaz pero <strong>lento</strong>. Sube \\(\\alpha^{w}\\) a \\(2^{-4}\\) y las tres "
    + "casillas que deben llegar llegan a \\(2-\\sqrt2\\)."));

  parrafo(zonaPaneles, "suave", t("t5b.m5.notaEjecuciones",
    "Son <strong>50</strong> ejecuciones y no las 100 del libro porque los episodios de la variante "
    + "que colapsa son larguísimos. Va rotulado en la gráfica."));
  const notaCortada = aviso(zonaPaneles, "");

  /* --- lectura --- */

  zonaLectura.classList.add("siempre");
  zonaLectura.innerHTML = t("t5b.m5.lectura1",
    "Lo que separa REINFORCE con línea base del actor-crítico no es aprender un valor: es "
    + "<strong>usarlo para hacer <em>bootstrap</em></strong>. Con línea base, el valor solo se resta, "
    + "y la actualización esperada sigue siendo exactamente \\(\\nabla J(\\theta)\\) sea cual sea el "
    + "número aprendido.");
  renderizarMatematicas(zonaLectura);
  const lectura2 = document.createElement("p");
  lectura2.className = "explicacion siempre";
  lectura2.innerHTML = t("t5b.m5.lectura2",
    "Con <em>bootstrap</em>, en cambio, <strong>el sesgo depende de la calidad del crítico</strong>: "
    + "con un solo número para tres estados de valor muy distinto, la actualización esperada apunta a "
    + "\\(p = 1\\) para cualquier \\(p\\) y la política se destruye; con un peso por estado, vuelve a "
    + "ser \\(\\nabla J(\\theta)\\) y la política llega a \\(2-\\sqrt2\\).");
  zonaLectura.after(lectura2);
  renderizarMatematicas(lectura2);

  /* --- cálculo --- */

  function pedir() {
    arrancado = true;
    sincronizar();
    dibujar();
    const c = clave();
    if (cache.has(c) || enMarcha.has(c)) return;
    enMarcha.add(c);
    error = null;
    progreso.fijar(0);
    calcularTanda({
      entorno: "pasilloCorto", algoritmo: variantes(),
      episodios: EPISODIOS_M5, ejecuciones: EJECUCIONES_M5, semilla: semillaActual(),
      p0: P0, alphaTheta: ALPHA_THETA_M5, alphaW: 2 ** -expW,
      maxPasos: TOPE_M5, w0: 0, capacidad,
    }, (fraccion) => progreso.fijar(fraccion))
      .then((resultado) => {
        cache.set(c, resultado);
        enMarcha.delete(c);
        dibujar();
      })
      .catch((e) => {
        error = e.message;
        enMarcha.delete(c);
        dibujar();
      });
  }
  const datos = () => cache.get(clave()) || null;

  /* --- dibujo --- */

  /** Las series presentes, con su color fijo por variante. */
  function seriesDe(sufijo) {
    const d = datos();
    const salida = [];
    if (variantes().includes("lineaBase")) {
      salida.push({
        nombre: t("t5b.m5.serieBase", "línea base"),
        color: tono(COLORES_SERIE[2]),
        y: d ? d.curvas[`lineaBase.${sufijo}`] : [],
      });
    }
    if (variantes().includes("actorCritico")) {
      salida.push({
        nombre: t("t5b.m5.serieCritico", "crítico"),
        color: tono(COLORES_SERIE[1]),
        y: d ? d.curvas[`actorCritico.${sufijo}`] : [],
      });
    }
    return salida;
  }

  const ticksM5 = [1, 100, 200, 300, 400, 500].map((v) => ({ valor: v, etiqueta: String(v) }));

  function dibujarViz1() {
    const series = seriesDe("G0");
    if (!series.some((s) => s.y.length)) {
      vacia(viz1.cuerpo, error
        ? t("t5b.m5.error", "El cálculo ha fallado: {m}", { m: error })
        : t("t5b.m5.viz1vacio", "Pulsa <strong>Calcular</strong> para lanzar la tanda."));
    } else {
      /* Suelo de −200 (el del guion, más bajo que en los módulos 3 y 4 porque
         una de las variantes empeora); si alguna combinación de α^w y capacidad
         se va más abajo, lo estira `graficaLineas`. */
      pintar(viz1.cuerpo, graficaLineas(series, {
        ancho: 660, alto: 320,
        ejeX: t("t5b.m5.viz1x", "Episodio"),
        ejeY: t("t5b.m5.viz1y", "G₀: retorno total del episodio"),
        yMin: -200, yMax: -5, ticksX: ticksM5,
        formatoY: (v) => num(v, 0),
        anotacionesY: [
          { y: V_ESTRELLA, texto: t("t5b.m5.anotVestrella", "v*(s₀)") },
          { y: J_INICIAL, texto: t("t5b.m5.anotInicio", "política inicial") },
        ],
      }));
      conLeyenda(viz1.cuerpo, series);
    }
    fijarPie(viz1.pie, t("t5b.m5.viz1runs",
      "Media de 50 ejecuciones · \\(\\alpha^\\theta = 2^{-9}\\) · <strong>misma semilla para las "
      + "dos curvas</strong> · semilla {s}", { s: semillaActual() }));
    ver(progreso.caja, enMarcha.size > 0);
  }

  function dibujarViz2() {
    const series = seriesDe("p");
    if (!series.some((s) => s.y.length)) {
      vacia(viz2.cuerpo, t("t5b.m5.viz2vacio", "Lanza la tanda para ver a dónde va \\(p\\)."));
      fijarPie(viz2.pie, "");
      return;
    }
    pintar(viz2.cuerpo, graficaLineas(series, {
      ancho: 660, alto: 320,
      ejeX: t("t5b.m5.viz2x", "Episodio"),
      ejeY: t("t5b.m5.viz2y", "p = π(derecha | s, θ)"),
      yMin: 0, yMax: 1, ticksX: ticksM5,
      formatoY: (v) => num(v, 2),
      anotacionesY: [{ y: P_ESTRELLA, texto: t("t5b.m5.anotPestrella", "p* = 2−√2") }],
    }));
    conLeyenda(viz2.cuerpo, series);
    fijarPie(viz2.pie, t("t5b.m5.viz2runs", "Media de 50 ejecuciones · semilla {s}",
      { s: semillaActual() }));
  }

  /**
   * Las cuatro filas del panel exacto, en forma cerrada.
   *
   * `actualizacionEsperada` devuelve el incremento esperado por episodio SIN
   * α^θ: es lo único compatible a la vez con las aserciones de la línea base
   * (donde el valor esperado es ∇J(θ) a secas) y con las del crítico.
   */
  function dibujarTabla() {
    const theta = thetaDeP(entorno, P0);
    const v = valoresExactos(entorno, P0);
    const vPorEstado = Float64Array.from(v.v);
    const filas = [
      { etiqueta: t("t5b.m5.filaBase", "línea base"), d: 1, uso: "lineaBase", w: null },
      { etiqueta: t("t5b.m5.filaBase", "línea base"), d: 3, uso: "lineaBase", w: vPorEstado },
      { etiqueta: `<strong>${t("t5b.m5.filaCritico", "crítico")}</strong>`, d: 1,
        uso: "critico", w: null, destacada: true },
      { etiqueta: t("t5b.m5.filaCritico", "crítico"), d: 3, uso: "critico", w: vPorEstado },
    ];
    tablaExacta.actualizar(filas.map((fila) => {
      const r = actualizacionEsperada(entorno, theta, { uso: fila.uso, w: fila.w });
      const puntoFijo = (fila.uso === "critico" && fila.d === 1)
        ? `<strong>${t("t5b.m5.sinPuntoFijo", "ninguno: \\(p\\to1\\)")}</strong>`
        : t("t5b.m5.conPuntoFijo", "\\(p^\\star = 2-\\sqrt2\\)");
      const w = typeof r.wPuntoFijo === "number"
        ? `\\(${numMat(r.wPuntoFijo, 2)}\\)`
        : vectorMat(r.wPuntoFijo, 2);
      return {
        destacada: fila.destacada,
        celdas: [fila.etiqueta, String(fila.d), w, vectorMat(r.deltaTheta, 4), puntoFijo],
      };
    }));
  }

  function dibujarMetricas() {
    const d = datos();
    const conBase = variantes().includes("lineaBase");
    const conCritico = variantes().includes("actorCritico");
    const cifra = (hay, valor) => (d && hay ? valor() : "—");
    fijarCifra(cifras.finalBase, cifra(conBase,
      () => `\\(${numMat(mediaFinal(d.curvas["lineaBase.G0"], 50), 2)}\\)`));
    fijarCifra(cifras.finalCritico, cifra(conCritico,
      () => `\\(${numMat(mediaFinal(d.curvas["actorCritico.G0"], 50), 2)}\\)`));
    fijarCifra(cifras.pBase, cifra(conBase,
      () => `\\(${numMat(media(d.porEjecucion.lineaBase.pFinal), 4)}\\)`));
    fijarCifra(cifras.pCritico, cifra(conCritico,
      () => `\\(${numMat(media(d.porEjecucion.actorCritico.pFinal), 4)}\\)`));
    if (!d) {
      fijarCifra(cifras.truncados, "—");
      fijarCifra(cifras["truncados$glosa"], "");
      return;
    }
    const partes = variantes().map((v) => `${v === "lineaBase"
      ? t("t5b.m5.serieBase", "línea base")
      : t("t5b.m5.serieCritico", "crítico")}: ${num(d.truncados[v], 0)}`);
    fijarCifra(cifras.truncados, partes.join(" · "));
    fijarCifra(cifras["truncados$glosa"], t("t5b.m5.truncGlosa", "de {n} episodios por variante",
      { n: num(EPISODIOS_M5 * EJECUCIONES_M5, 0) }));
  }

  function sincronizar() {
    /* Las combinaciones medidas como rotas (⚑ del guion, §5 del módulo 5): la
       línea base con un aproximador que no llega a tiempo. Se avisa en cuanto
       el alumno entra en ellas, no solo cuando se rompe la curva. */
    const critLento = variantes().includes("lineaBase")
      && (expW === 8 || (expW === 6 && capacidad === "porEstado"));
    ver(panelCritLento, critLento);
    const d = datos();
    let cortadas = 0;
    if (d) for (const v of variantes()) cortadas += d.cortadas[v] || 0;
    if (cortadas > 0) {
      notaCortada.innerHTML = t("t5b.m5.cortada",
        "{n} ejecuciones cortadas por desbordamiento.", { n: cortadas });
      renderizarMatematicas(notaCortada);
    }
    ver(notaCortada, cortadas > 0);
  }

  function dibujar() {
    sincronizar();
    dibujarViz1();
    dibujarViz2();
    dibujarMetricas();
  }

  oyentesSemilla.push(() => { cache.clear(); if (arrancado) pedir(); });
  repintadores.push(dibujar);
  sincronizar();
  dibujarTabla();
  alEntrarEnPantalla($("#m5"), pedir);

  crearQuiz($("#m5-quiz"), [
    {
      enunciado: "¿Qué distingue exactamente a un método actor-crítico de REINFORCE con línea base?",
      opciones: [
        "Que usa la función de valor para hacer <em>bootstrap</em>, es decir, como parte del "
        + "objetivo, y no solo como referencia que se resta.",
        "Que aprende una función de valor además de la política; REINFORCE con línea base solo "
        + "aprende la política.",
        "Que actualiza la política en cada paso en vez de al final del episodio, mientras que el "
        + "resto del algoritmo es idéntico.",
        "Que usa la función de ventaja \\(A(s,a)\\) en lugar del retorno, lo cual reduce la varianza "
        + "sin introducir sesgo.",
      ],
      correcta: 0,
      explicacion: "El libro lo dice con todas las letras: REINFORCE con línea base <strong>no</strong> "
        + "es actor-crítico, y no lo es aunque aprenda una función de valor, porque esa función se usa "
        + "solo como línea base. El criterio es el <em>bootstrap</em>, y con él llega el sesgo. Que "
        + "actualice en cada paso es una <strong>consecuencia</strong> de hacer <em>bootstrap</em> —al "
        + "no necesitar el retorno completo, ya no hay que esperar—, no la definición. Y las dos "
        + "variantes usan una estimación de la ventaja: el factor \\(G_t - \\hat v(S_t,w)\\) también lo "
        + "es, solo que de Monte Carlo; lo que cambia es que la del actor-crítico está sesgada.",
    },
    {
      enunciado: "En este pasillo, con \\(\\hat v(s,w) = w\\) —un solo número para los tres "
        + "estados—, ¿por qué el actor-crítico empuja la política hacia ir siempre a la derecha?",
      opciones: [
        "Porque con un valor constante casi todos los errores TD valen \\(-1\\) y no aportan nada; "
        + "el único informativo es el paso que entra en la meta, que refuerza <em>derecha</em> en las "
        + "tres celdas a la vez.",
        "Porque el crítico sobreestima el valor de la tercera celda y eso hace que la política "
        + "prefiera acercarse a ella.",
        "Porque el paso del crítico \\(\\alpha^{w}\\) es mayor que el de la política y el crítico "
        + "arrastra al actor.",
        "Porque con \\(\\gamma = 1\\) el acumulador \\(I\\) crece y amplifica las actualizaciones "
        + "tardías del episodio.",
      ],
      correcta: 0,
      explicacion: "Con un valor constante, \\(\\delta = -1 + w - w = -1\\) en toda transición que no "
        + "termine, y un \\(\\delta\\) igual para las dos acciones no mueve nada, porque "
        + "\\(\\sum_a\\nabla\\pi(a\\mid s,\\theta) = 0\\). El único paso distinto es el que entra en la "
        + "meta, donde \\(\\delta = -1-w\\); con \\(w\\) negativo eso es una sorpresa grande y positiva "
        + "que refuerza <em>derecha</em>, y como las tres celdas comparten política, la refuerza también "
        + "en la del medio, donde <em>derecha</em> va hacia atrás. El crítico no sobreestima ninguna "
        + "celda en particular: da el mismo número a las tres, y ese es el problema. Bajar "
        + "\\(\\alpha^{w}\\) no cambia el signo del empuje, solo su tamaño. Y con \\(\\gamma = 1\\) el "
        + "acumulador \\(I\\) vale <strong>1</strong> siempre: no amplifica nada.",
    },
    {
      enunciado: "Al pasar el aproximador de un solo número a un peso por estado, el actor-crítico "
        + "pasa a converger al mismo sitio que REINFORCE con línea base. ¿Qué muestra eso?",
      opciones: [
        "Que el sesgo del <em>bootstrap</em> no es fijo: depende de la calidad del crítico, y con un "
        + "crítico capaz de representar \\(v_\\pi\\) desaparece.",
        "Que el <em>bootstrap</em> nunca introduce sesgo si el paso del crítico es suficientemente "
        + "pequeño.",
        "Que el problema no era el <em>bootstrap</em> sino el número de parámetros de la política, "
        + "que con tres pesos ya distingue los estados.",
        "Que actor-crítico y REINFORCE con línea base son el mismo algoritmo escrito de dos maneras.",
      ],
      correcta: 0,
      explicacion: "Es la segunda mitad de la frase del libro: el <em>bootstrap</em> introduce sesgo "
        + "<strong>y una dependencia asintótica de la calidad de la aproximación</strong>. Con tres "
        + "pesos, el crítico puede representar \\(v_\\pi\\) exactamente, el error TD esperado pasa a ser "
        + "la ventaja verdadera y la actualización esperada vuelve a ser \\(\\nabla J(\\theta)\\). El "
        + "tamaño del paso del crítico no tiene nada que ver: con un solo número, el punto fijo está "
        + "donde está por pequeño que sea \\(\\alpha^{w}\\). La política <strong>no</strong> ha "
        + "cambiado: sigue teniendo dos parámetros y sigue sin distinguir los estados — de hecho las dos "
        + "variantes convergen a \\(2-\\sqrt2\\), que es el óptimo <strong>con</strong> "
        + "<em>aliasing</em>. Y no son el mismo algoritmo: uno espera al final del episodio y el otro "
        + "no.",
    },
  ], { claves: "t5b.m5.quiz" });
}

/* ======================================================================= *
 * MÓDULO 6 — El colapso de la política, y el freno
 *
 * Parámetro → curva con traza inspeccionable: se dibujan las VEINTE
 * ejecuciones una a una, porque el colapso le pasa a una ejecución concreta y
 * una media lo taparía.
 *
 * ⚠ Aquí el incremento del episodio se ACUMULA y se aplica de una vez, a
 * diferencia del módulo 3. Hace falta para poder medir el salto, y el motor
 * exige `acumularEpisodio: true` para admitir el freno. Está declarado en
 * pantalla, con su dirección y su tamaño (un factor ocho en el paso).
 * ======================================================================= */

const EPISODIOS_M6 = 300;
const EJECUCIONES_M6 = 20;
const TOPE_M6 = 1000;
/** Las ocho posiciones del deslizador: exponentes de α^θ = 2^−k. */
const ALFAS_M6 = [14, 13, 12, 11, 10, 9, 8, 7];

/** Dígitos en superíndice Unicode, para el rótulo del deslizador. */
const SUPERINDICE = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

/**
 * Potencia de dos negativa, escrita entera en superíndice.
 *
 * El rótulo de un deslizador no pasa por KaTeX, así que hay que componerlo con
 * caracteres: sin esto salía «2⁻7», con el menos en superíndice y el exponente
 * en la línea base.
 */
const potenciaDeDos = (k) => `2⁻${String(k).split("").map((c) => SUPERINDICE[+c]).join("")}`;

function modulo6() {
  const zonaControles = $("#m6-controles");
  const zonaViz1 = $("#m6-viz1");
  const zonaViz2 = $("#m6-viz2");
  const zonaTabla = $("#m6-tabla");
  const zonaMetricas = $("#m6-metricas");
  const zonaPaneles = $("#m6-paneles");
  const zonaLectura = $("#m6-lectura");

  const entorno = pasilloCorto({});

  /* --- estado del módulo --- */
  let iAlfa = ALFAS_M6.indexOf(7);      // ⚑ del motor: con 2⁻⁹ no colapsa ninguna
  let conFreno = false;
  let iDelta = 20;                      // δ = 10^(−4 + i/10) → i = 20 es 10⁻²
  const alfa = () => 2 ** -ALFAS_M6[iAlfa];
  const delta = () => 10 ** (-4 + iDelta / 10);

  const cache = new Map();
  const enMarcha = new Set();
  let error = null;
  let arrancado = false;
  const clave = () => `${semillaActual()}|${ALFAS_M6[iAlfa]}|${conFreno ? delta() : "-"}`;

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  const mandoAlfa = controlDeslizador(panel, {
    etiqueta: t("t5b.m6.alphaLabel", "Paso de la política (\\(\\alpha^\\theta\\))"),
    min: 0, max: ALFAS_M6.length - 1, paso: 1, valor: iAlfa,
    formato: (v) => potenciaDeDos(ALFAS_M6[v]),
    alCambiar: (v) => { iAlfa = v; pedir(); },
  });
  const mandoFreno = grupoRadio(panel, t("t5b.m6.frenoLabel", "Freno"), [
    { valor: "ninguno", texto: t("t5b.m6.frenoNinguno", "ninguno") },
    { valor: "region", texto: t("t5b.m6.frenoRegion",
      "región de confianza \\(D_{KL} \\le \\delta\\)") },
  ], "ninguno", (v) => { conFreno = v === "region"; pedir(); });
  const mandoDelta = controlDeslizador(panel, {
    etiqueta: t("t5b.m6.deltaLabel", "Límite \\(\\delta\\)"),
    min: 0, max: 30, paso: 1, valor: iDelta,
    formato: (v) => num(10 ** (-4 + v / 10), 5),
    alCambiar: (v) => { iDelta = v; if (conFreno) pedir(); else sincronizar(); },
  });
  botonControl(panel, t("t5b.m6.calcular", "Calcular"), () => pedir());
  botonControl(panel, t("t5b.m6.reiniciar", "Valores por omisión"), () => {
    iAlfa = ALFAS_M6.indexOf(7); conFreno = false; iDelta = 20;
    mandoAlfa.fijar(iAlfa); mandoFreno.marcar("ninguno"); mandoDelta.fijar(iDelta);
    pedir();
  });

  parrafo(zonaControles, "suave", t("t5b.m6.notaSemilla",
    "Con y sin freno se comparte la semilla, <strong>no la trayectoria</strong>: en cuanto el freno "
    + "recorta un paso, las políticas divergen y los episodios ya no son los mismos."));

  /* --- visualizaciones y métricas --- */

  const viz1 = caja(zonaViz1, t("t5b.m6.viz1", "La política, ejecución a ejecución"),
    { conPie: true });
  vacia(viz1.cuerpo, t("t5b.m6.viz1vacio",
    "Pulsa <strong>Calcular</strong> para lanzar las ejecuciones."));
  const progreso = barraProgreso(viz1.caja);
  const viz2 = caja(zonaViz2, t("t5b.m6.viz2", "Retorno medio por episodio"), { conPie: true });
  vacia(viz2.cuerpo, t("t5b.m6.viz2vacio", "Lanza la tanda para ver el rendimiento."));

  const cifras = metricas(zonaMetricas, [
    { id: "colapsadas", etiqueta: t("t5b.m6.mColapsadas", "Ejecuciones colapsadas"),
      glosa: t("t5b.m6.mColapsadasGlosa",
        "colapsada = termina con \\(p \\ge 0{,}95\\) o \\(p \\le 0{,}05\\), las dos políticas "
        + "\\(\\varepsilon\\)-<em>greedy</em> que marca el libro") },
    { id: "final", etiqueta: t("t5b.m6.mFinal",
      "\\(G_0\\) medio de los últimos 30 episodios") },
    { id: "salto", etiqueta: t("t5b.m6.mSaltoMax",
      "Mayor salto de \\(p\\) en una sola actualización") },
    { id: "kl", etiqueta: t("t5b.m6.mKLmax",
      "Mayor \\(D_{KL}\\) de una sola actualización") },
    { id: "recortes", etiqueta: t("t5b.m6.mRecortes",
      "Actualizaciones recortadas por el freno") },
  ]);

  /* --- panel del bucle --- */

  parrafo(zonaTabla, "explicacion", t("t5b.m6.panelBucleIntro",
    "El bucle, con números. Se calcula con la \\(p\\) en la que está ahora la ejecución destacada "
    + "—o con \\(p_0\\) si todavía no has calculado— y con el paso que has elegido."));
  const tablaBucle = tablaDatos(zonaTabla, {
    cabecera: [t("t5b.m6.colMagnitud", "Magnitud"), t("t5b.m6.colValor", "Valor")],
  });
  parrafo(zonaTabla, "explicacion", t("t5b.m6.panelBucleNota",
    "La última fila es la que asusta. Un solo episodio, con el paso que has elegido, puede mover la "
    + "política de donde está hasta ahí. Y si acaba cerca de un extremo, el episodio siguiente será "
    + "mucho más largo, y el salto siguiente, mucho mayor."));

  /* --- paneles --- */

  parrafo(zonaPaneles, "explicacion", t("t5b.m6.panelFreno",
    "El freno es la idea de <code>5_Tema_5_2#slide-19</code> puesta a funcionar. Se calcula el paso "
    + "que pide REINFORCE y, antes de aplicarlo, se mide <strong>cuánto movería la política</strong> "
    + "con la divergencia de Kullback-Leibler entre la política de antes y la de después. Si se pasa "
    + "del límite \\(\\delta\\), el paso <strong>se recorta</strong> —se multiplica por el mayor "
    + "factor \\(\\tau\\le1\\) que quepa— y se aplica recortado. El aprendizaje sigue, solo que ya no "
    + "puede dar un salto que se lleve la política por delante. Esto es, en una línea, lo que el "
    + "examen llama <strong>estrategia de región de confianza</strong>, y es la idea que sostiene "
    + "TRPO y PPO."));

  /* Resumido: el desarrollo entero está en B11 y repetirlo aquí eran doscientas
     palabras idénticas. Se deja lo que hace falta para entender qué botón se
     está pulsando. */
  aviso(zonaPaneles, t("t5b.m6.panelPenalizacion",
    "⚠ <strong>La diapositiva propone la idea en otra forma</strong> —un objetivo \\(J - \\eta_{KL} "
    + "D_{KL}\\), al estilo de la regularización L2— y <strong>con un solo paso de gradiente por lote "
    + "esa forma no hace nada</strong>: el porqué está en <a href=\"#b11\">Limitar el salto de la "
    + "política</a>. Lo que corre bajo este botón es la otra cara de la misma idea, la de "
    + "<strong>región</strong>: se calcula el paso y, si mueve la política más de \\(\\delta\\), se "
    + "recorta hasta que quepa. <em>(La observación sobre la penalización es de esta página, no del "
    + "material.)</em>"));

  const panelKL = document.createElement("div");
  panelKL.className = "aviso";
  panelKL.style.margin = ".6rem 0";
  panelKL.innerHTML = `${t("t5b.m6.panelKL",
    "Y una cosa que la diapositiva no dice: entre qué dos distribuciones se calcula. En general hay "
    + "que promediar sobre los estados con \\(\\mu(s)\\); <strong>en este pasillo eso no hace "
    + "falta</strong>, porque las tres celdas comparten política y la divergencia es la misma en las "
    + "tres. Con dos acciones es esto:")
  }<p class="ecuacion">\\[ D_{KL} = p_{\\text{ant}}\\ln\\frac{p_{\\text{ant}}}{p} + (1-p_{\\text{ant}})\\ln\\frac{1-p_{\\text{ant}}}{1-p} \\]</p>`;
  zonaPaneles.appendChild(panelKL);
  renderizarMatematicas(panelKL);

  aviso(zonaPaneles, t("t5b.m6.panelAlcance",
    "<strong>Sutton &amp; Barto no cubre nada de este módulo.</strong> El capítulo 13 no discute el "
    + "colapso de la política por un paso demasiado grande, ni la regularización por divergencia KL, "
    + "ni TRPO, ni PPO; lo único que hay es una cita bibliográfica sobre regularización por entropía. "
    + "Lo que se ve aquí es la advertencia de <code>5_Tema_5_2#slide-18</code> convertida en un "
    + "experimento reproducible sobre el entorno del libro, <strong>y el experimento es de esta "
    + "página</strong>."));

  aviso(zonaPaneles, t("t5b.m6.panelTope",
    "Los episodios se cortan a <strong>1000 pasos</strong>. Con la política cerca de un extremo el "
    + "episodio puede no terminar nunca, y hace falta un tope para que el cálculo acabe. Al cortar, "
    + "el retorno se calcula sobre los pasos dados, así que <strong>el colapso se ve más suave de lo "
    + "que es</strong>: sin tope, los retornos serían mucho peores y los saltos, mayores. <strong>La "
    + "simplificación juega en contra de lo que este módulo quiere enseñar, no a favor.</strong>"));

  aviso(zonaPaneles, t("t5b.m6.notaAcumulado",
    "A diferencia del módulo 3, aquí el incremento del episodio se acumula y se aplica de una sola "
    + "vez, con \\(\\nabla\\ln\\pi\\) evaluado en la política <strong>anterior</strong>. Hace falta "
    + "para poder medir el salto. ⚠ <strong>Y la diferencia con el orden del libro no es pequeña: es "
    + "de un factor ocho en el paso.</strong> Acumular amortigua —las \\(T\\) actualizaciones dejan de "
    + "realimentarse dentro del episodio—, así que aquí hace falta un \\(\\alpha^\\theta\\) bastante "
    + "mayor para ver lo mismo: el colapso empieza en \\(2^{-8}\\) con este orden y en \\(2^{-11}\\) "
    + "con el del recuadro del libro. <strong>Es la misma diferencia que produce el estancamiento de "
    + "la Figura 13.1</strong>, y está contada en el módulo 3."));

  const notaCortada = aviso(zonaPaneles, "");

  /* --- lectura --- */

  zonaLectura.classList.add("siempre");
  zonaLectura.innerHTML = t("t5b.m6.lectura1",
    "«Un mal movimiento de la política destroza el entrenamiento» <strong>no es una metáfora</strong>: "
    + "en este entorno el salto de una actualización crece con <strong>el cuadrado de la longitud del "
    + "episodio</strong>, y la longitud del episodio crece cuando la política empeora. Un salto malo "
    + "empeora la política, la política alarga los episodios, y los episodios agrandan el salto "
    + "siguiente. El bucle se cierra, y por eso no se corrige solo.");
  renderizarMatematicas(zonaLectura);
  /* La segunda lectura lleva la p final VIVA: depende del deslizador, del
     freno, de δ y de la semilla. Y hay una cosa más que decir, porque es del
     motor y no del algoritmo: este módulo es el único de la página cuyos
     decimales cambian de un motor de JavaScript a otro (el colapso es
     caótico), así que la frase no puede fijar un número. */
  const lectura2 = document.createElement("p");
  lectura2.className = "explicacion siempre";
  zonaLectura.after(lectura2);

  /* --- cálculo --- */

  function pedir() {
    arrancado = true;
    sincronizar();
    dibujar();
    const c = clave();
    if (cache.has(c) || enMarcha.has(c)) return;
    enMarcha.add(c);
    error = null;
    progreso.fijar(0);
    calcularTanda({
      entorno: "pasilloCorto", algoritmo: "reinforce",
      episodios: EPISODIOS_M6, ejecuciones: EJECUCIONES_M6, semilla: semillaActual(),
      p0: P0, alphaTheta: alfa(), maxPasos: TOPE_M6,
      acumularEpisodio: true, freno: conFreno ? { delta: delta() } : null,
    }, (fraccion) => progreso.fijar(fraccion))
      .then((resultado) => {
        cache.set(c, resultado);
        enMarcha.delete(c);
        dibujar();
      })
      .catch((e) => {
        error = e.message;
        enMarcha.delete(c);
        dibujar();
      });
  }
  const datos = () => cache.get(clave()) || null;

  /* --- dibujo --- */

  /** Cuántas trazas se dibujan: en móvil, ocho de veinte, y se dice. */
  const trazas = () => (enMovil() ? 8 : EJECUCIONES_M6);

  function dibujarViz1() {
    const d = datos();
    if (!d) {
      vacia(viz1.cuerpo, error
        ? t("t5b.m6.error", "El cálculo ha fallado: {m}", { m: error })
        : t("t5b.m6.viz1vacio",
          "Pulsa <strong>Calcular</strong> para lanzar las ejecuciones."));
      fijarPie(viz1.pie, "");
      ver(progreso.caja, enMarcha.size > 0);
      return;
    }
    const curvas = d.porEjecucion.reinforce.curvaP;
    const atenuado = conAlfa(tono("--texto-suave"), 0.45);
    const series = [];
    for (let k = trazas() - 1; k >= 1; k--) {
      if (!curvas[k]) continue;
      series.push({ nombre: "", color: atenuado, y: curvas[k], grosor: 1.2 });
    }
    /* La ejecución 0 se dibuja LA ÚLTIMA para que quede encima de las demás. */
    series.push({
      nombre: t("t5b.m6.serieDestacada", "ejecución 0"),
      color: tono("--acento"), y: curvas[0], grosor: 2.6,
    });
    pintar(viz1.cuerpo, graficaLineas(series, {
      ancho: 660, alto: 340,
      ejeX: t("t5b.m6.viz1x", "Episodio"),
      ejeY: t("t5b.m6.viz1y", "p = π(derecha | s, θ)"),
      yMin: 0, yMax: 1,
      ticksX: [1, 60, 120, 180, 240, 300].map((v) => ({ valor: v, etiqueta: String(v) })),
      formatoY: (v) => num(v, 2),
      anotacionesY: [
        { y: P_ESTRELLA, texto: t("t5b.m6.anotOptimo", "p*") },
        { y: UMBRAL_COLAPSO.alto, texto: t("t5b.m6.anotArriba", "ε-greedy derecha"),
          color: tono("--peligro") },
        { y: UMBRAL_COLAPSO.bajo, texto: t("t5b.m6.anotAbajo", "ε-greedy izquierda"),
          color: tono("--peligro") },
      ],
    }));
    conLeyenda(viz1.cuerpo, [
      { nombre: t("t5b.m6.serieDestacada", "ejecución 0"), color: tono("--acento") },
      { nombre: t("t5b.m6.serieResto", "las demás ejecuciones"), color: atenuado },
    ]);
    fijarPie(viz1.pie, t("t5b.m6.viz1runs",
      "{n} ejecuciones <strong>sin promediar</strong> · semilla {s}",
      { n: trazas(), s: semillaActual() }));
    ver(progreso.caja, enMarcha.size > 0);
  }

  function dibujarViz2() {
    const d = datos();
    if (!d) {
      vacia(viz2.cuerpo, t("t5b.m6.viz2vacio", "Lanza la tanda para ver el rendimiento."));
      fijarPie(viz2.pie, "");
      return;
    }
    const series = [{
      nombre: t("t5b.m6.serieMedia", "media de las 20"),
      color: tono(COLORES_SERIE[0]), y: d.curvas["reinforce.G0"], grosor: 2.2,
    }];
    /* Suelo de −300, el del guion; con el paso por omisión la media baja de
       −380 y lo estira `graficaLineas`. Nunca sube de −300, para que con y sin
       freno se comparen sobre el mismo mínimo de referencia. */
    pintar(viz2.cuerpo, graficaLineas(series, {
      ancho: 660, alto: 300,
      ejeX: t("t5b.m6.viz2x", "Episodio"),
      ejeY: t("t5b.m6.viz2y", "G₀: retorno total del episodio"),
      yMin: -300, yMax: -5,
      ticksX: [1, 60, 120, 180, 240, 300].map((v) => ({ valor: v, etiqueta: String(v) })),
      formatoY: (v) => num(v, 0),
      anotacionesY: [
        { y: V_ESTRELLA, texto: t("t5b.m6.anotVestrella", "v*(s₀)") },
        { y: J_INICIAL, texto: t("t5b.m6.anotInicio", "política inicial") },
      ],
    }));
    conLeyenda(viz2.cuerpo, series);
    fijarPie(viz2.pie, t("t5b.m6.viz2runs",
      "Media de las {n} ejecuciones · semilla {s}", { n: EJECUCIONES_M6, s: semillaActual() }));
  }

  /**
   * El panel del bucle, con la p en la que está la ejecución destacada.
   *
   * La cota es la del §6 del guion, exacta: con γ = 1 y r = −1, Σ|G_t| =
   * T(T+1)/2 y ‖∇ln π‖ ≤ √2, luego ‖Δθ‖ ≤ α√2·T(T+1)/2. Un salto de ese
   * tamaño en la dirección [1,−1] mueve la diferencia de preferencias en
   * α·T(T+1), y de ahí sale la p de la última fila.
   */
  function dibujarTabla() {
    const d = datos();
    const curva = d ? d.porEjecucion.reinforce.curvaP[0] : null;
    const pActual = curva && curva.length ? curva[curva.length - 1] : P0;
    const j = J(entorno, pActual);
    const T = -j;
    const cota = alfa() * Math.SQRT2 * (T * (T + 1)) / 2;
    const z = Math.log(pActual / (1 - pActual));
    const pSalto = 1 / (1 + Math.exp(-(z + alfa() * T * (T + 1))));
    tablaBucle.actualizar([
      [t("t5b.m6.filaP", "\\(p\\) actual de la ejecución destacada"),
        `\\(${numMat(pActual, 4)}\\)`],
      [t("t5b.m6.filaJ", "\\(J(p)\\)"), `\\(${numMat(j, 2)}\\)`],
      [t("t5b.m6.filaT", "Longitud esperada del episodio, \\(-J(p)\\)"), `\\(${numMat(T, 2)}\\)`],
      [t("t5b.m6.filaCota",
        "Cota del salto de un episodio de esa longitud, "
        + "\\(\\alpha^\\theta\\sqrt2\\,T(T+1)/2\\)"),
      `\\(${numMat(cota, 3)}\\)`],
      { destacada: true,
        celdas: [t("t5b.m6.filaPsalto",
          "\\(p\\) que resultaría de un salto de ese tamaño hacia la derecha"),
        `<strong>\\(${numMat(pSalto, 4)}\\)</strong>`] },
    ]);
  }

  function dibujarMetricas() {
    const d = datos();
    if (!d) {
      for (const id of ["colapsadas", "final", "salto", "kl", "recortes"]) {
        fijarCifra(cifras[id], "—");
      }
      return;
    }
    fijarCifra(cifras.colapsadas, t("t5b.m6.deVeinte", "{n} de {total}",
      { n: d.colapsadas.reinforce, total: EJECUCIONES_M6 }));
    fijarCifra(cifras.final, `\\(${numMat(mediaFinal(d.curvas["reinforce.G0"], 30), 2)}\\)`);
    fijarCifra(cifras.salto, `\\(${numMat(d.saltoMaxP.reinforce, 4)}\\)`);
    fijarCifra(cifras.kl, `\\(${numMat(d.klMax.reinforce, 5)}\\)`);
    fijarCifra(cifras.recortes, conFreno
      ? t("t5b.m6.deTotal", "{n} de {total}",
        { n: num(d.recortes.reinforce, 0), total: num(EPISODIOS_M6 * EJECUCIONES_M6, 0) })
      : "—");
  }

  /** La segunda lectura, con la \(p\) final de la tanda que hay delante. */
  function textoLectura2() {
    const d = datos();
    const pFinal = d ? media(d.porEjecucion.reinforce.pFinal) : null;
    lectura2.innerHTML = (d && conFreno)
      ? t("t5b.m6.lectura2",
        "Limitar <strong>cuánto puede moverse la política</strong> en cada actualización —no cuánto "
        + "valen los pesos— corta el bucle sin parar el aprendizaje: con el freno puesto, el mismo "
        + "paso que antes destrozaba la política ahora avanza hacia \\(2-\\sqrt2\\). Esa es la idea "
        + "que hay detrás de TRPO y PPO. Ojo con el matiz, que es honesto: el freno <strong>evita el "
        + "desastre, no recupera el óptimo</strong> — con el paso y el \\(\\delta\\) que tienes "
        + "puestos, la política final se queda en <strong>{p}</strong> frente a \\(2-\\sqrt2 = "
        + "0{,}5858\\).", { p: num(pFinal, 4) })
      : t("t5b.m6.lectura2Sin",
        "Limitar <strong>cuánto puede moverse la política</strong> en cada actualización —no cuánto "
        + "valen los pesos— corta el bucle sin parar el aprendizaje: pon el freno y verás el mismo "
        + "paso que antes destrozaba la política avanzar hacia \\(2-\\sqrt2\\). Esa es la idea que "
        + "hay detrás de TRPO y PPO. Y ojo con el matiz, que es honesto: el freno <strong>evita el "
        + "desastre, no recupera el óptimo</strong> — con un paso lo bastante grande como para "
        + "colapsar, la política final se queda por debajo de \\(2-\\sqrt2 = 0{,}5858\\).");
    renderizarMatematicas(lectura2);
  }

  function sincronizar() {
    textoLectura2();
    mandoDelta.habilitar(conFreno);
    const d = datos();
    const cortadas = d ? (d.cortadas.reinforce || 0) : 0;
    if (cortadas > 0) {
      notaCortada.innerHTML = t("t5b.m6.cortada",
        "{n} ejecuciones cortadas por desbordamiento de \\(\\theta\\).", { n: cortadas });
      renderizarMatematicas(notaCortada);
    }
    ver(notaCortada, cortadas > 0);
  }

  function dibujar() {
    sincronizar();
    dibujarViz1();
    dibujarViz2();
    dibujarTabla();
    dibujarMetricas();
  }

  oyentesSemilla.push(() => { cache.clear(); if (arrancado) pedir(); });
  repintadores.push(dibujar);
  sincronizar();
  dibujarTabla();
  dibujarMetricas();
  ver(progreso.caja, false);
  alEntrarEnPantalla($("#m6"), pedir);

  crearQuiz($("#m6-quiz"), [
    {
      enunciado: "¿Por qué un paso demasiado grande es más peligroso en gradiente de política que "
        + "en aprendizaje supervisado?",
      opciones: [
        "Porque la política decide con qué experiencia se entrena: una política estropeada genera "
        + "episodios peores, y con esos episodios se calcula la actualización siguiente.",
        "Porque el gradiente de la política tiene mayor módulo que el de una función de pérdida "
        + "supervisada, y por eso los mismos pasos son más grandes.",
        "Porque la política es estocástica y el ruido del muestreo se acumula linealmente con el "
        + "número de actualizaciones.",
        "Porque en gradiente de política se maximiza en vez de minimizar, y el ascenso es "
        + "intrínsecamente inestable.",
      ],
      correcta: 0,
      explicacion: "En supervisado, los datos no cambian: un paso malo estropea los pesos y el mismo "
        + "conjunto de datos tira de ellos hacia atrás. Aquí los datos los genera la política, así que "
        + "un paso malo empeora también <strong>la fuente de los datos siguientes</strong>, y en este "
        + "pasillo eso se nota mucho porque los episodios se alargan y con ellos crece el tamaño del "
        + "salto. El módulo del gradiente no es intrínsecamente mayor: lo que crece es el retorno que "
        + "lo multiplica. El ruido del muestreo existe, pero es lo que estudia el módulo de REINFORCE, "
        + "y por sí solo no produce un colapso irreversible. Y maximizar o minimizar es solo un signo: "
        + "el ascenso sobre \\(J\\) es el descenso sobre \\(-J\\).",
    },
    {
      enunciado: "¿Qué limita exactamente una estrategia de región de confianza?",
      opciones: [
        "Cuánto puede cambiar la política de una actualización a la siguiente, medido con una "
        + "divergencia entre las dos distribuciones.",
        "El módulo del vector de parámetros \\(\\theta\\), como hace la regularización L2 en "
        + "aprendizaje supervisado.",
        "El número de episodios que se pueden usar antes de volver a estimar el gradiente.",
        "El rango de las recompensas, para que los retornos no crezcan sin control.",
      ],
      correcta: 0,
      explicacion: "Lo que se acota es el movimiento de <strong>la política</strong>, no el de los "
        + "parámetros. Es una diferencia importante: dos vectores \\(\\theta\\) muy parecidos pueden "
        + "dar políticas muy distintas, y al revés; por eso se mide con una divergencia entre "
        + "distribuciones, como la KL, y no con una norma sobre \\(\\theta\\). La regularización L2 sí "
        + "acota el vector de pesos, y es la analogía que usa la diapositiva <strong>para explicar la "
        + "idea</strong>, no la técnica. El número de episodios y el recorte de recompensas son otras "
        + "cosas, útiles pero distintas.",
    },
    {
      enunciado: "En este pasillo, ¿por qué el tamaño de la actualización crece cuando la política "
        + "empeora?",
      opciones: [
        "Porque el retorno es menos la longitud del episodio, y el incremento de un episodio de "
        + "longitud \\(T\\) suma \\(T(T+1)/2\\) en módulo: si la política alarga los episodios, "
        + "agranda los saltos.",
        "Porque al acercarse la política a un extremo, el vector de elegibilidad crece sin límite.",
        "Porque el paso \\(\\alpha^\\theta\\) se adapta automáticamente al rendimiento observado.",
        "Porque con episodios largos hay más pasos y el ruido del muestreo se cancela menos.",
      ],
      correcta: 0,
      explicacion: "Con \\(-1\\) por paso y sin descuento, \\(G_t = -(T-t)\\), y la suma de sus "
        + "módulos a lo largo del episodio es \\(T(T+1)/2\\): crece con el <strong>cuadrado</strong> de "
        + "la longitud. El vector de elegibilidad hace justo lo contrario: su norma es "
        + "\\(\\sqrt2(1-p)\\) o \\(\\sqrt2 p\\), así que en los extremos <strong>se encoge</strong> "
        + "para la acción probable — y aun así el retorno gana. El paso es fijo, no se adapta. Y el "
        + "ruido del muestreo influye, pero lo que hace crecer el salto de forma sistemática es el "
        + "tamaño del retorno, no su varianza.",
    },
  ], { claves: "t5b.m6.quiz" });
}

/* ======================================================================= *
 * Arranque
 * ======================================================================= */

modulo1();
modulo2();
modulo3();
modulo4();
modulo5();
modulo6();
