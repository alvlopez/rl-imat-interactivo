/* ==========================================================================
   RL · IMAT — Tema 5: aproximación de la función de valor
   Comportamiento de los seis módulos de tema5.html.

   Motor separado de interfaz: TODA la matemática vive en assets/aproximacion.js
   y en assets/aproximacion-worker.js —que no tocan el DOM y se prueban desde
   node—. Aquí solo se pinta y se escucha.

   CUATRO DECISIONES DE ESTE FICHERO QUE CONVIENE LEER ANTES DE TOCAR NADA

   1. EL PERFIL DE GENERALIZACIÓN DEL MÓDULO 2 NO SE CALCULA AQUÍ: SE PIDE AL
      MOTOR. ρ(s,s′) = x(s)ᵀx(s′)/x(s)ᵀx(s) es, literalmente, «entrena s con
      α = 1/m y error unidad y mira cuánto se ha movido v̂(s′)», así que se
      obtiene con `repr.acumular` y `repr.valor` y no con aritmética de
      conjuntos escrita en la interfaz. Es además la definición que la gráfica
      rotula («fracción de la actualización que llega a s′»).

   2. LA ESCALERA DE v̂ SE PASA CON 2k PUNTOS, NO CON 1000. `graficaLineas`
      submuestrea a 900 puntos, y eso deforma una escalera de 1000 puntos
      convirtiendo los saltos en rampas (§C2 del guion). Con dos puntos por
      grupo —el borde izquierdo y el derecho— la escalera es exacta y no hay
      submuestreo. Con k ≥ 450 se pasa un punto por estado, porque a esa
      resolución los peldaños ya son de dos píxeles.

   3. EL MÓDULO 5 PIDE LOS DOS ALGORITMOS AL WORKER, no uno. La sexta serie de
      la Viz 2 es el otro algoritmo con el mismo α×m, así que hacen falta las
      dos tandas; se lanza primero la del algoritmo seleccionado y se dibuja en
      cuanto llega, sin esperar a la otra.

   4. CON λ > 0 EL MÓDULO 5 NO OFRECE α×m = 1,5, y se dice en pantalla. La
      exclusión es de la INTERFAZ: `curvasControl` del worker recorre sus cinco
      α×m siempre, así que hoy no ahorra tiempo de cálculo (queda reportado).

   Diapositivas: 5_Tema_5_1#slide-1 a #slide-37.
   Libro: Sutton & Barto, capítulos 9, 10 y 11, y §16.5.
   ========================================================================== */

import {
  iniciarPagina, graficaLineas, campoCalor, crearQuiz, pintar,
  num, numMat, pct, tono, el, textoSvg, defsPunta, colorCalor, textoSobre,
  alCambiarTema, renderizarMatematicas, leyenda, deslizador, COLORES_SERIE,
} from "./nucleo.js";

import { t } from "./i18n.js";

import {
  paseoMil, mountainCar, oneHot, agregacion, tileCoding1D, tileCoding2D,
  pesosOptimos, errorVE, puntoFijoTD, costePorRecorrer, fragmentoW2W, BAIRD,
  TABLA_PREDICCION, TABLA_CONTROL, contarInductores, fichaCasilla,
} from "./aproximacion.js";

iniciarPagina();

/* ======================================================================= *
 * 0. Utilidades comunes
 * ======================================================================= */

const $ = (sel) => document.querySelector(sel);

/** Repintar los SVG cuando cambia el tema (llevan colores ya resueltos). */
const repintadores = [];
alCambiarTema(() => repintadores.forEach((fn) => fn()));

/** ¿Pantalla estrecha? Decide número de marcas, celdas y bandas dibujadas. */
const enMovil = () => (typeof window !== "undefined" && window.innerWidth < 620);

/* --- semilla de la página: solo la consumen los módulos 3 y 5 ----------- */

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
 * `[hidden]` de la hoja del navegador, y el nodo se seguía viendo. Lo destapó
 * el deslizador de grupos del módulo 2, que aparecía con `tile coding`.
 */
function ver(nodo, visible) {
  if (nodo) nodo.style.display = visible ? "" : "none";
}

/** Rejilla de dos columnas. */
function dosColumnas(zona, clase = "") {
  const div = document.createElement("div");
  div.className = `dos-columnas ${clase}`.trim();
  const a = document.createElement("div");
  const b = document.createElement("div");
  div.append(a, b);
  zona.appendChild(div);
  return [a, b];
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
  label.className = "literal";
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
    /* Se deshabilita en vez de esconderse: así la fila de controles no salta
       al conmutar de representación (lo aprendió el módulo 1 del tema 4b). */
    habilitar(activo) {
      input.disabled = !activo;
      div.style.opacity = activo ? "1" : "0.45";
    },
    mostrar(visible) {
      div.style.display = visible ? "" : "none";
    },
  };
}

/** Grupo de botones que se comporta como un grupo de radio. */
function grupoRadio(panel, etiqueta, opciones, valorInicial, alElegir) {
  const div = document.createElement("div");
  div.className = "control";
  const label = document.createElement("label");
  label.className = "literal";
  label.innerHTML = etiqueta;
  const fila = document.createElement("div");
  fila.className = "grupo-botones";
  div.append(label, fila);
  panel.appendChild(div);
  renderizarMatematicas(label);

  const botones = opciones.map((op) => {
    const b = document.createElement("button");
    b.type = "button";
    if (op.html) b.innerHTML = op.texto;
    else b.textContent = op.texto;
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
  function habilitar(valor, activo) {
    const x = botones.find((y) => y.valor === valor);
    if (!x) return;
    x.boton.disabled = !activo;
    x.boton.style.opacity = activo ? "1" : "0.45";
  }
  marcar(valorInicial);
  renderizarMatematicas(fila);
  return { marcar, habilitar, caja: div };
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
    e.className = "etiq literal";
    e.innerHTML = m.etiqueta;
    const v = document.createElement("div");
    v.className = "cifra";
    v.textContent = "—";
    c.append(e, v);
    div.appendChild(c);
    cifras[m.id] = v;
    cifras[`${m.id}$caja`] = c;
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
 * Devuelve `{ actualizar(filas) }`: las filas son listas de HTML, una por
 * celda. El `position: relative` del envoltorio lo pone `estilo.css` y no es
 * decorativo (MathML oculto de KaTeX).
 */
function tablaDatos(zona, { cabecera, clase = "datos", texto = false }) {
  const envoltorio = document.createElement("div");
  envoltorio.className = "tabla-scroll";
  const tabla = document.createElement("table");
  tabla.className = `${clase}${texto ? " texto" : ""}`;
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  for (const celda of cabecera) {
    const th = document.createElement("th");
    th.innerHTML = celda;
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  const tbody = document.createElement("tbody");
  tabla.append(thead, tbody);
  envoltorio.appendChild(tabla);
  zona.appendChild(envoltorio);
  renderizarMatematicas(thead);

  return {
    tabla,
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
 * lanza ningún Worker. Los módulos 1, 2, 4 y 6 se dibujan al instante y los
 * dos caros esperan a que alguien mire.
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

/* --- notación recurrente, escrita una sola vez -------------------------- */

const RAIZ_VE = "\\(\\sqrt{\\overline{VE}}\\)";
const VE = "\\(\\overline{VE}\\)";

/* ======================================================================= *
 * 1. El paseo de mil estados, resuelto una vez para toda la página
 *
 * `paseoMil` cachea v_π, η y μ por valor de γ, así que llamarla de nuevo con
 * el mismo γ no vuelve a iterar (módulos 1, 2 y 3 comparten el cálculo).
 * ======================================================================= */

const N_ESTADOS = 1000;
const PASEO = paseoMil({ gamma: 1 });
/** Rótulo de un estado: el motor va en base 0 y la pantalla en base 1. */
const marcasEstado = () => (enMovil()
  ? [{ valor: 1, etiqueta: "1" }, { valor: 500, etiqueta: "500" }, { valor: 1000, etiqueta: "1000" }]
  : [1, 200, 400, 600, 800, 1000].map((v) => ({ valor: v, etiqueta: String(v) })));

/* ======================================================================= *
 * MÓDULO 1 — el objetivo: qué estados importan
 * ======================================================================= */

/** Los divisores de 1000 del deslizador de grupos. */
const GRUPOS_M1 = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

function modulo1() {
  const zonaControles = $("#m1-controles");
  const zonaViz1 = $("#m1-viz1");
  const zonaViz2 = $("#m1-viz2");
  const zonaMetricas = $("#m1-metricas");
  const zonaFicha = $("#m1-ficha");
  const zonaLectura = $("#m1-lectura");
  const verdaderos = PASEO.valoresVerdaderos;
  const mu = PASEO.mu;

  /* --- estado del módulo --- */
  let iK = 3;                       // GRUPOS_M1[3] = 10, el de la figura 9.1
  let ponderacion = "mu";
  let estado = 100;                 // el que el libro usa para contar el sesgo
  const k = () => GRUPOS_M1[iK];

  /* --- textos de encuadre --- */

  parrafo(zonaControles, "explicacion", t("t5.m1.explicacion",
    "Mil estados en fila. Empiezas siempre en el 500 y a cada paso saltas a <strong>uno de los "
    + "100 estados de la izquierda o uno de los 100 de la derecha</strong>, todos con la misma "
    + "probabilidad; si el salto se sale por un lado, el episodio termina, con recompensa "
    + "<strong>−1</strong> por la izquierda y <strong>+1</strong> por la derecha. Con \\(k\\) pesos "
    + "—uno por grupo de estados consecutivos— la mejor aproximación posible es <strong>plana "
    + "dentro de cada grupo</strong>, así que hay que decidir qué valor le toca. Y esa decisión es "
    + `exactamente el objetivo: la que minimiza ${VE} le da a cada grupo <strong>la media de los `
    + "valores verdaderos ponderada por \\(\\mu\\)</strong>."));

  aviso(zonaControles, t("t5.m1.notaExacto",
    "Aquí no se aprende nada: los pesos <strong>se calculan</strong> en forma cerrada, y "
    + "\\(v_\\pi\\) y \\(\\mu\\) se resuelven por programación dinámica con tolerancia "
    + "\\(10^{-12}\\). <strong>Este módulo no usa la semilla</strong>: cambiarla no cambia ni un "
    + "dígito. Aprender estos mismos pesos con Monte Carlo y con TD es el módulo 3."));

  aviso(zonaControles, t("t5.m1.notaGamma",
    "\\(\\gamma = 1\\): la tarea es episódica y sin descuento. <strong>El libro no lo dice en "
    + "este ejemplo</strong>; se hereda del paseo aleatorio del tema 4, que sí lo declara, y es "
    + "coherente con que los valores verdaderos vayan de −1 a +1."));

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  const mandoK = controlDeslizador(panel, {
    etiqueta: t("t5.m1.gruposLabel", "Número de grupos (\\(k\\))"),
    min: 0, max: GRUPOS_M1.length - 1, valor: iK,
    formato: (v) => String(GRUPOS_M1[v]),
    alCambiar: (v) => { iK = v; dibujar(); },
  });
  const mandoPeso = grupoRadio(panel, t("t5.m1.pesoLabel", "Ponderación"), [
    { valor: "mu", texto: t("t5.m1.pesoMu", "con \\(\\mu\\)"), html: true },
    { valor: "unif", texto: t("t5.m1.pesoUnif", "uniforme"), html: true },
  ], ponderacion, (v) => { ponderacion = v; dibujar(); });
  const mandoEstado = controlDeslizador(panel, {
    etiqueta: t("t5.m1.estadoLabel", "Estado inspeccionado"),
    min: 1, max: N_ESTADOS, valor: estado,
    alCambiar: (v) => { estado = v; dibujar(); },
  });
  botonControl(panel, t("t5.m1.reiniciar", "Valores por omisión"), () => {
    iK = 3; ponderacion = "mu"; estado = 100;
    mandoK.fijar(iK); mandoPeso.marcar(ponderacion); mandoEstado.fijar(estado);
    dibujar();
  });

  /* --- visualizaciones, métricas y ficha --- */

  const viz1 = caja(zonaViz1, t("t5.m1.viz1",
    "Los mil valores verdaderos y los \\(k\\) pesos que los aproximan"), { conPie: true });
  const viz2 = caja(zonaViz2, t("t5.m1.viz2",
    "Cuánto tiempo se pasa en cada estado"), { conPie: true });

  const cifras = metricas(zonaMetricas, [
    { id: "error", etiqueta: t("t5.m1.mError", `${RAIZ_VE} mínimo con \\(k\\) grupos`) },
    { id: "alcance", etiqueta: t("t5.m1.mAlcance", "Estados que cambian al mover un peso") },
    { id: "pond", etiqueta: t("t5.m1.mPonderada", "Valor del grupo, ponderando por \\(\\mu\\)") },
    { id: "sinPond", etiqueta: t("t5.m1.mSinPonderar", "El mismo grupo, sin ponderar") },
  ]);

  const ficha = tablaDatos(zonaFicha, {
    cabecera: t("t5.m1.fichaCab", "Dato · Valor").split(" · "),
    texto: true,
  });

  /* Las notas condicionales van justo detrás de la lectura, no al final de la
     sección: `appendChild` sobre el <section> las dejaría debajo del quiz. */
  zonaLectura.classList.add("siempre");
  const zonaNotas = document.createElement("div");
  zonaLectura.after(zonaNotas);

  const notaUniforme = aviso(zonaNotas, t("t5.m1.notaUniforme",
    "Acabas de cambiar el objetivo. Con ponderación uniforme cada grupo toma la media "
    + "aritmética de sus valores verdaderos, que es una aproximación perfectamente razonable "
    + `—y que <strong>empeora ${VE}</strong>, porque ${VE} mide el error donde el agente pasa `
    + "el tiempo. No hay una respuesta “correcta” sin decir antes qué estados importan: ése es "
    + "todo el contenido de \\(\\mu\\)."));
  const notaTabular = aviso(zonaNotas, t("t5.m1.notaTabular",
    "Un peso por estado: esto es <em>one-hot</em>, y esto es <strong>el caso tabular</strong>. El "
    + "error mínimo es <strong>exactamente cero</strong>, porque no hay ninguna aproximación que "
    + "repartir. Es la respuesta a la pregunta de <code>#slide-11</code>."));
  const notaUnPeso = aviso(zonaNotas, t("t5.m1.notaUnPeso",
    "Un solo peso para mil estados: la mejor aproximación posible es una constante, y la "
    + `constante que minimiza ${VE} es la media de \\(v_\\pi\\) ponderada por \\(\\mu\\). Como `
    + "\\(\\mu\\) está casi centrada, sale casi cero, y el error es casi todo el que hay."));

  /* --- dibujo --- */

  function dibujar() {
    const grupos = k();
    const repr = agregacion(N_ESTADOS, grupos);
    const wPond = pesosOptimos(repr, verdaderos, mu).w;
    const wUnif = pesosOptimos(repr, verdaderos, "uniforme").w;
    const w = ponderacion === "mu" ? wPond : wUnif;
    /* El error que se muestra es SIEMPRE el ponderado por μ, evaluado en los
       pesos que el botón elija: al pulsar «uniforme» no cambia la métrica,
       cambian los pesos, y por eso empeora. */
    const raizVE = Math.sqrt(errorVE(repr, w, verdaderos, mu));

    const s0 = estado - 1;                       // índice interno del motor
    const j = repr.grupo(s0);
    const { desde, hasta } = repr.limites(j);
    const anotacionS = [{ x: estado, texto: t("t5.m1.anotEstado", "s = {s}", { s: estado }) }];

    /* Viz 1 — la escalera. Dos puntos por grupo mientras quepan (decisión 2
       de la cabecera de este fichero). */
    let xEscalera;
    let yEscalera;
    if (grupos <= 450) {
      xEscalera = [];
      yEscalera = [];
      for (let g = 0; g < grupos; g++) {
        const lim = repr.limites(g);
        xEscalera.push(lim.desde + 1, lim.hasta + 1);
        yEscalera.push(w[g], w[g]);
      }
    } else {
      xEscalera = Array.from({ length: N_ESTADOS }, (_, i) => i + 1);
      yEscalera = Array.from({ length: N_ESTADOS }, (_, i) => repr.valor(w, i));
    }

    const series1 = [
      {
        nombre: t("t5.m1.serieVerdadero", "\\(v_\\pi\\) verdadera"),
        color: tono(COLORES_SERIE[3]), grosor: 2.4,
        x: Array.from({ length: N_ESTADOS }, (_, i) => i + 1),
        y: Array.from(verdaderos),
      },
      {
        nombre: t("t5.m1.serieAprox", "\\(\\hat v(s,w)\\), \\(k\\) grupos"),
        color: tono(COLORES_SERIE[0]), grosor: 2.4, x: xEscalera, y: yEscalera,
      },
    ];
    pintar(viz1.cuerpo, graficaLineas(series1, {
      ejeX: t("t5.m1.viz1x", "Estado"),
      ejeY: t("t5.m1.viz1y", "Valor"),
      yMin: -1, yMax: 1, lineaCero: true,
      ticksX: marcasEstado(),
      anotaciones: anotacionS,
      mensaje: t("t5.m1.viz1vacio", "Resolviendo \\(v_\\pi\\) por programación dinámica…"),
    }));
    conLeyenda(viz1.cuerpo, series1);
    fijarPie(viz1.pie, t("t5.m1.rotuloExacto", "Cálculo exacto · sin simulación"));

    /* Viz 2 — la distribución μ. */
    const series2 = [{
      nombre: t("t5.m1.serieMu", "\\(\\mu(s)\\)"),
      color: tono("--texto-suave"), grosor: 2,
      x: Array.from({ length: N_ESTADOS }, (_, i) => i + 1),
      y: Array.from(mu),
    }];
    pintar(viz2.cuerpo, graficaLineas(series2, {
      ejeX: t("t5.m1.viz1x", "Estado"),
      ejeY: t("t5.m1.viz2y", "μ(s)"),   // texto plano: va dentro de un <text> de SVG
      yMin: 0,
      ticksX: marcasEstado(),
      formatoY: (v) => num(v, 4),
      anotaciones: [
        ...anotacionS,
        { x: 500, texto: t("t5.m1.anotInicio", "inicio") },
      ],
      mensaje: t("t5.m1.viz2vacio", "Resolviendo \\(\\eta\\) y \\(\\mu\\)…"),
    }));
    fijarPie(viz2.pie, t("t5.m1.rotuloExacto", "Cálculo exacto · sin simulación"));

    /* Métricas. */
    fijarCifra(cifras.error, num(raizVE, 4));
    fijarCifra(cifras.alcance, String(N_ESTADOS / grupos));
    fijarCifra(cifras.pond, num(wPond[j], 4));
    fijarCifra(cifras.sinPond, num(wUnif[j], 4));

    /* Ficha del estado inspeccionado. */
    const vHat = repr.valor(w, s0);
    const error = vHat - verdaderos[s0];
    ficha.actualizar([
      [t("t5.m1.fichaV", "\\(v_\\pi(s)\\) verdadero"), num(verdaderos[s0], 4)],
      [t("t5.m1.fichaMu", "\\(\\mu(s)\\)"), num(mu[s0], 6)],
      [t("t5.m1.fichaGrupo", "Grupo"),
        t("t5.m1.fichaGrupoValor", "estados {a}–{b}", { a: desde + 1, b: hasta + 1 })],
      [t("t5.m1.fichaVhat", "\\(\\hat v(s,w)\\)"), num(vHat, 4)],
      [t("t5.m1.fichaError", "Error en este estado"),
        `${error >= 0 ? "+" : "−"}${num(Math.abs(error), 4)}`],
    ]);

    /* Lectura guiada: se recalcula con k. */
    const primeroFin = N_ESTADOS / grupos;
    zonaLectura.innerHTML = t("t5.m1.lecturaSesgo",
      "Con \\(k={k}\\), el primer grupo son los estados 1 a {b}. Su valor <strong>no</strong> es la "
      + "media de sus {n} valores verdaderos: es la media <strong>ponderada por \\(\\mu\\)</strong>, y "
      + "como se pasa por el estado {b} <strong>{razon} veces más a menudo</strong> que por el estado "
      + "1, el valor del grupo se desplaza hacia el del estado {b}, que es el más alto de los {n}. "
      + "Compara las dos métricas de la derecha: ésa es la diferencia entre minimizar "
      + `${VE} y promediar sin pensar.`,
      {
        k: grupos, b: primeroFin, n: primeroFin,
        razon: num(mu[primeroFin - 1] / mu[0], 1),
      });
    renderizarMatematicas(zonaLectura);
    /* Con grupos de menos de cinco estados la lectura se vuelve absurda
       («el primer grupo son los estados 1 a 1 … se pasa 1,0 veces mas a
       menudo que por el estado 1»), asi que se apaga en vez de decir eso. */
    ver(zonaLectura, grupos > 1 && primeroFin >= 5);

    ver(notaUniforme, ponderacion === "unif");
    ver(notaTabular, grupos === N_ESTADOS);
    ver(notaUnPeso, grupos === 1);
  }

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m1-quiz"), [
    {
      enunciado: "Con agregación en 10 grupos de 100 estados, ¿qué valor le toca al primer "
        + `grupo (estados 1 a 100) si se quiere minimizar ${VE}?`,
      opciones: [
        "La media de los cien valores verdaderos <strong>ponderada por \\(\\mu\\)</strong>, que queda "
        + "más cerca del valor del estado 100 porque se pasa por él más a menudo que por el estado 1.",
        "La media aritmética de los cien valores verdaderos, porque los cien estados pertenecen "
        + "al mismo grupo y por tanto cuentan igual.",
        "El valor verdadero del estado central del grupo, el 50, porque es el que minimiza la "
        + "distancia máxima al resto.",
        "El valor verdadero del estado 1, porque es el primero que se encuentra al recorrer el "
        + "grupo y el que fija el peso.",
      ],
      correcta: 0,
      explicacion: `${VE} pesa cada estado por \\(\\mu(s)\\), la fracción del tiempo que se pasa `
        + "en él, así que al derivar e igualar a cero sale la media <strong>ponderada</strong>, no la "
        + "aritmética. En este paseo \\(\\mu\\) crece de izquierda a derecha dentro del primer grupo "
        + "—el libro dice que el estado 100 pesa más del triple que el estado 1—, y por eso el valor "
        + "del grupo se desplaza hacia arriba. Pertenecer al mismo grupo no hace que los estados "
        + "cuenten igual: eso sería cierto solo con ponderación uniforme, que es otro objetivo. Y ni "
        + "el estado central ni el primero tienen ningún papel privilegiado en la fórmula.",
    },
    {
      enunciado: "¿Por qué en el caso tabular no hacía falta ninguna medida ponderada del error, "
        + "y aquí sí?",
      opciones: [
        "Porque en el caso tabular los valores están desacoplados y pueden acabar siendo "
        + "exactamente los verdaderos; con menos pesos que estados, mejorar un estado empeora otros "
        + "y hay que decidir cuáles importan.",
        "Porque en el caso tabular el error es siempre cero por construcción, y con aproximación "
        + "es siempre positivo por el ruido del muestreo.",
        "Porque la ponderación por \\(\\mu\\) es una técnica de aceleración: sirve para converger "
        + "antes, no para definir el objetivo.",
        "Porque en el caso tabular \\(\\gamma\\) no interviene y aquí sí, y \\(\\mu\\) es la forma "
        + "de introducir el descuento en el objetivo.",
      ],
      correcta: 0,
      explicacion: "La clave es el desacoplamiento: con una casilla por estado, actualizar un "
        + "estado no afectaba a ningún otro y el límite alcanzable era el valor verdadero en todos. "
        + "Con menos pesos que estados, cada actualización se reparte, y hacer más preciso un estado "
        + "significa inevitablemente hacer menos precisos otros: hay que decir qué estados importan "
        + "más. El error tabular no es cero “por construcción” —durante el aprendizaje es positivo—, "
        + "sino que su mínimo alcanzable es cero. \\(\\mu\\) no acelera nada: define <strong>qué</strong> "
        + "se minimiza. Y el descuento se trata aparte: en este entorno \\(\\gamma=1\\) y \\(\\mu\\) "
        + "sigue siendo imprescindible.",
    },
    {
      enunciado: "Mueves el número de grupos de 10 a 1000, con un peso por estado. ¿Qué pasa con "
        + `\\(\\min_w \\overline{VE}\\) y por qué?`,
      opciones: [
        "Baja a exactamente cero, porque con un vector de características <em>one-hot</em> los pesos "
        + "pueden reproducir \\(v_\\pi\\) y no queda ningún error que repartir entre estados.",
        "Baja mucho pero no llega a cero, porque \\(v_\\pi\\) se estima con programación dinámica y "
        + "siempre queda el error numérico de la iteración.",
        `Se queda igual, porque ${VE} está ponderado por \\(\\mu\\) y \\(\\mu\\) no cambia al `
        + "cambiar el número de grupos.",
        "Sube, porque con mil pesos y mil estados el problema queda sobreparametrizado y la "
        + "solución deja de ser única.",
      ],
      correcta: 0,
      explicacion: "Con un grupo por estado el vector de características es <em>one-hot</em>, la "
        + "aproximación puede igualar \\(v_\\pi\\) estado por estado y el mínimo del objetivo es "
        + "cero: eso es exactamente el caso tabular, y es la respuesta a la pregunta que "
        + "<code>#slide-11</code> deja abierta. El error de la iteración de programación dinámica se "
        + "controla por tolerancia y es varios órdenes de magnitud menor que cualquier cifra que se "
        + "muestre. \\(\\mu\\) no cambia, cierto, pero lo que cambia es el conjunto de funciones "
        + "representables. Y no hay sobreparametrización: hay exactamente un peso por estado, y la "
        + "solución es única.",
    },
  ], { claves: "t5.m1.quiz" });
}

/* ======================================================================= *
 * MÓDULO 2 — qué es x(s): de one-hot a tile coding
 * ======================================================================= */

/** Los valores de m del deslizador de mosaicados. */
const MOSAICADOS_M2 = [1, 2, 4, 8, 16, 32, 50];
/** Los valores de k del deslizador de grupos, cuando la representación es agregación. */
const GRUPOS_M2 = [5, 10, 20, 50];
/** Ancho de mosaico, fijo: el de la figura 9.10 del libro. */
const ANCHO_M2 = 200;

function modulo2() {
  const zonaControles = $("#m2-controles");
  const zonaViz1 = $("#m2-viz1");
  const zonaViz2 = $("#m2-viz2");
  const zonaMetricas = $("#m2-metricas");
  const zonaRegla = $("#m2-regla");

  /* --- estado del módulo --- */
  let rep = "tile";
  let iM = 2;                        // MOSAICADOS_M2[2] = 4, el de la figura 9.9
  let iG = 0;                        // GRUPOS_M2[0] = 5, el mosaicado único
  let estado = 500;
  const m = () => MOSAICADOS_M2[iM];
  const grupos = () => GRUPOS_M2[iG];

  /** La representación activa, construida por el motor. */
  function representacion() {
    if (rep === "oneHot") return oneHot(N_ESTADOS);
    if (rep === "agregacion") return agregacion(N_ESTADOS, grupos());
    return tileCoding1D({ nEstados: N_ESTADOS, m: m(), ancho: ANCHO_M2 });
  }

  /* --- textos de encuadre --- */

  parrafo(zonaControles, "explicacion", t("t5.m2.explicacion",
    "Los mil estados del paseo, tratados como <strong>una sola dimensión continua</strong>, que es "
    + "lo que hace el libro en la figura 9.10. Un <strong>mosaicado</strong> es una partición de esa "
    + "recta en <strong>mosaicos</strong> de ancho \\(\\ell = 200\\) estados: cada estado cae en "
    + "exactamente un mosaico, y la característica correspondiente vale 1 y todas las demás 0. Con "
    + "<strong>un solo mosaicado eso es agregación de estados</strong>. Al añadir mosaicados "
    + "desplazados entre sí, cada estado activa <strong>exactamente \\(m\\)</strong> características, "
    + "una por mosaicado, y <strong>eso</strong> es <em>tile coding</em>."));

  aviso(zonaControles, t("t5.m2.notaExacto",
    "Aquí no hay simulación ni azar: lo que se dibuja es la geometría de la representación, y es "
    + "exacta. La semilla no afecta a este módulo."));

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  const mandoRep = grupoRadio(panel, t("t5.m2.repLabel", "Representación"), [
    { valor: "oneHot", texto: t("t5.m2.repOneHot", "<em>one-hot</em>"), html: true },
    { valor: "agregacion", texto: t("t5.m2.repAgreg", "agregación"), html: true },
    { valor: "tile", texto: t("t5.m2.repTile", "<em>tile coding</em>"), html: true },
  ], rep, (v) => { rep = v; dibujar(); });
  const mandoM = controlDeslizador(panel, {
    etiqueta: t("t5.m2.mLabel", "Mosaicados (\\(m\\))"),
    min: 0, max: MOSAICADOS_M2.length - 1, valor: iM,
    formato: (v) => String(MOSAICADOS_M2[v]),
    alCambiar: (v) => { iM = v; dibujar(); },
  });
  const mandoG = controlDeslizador(panel, {
    etiqueta: t("t5.m2.gruposLabel", "Grupos"),
    min: 0, max: GRUPOS_M2.length - 1, valor: iG,
    formato: (v) => String(GRUPOS_M2[v]),
    alCambiar: (v) => { iG = v; dibujar(); },
  });
  const mandoEstado = controlDeslizador(panel, {
    etiqueta: t("t5.m2.estadoLabel", "Estado inspeccionado"),
    min: 1, max: N_ESTADOS, valor: estado,
    alCambiar: (v) => { estado = v; dibujar(); },
  });
  botonControl(panel, t("t5.m2.reiniciar", "Valores por omisión"), () => {
    rep = "tile"; iM = 2; iG = 0; estado = 500;
    mandoRep.marcar(rep); mandoM.fijar(iM); mandoG.fijar(iG); mandoEstado.fijar(estado);
    dibujar();
  });

  /* --- visualizaciones --- */

  const viz1 = caja(zonaViz1, t("t5.m2.viz1",
    "Los mosaicados, y en qué mosaico cae el estado"), { conPie: true });
  const viz2 = caja(zonaViz2, t("t5.m2.viz2", "Cuánto salpica una sola actualización"),
    { conPie: true });

  const cifras = metricas(zonaMetricas, [
    { id: "d", etiqueta: t("t5.m2.mD", "Pesos (\\(d\\))") },
    { id: "activas", etiqueta: t("t5.m2.mActivas", "Características activas") },
    { id: "alpha", etiqueta: t("t5.m2.mAlpha1", "\\(\\alpha = 1/m\\) (un solo ensayo)") },
    { id: "ancho", etiqueta: t("t5.m2.mAncho", "Estados que reciben algo") },
  ]);

  /* --- panel de la regla del paso, ejercicio 9.5 y notas --- */

  parrafo(zonaRegla, "ecuacion",
    "\\[ \\alpha \\doteq \\big(\\tau\\,\\mathbb E[x^\\top x]\\big)^{-1} = \\frac{1}{\\tau m} \\]");
  parrafo(zonaRegla, "explicacion siempre", t("t5.m2.reglaAlpha",
    "Como las características son binarias y hay <strong>exactamente \\(m\\)</strong> activas, "
    + "\\(x^\\top x = m\\) es constante, y la regla general del libro se reduce a "
    + "\\(\\alpha = 1/(\\tau m)\\). Con \\(\\tau=1\\) sale \\(\\alpha = 1/m\\), que da "
    + "<strong>aprendizaje exacto en un solo ensayo</strong>: entrena el ejemplo \\(s\\mapsto u\\) y "
    + "la nueva estimación es <strong>exactamente \\(u\\)</strong>, sea cual fuera la anterior. Con "
    + "\\(\\tau=10\\), \\(\\alpha = 1/(10m)\\), y la estimación se mueve <strong>exactamente una "
    + "décima</strong> del camino."));

  const panelEnsayo = panelControles(zonaRegla);
  const resultadoEnsayo = document.createElement("p");
  resultadoEnsayo.className = "explicacion siempre";
  botonControl(panelEnsayo,
    t("t5.m2.botonEnsayo", "Entrenar \\(s \\mapsto 0{,}5\\) con \\(\\alpha = 1/m\\)"),
    () => ensayo());
  zonaRegla.appendChild(resultadoEnsayo);

  aviso(zonaRegla, t("t5.m2.ejercicio95",
    "El Exercise 9.5 del libro es exactamente esta regla: un espacio continuo de <strong>7 "
    + "dimensiones</strong>, con 8 mosaicados por cada dimensión suelta (7×8 = 56) más 2 mosaicados "
    + "por cada uno de los \\(\\binom{7}{2}=21\\) pares (42), <strong>98 mosaicados</strong> en total; "
    + "se quiere aprender gradualmente, en unas 10 presentaciones. Entonces \\(\\tau = 10\\), "
    + "\\(m = 98\\) y \\(\\alpha = 1/(10\\cdot 98) = 1/980\\)."));

  aviso(zonaRegla, t("t5.m2.notaPractica",
    "Recuerda de dónde sale esto en clase: <code>#slide-22</code> manda <strong>leer la sección "
    + "9.5.4 del Sutton &amp; Barto</strong> y hacer los ejercicios con el código de la "
    + "<strong>práctica 3</strong>. Este módulo es el resumen de esa sección, no su sustituto: el "
    + "<em>hashing</em>, los mosaicos irregulares y las franjas diagonales de la figura 9.12 están "
    + "en el libro y no aquí."));

  const notaOneHot = aviso(zonaRegla, t("t5.m2.notaOneHot",
    "Un peso por estado: \\(x(s) = e_s\\), \\(d = 1000\\), <strong>una</strong> característica "
    + "activa. El valor aproximado es literalmente el peso, \\(\\hat v(s,w) = w_s\\), y la "
    + "actualización es \\(w_s \\leftarrow w_s + \\alpha[U_t - w_s]\\): <strong>la actualización "
    + "tabular de los temas anteriores</strong>. La generalización es cero: entrenar en \\(s\\) no "
    + "mueve absolutamente nada en ningún otro estado. Es la respuesta a <code>#slide-11</code>: "
    + "<strong>aquí no hay aproximación</strong>."));
  const notaAgreg = aviso(zonaRegla, t("t5.m2.notaAgreg",
    "Un peso por grupo. El gradiente vale <strong>1 en la componente del grupo de \\(s\\) y 0 en "
    + "las demás</strong>: sigue siendo <em>one-hot</em>, pero sobre grupos. La generalización es "
    + "<strong>total dentro del grupo y nula fuera</strong>, y por eso el perfil de abajo es un "
    + "escalón con los bordes en vertical. Es la respuesta manuscrita de <code>#slide-11</code>: la "
    + "aproximación aparece <strong>en cuanto se agrupan estados</strong>."));
  const notaTileUno = aviso(zonaRegla, t("t5.m2.notaTileUno",
    "<strong>Con un solo mosaicado no hay codificación gruesa: hay agregación de estados.</strong> "
    + "Compara el perfil con el del botón «agregación» y cinco grupos: es el mismo. Todo lo que "
    + "aporta <em>tile coding</em> viene de solapar varios mosaicados desplazados."));
  const notaVacios = aviso(zonaRegla, t("t5.m2.notaVacios",
    "Algunos mosaicos de los extremos no contienen ningún estado: sus pesos existen, valen cero y "
    + "no se actualizan nunca. Cuentan en \\(d\\) porque están en el vector."));
  const notaDesplazamiento = aviso(zonaRegla, t("t5.m2.notaDesplazamiento",
    "El desplazamiento \\(\\ell/m\\) no tiene que ser entero: los estados son enteros, pero los "
    + "bordes de los mosaicos no."));
  const notaDibujo = aviso(zonaRegla, t("t5.m2.notaDibujo",
    "Con <em>one-hot</em> la banda se dibuja con una marca cada 10 estados: son mil mosaicos y no "
    + "caben todos en la pantalla. El cálculo usa los mil."));
  const notaMovil = aviso(zonaRegla, t("t5.m2.notaMovil",
    "Se dibujan los ocho primeros mosaicados de \\(m\\); el cálculo usa todos."));

  /* --- Viz 1: SVG propio (rectángulos y líneas: no hace falta primitiva) --- */

  function dibujarMosaicados(repr) {
    const ancho = 640;
    const margen = { i: 34, d: 14, s: 10, f: 30 };
    const bandas = rep === "tile" ? Math.min(repr.m, enMovil() ? 8 : repr.m) : 1;
    const altoBanda = Math.max(12, Math.min(26, 150 / bandas));
    const anchoUtil = ancho - margen.i - margen.d;
    const altoCuadros = 26;
    const alto = margen.s + bandas * (altoBanda + 3) + altoCuadros + margen.f;
    const svg = el("svg", {
      viewBox: `0 0 ${ancho} ${alto}`, width: ancho, height: alto, role: "img",
      style: "max-width:100%;height:auto",
    });
    const borde = tono("--borde-fuerte");
    const acento = tono("--acento");
    const suave = tono("--texto-suave");
    const px = (s) => margen.i + ((s - 1) / (N_ESTADOS - 1)) * anchoUtil;
    const s0 = estado - 1;
    const activas = new Set(Array.from(repr.activas(s0)));

    for (let j = 0; j < bandas; j++) {
      const y = margen.s + j * (altoBanda + 3);
      if (rep === "oneHot") {
        /* Mil mosaicos no caben: una marca cada diez, declarada en notaDibujo. */
        svg.appendChild(el("rect", {
          x: margen.i, y, width: anchoUtil, height: altoBanda,
          fill: "none", stroke: borde, "stroke-width": 1,
        }));
        for (let s = 11; s <= N_ESTADOS; s += 10) {
          svg.appendChild(el("line", {
            x1: px(s), x2: px(s), y1: y, y2: y + altoBanda,
            stroke: borde, "stroke-width": 0.4, opacity: 0.5,
          }));
        }
        svg.appendChild(el("rect", {
          x: px(estado) - 1, y, width: 3, height: altoBanda, fill: acento,
        }));
      } else {
        const paso = rep === "agregacion" ? N_ESTADOS / repr.d : ANCHO_M2;
        const desfase = rep === "agregacion" ? 0 : (j * repr.offset);
        /* Los bordes de los mosaicos de este mosaicado, en base 1. */
        let borde0 = 1 - desfase;
        while (borde0 + paso < 1) borde0 += paso;
        for (let x0 = borde0; x0 < N_ESTADOS + paso; x0 += paso) {
          const iz = Math.max(1, x0);
          const de = Math.min(N_ESTADOS, x0 + paso);
          if (de <= iz) continue;
          const contiene = estado >= x0 && estado < x0 + paso;
          svg.appendChild(el("rect", {
            x: px(iz), y, width: Math.max(1, px(de) - px(iz)), height: altoBanda,
            fill: contiene ? acento : "none",
            opacity: contiene ? 0.75 : 1,
            stroke: borde, "stroke-width": contiene ? 1.4 : 0.8,
          }));
        }
      }
      svg.appendChild(textoSvg({
        x: margen.i - 6, y: y + altoBanda / 2 + 4, "text-anchor": "end",
        fill: suave, "font-size": 10, "font-family": "monospace",
      }, rep === "tile" ? String(j) : ""));
    }

    /* Línea vertical del estado inspeccionado, atravesando las bandas. */
    const yFin = margen.s + bandas * (altoBanda + 3);
    svg.appendChild(el("line", {
      x1: px(estado), x2: px(estado), y1: margen.s - 4, y2: yFin,
      stroke: acento, "stroke-width": 1.4, "stroke-dasharray": "4 3",
    }));

    /* x(s) como fila de cuadraditos, cuando caben. */
    if (repr.d <= 320) {
      const anchoCuadro = anchoUtil / repr.d;
      for (let i = 0; i < repr.d; i++) {
        svg.appendChild(el("rect", {
          x: margen.i + i * anchoCuadro, y: yFin + 6,
          width: Math.max(1, anchoCuadro - 0.6), height: 12,
          fill: activas.has(i) ? acento : "none",
          stroke: borde, "stroke-width": 0.5,
        }));
      }
    }
    svg.appendChild(textoSvg({
      x: margen.i, y: yFin + 34, fill: suave, "font-size": 11,
    }, t("t5.m2.activas", "{m} activas de {d}", { m: repr.nActivas, d: repr.d })));
    svg.appendChild(textoSvg({
      x: margen.i + anchoUtil, y: yFin + 34, "text-anchor": "end",
      fill: suave, "font-size": 11,
    }, t("t5.m2.rotuloEstado", "estado {s}", { s: estado })));
    return svg;
  }

  /* --- dibujo --- */

  /**
   * El perfil de generalización, pedido al motor.
   *
   * ρ(s,s′) es, por definición, cuánto se mueve v̂(s′) al entrenar s con
   * α = 1/x(s)ᵀx(s) y error unidad: se obtiene con `acumular` y `valor`, que
   * son las dos operaciones lineales del motor. Aquí no se calcula nada.
   */
  function perfil(repr, s0, desde, hasta) {
    const w = new Float64Array(repr.d);
    repr.acumular(w, 1 / repr.nActivas, s0);
    const x = [];
    const y = [];
    for (let s = desde; s <= hasta; s++) {
      x.push(s + 1);
      y.push(repr.valor(w, s));
    }
    let cuantos = 0;
    for (let s = 0; s < N_ESTADOS; s++) if (repr.valor(w, s) > 0) cuantos += 1;
    return { x, y, cuantos, w };
  }

  function ensayo() {
    const repr = representacion();
    const s0 = estado - 1;
    const w = new Float64Array(repr.d);
    const objetivo = 0.5;
    const antes = repr.valor(w, s0);
    const alpha = 1 / repr.nActivas;
    repr.acumular(w, alpha * (objetivo - antes), s0);
    const despues = repr.valor(w, s0);
    resultadoEnsayo.innerHTML = t("t5.m2.ensayoResultado",
      "Antes: \\(\\hat v(s,w) = {antes}\\). Después de <strong>una</strong> actualización con "
      + "\\(\\alpha = 1/{m}\\): \\(\\hat v(s,w) = {despues}\\), que es exactamente el objetivo.",
      { antes: numMat(antes, 2), m: repr.nActivas, despues: numMat(despues, 2) });
    renderizarMatematicas(resultadoEnsayo);
  }

  function dibujar() {
    const repr = representacion();
    const s0 = estado - 1;

    mandoM.mostrar(rep === "tile");
    mandoG.mostrar(rep === "agregacion");

    pintar(viz1.cuerpo, dibujarMosaicados(repr));
    fijarPie(viz1.pie, t("t5.m2.rotuloExacto", "Geometría exacta · sin simulación"));

    const desde = Math.max(0, s0 - 400);
    const hasta = Math.min(N_ESTADOS - 1, s0 + 400);
    const p = perfil(repr, s0, desde, hasta);
    const serie = [{
      nombre: t("t5.m2.serieperfil", "\\(x(s)^\\top x(s')/m\\)"),
      color: tono("--acento"), grosor: 2.4, x: p.x, y: p.y,
    }];
    const anotaciones = [{ x: estado, texto: t("t5.m2.anotS", "s") }];
    if (rep === "tile") {
      for (const lado of [-1, 1]) {
        const x = estado + lado * ANCHO_M2;
        if (x >= 1 && x <= N_ESTADOS) {
          anotaciones.push({ x, texto: t("t5.m2.anotAncho", "±ℓ (cota)") });
        }
      }
    }
    pintar(viz2.cuerpo, graficaLineas(serie, {
      ejeX: t("t5.m2.viz2x", "Estado s′"),
      ejeY: t("t5.m2.viz2y", "Fracción de la actualización que llega a s′"),
      yMin: 0, yMax: 1,
      formatoY: (v) => num(v, 2),
      /* Marcas cada 200 estados dentro de la ventana, más sus dos extremos:
         la ventana se mueve con s y unas marcas fijas se quedarían fuera. */
      ticksX: (() => {
        const marcas = [{ valor: desde + 1, etiqueta: String(desde + 1) }];
        for (let v = Math.ceil((desde + 1) / 200) * 200; v <= hasta + 1; v += 200) {
          if (v > desde + 60 && v < hasta - 60) marcas.push({ valor: v, etiqueta: String(v) });
        }
        marcas.push({ valor: hasta + 1, etiqueta: String(hasta + 1) });
        return marcas;
      })(),
      anotaciones,
      mensaje: t("t5.m2.viz2vacio", "Mueve el estado inspeccionado."),
    }));
    fijarPie(viz2.pie, t("t5.m2.rotuloExacto", "Geometría exacta · sin simulación"));

    fijarCifra(cifras.d, String(repr.d));
    fijarCifra(cifras.activas, String(repr.nActivas));
    fijarCifra(cifras.alpha, num(1 / repr.nActivas, 5));
    fijarCifra(cifras.ancho, String(p.cuantos));

    resultadoEnsayo.innerHTML = "";
    ver(notaOneHot, rep === "oneHot");
    ver(notaAgreg, rep === "agregacion");
    ver(notaTileUno, rep === "tile" && repr.m === 1);
    ver(notaVacios, rep === "tile");
    ver(notaDesplazamiento, rep === "tile" && !Number.isInteger(repr.offset));
    ver(notaDibujo, rep === "oneHot");
    ver(notaMovil, rep === "tile" && repr.m > 8 && enMovil());
  }

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m2-quiz"), [
    {
      enunciado: "Pones <em>tile coding</em> con un solo mosaicado. ¿Qué tienes?",
      opciones: [
        "Agregación de estados: la generalización es total dentro del mosaico e inexistente "
        + "fuera, y no hay codificación gruesa de ninguna clase.",
        "<em>Tile coding</em> con la máxima generalización posible, porque con un mosaicado cada "
        + "mosaico es lo más ancho que puede ser.",
        "Codificación <em>one-hot</em>, porque solo hay una característica activa a la vez.",
        "Una representación degenerada que no se puede usar, porque el gradiente no está definido "
        + "si no hay mosaicados solapados.",
      ],
      correcta: 0,
      explicacion: "Con un mosaicado el espacio queda partido y cada estado activa una única "
        + "característica: eso es exactamente agregación de estados, y el libro lo dice con estas "
        + "palabras. La generalización no es máxima ni mínima por la anchura del mosaico: es "
        + "<strong>total</strong> dentro y <strong>nula</strong> fuera, sin gradación, y precisamente "
        + "por eso no es codificación gruesa. No es <em>one-hot</em> sobre estados, sino sobre grupos "
        + "—con <em>one-hot</em> habría mil pesos, aquí hay cinco—. Y el gradiente está perfectamente "
        + "definido: vale 1 en la componente del mosaico y 0 en las demás.",
    },
    {
      enunciado: "Con 8 mosaicados y \\(\\alpha = 1/8\\), entrenas el ejemplo \\(s\\mapsto u\\) una "
        + "sola vez. ¿Cuánto vale \\(\\hat v(s,w)\\) después?",
      opciones: [
        "Exactamente \\(u\\), porque hay 8 características activas y cada una recibe "
        + "\\(\\alpha[u-\\hat v]\\), de modo que el valor aproximado se mueve "
        + "\\(8\\alpha[u-\\hat v] = [u-\\hat v]\\).",
        "Un octavo del camino hacia \\(u\\), porque el paso se ha repartido entre los 8 mosaicados "
        + "activos.",
        "Ocho veces el camino hacia \\(u\\), es decir, se pasa de largo: por eso "
        + "\\(\\alpha=1/8\\) es un valor inestable con 8 mosaicados.",
        "Depende de los pesos iniciales, porque la actualización es proporcional al valor previo y "
        + "no al error.",
      ],
      correcta: 0,
      explicacion: "El valor aproximado es la suma de los pesos de las características activas, y "
        + "las 8 se actualizan a la vez con el mismo error, así que el incremento total es "
        + "\\(8\\alpha\\) veces el error. Con \\(\\alpha = 1/8\\) eso es exactamente el error, y la "
        + "nueva estimación es \\(u\\): es el «aprendizaje exacto en un solo ensayo» del libro, y la "
        + "razón por la que \\(\\alpha\\) se escribe siempre dividido por el número de mosaicados. No "
        + "se reparte quedándose corto ni se pasa de largo, y no depende de los pesos previos: la "
        + "actualización es proporcional <strong>al error</strong>, no al valor.",
    },
    {
      enunciado: "Con mosaicos anchos, la generalización inicial es amplia. ¿Qué se puede decir de "
        + "la precisión que se acabará alcanzando?",
      opciones: [
        "Que la controla más el número total de características que la anchura de los mosaicos: la "
        + "anchura afecta sobre todo a la generalización inicial.",
        "Que queda limitada por la anchura del mosaico: con mosaicos anchos no se puede distinguir "
        + "dentro de un mosaico, por mucho que se entrene.",
        "Que es la misma en todos los casos, porque la aproximación lineal converge siempre al "
        + "mismo punto fijo.",
        "Que empeora con el número de mosaicados, porque cada mosaicado añadido reparte el paso "
        + "entre más pesos.",
      ],
      correcta: 0,
      explicacion: "El libro lo dice explícitamente: la generalización inicial la controlan el "
        + "tamaño y la forma de los campos receptivos, pero la <em>acuidad</em> —la discriminación "
        + "más fina posible— la controla más el número total de características. Con varios "
        + "mosaicados desplazados se distingue perfectamente dentro de un mosaico, porque los estados "
        + "de dentro difieren en las características de los demás mosaicados: eso es todo el truco. "
        + "El punto fijo depende de la representación, así que no es el mismo en todos los casos. Y "
        + "añadir mosaicados no empeora la precisión: hay que reescalar \\(\\alpha\\), que es otra "
        + "cosa.",
    },
  ], { claves: "t5.m2.quiz" });
}

/* ======================================================================= *
 * 2. El Worker de los módulos 3 y 5
 *
 * Patrón de `sinmodelo-worker.js`: { tarea, id, config } de entrada y
 * { tipo, id, … } de salida. Si el navegador no admite Workers, el cálculo se
 * hace en el hilo principal —la página se congela unos segundos, pero no se
 * queda sin dato— importando el mismo módulo, que exporta sus dos funciones.
 * ======================================================================= */

let worker = null;
try {
  worker = new Worker(new URL("./aproximacion-worker.js", import.meta.url), { type: "module" });
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

/** Lanza una tarea en el Worker; si no hay Worker, en el hilo principal. */
function calcular(tarea, config, alProgresar) {
  if (!worker) {
    return import("./aproximacion-worker.js").then((mod) => {
      const fn = tarea === "prediccion" ? mod.curvasPrediccion : mod.curvasControl;
      const resultado = fn({ ...config, alProgresar });
      alProgresar(1);
      return resultado;
    });
  }
  const id = siguienteId++;
  return new Promise((resolver, rechazar) => {
    enCurso.set(id, { resolver, rechazar, alProgresar });
    worker.postMessage({ tarea, id, config });
  });
}

/* ======================================================================= *
 * MÓDULO 3 — a dónde converge cada uno
 * ======================================================================= */

/**
 * Los siete valores de α del deslizador.
 *
 * ⚠ EL POR OMISIÓN ES 10⁻³, NO EL 2·10⁻⁴ DEL GUION v2, y la lista se extiende
 * hasta 2·10⁻³ (corrección del guion del 2026-09-08). Con 2·10⁻⁴ y 5000
 * episodios, TD se queda en 0,335 con su asíntota en 0,117: la lectura «TD se
 * detiene en el punto fijo» NO SE VE. Con 10⁻³, TD llega a 0,153. Y por encima
 * de 10⁻³ el orden se invierte —MC 0,147 frente a TD 0,116—, porque el suelo
 * de ruido de MC crece con α: eso es una lección y hay que poder verla.
 */
const ALFAS_M3 = [2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3];
const GAMMAS_M3 = [0.9, 0.95, 0.99, 1];
const EPISODIOS_M3 = 5000;
const GRUPOS_M3 = 10;

/**
 * α en notación de potencia para el rótulo del deslizador.
 *
 * El valor del deslizador se escribe con `textContent`, así que ni KaTeX ni
 * `<sup>` entran ahí: el exponente va en superíndices Unicode. Escribir
 * «1·10^-3» con el caret literal se lee mal y no es la notación del curso.
 */
const SUPERINDICES = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵" };
function alphaTexto(alpha) {
  const exponente = Math.floor(Math.log10(alpha));
  const mantisa = Math.round(alpha / 10 ** exponente);
  const potencia = String(exponente).split("").map((c) => SUPERINDICES[c] ?? c).join("");
  return `${mantisa}·10${potencia}`;
}
function alphaMat(alpha) {
  const exponente = Math.floor(Math.log10(alpha));
  const mantisa = Math.round(alpha / 10 ** exponente);
  return `${mantisa}\\times 10^{${exponente}}`;
}

function modulo3() {
  const zonaControles = $("#m3-controles");
  const zonaViz1 = $("#m3-viz1");
  const zonaViz2 = $("#m3-viz2");
  const zonaMetricas = $("#m3-metricas");
  const zonaLectura = $("#m3-lectura");

  /* --- estado del módulo --- */
  let iAlpha = 5;                    // ALFAS_M3[5] = 1e-3 (ver el comentario)
  let iGamma = 3;                    // γ = 1, el del entorno del libro
  let episodios = EPISODIOS_M3;
  const alpha = () => ALFAS_M3[iAlpha];
  const gamma = () => GAMMAS_M3[iGamma];

  /** Caché por (semilla, α, γ) en el hilo principal, además de la del Worker. */
  const cache = new Map();
  const clave = () => `${semillaActual()}|${alpha()}|${gamma()}`;
  let enMarcha = null;
  let error = null;

  $("#m3-semilla").textContent = t("t5.m3.semillaPie",
    "Semilla {s} · 10 ejecuciones, semillas {a}…{b}",
    { s: semillaActual(), a: semillaActual(), b: semillaActual() + 9 });

  /* --- textos de encuadre --- */

  parrafo(zonaControles, "explicacion", t("t5.m3.explicacion",
    "El mismo paseo de mil estados, el mismo aproximador de diez pesos, <strong>los mismos "
    + "episodios</strong>: MC y TD(0) ven exactamente la misma experiencia, generada con la misma "
    + "semilla, y lo único que cambia es el objetivo \\(U_t\\) —el retorno observado para MC, la "
    + "recompensa más el valor estimado del estado siguiente para TD—. Las dos <strong>líneas "
    + "horizontales</strong> son los puntos a los que converge cada uno, <strong>calculados "
    + `exactamente</strong>: la de MC es el mínimo de ${VE}; la de TD, el punto fijo `
    + "<span class=\"nowrap\">\\(w_{TD} = A^{-1}b\\).</span>"));

  aviso(zonaControles, t("t5.m3.notaAsintotas",
    "Las dos líneas horizontales <strong>no se simulan</strong>: se resuelven. La de MC sale de "
    + `derivar ${VE} e igualar a cero; la de TD, de resolver el sistema \\(A\\,w = b\\) con `
    + "\\(A = \\mathbb E[x_t(x_t-\\gamma x_{t+1})^\\top]\\) y \\(b = \\mathbb E[R_{t+1}x_t]\\) "
    + "construidos con la dinámica exacta del entorno. Por eso no se mueven al cambiar "
    + "\\(\\alpha\\) ni al cambiar la semilla: <strong>solo dependen del entorno, de la "
    + "representación y de \\(\\gamma\\)</strong>."));

  aviso(zonaControles, t("t5.m3.notaSimplificacion",
    "El libro corre <strong>100.000 episodios</strong> con \\(\\alpha = 2\\times 10^{-5}\\) para la "
    + "figura 9.1. Aquí se corren <strong>5.000</strong> y se promedian <strong>10 "
    + "ejecuciones</strong>, para que responda en clase, y el \\(\\alpha\\) por omisión es "
    + "<strong>cincuenta veces mayor</strong> por la misma razón. Puedes poner "
    + "\\(\\alpha = 2\\times10^{-5}\\) en el deslizador para ver la configuración del libro: apenas "
    + "se mueve, y eso también dice algo. <strong>La conclusión del módulo no depende de "
    + "esto</strong>, porque los dos destinos se calculan exactos."));

  aviso(zonaControles, t("t5.m3.notaVisitas",
    "Monte Carlo se aplica en modo <em>cada visita</em>, como la caja del libro: en este paseo los "
    + "estados se repiten mucho dentro de un episodio."));

  aviso(zonaControles, t("t5.m3.notaGammaMu",
    "Al cambiar \\(\\gamma\\) cambia también \\(\\mu\\): el libro pide tratar el descuento como una "
    + "forma de terminación, así que \\(\\gamma\\) entra en el cálculo de las visitas esperadas."));

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  const mandoAlpha = controlDeslizador(panel, {
    etiqueta: t("t5.m3.alphaLabel", "Paso de aprendizaje (\\(\\alpha\\))"),
    min: 0, max: ALFAS_M3.length - 1, valor: iAlpha,
    formato: (v) => alphaTexto(ALFAS_M3[v]),
    alCambiar: (v) => { iAlpha = v; pedir(); },
  });
  const mandoGamma = grupoRadio(panel, t("t5.m3.gammaLabel", "Descuento (\\(\\gamma\\))"),
    GAMMAS_M3.map((g) => ({ valor: g, texto: num(g, g === 1 ? 0 : 2) })),
    gamma(), (v) => { iGamma = GAMMAS_M3.indexOf(v); pedir(); });
  const mandoEpisodios = controlDeslizador(panel, {
    etiqueta: t("t5.m3.episodiosLabel", "Episodios dibujados"),
    min: 0, max: EPISODIOS_M3, paso: 25, valor: episodios,
    alCambiar: (v) => { episodios = v; dibujarViz2(); },
  });
  parrafo(panel, "suave", t("t5.m3.marcas", "0 · 100 · 1000 · 5000"));
  botonControl(panel, t("t5.m3.reiniciar", "Valores por omisión"), () => {
    iAlpha = 5; iGamma = 3; episodios = EPISODIOS_M3;
    mandoAlpha.fijar(iAlpha); mandoGamma.marcar(gamma()); mandoEpisodios.fijar(episodios);
    pedir();
  });

  /* --- visualizaciones y métricas --- */

  const viz1 = caja(zonaViz1, t("t5.m3.viz1", "Error frente a experiencia, y los dos destinos"),
    { conPie: true });
  const viz2 = caja(zonaViz2, t("t5.m3.viz2", "Los diez pesos, y a qué escalera tiende cada método"),
    { conPie: true });
  const progreso = barraProgreso(viz1.cuerpo);
  ver(progreso.caja, false);

  const cifras = metricas(zonaMetricas, [
    { id: "min", etiqueta: t("t5.m3.mMin", `${RAIZ_VE} del óptimo global`) },
    { id: "td", etiqueta: t("t5.m3.mTD", `${RAIZ_VE} del punto fijo TD`) },
    { id: "razon", etiqueta: t("t5.m3.mRazon", `Razón \\(\\overline{VE}(w_{TD})/\\min\\overline{VE}\\)`) },
    { id: "cota", etiqueta: t("t5.m3.mCota", "Cota del libro, \\(1/(1-\\gamma)\\)") },
  ]);

  zonaLectura.classList.add("siempre");
  zonaLectura.innerHTML = t("t5.m3.lectura",
    "Mira las dos líneas horizontales antes que las curvas. <strong>TD no converge donde converge "
    + "MC</strong>: converge al punto fijo \\(w_{TD}\\), que está por encima del mínimo. Y ahora "
    + "mueve \\(\\alpha\\): las curvas cambian de forma, pero <strong>las dos líneas no se "
    + "mueven</strong>. El paso decide la velocidad; el destino lo deciden el entorno, la "
    + "representación y \\(\\gamma\\).");
  renderizarMatematicas(zonaLectura);

  /* Las dos notas que dependen de α. Sin ellas, quien mueve el deslizador al
     tope ve que MC empeora y no hay nada que se lo explique —y quien lo baja,
     que TD «no converge» cuando lo que pasa es que no ha arrancado—. */
  const notaEscalera = aviso(zonaLectura, t("t5.m3.notaEscaleraTD",
    "Fíjate en la escalera azul: está <strong>casi pegada al cero</strong>, y sus cuatro peldaños "
    + "centrales son indistinguibles de la línea de cero. Con este paso y 5.000 episodios, "
    + "<strong>TD apenas se ha movido de \\(w_0 = 0\\)</strong> —con \\(\\alpha = 2\\times10^{-4}\\) "
    + "y la semilla por omisión, sus diez pesos van de −0,31 a 0,31, mientras los de Monte Carlo ya "
    + "van de −0,77 a 0,74—. Su error no es grande porque haya "
    + "convergido a un sitio malo: es grande porque <strong>no ha convergido a ninguno</strong>. "
    + "Sube \\(\\alpha\\) al valor por omisión y mira cómo la escalera azul se estira hacia su propia "
    + "línea discontinua, <strong>sin llegar a la negra</strong>: eso último es lo que sí es el punto "
    + "fijo TD."));

  const notaOrden = aviso(zonaLectura, t("t5.m3.notaOrdenInvertido",
    "Acabas de invertir el orden, y merece la pena entender por qué. Con este paso —y con la semilla "
    + "y el \\(\\gamma\\) por omisión— MC se queda en <strong>0,147</strong> y TD en "
    + "<strong>0,116</strong>: la curva roja pasa a estar "
    + "<strong>por encima</strong> de la azul, justo lo contrario de lo que dicen las figuras 9.1 y "
    + "9.2 del libro. No es que MC haya dejado de converger al óptimo global —su línea horizontal no "
    + "se ha movido; con \\(\\gamma = 1\\) está en 0,0544—, es que <strong>con \\(\\alpha\\) "
    + "constante ninguno de los dos llega: los dos "
    + "fluctúan alrededor de su destino con una amplitud que crece con \\(\\alpha\\)</strong>, y el "
    + "suelo de ruido de MC crece más deprisa porque su objetivo —el retorno completo— tiene mucha "
    + "más varianza que el de TD. La ventaja asintótica de MC está en el límite de \\(\\alpha\\) "
    + "decreciente, que es exactamente la condición con la que el libro enuncia el resultado."));

  /** Enciende cada nota en el tramo del deslizador en el que dice algo. */
  function sincronizarNotasAlpha() {
    ver(notaEscalera, alpha() <= 2e-4);
    ver(notaOrden, alpha() >= 2e-3);
  }

  /* Se llama YA, no solo desde `pedir()`: `pedir()` no corre hasta que el
     módulo entra en el viewport, y hasta entonces las dos notas se verían a la
     vez —y diciendo cosas contradictorias— con el α por omisión. */
  sincronizarNotasAlpha();

  const zonaNotas = document.createElement("div");
  zonaLectura.after(zonaNotas);
  const notaCota = aviso(zonaNotas, t("t5.m3.notaCota",
    "Con \\(\\gamma = 1\\) la cota \\(1/(1-\\gamma)\\) es <strong>infinita</strong>: no dice nada. "
    + "Eso no es un defecto del cálculo, es lo que el libro advierte —«como \\(\\gamma\\) suele estar "
    + "cerca de uno, este factor de expansión puede ser bastante grande, así que hay una pérdida "
    + "potencial sustancial de rendimiento asintótico con el método TD»—. Baja \\(\\gamma\\) a 0,9 y "
    + "compara la razón real con la cota. Y una precisión más: <strong>la cota está enunciada para "
    + "tareas continuas</strong>; para tareas episódicas como ésta el libro dice que es «ligeramente "
    + "distinta pero relacionada», así que aquí se muestra como referencia y no como garantía."));
  const notaDivergencia = aviso(zonaNotas, t("t5.m3.notaDivergencia",
    "Con este \\(\\alpha\\), alguna ejecución se ha ido: los pesos han superado \\(10^{6}\\) y se ha "
    + "cortado. Esto <strong>no</strong> es la divergencia del módulo 4 —aquí el entrenamiento es "
    + "dentro de política y el problema es solo que el paso es demasiado grande—, es la inestabilidad "
    + "numérica de siempre del descenso del gradiente. Baja \\(\\alpha\\)."));
  const notaSingular = aviso(zonaNotas, t("t5.m3.notaSingular",
    "La matriz \\(A\\) ha salido casi singular y se ha regularizado con \\(\\varepsilon I\\), como "
    + "hace LSTD. Es un aviso, no un resultado."));
  const notaTruncados = aviso(zonaNotas, t("t5.m3.notaTruncados",
    "{n} episodios han alcanzado el tope de 10.000 pasos y se han descartado, generando otro con el "
    + "mismo generador. No se esperaba ninguno: queda dicho y no oculto."));

  /* --- las dos asíntotas y las dos escaleras exactas: hilo principal ----- */

  function exacto() {
    const entorno = paseoMil({ gamma: gamma() });
    const repr = agregacion(N_ESTADOS, GRUPOS_M3);
    const optimo = pesosOptimos(repr, entorno.valoresVerdaderos, entorno.mu);
    const fijo = puntoFijoTD(entorno, repr, gamma());
    const veOptimo = errorVE(repr, optimo.w, entorno.valoresVerdaderos, entorno.mu);
    const veTD = errorVE(repr, fijo.w, entorno.valoresVerdaderos, entorno.mu);
    return {
      entorno, repr, wOptimo: optimo.w, wTD: fijo.w,
      asintotaMC: Math.sqrt(veOptimo), asintotaTD: Math.sqrt(veTD),
      razon: veTD / veOptimo, regularizada: fijo.regularizada,
    };
  }

  /** Escalera de 2k puntos a partir de un vector de 10 pesos. */
  function escalera(repr, w) {
    const x = [];
    const y = [];
    for (let g = 0; g < repr.d; g++) {
      const lim = repr.limites(g);
      x.push(lim.desde + 1, lim.hasta + 1);
      y.push(w[g], w[g]);
    }
    return { x, y };
  }

  /* --- dibujo --- */

  function dibujarViz1() {
    const ex = exacto();
    const datos = cache.get(clave());
    const colorMC = tono(COLORES_SERIE[3]);
    const colorTD = tono(COLORES_SERIE[0]);
    const x = Array.from({ length: EPISODIOS_M3 + 1 }, (_, i) => i);

    const series = datos ? [
      { nombre: t("t5.m3.serieMC", "MC gradiente"), color: colorMC, grosor: 2.4, x, y: datos.curvaMC },
      { nombre: t("t5.m3.serieTD", "TD(0) semi-gradiente"), color: colorTD, grosor: 2.4, x, y: datos.curvaTD },
    ] : [];

    const mensaje = error
      ? t("t5.m3.error", "El cálculo ha fallado: {m}", { m: error })
      : t("t5.m3.viz1vacio", "Calculando las 10 ejecuciones…");

    pintar(viz1.cuerpo, graficaLineas(series, {
      ejeX: t("t5.m3.viz1x", "Episodios"),
      /* El rótulo del eje va dentro de un <text> del SVG, donde KaTeX no
         entra: se escribe con el radical y las siglas, y la notación completa
         —con la barra— la lleva el título de la caja, que sí es HTML. */
      ejeY: t("t5.m3.viz1y", "√VE"),
      yMin: 0,
      ticksX: [0, 1000, 2000, 3000, 4000, 5000].map((v) => ({ valor: v, etiqueta: String(v) })),
      anotacionesY: [
        { y: ex.asintotaMC, texto: t("t5.m3.asintotaMC", "óptimo global de VE"), color: colorMC },
        { y: ex.asintotaTD, texto: t("t5.m3.asintotaTD", "punto fijo TD"), color: colorTD },
      ],
      mensaje,
    }));
    if (series.length) conLeyenda(viz1.cuerpo, series);
    viz1.cuerpo.appendChild(progreso.caja);
    ver(progreso.caja, !datos && !error);
    fijarPie(viz1.pie, t("t5.m3.viz1runs",
      "<strong>10 ejecuciones independientes</strong> · semillas {a}…{b}",
      { a: semillaActual(), b: semillaActual() + 9 }));

    /* Métricas: salen del cálculo exacto, no de la simulación. */
    fijarCifra(cifras.min, num(ex.asintotaMC, 4));
    fijarCifra(cifras.td, num(ex.asintotaTD, 4));
    fijarCifra(cifras.razon, num(ex.razon, 3));
    fijarCifra(cifras.cota, gamma() === 1 ? "∞" : num(1 / (1 - gamma()), 2));

    ver(notaCota, gamma() === 1);
    ver(notaSingular, ex.regularizada);
    ver(notaDivergencia, Boolean(datos && datos.cortadas));
    if (datos && datos.truncados) {
      notaTruncados.innerHTML = t("t5.m3.notaTruncados",
        "{n} episodios han alcanzado el tope de 10.000 pasos y se han descartado, generando otro con "
        + "el mismo generador. No se esperaba ninguno: queda dicho y no oculto.",
        { n: datos.truncados });
    }
    ver(notaTruncados, Boolean(datos && datos.truncados));
  }

  function dibujarViz2() {
    const ex = exacto();
    const datos = cache.get(clave());
    const colorMC = tono(COLORES_SERIE[3]);
    const colorTD = tono(COLORES_SERIE[0]);
    const series = [
      {
        nombre: t("t5.m3.serieVerdadero", "\\(v_\\pi\\) verdadera"),
        color: tono("--texto"), grosor: 2, discontinua: true,
        x: Array.from({ length: N_ESTADOS }, (_, i) => i + 1),
        y: Array.from(ex.entorno.valoresVerdaderos),
      },
    ];
    if (datos) {
      const iMC = Math.min(episodios, datos.instantaneasMC.length - 1);
      const finMC = escalera(ex.repr, datos.instantaneasMC[iMC]);
      const finTD = escalera(ex.repr, datos.instantaneasTD[iMC]);
      series.push(
        { nombre: t("t5.m3.serieMCahora", "\\(\\hat v\\) de MC"), color: colorMC, grosor: 2.4, ...finMC },
        { nombre: t("t5.m3.serieTDahora", "\\(\\hat v\\) de TD"), color: colorTD, grosor: 2.4, ...finTD },
      );
    }
    /* En móvil se dejan fuera las dos escaleras finas (§10 del guion). */
    if (!enMovil()) {
      series.push(
        {
          nombre: t("t5.m3.serieMCfin", "óptimo global"),
          color: colorMC, grosor: 1, discontinua: true, ...escalera(ex.repr, ex.wOptimo),
        },
        {
          nombre: t("t5.m3.serieTDfin", "\\(w_{TD}\\)"),
          color: colorTD, grosor: 1, discontinua: true, ...escalera(ex.repr, ex.wTD),
        },
      );
    }
    pintar(viz2.cuerpo, graficaLineas(series, {
      ejeX: t("t5.m3.viz2x", "Estado"),
      ejeY: t("t5.m3.viz2y", "Valor"),
      yMin: -1, yMax: 1, lineaCero: true,
      ticksX: marcasEstado(),
      mensaje: t("t5.m3.viz2vacio", "Mueve el deslizador de episodios."),
    }));
    conLeyenda(viz2.cuerpo, series);
    fijarPie(viz2.pie, t("t5.m3.viz2runs",
      "1 ejecución (la primera) · semilla {s} · episodio {e}",
      { s: semillaActual(), e: datos ? Math.min(episodios, EPISODIOS_M3) : 0 }));
  }

  /** Pide el cálculo al Worker si no está en la caché. */
  function pedir() {
    sincronizarNotasAlpha();
    dibujarViz1();
    dibujarViz2();
    const k = clave();
    if (cache.has(k) || enMarcha === k) return;
    enMarcha = k;
    error = null;
    progreso.fijar(0);
    calcular("prediccion", {
      semilla: semillaActual(), alpha: alpha(), gamma: gamma(),
      episodios: EPISODIOS_M3, ejecuciones: 10, grupos: GRUPOS_M3,
    }, (fraccion) => progreso.fijar(fraccion))
      .then((resultado) => {
        cache.set(k, resultado);
        if (enMarcha === k) enMarcha = null;
        if (clave() === k) { dibujarViz1(); dibujarViz2(); }
      })
      .catch((e) => {
        error = e.message;
        if (enMarcha === k) enMarcha = null;
        dibujarViz1();
      });
  }

  oyentesSemilla.push(() => {
    $("#m3-semilla").textContent = t("t5.m3.semillaPie",
      "Semilla {s} · 10 ejecuciones, semillas {a}…{b}",
      { s: semillaActual(), a: semillaActual(), b: semillaActual() + 9 });
    pedir();
  });
  repintadores.push(() => { dibujarViz1(); dibujarViz2(); });

  /* Nada de Worker al cargar: arranca al entrar en el viewport (§C6). */
  dibujarViz1();
  dibujarViz2();
  alEntrarEnPantalla($("#m3"), pedir);

  crearQuiz($("#m3-quiz"), [
    {
      enunciado: "Las dos líneas horizontales de la gráfica no se mueven al cambiar "
        + "\\(\\alpha\\). ¿Por qué?",
      opciones: [
        "Porque son los puntos de convergencia, y dependen del entorno, de la representación y de "
        + "\\(\\gamma\\), no del tamaño de paso: \\(\\alpha\\) decide la velocidad y la oscilación, no "
        + "el destino.",
        "Porque están calculadas con el \\(\\alpha\\) por omisión y la implementación no las "
        + "recalcula al mover el deslizador.",
        "Porque con \\(\\alpha\\) pequeño el método converge al mismo punto que con \\(\\alpha\\) "
        + "grande solo si el problema es lineal, y aquí lo es.",
        "Porque las líneas horizontales son el error de la inicialización \\(w=0\\), que no depende "
        + "de \\(\\alpha\\).",
      ],
      correcta: 0,
      explicacion: `El mínimo de ${VE} sale de derivar el objetivo e igualar a cero, y el punto `
        + "fijo TD de resolver \\(A\\,w=b\\): en ninguna de las dos expresiones aparece "
        + "\\(\\alpha\\). El paso interviene en cómo se llega —velocidad, oscilación, y si el proceso "
        + "es numéricamente estable— pero no en dónde. No es un defecto de la implementación: se "
        + "recalculan al cambiar \\(\\gamma\\), que es lo que sí las mueve. Y no son el error inicial: "
        + "ése es el punto de partida común de las dos curvas, arriba a la izquierda.",
    },
    {
      enunciado: "<code>#slide-14</code> dice que TD(0) “converge a un punto cercano al óptimo "
        + "global”. ¿Qué mide exactamente esa cercanía?",
      opciones: [
        "El error asintótico de TD no pasa de \\(1/(1-\\gamma)\\) veces el error mínimo posible; con "
        + "\\(\\gamma\\) cerca de uno ese factor es enorme y la cota deja de decir gran cosa.",
        "La distancia euclídea entre \\(w_{TD}\\) y \\(w^*\\), que está acotada por "
        + "\\(\\alpha/(1-\\gamma)\\).",
        "Nada cuantitativo: “cercano” significa que las dos soluciones coinciden salvo un error de "
        + "muestreo que tiende a cero con el número de episodios.",
        "El número de grupos: con más grupos los dos puntos se acercan, y con menos se alejan, "
        + "independientemente de \\(\\gamma\\).",
      ],
      correcta: 0,
      explicacion: "La cota del libro es sobre el objetivo, no sobre los pesos, y el factor es "
        + "\\(1/(1-\\gamma)\\): el error asintótico de TD no pasa de eso multiplicado por el mínimo. "
        + "El propio libro advierte de que con \\(\\gamma\\) próximo a uno el factor es grande y hay "
        + "pérdida potencial sustancial de rendimiento asintótico. No es una cuestión de muestreo: los "
        + "dos puntos son distintos aunque los episodios fueran infinitos, y por eso están dibujados "
        + "como dos líneas. Y aunque con un grupo por estado los dos puntos sí coinciden —porque "
        + "entonces no hay aproximación—, en general la diferencia depende de \\(\\gamma\\) y de la "
        + "representación a la vez.",
    },
    {
      enunciado: "Con un peso por estado —<em>one-hot</em>, mil grupos— ¿qué pasa con los dos "
        + "puntos de convergencia?",
      opciones: [
        "Coinciden, y los dos valen \\(v_\\pi\\): en el caso tabular no hay error de aproximación "
        + "que reparta y el punto fijo TD <strong>es</strong> el valor verdadero.",
        "Siguen siendo distintos, porque TD hace <em>bootstrapping</em> y el sesgo del "
        + "<em>bootstrapping</em> no desaparece por tener más pesos.",
        "Coinciden solo si además \\(\\gamma<1\\), porque con \\(\\gamma=1\\) la cota es infinita y "
        + "no hay garantía de nada.",
        "TD deja de converger, porque con mil pesos la matriz \\(A\\) es singular.",
      ],
      correcta: 0,
      explicacion: "Con <em>one-hot</em> la aproximación puede reproducir \\(v_\\pi\\) exactamente: "
        + "el mínimo del objetivo es cero, y resolviendo \\(A\\,w=b\\) sale el mismo \\(v_\\pi\\). El "
        + "sesgo del <em>bootstrapping</em> no desaparece durante el aprendizaje —TD sigue siendo "
        + "sesgado en el camino—, pero el punto al que converge es el correcto cuando no hay error de "
        + "representación que repartir. La cota infinita con \\(\\gamma=1\\) es una cota, no un "
        + "resultado: no impide que en el caso tabular los dos puntos coincidan. Y \\(A\\) no es "
        + "singular: con <em>one-hot</em> es diagonal y con entradas positivas.",
    },
  ], { claves: "t5.m3.quiz" });
}

/* ======================================================================= *
 * MÓDULO 4 — cuándo divergen los pesos: el ejemplo w → 2w
 * ======================================================================= */

const ALFAS_M4 = [0.01, 0.05, 0.1, 0.3];
const PASOS_M4 = 60;
const W0_M4 = 10;

function modulo4() {
  const zonaControles = $("#m4-controles");
  const zonaViz1 = $("#m4-viz1");
  const zonaViz2 = $("#m4-viz2");
  const zonaFormula = $("#m4-formula");
  const zonaTraza = $("#m4-traza");
  const zonaMetricas = $("#m4-metricas");
  const zonaTablaAlpha = $("#m4-tablaAlpha");
  const zonaBaird = $("#m4-baird");

  /* --- estado del módulo --- */
  let gamma = 0.99;                  // el de Baird
  let alpha = 0.1;                   // el de la ilustración del libro
  let regimen = "off";

  /* --- textos de encuadre --- */

  parrafo(zonaControles, "explicacion", t("t5.m4.explicacion",
    "Dos estados y <strong>un solo peso</strong>. El primero tiene valor estimado \\(w\\) y el "
    + "segundo \\(2w\\) —es decir, características escalares \\(x=1\\) y \\(x=2\\)—, y del primero "
    + "sale una única acción que lleva al segundo con recompensa 0. El valor verdadero de los dos es "
    + "<strong>cero</strong>, y con \\(w=0\\) se representa exactamente: no hay error de aproximación "
    + "que repartir. Aun así, <strong>los pesos pueden irse a infinito</strong>, y aquí se ve por qué "
    + "en tres líneas."));

  aviso(zonaControles, t("t5.m4.notaExacto",
    "Este módulo es determinista: <strong>no hay simulación ni azar</strong>, y la semilla no lo "
    + "afecta. Todo lo que se muestra es la iteración exacta de una fórmula."));

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  const mandoGamma = controlDeslizador(panel, {
    etiqueta: t("t5.m4.gammaLabel", "Descuento (\\(\\gamma\\))"),
    min: 0, max: 1, paso: 0.01, valor: gamma,
    formato: (v) => num(v, 2),
    alCambiar: (v) => { gamma = v; dibujar(); },
  });
  const mandoAlpha = grupoRadio(panel, t("t5.m4.alphaLabel", "Paso (\\(\\alpha\\))"),
    ALFAS_M4.map((a) => ({ valor: a, texto: num(a, 2) })), alpha,
    (v) => { alpha = v; dibujar(); });
  const mandoRegimen = grupoRadio(panel, t("t5.m4.regimenLabel", "Régimen de actualización"), [
    { valor: "off", texto: t("t5.m4.regimenOff", "fuera de política") },
    { valor: "on", texto: t("t5.m4.regimenOn", "dentro de política") },
  ], regimen, (v) => { regimen = v; dibujar(); });
  botonControl(panel, t("t5.m4.reiniciar", "Valores por omisión"), () => {
    gamma = 0.99; alpha = 0.1; regimen = "off";
    mandoGamma.fijar(gamma); mandoAlpha.marcar(alpha); mandoRegimen.marcar(regimen);
    dibujar();
  });

  /* --- visualizaciones --- */

  const viz1 = caja(zonaViz1, t("t5.m4.viz1", "El fragmento: dos estados, un peso"));
  const viz2 = caja(zonaViz2, t("t5.m4.viz2", "El peso, actualización a actualización"),
    { conPie: true });

  const cifras = metricas(zonaMetricas, [
    { id: "factor", etiqueta: t("t5.m4.mFactor", "Factor de crecimiento") },
    { id: "veredicto", etiqueta: t("t5.m4.mVeredicto", "Veredicto") },
    { id: "pasos", etiqueta: t("t5.m4.mPasos", "Actualizaciones hasta \\(\\lvert w\\rvert>1000\\)") },
    { id: "umbral", etiqueta: t("t5.m4.mUmbral", "Umbral de \\(\\gamma\\)") },
  ]);

  const formula = parrafo(zonaFormula, "ecuacion", "");
  const traza = tablaDatos(zonaTraza, {
    cabecera: t("t5.m4.trazaCab",
      "\\(t\\) · \\(w_t\\) · \\(\\hat v(s_1)\\) · \\(\\hat v(s_2)\\) · \\(\\delta_t\\) · "
      + "\\(\\Delta w\\) · \\(w_{t+1}\\)").split(" · "),
  });

  const tablaAlpha = tablaDatos(zonaTablaAlpha, {
    cabecera: t("t5.m4.tablaAlphaCab", "\\(\\alpha\\) · Factor · Veredicto").split(" · "),
  });
  parrafo(zonaTablaAlpha, "explicacion siempre", t("t5.m4.lecturaAlpha",
    "Ésta es la tabla que hay que mirar dos veces. Con \\(\\gamma\\) por encima de 0,5, "
    + "<strong>los cuatro</strong> pasos dan un factor mayor que 1: la inestabilidad ocurre "
    + "<strong>para cualquier \\(\\alpha>0\\), por pequeño que sea</strong>. Un paso más pequeño solo "
    + "cambia la velocidad a la que \\(w\\) se va a infinito, no si se va."));

  const notaUmbral = aviso(zonaTablaAlpha, t("t5.m4.notaUmbral",
    "Justo en el umbral: \\(2\\gamma-1 = 0\\), el error TD es cero para cualquier \\(w\\), y los "
    + "pesos <strong>no se mueven nunca</strong>. Cualquier \\(w\\) es un punto fijo, aunque solo "
    + "\\(w=0\\) sea el valor verdadero. Sube un centésimo \\(\\gamma\\) y mira lo que pasa."));
  const notaDentro = aviso(zonaTablaAlpha, t("t5.m4.notaDentro",
    "Ahora se recorre el episodio completo: la transición del primer estado al segundo "
    + "<strong>y</strong> la del segundo al terminal. La segunda actualización usa \\(x=2\\) y su "
    + "error TD es \\(0+\\gamma\\cdot 0-2w = -2w\\) —porque \\(\\hat v(\\text{terminal})=0\\)—, así "
    + "que \\(\\Delta w = \\alpha(-2w)\\cdot 2 = -4\\alpha w\\). El factor por episodio pasa a ser "
    + "\\((1+\\alpha(2\\gamma-1))(1-4\\alpha)\\), y con los cuatro pasos de la lista y "
    + "\\(\\gamma=1\\) su módulo es <strong>menor que 1</strong>: el sistema se mantiene a raya. "
    + "<strong>Este cierre del ejemplo no está en el libro</strong>: lo añade este recurso para que "
    + "se vea el contraste, y es la aplicación directa del teorema de convergencia de TD(0) lineal "
    + "dentro de política —de hecho, con esta distribución la matriz \\(A\\) vale "
    + "\\((5-2\\gamma)/2 > 0\\) y \\(b = 0\\), luego el punto fijo TD es \\(w_{TD}=0\\), que es el "
    + "valor verdadero—."));
  const notaAlphaGrande = aviso(zonaTablaAlpha, t("t5.m4.notaAlphaGrande",
    "Que dentro de política sea estable no es gratis: con un \\(\\alpha\\) suficientemente grande "
    + "también se rompe. Pero eso es el paso demasiado grande de siempre, no la tríada: se arregla "
    + "bajando \\(\\alpha\\), y la divergencia de fuera de política no."));
  const notaDesborde = aviso(zonaTablaAlpha, t("t5.m4.notaDesborde",
    "Se ha parado el cálculo en \\(10^{12}\\): seguir no añade información. En el límite, \\(w\\) se "
    + "va a infinito."));

  parrafo(zonaTablaAlpha, "explicacion siempre", t("t5.m4.porQueOff",
    "La clave del ejemplo es que <strong>esa transición ocurre repetidamente sin que \\(w\\) se "
    + "actualice en las demás transiciones</strong>. Fuera de política eso es posible: la política de "
    + "comportamiento puede elegir, en las otras transiciones, acciones que la política objetivo nunca "
    + "elegiría, y para ellas la razón de importancia es cero y no se actualiza nada. Dentro de "
    + "política, esa razón vale siempre uno. Como lo dice el libro: <strong>al final, al gaitero hay "
    + "que pagarle</strong>. Dentro de política, la promesa de recompensa futura hay que cumplirla y el "
    + "sistema se mantiene a raya; fuera de política se puede prometer y luego, tras tomar una acción "
    + "que la política objetivo nunca tomaría, olvidar y perdonar."));

  aviso(zonaTablaAlpha, t("t5.m4.panelA",
    "Y esto conecta con el punto fijo TD del módulo 3. La condición de estabilidad de TD(0) lineal es "
    + "que la matriz \\(A = \\mathbb E[x_t(x_t-\\gamma x_{t+1})^\\top]\\) sea definida positiva. Aquí "
    + "es un solo número: fuera de política, actualizando solo la primera transición, "
    + "\\(A = 1\\cdot(1-2\\gamma) = 1-2\\gamma\\), que es <strong>negativo</strong> en cuanto "
    + "\\(\\gamma>0{,}5\\). Dentro de política, con las dos transiciones, \\(A = (5-2\\gamma)/2 > 0\\). "
    + "<strong>El umbral 0,5 es exactamente el cambio de signo de \\(A\\).</strong>"));

  /* --- ficha de datos de Baird: texto y figura, no módulo --- */

  parrafo(zonaBaird, "explicacion siempre", t("t5.m4.bairdIntro",
    "Lo que <code>#slide-15</code> proyecta es la versión completa de este mismo fenómeno, y la "
    + "diapositiva no da ninguno de sus datos. Aquí están todos, para que la figura se pueda leer:"));
  const detalles = document.createElement("details");
  detalles.open = !enMovil();
  const resumen = document.createElement("summary");
  resumen.textContent = t("t5.m4.bairdResumen", "Ficha del contraejemplo de Baird");
  detalles.appendChild(resumen);
  zonaBaird.appendChild(detalles);
  const bairdTabla = tablaDatos(detalles, {
    cabecera: t("t5.m4.bairdCab", "Elemento · Valor").split(" · "),
    texto: true,
  });
  bairdTabla.actualizar([
    [t("t5.m4.baird1", "MDP"),
      t("t5.m4.baird1v", "episódico, <strong>siete estados y dos acciones</strong>")],
    [t("t5.m4.baird2", "Acción de trazo discontinuo"),
      t("t5.m4.baird2v", "lleva a uno de los <strong>seis estados superiores con igual "
        + "probabilidad</strong> (1/6 cada uno)")],
    [t("t5.m4.baird3", "Acción de trazo continuo"),
      t("t5.m4.baird3v", "lleva al <strong>séptimo</strong> estado (el inferior)")],
    [t("t5.m4.baird4", "Política de comportamiento"),
      t("t5.m4.baird4v", "\\(b(\\text{discontinua}\\mid\\cdot) = 6/7\\), "
        + "\\(b(\\text{continua}\\mid\\cdot) = 1/7\\); con eso la distribución del estado siguiente "
        + "es <strong>uniforme</strong>, y es también la distribución inicial de cada episodio")],
    [t("t5.m4.baird5", "Política objetivo"),
      t("t5.m4.baird5v", "\\(\\pi(\\text{continua}\\mid\\cdot) = 1\\): <strong>siempre</strong> la "
        + "continua. Su distribución está concentrada en el séptimo estado")],
    [t("t5.m4.baird6", "Recompensa"),
      t("t5.m4.baird6v", "<strong>cero en todas las transiciones</strong>")],
    [t("t5.m4.baird7", "Descuento"), `\\(\\gamma = ${numMat(BAIRD.gamma, 2)}\\)`],
    [t("t5.m4.baird8", "Pesos"),
      t("t5.m4.baird8v", "<strong>ocho</strong>, para <strong>siete</strong> estados no terminales")],
    [t("t5.m4.baird9", "Parametrización"),
      t("t5.m4.baird9v", "los seis estados superiores valen \\(2w_1+w_8, \\dots, 2w_6+w_8\\); el "
        + "séptimo vale \\(w_7+2w_8\\). Por ejemplo \\(x(1) = (2,0,0,0,0,0,0,1)^\\top\\)")],
    [t("t5.m4.baird10", "Solución exacta"),
      t("t5.m4.baird10v", "\\(v_\\pi(s)=0\\) para todo \\(s\\), y <strong>se representa "
        + "exactamente</strong> con \\(w=0\\). Hay <strong>muchas</strong> soluciones, porque hay más "
        + "pesos que estados, y las características son <strong>linealmente independientes</strong>: "
        + "todo es favorable")],
    [t("t5.m4.baird11", "Parámetros de la figura 11.2"),
      t("t5.m4.baird11v", "\\(\\alpha = 0{,}01\\), "
        + "\\(w_0 = (1,1,1,1,1,1,10,1)^\\top\\), 1000 pasos (panel de TD) y 1000 barridos (panel de "
        + "DP)")],
    [t("t5.m4.baird12", "Qué se ve"),
      t("t5.m4.baird12v", "los pesos <strong>divergen a infinito</strong>: \\(w_1\\) a \\(w_6\\) "
        + "juntos, \\(w_8\\) el que más crece, y \\(w_7\\) <strong>plano</strong> en su valor "
        + "inicial")],
  ]);
  aviso(zonaBaird, t("t5.m4.bairdDos",
    "Dos precisiones que el libro subraya y que la diapositiva no da. <strong>No es cuestión del "
    + "tamaño de paso</strong>: la inestabilidad ocurre para cualquier \\(\\alpha>0\\). Y <strong>no "
    + "es cuestión de muestreo ni de asincronía</strong>: con actualizaciones de DP semi-gradiente "
    + "—barriendo todos los estados, sin nada de azar— el sistema sigue siendo inestable. Lo que lo "
    + "arregla es <strong>la distribución</strong>: cambiando solo la distribución de las "
    + "actualizaciones de uniforme a la distribución dentro de política, la convergencia queda "
    + "garantizada con el error acotado por la cota del módulo 3."));

  /* --- Viz 1: SVG propio del fragmento --- */

  function dibujarFragmento(w) {
    const ancho = 380;
    const alto = 170;
    const svg = el("svg", {
      viewBox: `0 0 ${ancho} ${alto}`, width: ancho, height: alto, role: "img",
      style: "max-width:100%;height:auto",
    });
    const borde = tono("--borde-fuerte");
    const acento = tono("--acento");
    const suave = tono("--texto-suave");
    const texto = tono("--texto");
    const punta = defsPunta(svg, borde);
    const puntaTenue = defsPunta(svg, suave);

    const nodo = (cx, etiqueta, valor, atenuado) => {
      svg.appendChild(el("circle", {
        cx, cy: 62, r: 30,
        fill: tono("--superficie"), stroke: atenuado ? suave : borde,
        "stroke-width": atenuado ? 1 : 1.6, opacity: atenuado ? 0.55 : 1,
      }));
      svg.appendChild(textoSvg({
        x: cx, y: 58, "text-anchor": "middle", "font-size": 12,
        fill: atenuado ? suave : texto,
      }, etiqueta));
      if (valor !== null) {
        svg.appendChild(textoSvg({
          x: cx, y: 74, "text-anchor": "middle", "font-size": 12,
          "font-family": "monospace", fill: acento,
        }, valor));
      }
    };

    nodo(58, "v̂ = w", num(w, 2), false);
    nodo(190, "v̂ = 2w", num(2 * w, 2), false);
    svg.appendChild(el("line", {
      x1: 90, y1: 62, x2: 158, y2: 62, stroke: borde, "stroke-width": 2,
      "marker-end": `url(#${punta})`,
    }));
    svg.appendChild(textoSvg({
      x: 124, y: 52, "text-anchor": "middle", "font-size": 11, fill: suave,
    }, t("t5.m4.rotuloR", "r = 0")));

    if (regimen === "on") {
      nodo(322, t("t5.m4.rotuloFin", "terminal"), "0", false);
      svg.appendChild(el("line", {
        x1: 222, y1: 62, x2: 290, y2: 62, stroke: borde, "stroke-width": 2,
        "marker-end": `url(#${punta})`,
      }));
      svg.appendChild(textoSvg({
        x: 256, y: 52, "text-anchor": "middle", "font-size": 11, fill: suave,
      }, t("t5.m4.rotuloR", "r = 0")));
    } else {
      nodo(322, t("t5.m4.rotuloFin", "terminal"), null, true);
      svg.appendChild(el("line", {
        x1: 222, y1: 62, x2: 290, y2: 62, stroke: suave, "stroke-width": 1.4,
        "stroke-dasharray": "4 3", opacity: 0.6, "marker-end": `url(#${puntaTenue})`,
      }));
      /* La tachadura es la que dice que esa transición no se actualiza. */
      svg.appendChild(el("line", {
        x1: 248, y1: 50, x2: 264, y2: 74, stroke: tono("--peligro"), "stroke-width": 2,
      }));
      svg.appendChild(el("line", {
        x1: 264, y1: 50, x2: 248, y2: 74, stroke: tono("--peligro"), "stroke-width": 2,
      }));
      svg.appendChild(textoSvg({
        x: 256, y: 100, "text-anchor": "middle", "font-size": 10.5, fill: tono("--peligro"),
      }, t("t5.m4.rotuloIgnorada", "esta transición no se actualiza")));
    }
    svg.appendChild(textoSvg({
      x: 58, y: 132, "font-size": 11, fill: suave, "text-anchor": "middle",
    }, "x = 1"));
    svg.appendChild(textoSvg({
      x: 190, y: 132, "font-size": 11, fill: suave, "text-anchor": "middle",
    }, "x = 2"));
    return svg;
  }

  /* --- dibujo --- */

  function dibujar() {
    const res = fragmentoW2W({ gamma, alpha, w0: W0_M4, pasos: PASOS_M4, regimen });

    pintar(viz1.cuerpo, dibujarFragmento(res.serie[0]));

    const anotaciones = [];
    const iMil = res.serie.findIndex((w) => Math.abs(w) > 1000);
    if (iMil > 0) {
      anotaciones.push({ x: iMil, texto: t("t5.m4.anotMil", "|w| > 1000") });
    }
    const serie = [{
      nombre: t("t5.m4.serieW", "\\(w_t\\)"),
      color: tono("--acento"), grosor: 2.6, puntos: res.serie.length <= 80,
      x: res.serie.map((_, i) => i), y: res.serie,
    }];
    pintar(viz2.cuerpo, graficaLineas(serie, {
      ejeX: regimen === "on"
        ? t("t5.m4.viz2xOn", "Episodios")
        : t("t5.m4.viz2x", "Actualizaciones"),
      ejeY: t("t5.m4.viz2y", "w"),
      yMin: res.veredicto === "divergen" ? 0 : undefined,
      lineaCero: true,
      ticksX: [0, 10, 20, 30, 40, 50, 60].map((v) => ({ valor: v, etiqueta: String(v) })),
      anotaciones,
      mensaje: t("t5.m4.viz2vacio", "Mueve \\(\\gamma\\) para ver la trayectoria."),
    }));
    fijarPie(viz2.pie, t("t5.m4.rotuloExacto", "Cálculo exacto · sin simulación"));

    /* La fórmula viva, con los valores sustituidos. */
    /* El factor sale del motor (`res.factor`), no se recalcula aquí: dentro de
       política el episodio tiene DOS actualizaciones y el factor es
       (1+α(2γ−1))(1−4α), no solo la primera. Recalcularlo a mano hacía que la
       fórmula dijera 1,0980 mientras la métrica de al lado decía 0,6588. */
    const primera = `${numMat(gamma, 2)}\\cdot 2w_t - w_t = ${numMat(2 * gamma - 1, 2)}\\,w_t`;
    formula.innerHTML = regimen === "on"
      ? `\\[ \\delta_t = 0 + ${primera}`
        + `\\qquad\\Longrightarrow\\qquad w_{t+2} = ${numMat(res.factor, 4)}\\,w_t \\]`
      : `\\[ \\delta_t = 0 + ${primera}`
        + `\\qquad\\Longrightarrow\\qquad w_{t+1} = ${numMat(res.factor, 4)}\\,w_t \\]`;
    renderizarMatematicas(formula);

    /* Traza inspeccionable: las seis primeras actualizaciones. */
    const filas = res.traza.slice(0, enMovil() ? 3 : 6).map((f) => [
      String(f.t), num(f.w, 3), num(f.w, 3), num(2 * f.w, 3),
      num(f.delta, 3), num(f.deltaW, 3), num(f.wSiguiente, 3),
    ]);
    traza.actualizar(filas);

    const veredictos = {
      divergen: t("t5.m4.divergen", "los pesos divergen"),
      convergen: t("t5.m4.convergen", "los pesos se apagan"),
      quietos: t("t5.m4.quietos", "los pesos no se mueven"),
    };
    fijarCifra(cifras.factor, num(res.factor, 4));
    fijarCifra(cifras.veredicto, `<span style="font-size:1rem">${veredictos[res.veredicto]}</span>`);
    fijarCifra(cifras.pasos, res.pasosHastaMil === null
      ? t("t5.m4.nunca", "no llega") : String(res.pasosHastaMil));
    fijarCifra(cifras.umbral, num(0.5, 1));

    /* Tabla «no depende de α»: los cuatro pasos con el γ actual. */
    tablaAlpha.actualizar(ALFAS_M4.map((a) => {
      const r = fragmentoW2W({ gamma, alpha: a, w0: W0_M4, pasos: 1, regimen });
      return {
        destacada: a === alpha,
        celdas: [num(a, 2), num(r.factor, 4), veredictos[r.veredicto]],
      };
    }));

    ver(notaUmbral, Math.abs(gamma - 0.5) < 1e-9);
    ver(notaDentro, regimen === "on");
    ver(notaAlphaGrande, regimen === "on");
    ver(notaDesborde, res.desbordado);
  }

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m4-quiz"), [
    {
      enunciado: "Con \\(\\gamma = 0{,}99\\), bajas \\(\\alpha\\) de 0,3 a 0,01. ¿Qué cambia?",
      opciones: [
        "La velocidad a la que \\(w\\) se va a infinito, pero no el hecho de que se vaya: el factor "
        + "sigue siendo mayor que 1 para cualquier \\(\\alpha>0\\).",
        "Deja de divergir, porque con un paso suficientemente pequeño la actualización "
        + "semi-gradiente vuelve a ser estable.",
        "Deja de divergir solo si además se reduce \\(\\gamma\\) por debajo de 0,99, porque la "
        + "estabilidad depende del producto \\(\\alpha\\gamma\\).",
        "Nada, porque en este ejemplo \\(\\alpha\\) se cancela al ser el gradiente igual a 1.",
      ],
      correcta: 0,
      explicacion: "El factor de crecimiento es \\(1+\\alpha(2\\gamma-1)\\): con "
        + "\\(2\\gamma-1>0\\), cualquier \\(\\alpha\\) positivo lo deja por encima de 1, y \\(w\\) "
        + "crece geométricamente. El libro es explícito: la inestabilidad ocurre para cualquier tamaño "
        + "de paso positivo, por pequeño que sea, y el paso solo afecta a la velocidad. La condición de "
        + "estabilidad no es sobre el producto \\(\\alpha\\gamma\\) sino sobre el signo de "
        + "\\(2\\gamma-1\\), con el umbral en \\(\\gamma = 0{,}5\\). Y \\(\\alpha\\) no se cancela: "
        + "multiplica al error, y por eso cambia la pendiente.",
    },
    {
      enunciado: "¿Qué es exactamente lo que cambia al pasar de fuera de política a dentro de "
        + "política en este ejemplo?",
      opciones: [
        "Que también se actualiza la transición de salida del segundo estado, cuya actualización "
        + "empuja \\(w\\) hacia abajo y compensa la primera.",
        "Que el error TD deja de depender de \\(w\\), porque dentro de política el objetivo se "
        + "calcula con el valor verdadero en lugar de con la estimación.",
        "Que la razón de muestreo de importancia deja de ser 1 y pondera la actualización hacia "
        + "abajo.",
        "Que el gradiente pasa de valer 1 a valer 2, porque dentro de política se recorre el segundo "
        + "estado y su característica es \\(x=2\\).",
      ],
      correcta: 0,
      explicacion: "La clave del ejemplo es que fuera de política esa transición se repite sin que "
        + "\\(w\\) se actualice en las demás; dentro de política se recorre el episodio completo, y la "
        + "transición al terminal aporta \\(\\Delta w = -4\\alpha w\\), que es lo que mantiene el "
        + "sistema a raya. El objetivo sigue siendo una estimación en los dos casos —eso es el "
        + "<em>bootstrapping</em>, y no cambia—. La razón de importancia va al revés: dentro de "
        + "política vale siempre uno, y es fuera de política donde vale cero en las transiciones que la "
        + "política objetivo nunca tomaría. Y el gradiente vale 1 en la primera transición y 2 en la "
        + "segunda: no es que “pase a valer 2”, es que hay dos actualizaciones distintas.",
    },
    {
      enunciado: "En el contraejemplo de Baird, el valor verdadero es cero en todos los estados y se "
        + "puede representar exactamente con \\(w=0\\). ¿Por qué divergen entonces los pesos?",
      opciones: [
        "Porque están los tres inductores a la vez: aproximación, <em>bootstrapping</em> y una "
        + "distribución de actualización que no es la que produce la política objetivo. Que exista una "
        + "solución exacta no garantiza que el proceso la encuentre.",
        "Porque hay ocho pesos para siete estados y el problema está sobreparametrizado, así que no "
        + "hay una solución única a la que converger.",
        "Porque las características de los siete estados no son linealmente independientes y la "
        + "matriz del sistema es singular.",
        "Porque la política de comportamiento no cubre todas las acciones de la política objetivo, y "
        + "sin cobertura ningún método fuera de política converge.",
      ],
      correcta: 0,
      explicacion: "El libro presenta el ejemplo precisamente para dejar claro que todas las "
        + "condiciones “favorables” se cumplen —hay solución exacta, hay muchas, y las características "
        + "son linealmente independientes— y que la divergencia viene de la combinación de los tres "
        + "inductores. La sobreparametrización no es el problema: hay muchas soluciones, y cualquiera "
        + "valdría. Las características <strong>sí</strong> son linealmente independientes, y el libro "
        + "lo subraya. Y la cobertura se cumple: la política de comportamiento toma la acción continua "
        + "una de cada siete veces, así que todas las acciones de la política objetivo tienen "
        + "probabilidad positiva.",
    },
  ], { claves: "t5.m4.quiz" });
}


/** El máximo de la superficie, como entero legible.
 *
 * Cuando los pesos revientan —traza acumulativa con \(\alpha m \ge 0{,}5\)—
 * el máximo llega a 2,2·10³⁶, y `String(Math.round(...))` lo escupía en
 * notación exponencial dentro de una métrica que el guion declara entera.
 * La regla del módulo 4 vale también aquí: no se dibuja NaN ni Infinity. */
function textoMaximo(superficie) {
  if (!superficie) return "\u2014";
  const m = superficie.maximo;
  if (!Number.isFinite(m)) return "\u2014";
  if (Math.abs(m) >= 1e7) return "> 10\u2076";   // los pesos se han ido
  return String(Math.round(m));
}

/* ======================================================================= *
 * MÓDULO 5 — control: SARSA semi-gradiente en Mountain Car
 * ======================================================================= */

/** Los cinco α×m del deslizador; los tres primeros son los de la figura 10.2. */
const ALFAS_M5 = [0.1, 0.2, 0.5, 1.0, 1.5];
/**
 * Con λ > 0 no se ofrece α×m = 1,5.
 *
 * ⚠ LA EXCLUSIÓN ES DE LA INTERFAZ: `curvasControl` recorre sus cinco α×m
 * siempre, así que hoy NO ahorra tiempo de cálculo. Para que lo ahorre, el
 * worker necesitaría un parámetro `alphasM` (queda reportado). Lo que sí evita
 * es que el alumno mire una familia en la que la traza acumulativa revienta
 * por el paso y no por la traza.
 */
const ALFAS_M5_CON_TRAZA = [0.1, 0.2, 0.5, 1.0];
const EPISODIOS_M5 = 500;

function modulo5() {
  const zonaControles = $("#m5-controles");
  const zonaViz1 = $("#m5-viz1");
  const zonaViz2 = $("#m5-viz2");
  const zonaMetricas = $("#m5-metricas");
  const zonaCajas = $("#m5-cajas");

  /* --- estado del módulo --- */
  let iAlpha = 2;                    // ALFAS_M5[2] = 0,5, la curva más rápida
  let algoritmo = "sarsa";
  let traza = { lambda: 0, tipo: "reemplazo" };
  let instantanea = "ep500";
  const alphaM = () => ALFAS_M5[iAlpha];
  const otro = () => (algoritmo === "sarsa" ? "qLearning" : "sarsa");
  const nombreAlgo = (a) => (a === "sarsa" ? "SARSA" : "Q-learning");

  const entorno = mountainCar();
  const repr = tileCoding2D({
    rangos: entorno.rangos, m: 8, desplazamiento: [1, 3], nAcciones: 3, mosaicosPorLado: 8,
  });

  /** Caché por (semilla, algoritmo, λ, tipo de traza). */
  const cache = new Map();
  const clave = (algo) => `${semillaActual()}|${algo}|${traza.lambda}|${traza.lambda > 0 ? traza.tipo : "-"}`;
  const enMarcha = new Set();
  let error = null;

  $("#m5-semilla").textContent = t("t5.m5.semillaPie",
    "Semilla {s} · SARSA y Q-learning comparten las semillas", { s: semillaActual() });

  /* --- textos de encuadre --- */

  parrafo(zonaControles, "explicacion", t("t5.m5.explicacion",
    "Un coche sin potencia en un valle. La gravedad es más fuerte que el motor, así que a todo gas "
    + "no puede subir la pendiente: la única solución es <strong>alejarse primero de la meta</strong>, "
    + "subir la ladera contraria y usar la inercia. Cada paso cuesta <strong>−1</strong> hasta llegar "
    + "arriba a la derecha, así que el valor de un estado es, con el signo cambiado, <strong>cuántos "
    + "pasos quedan</strong>. El estado son dos números continuos —posición y velocidad— y se "
    + "convierten en \\(x(s,a)\\) con <strong>ocho mosaicados</strong> de mosaicos que cubren un "
    + "octavo del rango en cada dimensión, con desplazamientos asimétricos: <strong>ocho "
    + "características activas de 1944</strong>."));

  aviso(zonaControles, t("t5.m5.notaOptimismo",
    "Fíjate en la primera instantánea, «paso 428»: no se ha completado <strong>ni un "
    + "episodio</strong>, y el coche lleva un rato oscilando en el fondo del valle. Todos los estados "
    + "por los que ha pasado valen <strong>peor</strong> que los que no ha visitado nunca, porque las "
    + "recompensas reales han sido peores de lo que —irrealmente— se esperaba: con \\(w = 0\\) y "
    + "recompensa \\(-1\\) en todos los pasos, <strong>todo estado no visitado parece perfecto</strong>. "
    + "Eso empuja al agente a salir continuamente de donde ha estado, y es <strong>inicialización "
    + "optimista</strong> —la del tema 1— con aproximación de funciones. Aquí funciona tan bien que la "
    + "figura 10.1 del libro se obtiene con \\(\\varepsilon = 0\\)."));

  aviso(zonaControles, t("t5.m5.notaEpsilon",
    "\\(\\varepsilon = 0{,}1\\), fijo. <strong>El libro no publica el \\(\\varepsilon\\) de la figura "
    + "10.2</strong>; la figura 10.1, en cambio, usa \\(\\varepsilon = 0\\) con la inicialización "
    + "optimista de arriba. Aquí hace falta \\(\\varepsilon > 0\\) por una razón concreta: <strong>con "
    + "\\(\\varepsilon = 0\\) los dos algoritmos son la misma regla</strong> —la acción greedy es el "
    + "\\(\\arg\\max\\), y el objetivo de SARSA coincide con el máximo en cada paso—, así que lo que se "
    + "estaría comparando <strong>no es dentro de política frente a fuera de política</strong>, sino el "
    + "<strong>momento</strong> en que cada caja elige la acción. Eso no es la lección. La comparación "
    + "que importa solo existe si hay exploración."));

  /* La precisión que destapó el motor: «misma regla» no es «misma ejecución».
     El guion lo afirmaba mal y el test C5-12b comprueba que se separan. */
  aviso(zonaControles, t("t5.m5.notaEpsilonRegla",
    "Una precisión fina, y es de las que se examinan. Con \\(\\varepsilon = 0\\), SARSA y Q-learning "
    + "son <strong>la misma regla</strong>, porque la acción greedy <strong>es</strong> el "
    + "\\(\\arg\\max\\) y evaluar \\(\\hat q\\) en ella es tomar el máximo. Pero <strong>no son la "
    + "misma ejecución</strong>, y la diferencia está en <strong>cuándo se elige la acción</strong>: "
    + "en la caja de SARSA, \\(A'\\) se elige <strong>antes</strong> de actualizar los pesos; en "
    + "Q-learning se elige al principio del paso siguiente, es decir <strong>después</strong>. Cuando "
    + "la actualización baja el \\(\\hat q\\) de la acción que se acaba de tomar —y con recompensa "
    + "\\(-1\\) siempre, eso pasa todo el tiempo—, el \\(\\arg\\max\\) en \\(S'\\) cambia entre los dos "
    + "momentos, y las dos trayectorias se separan. Con los valores por omisión de este módulo ocurre "
    + "ya en el <strong>tercer paso del primer episodio</strong>, con el mismo estado y el mismo "
    + "objetivo. La moraleja no cambia: "
    + "lo que separa a los dos algoritmos es <strong>el objetivo</strong>, y \\(\\varepsilon > 0\\) es "
    + "lo que hace que esa diferencia se note en el aprendizaje y no solo en el orden de dos líneas "
    + "de pseudocódigo."));

  aviso(zonaControles, t("t5.m5.notaFigura102",
    "Y un aviso sobre la figura 10.2 del libro, el de su propia nota al pie: <strong>esos datos no "
    + "son de SARSA de un paso, son de «SARSA(λ) semi-gradiente», del capítulo 12</strong>, que no se "
    + "ve en este tema. Este módulo usa <strong>SARSA semi-gradiente de un paso</strong>, que es la "
    + "caja de <code>#slide-19</code>, así que <strong>las curvas no coinciden exactamente con las del "
    + "libro</strong> y no deben compararse cifra a cifra. La forma —bajar rápido y estabilizarse— sí "
    + "es la misma."));

  aviso(zonaControles, t("t5.m5.notaSimplificacion",
    "Tres diferencias con el libro, todas por presupuesto de cálculo y todas declaradas. Una: el "
    + "libro promedia <strong>100 ejecuciones</strong> en la figura 10.2 y aquí se promedian "
    + "<strong>10</strong>. Dos: la figura 10.1 llega al <strong>episodio 9000</strong> y aquí se llega "
    + "al <strong>500</strong>. Tres: el libro hashea el espacio de características a 4096 posiciones "
    + "con la utilidad <code>IHT(4096)</code>; aquí se indexa directamente, porque "
    + "\\(8\\times 9\\times 9\\times 3 = 1944\\) pesos caben de sobra en 4096 y <strong>al no haber "
    + "colisiones el aproximador es exactamente el mismo</strong>. La tercera no cambia nada; las dos "
    + "primeras solo cambian el suavizado de las curvas y cuánto se aplana la superficie."));

  aviso(zonaControles, t("t5.m5.notaGamma",
    "\\(\\gamma = 1\\): tarea episódica y sin descuento. <strong>El libro no lo escribe</strong> para "
    + "Mountain Car; es lo único coherente con que el coste por recorrer de la figura 10.1 llegue a "
    + "120, del orden del número de pasos."));

  aviso(zonaControles, t("t5.m5.notaEmpates",
    "Cuando dos o tres acciones empatan en \\(\\hat q\\), se elige entre ellas al azar. Con "
    + "\\(w=0\\) las tres empatan al empezar, así que la elección importa; el libro no precisa qué "
    + "hace."));

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  const mandoAlpha = controlDeslizador(panel, {
    etiqueta: t("t5.m5.alphaLabel", "\\(\\alpha\\times\\) mosaicados (8)"),
    min: 0, max: ALFAS_M5.length - 1, valor: iAlpha,
    formato: (v) => num(ALFAS_M5[v], ALFAS_M5[v] === 1 ? 0 : 1),
    alCambiar: (v) => {
      iAlpha = v;
      if (traza.lambda > 0 && !ALFAS_M5_CON_TRAZA.includes(alphaM())) {
        iAlpha = ALFAS_M5.indexOf(1.0);
        mandoAlpha.fijar(iAlpha);
      }
      dibujar();
    },
  });
  const mandoAlgo = grupoRadio(panel, t("t5.m5.algoLabel", "Algoritmo"), [
    { valor: "sarsa", texto: "SARSA" },
    { valor: "qLearning", texto: "Q-learning" },
  ], algoritmo, (v) => { algoritmo = v; pedir(); });
  const mandoTraza = grupoRadio(panel, t("t5.m5.trazaLabel", "Traza"), [
    { valor: "0", texto: t("t5.m5.trazaCero", "\\(\\lambda = 0\\) (sin traza)"), html: true },
    { valor: "r", texto: t("t5.m5.trazaReemplazo", "\\(\\lambda = 0{,}9\\) · reemplazo"), html: true },
    { valor: "a", texto: t("t5.m5.trazaAcumulativa", "\\(\\lambda = 0{,}9\\) · acumulativa"), html: true },
  ], "0", (v) => {
    traza = v === "0"
      ? { lambda: 0, tipo: "reemplazo" }
      : { lambda: 0.9, tipo: v === "r" ? "reemplazo" : "acumulativa" };
    if (traza.lambda > 0 && !ALFAS_M5_CON_TRAZA.includes(alphaM())) {
      iAlpha = ALFAS_M5.indexOf(1.0);
      mandoAlpha.fijar(iAlpha);
    }
    /* Y se acorta el recorrido: dejar el tope en 1,5 con lambda > 0 daba un
       pulgar que se movia sin que cambiara nada. */
    mandoAlpha.input.max = String((traza.lambda > 0 ? ALFAS_M5_CON_TRAZA : ALFAS_M5).length - 1);
    pedir();
  });
  const mandoInstantanea = grupoRadio(panel,
    t("t5.m5.instantaneaLabel", "Instantánea de la superficie"), [
      { valor: "paso428", texto: t("t5.m5.instPaso428", "paso 428") },
      { valor: "ep12", texto: t("t5.m5.instEp12", "episodio 12") },
      { valor: "ep104", texto: t("t5.m5.instEp104", "episodio 104") },
      { valor: "ep500", texto: t("t5.m5.instEp500", "episodio 500") },
    ], instantanea, (v) => { instantanea = v; dibujarViz1(); });
  botonControl(panel, t("t5.m5.reiniciar", "Valores por omisión"), () => {
    iAlpha = 2; algoritmo = "sarsa"; traza = { lambda: 0, tipo: "reemplazo" };
    instantanea = "ep500";
    mandoAlpha.fijar(iAlpha); mandoAlgo.marcar(algoritmo);
    mandoTraza.marcar("0"); mandoInstantanea.marcar(instantanea);
    pedir();
  });

  /* --- visualizaciones y métricas --- */

  const viz1 = caja(zonaViz1, t("t5.m5.viz1",
    "Coste por recorrer, \\(-\\max_a \\hat q(s,a,w)\\)"), { conPie: true });
  const viz2 = caja(zonaViz2, t("t5.m5.viz2", "Cuántos pasos tarda en llegar arriba"),
    { conPie: true });
  const progreso = barraProgreso(viz2.cuerpo);

  const cifras = metricas(zonaMetricas, [
    { id: "final", etiqueta: t("t5.m5.mFinal", "Pasos por episodio, últimos 50 episodios") },
    { id: "finalOtro", etiqueta: t("t5.m5.mFinalOtro", "El otro algoritmo, mismos episodios") },
    { id: "primeros", etiqueta: t("t5.m5.mPrimeros",
      "Pasos por episodio, primeros 50 (el eje de la figura 10.4)") },
    { id: "maxCoste", etiqueta: t("t5.m5.mMaxCoste", "Máximo de la superficie") },
    { id: "traza", etiqueta: t("t5.m5.mTraza", "Componentes de \\(z\\) no nulas (media)") },
  ]);

  /* --- notas condicionales de la traza y de los topes --- */

  const zonaNotas = document.createElement("div");
  zonaMetricas.after(zonaNotas);
  const notaLambda = aviso(zonaNotas, t("t5.m5.notaLambda",
    "Trazas activadas, \\(\\lambda = 0{,}9\\). Ahora cada paso actualiza <strong>todos los pesos con "
    + "traza no nula</strong>, no solo los ocho activos, y el crédito del error TD se reparte hacia "
    + "atrás a lo largo del episodio. Dos cosas que <strong>no</strong> cambian: sigue siendo un método "
    + "<strong>semi-gradiente</strong>, y la traza sigue teniendo <strong>dimensión \\(d = 1944\\)</strong>, "
    + "la de los pesos —no la del espacio de estados, que aquí es continuo—. Con \\(\\lambda = 0\\) esto "
    + "es, exactamente, el algoritmo de un paso de la caja de <code>#slide-19</code>. El desarrollo está "
    + "en el bloque de apuntes de las trazas, más arriba."));
  const notaLambdaEjecuciones = aviso(zonaNotas, t("t5.m5.notaLambdaEjecuciones",
    "Con trazas, las curvas se promedian sobre <strong>5 ejecuciones</strong> en lugar de 10: cada "
    + "paso cuesta más porque hay que recorrer las componentes de la traza que no son cero. Se dice "
    + "aquí porque cambia <strong>el suavizado</strong> de las curvas, no las conclusiones."));
  const notaPoda = aviso(zonaNotas, t("t5.m5.notaPoda",
    "Simplificación declarada: la traza se guarda como <strong>lista de componentes no nulas</strong>, "
    + "no como un vector de 1944 números recorrido entero en cada paso —eso multiplicaría el coste por "
    + "\\(1944/8\\)—. Las componentes que bajan de \\(10^{-8}\\) en valor absoluto <strong>se eliminan "
    + "de la lista</strong>: con \\(\\gamma\\lambda \\le 0{,}9\\) eso es ruido de redondeo frente a la "
    + "magnitud de la actualización."));
  const notaNoReproduce = aviso(zonaNotas, t("t5.m5.notaNoReproduce",
    "Y que quede claro, porque es la inferencia fácil y es falsa: <strong>activar las trazas no vuelve "
    + "reproducible la figura 10.2</strong>. Es verdad que sus datos son de «SARSA(λ) semi-gradiente», "
    + "pero <strong>el libro no publica el \\(\\lambda\\) que usó</strong>, y la propia nota al pie añade "
    + "que «SARSA semi-gradiente se comportaría de forma similar». La comparación con esa figura sigue "
    + "siendo <strong>cualitativa</strong> con \\(\\lambda = 0\\) y con \\(\\lambda = 0{,}9\\)."));
  const notaExcluir = aviso(zonaNotas, t("t5.m5.notaExcluir",
    "Con trazas, el deslizador <strong>no ofrece \\(\\alpha\\times m = 1{,}5\\)</strong>: ese paso es lo "
    + "bastante grande como para que lo que se vea sea el paso reventando y no lo que hace la traza, y "
    + "además es el valor que más cuesta calcular de los cinco. Con \\(\\lambda = 0\\) sigue estando, "
    + "porque ahí la lección <strong>es</strong> que el paso revienta."));
  /* Nota propia de la traza acumulativa. `notaDivergePesos` culpa al tamaño de
     paso, y aquí el culpable es OTRO: la traza acumulativa sobre
     características binarias solapadas. Es justo por lo que el libro usa traza
     de reemplazo con tile coding. Redacción provisional de este fichero: la
     clave definitiva la escribe el diseñador (queda reportado). */
  const notaTrazaAcumulativa = aviso(zonaNotas, t("t5.m5.notaTrazaAcumulativa",
    "<strong>Las ejecuciones han reventado, y esta vez el culpable no es el paso: es la traza "
    + "acumulativa.</strong> Con \\(\\lambda = 0{,}9\\) y \\(\\gamma = 1\\), \\(\\gamma\\lambda = 0{,}9\\), y como los ocho mosaicados <strong>se solapan</strong>, un "
    + "mosaico que se vuelve a activar en pasos consecutivos suma \\(1 + 0{,}9 + 0{,}81 + \\dots\\) "
    + "y su traza se acerca a <strong>10</strong>: la actualización efectiva de ese peso es diez "
    + "veces \\(\\alpha\\), y con \\(\\alpha\\times m \\ge 0{,}5\\) eso cruza de sobra la línea "
    + "\\(\\alpha = 1/m\\) de la que habla la otra nota. En Mountain Car, con el coche oscilando en "
    + "el fondo del valle, los mosaicos se repiten constantemente. Con traza de <strong>reemplazo"
    + "</strong> no pasa: la componente se pone a <strong>1</strong> y no pasa de ahí. <strong>Y eso "
    + "es exactamente por lo que el libro usa reemplazo con <em>tile coding</em></strong>. Baja "
    + "\\(\\alpha\\times m\\) a 0,1 o a 0,2 —ahí la acumulativa aguanta, y aprende algo mejor que "
    + "sin traza—, o cambia a reemplazo."));
  const notaDivergePesos = aviso(zonaNotas, t("t5.m5.notaDivergePesos",
    "Con este paso, alguna ejecución ha reventado numéricamente: los pesos han pasado de "
    + "\\(10^{6}\\). Es el paso demasiado grande, no la tríada —SARSA aquí es dentro de política—. Baja "
    + "\\(\\alpha\\times m\\)."));
  const notaTope = aviso(zonaNotas, "");

  /* --- las dos cajas de pseudocódigo, enfrentadas --- */

  const cajaQ = document.createElement("pre");
  cajaQ.className = "codigo";
  cajaQ.textContent = t("t5.m5.cajaQ",
    "Q-learning semi-gradiente episódico — lo que cambia respecto de SARSA\n"
    + "\n"
    + "    Repetir para cada paso del episodio:\n"
    + "        Elegir A en función de q̂(S,·,w)   (p. ej. ε-greedy)   ← la elección se hace AQUÍ\n"
    + "        Tomar la acción A; observar R, S′\n"
    + "        Si S′ es terminal:\n"
    + "            w ← w + α[R − q̂(S,A,w)] ∇q̂(S,A,w)\n"
    + "            pasar al episodio siguiente\n"
    + "        w ← w + α[R + γ max_a q̂(S′,a,w) − q̂(S,A,w)] ∇q̂(S,A,w)   ← el objetivo es el MÁXIMO\n"
    + "        S ← S′\n");
  zonaCajas.appendChild(cajaQ);

  parrafo(zonaCajas, "explicacion siempre", t("t5.m5.explicaCajas",
    "Ésa es toda la diferencia, y es la respuesta al ejercicio de <code>#slide-20</code>: la línea "
    + "«Elegir \\(A'\\)» <strong>desaparece como elección de la acción a ejecutar</strong> —en "
    + "Q-learning la acción del paso siguiente se elige al principio del paso siguiente, no aquí— y el "
    + "objetivo pasa de \\(\\hat q(S',A',w)\\), la acción <strong>realmente elegida</strong>, a "
    + "\\(\\max_a \\hat q(S',a,w)\\). Ese \\(\\max\\) es lo que convierte el método en <strong>fuera de "
    + "política</strong>, y por tanto lo que le añade el tercer inductor de inestabilidad. En el caso "
    + "lineal las dos reglas se escriben igual, \\(\\Delta w = \\alpha\\,\\delta\\,x(S,A)\\), con el "
    + "\\(\\delta\\) que corresponda."));

  aviso(zonaCajas, t("t5.m5.notaXSA",
    "\\(x(s,a)\\), el vector de características del <strong>par</strong> estado-acción, es la notación "
    + "que se examina y la que en clase <strong>no se ve</strong>: en <code>#slide-19</code> la fórmula "
    + "que la contiene está tapada por la caja de pseudocódigo. Aquí es literal: \\(x(s,a)\\) tiene 1944 "
    + "componentes, de las cuales <strong>ocho</strong> valen 1 —una por mosaicado— y <strong>dependen "
    + "de la acción</strong>: los mosaicos de las tres acciones son distintos, así que entrenar la "
    + "acción «gas adelante» en un estado no cambia el valor de «gas atrás» en ese mismo estado."));

  /* --- dibujo --- */

  /** Los pesos de la instantánea elegida, del α×m elegido, si ya han llegado. */
  function pesosInstantanea() {
    const datos = cache.get(clave(algoritmo));
    if (!datos) return null;
    const fila = datos.resultados.find((r) => r.alphaM === alphaM());
    if (!fila) return null;
    const inst = fila.instantaneas.find((s) => s.clave === instantanea);
    return inst ? inst.w : fila.pesosFinales;
  }

  function dibujarViz1() {
    const w = pesosInstantanea();
    /* Siempre 60: con 30 el maximo de la superficie pasaba de 143 a 141 y
       una metrica no puede depender del ancho de la ventana. Cuesta 1 ms. */
    const celdas = 60;
    let superficie = null;
    if (w) {
      superficie = costePorRecorrer(repr, Float64Array.from(w), {
        rangos: entorno.rangos, celdas, acciones: entorno.acciones,
      });
    }
    pintar(viz1.cuerpo, campoCalor({
      valores: superficie ? superficie.valores : null,
      celdasX: celdas, celdasY: celdas,
      rangoX: entorno.rangos[0], rangoY: entorno.rangos[1],
      ejeX: t("t5.m5.viz1x", "Posición p"),
      ejeY: t("t5.m5.viz1y", "Velocidad ṗ"),
      ticksX: [-1.2, -0.5, 0, 0.5].map((v) => ({ valor: v, etiqueta: num(v, 1) })),
      ticksY: [-0.07, 0, 0.07].map((v) => ({ valor: v, etiqueta: num(v, 2) })),
      /* Escala por instantánea, como los cinco paneles de la figura 10.1, que
         tienen máximos distintos; el máximo va escrito al lado. */
      min: 0, max: superficie ? Math.max(1, superficie.maximo) : undefined,
      leyenda: {
        frio: t("t5.m5.frio", "0 (queda poco)"),
        caliente: t("t5.m5.caliente", "{max} (queda mucho)",
          { max: superficie ? Math.round(superficie.maximo) : "?" }),
      },
      ancho: 460, alto: 320,
      mensaje: error
        ? t("t5.m5.error", "El cálculo ha fallado: {m}", { m: error })
        : t("t5.m5.viz1vacio", "Entrenando el agente para dibujar la superficie…"),
    }));
    fijarPie(viz1.pie, t("t5.m5.viz1runs", "1 ejecución (la primera) · semilla {s}",
      { s: semillaActual() }));
    fijarCifra(cifras.maxCoste, textoMaximo(superficie));
  }

  function dibujarViz2() {
    const datos = cache.get(clave(algoritmo));
    const datosOtro = cache.get(clave(otro()));
    const series = [];
    const visibles = traza.lambda > 0 ? ALFAS_M5_CON_TRAZA : ALFAS_M5;

    if (datos) {
      const solo = enMovil();
      datos.resultados
        .filter((r) => visibles.includes(r.alphaM))
        .filter((r) => !solo || r.alphaM === alphaM())
        .forEach((r) => {
          const elegida = r.alphaM === alphaM();
          const color = tono(COLORES_SERIE[ALFAS_M5.indexOf(r.alphaM) % COLORES_SERIE.length]);
          series.push({
            nombre: t("t5.m5.serieAlpha", "\\(\\alpha\\times m = \\) {v}",
              { v: num(r.alphaM, r.alphaM === 1 ? 0 : 1) }),
            color: elegida ? color : conAlfa(color, 0.42),
            grosor: elegida ? 3 : 1.2,
            x: r.curva.map((_, i) => i + 1), y: r.curva,
          });
        });
    }
    if (datosOtro) {
      const fila = datosOtro.resultados.find((r) => r.alphaM === alphaM());
      if (fila) {
        series.push({
          nombre: t("t5.m5.serieOtro", "{otro}, \\(\\alpha\\times m = \\) {v}",
            { otro: nombreAlgo(otro()), v: num(alphaM(), alphaM() === 1 ? 0 : 1) }),
          color: tono("--texto-suave"), grosor: 2.2, discontinua: true,
          x: fila.curva.map((_, i) => i + 1), y: fila.curva,
        });
      }
    }

    pintar(viz2.cuerpo, graficaLineas(series, {
      ejeX: t("t5.m5.viz2x", "Episodio"),
      ejeY: t("t5.m5.viz2y", "Pasos por episodio"),
      escalaY: "log",
      ticksY: [100, 200, 400, 1000, 2000].map((v) => ({ valor: v, etiqueta: String(v) })),
      ticksX: [1, 100, 200, 300, 400, 500].map((v) => ({ valor: v, etiqueta: String(v) })),
      mensaje: error
        ? t("t5.m5.error", "El cálculo ha fallado: {m}", { m: error })
        : t("t5.m5.viz2vacio", "Calculando los cinco pasos de aprendizaje…"),
    }));
    if (series.length) conLeyenda(viz2.cuerpo, series);
    viz2.cuerpo.appendChild(progreso.caja);
    ver(progreso.caja, !datos && !error);

    const ejecuciones = datos ? datos.ejecuciones : (traza.lambda > 0 ? 5 : 10);
    fijarPie(viz2.pie, traza.lambda > 0
      ? t("t5.m5.viz2runs5",
        "<strong>5 ejecuciones independientes</strong> (con trazas) · semillas {a}…{b}",
        { a: semillaActual(), b: semillaActual() + ejecuciones - 1 })
      : t("t5.m5.viz2runs",
        "<strong>10 ejecuciones independientes</strong> · semillas {a}…{b}",
        { a: semillaActual(), b: semillaActual() + ejecuciones - 1 }));

    /* Métricas de las curvas. */
    const fila = datos && datos.resultados.find((r) => r.alphaM === alphaM());
    const filaOtro = datosOtro && datosOtro.resultados.find((r) => r.alphaM === alphaM());
    fijarCifra(cifras.final, fila ? String(Math.round(fila.ultimos50)) : "—");
    fijarCifra(cifras.finalOtro, filaOtro ? String(Math.round(filaOtro.ultimos50)) : "—");
    fijarCifra(cifras.primeros, fila ? String(Math.round(fila.primeros50)) : "—");
    fijarCifra(cifras.traza, fila && fila.trazaNoNulaMedia !== null
      ? String(Math.round(fila.trazaNoNulaMedia)) : "—");
    ver(cifras["traza$caja"], traza.lambda > 0);

    /* Notas que dependen del resultado. */
    ver(notaDivergePesos, Boolean(fila && fila.cortadas && traza.tipo !== "acumulativa"));
    ver(notaTrazaAcumulativa,
      Boolean(traza.lambda > 0 && traza.tipo === "acumulativa" && fila && fila.cortadas));
    if (fila && fila.topes) {
      notaTope.innerHTML = t("t5.m5.notaTope",
        "{n} episodios de los {total} simulados han alcanzado el tope de 5.000 pasos y se han "
        + "cortado. Se cuentan como 5.000 pasos en la media y se marcan en la gráfica. El libro no pone "
        + "tope; aquí hace falta uno para que el bucle termine.",
        { n: fila.topes, total: ejecuciones * EPISODIOS_M5 });
      renderizarMatematicas(notaTope);
    }
    ver(notaTope, Boolean(fila && fila.topes));
  }

  function dibujar() {
    ver(notaLambda, traza.lambda > 0);
    ver(notaLambdaEjecuciones, traza.lambda > 0);
    ver(notaPoda, traza.lambda > 0);
    ver(notaNoReproduce, traza.lambda > 0);
    ver(notaExcluir, traza.lambda > 0);
    dibujarViz1();
    dibujarViz2();
  }

  /** Pide las dos tandas: primero la del algoritmo elegido. */
  function pedir() {
    dibujar();
    for (const algo of [algoritmo, otro()]) {
      const k = clave(algo);
      if (cache.has(k) || enMarcha.has(k)) continue;
      enMarcha.add(k);
      error = null;
      calcular("control", {
        semilla: semillaActual(), algoritmo: algo, episodios: EPISODIOS_M5,
        epsilon: 0.1, gamma: 1, lambda: traza.lambda, traza: traza.tipo,
      }, (fraccion) => { if (algo === algoritmo) progreso.fijar(fraccion); })
        .then((resultado) => {
          cache.set(k, resultado);
          enMarcha.delete(k);
          dibujar();
        })
        .catch((e) => {
          error = e.message;
          enMarcha.delete(k);
          dibujar();
        });
    }
  }

  oyentesSemilla.push(() => {
    $("#m5-semilla").textContent = t("t5.m5.semillaPie",
      "Semilla {s} · SARSA y Q-learning comparten las semillas", { s: semillaActual() });
    pedir();
  });
  repintadores.push(dibujar);

  dibujar();
  alEntrarEnPantalla($("#m5"), pedir);

  crearQuiz($("#m5-quiz"), [
    {
      enunciado: "Con la inicialización \\(w = 0\\) y recompensa \\(-1\\) en todos los pasos, ¿qué le "
        + "pasa a un estado que el agente no ha visitado nunca?",
      opciones: [
        "Parece perfecto: su valor estimado es 0 y el verdadero es negativo, así que el agente se ve "
        + "empujado a explorar hacia donde no ha estado, incluso con \\(\\varepsilon = 0\\).",
        "Parece pésimo: al no tener información, la aproximación lineal extrapola hacia valores muy "
        + "negativos y el agente evita esa zona.",
        "No parece nada: los estados no visitados no tienen valor definido hasta que se visitan al "
        + "menos una vez.",
        "Parece exactamente igual que los visitados, porque la generalización del <em>tile "
        + "coding</em> les asigna el promedio de sus vecinos.",
      ],
      correcta: 0,
      explicacion: "Con \\(w=0\\) el valor estimado de cualquier par estado-acción es exactamente 0, "
        + "y como cada paso cuesta \\(-1\\), el valor verdadero de todo par no terminal es como poco "
        + "\\(-1\\): la estimación inicial es optimista <strong>en todas partes</strong>. Los estados "
        + "por los que el agente ya ha pasado han bajado, así que los no visitados destacan hacia "
        + "arriba y el agente los busca; el libro lo describe en la primera instantánea de la figura "
        + "10.1, y por eso esa figura se obtiene con \\(\\varepsilon=0\\). No hay extrapolación hacia "
        + "valores negativos: los pesos que no se han tocado siguen a cero. Y el valor de un estado no "
        + "visitado sí está definido: es la suma de los pesos de sus mosaicos, que puede ser cero o no "
        + "según lo que hayan movido los vecinos.",
    },
    {
      enunciado: "¿Qué línea de la caja de SARSA semi-gradiente hay que cambiar para tener "
        + "Q-learning semi-gradiente?",
      opciones: [
        "La del objetivo: \\(\\hat q(S',A',w)\\) —la acción realmente elegida— pasa a "
        + "\\(\\max_a \\hat q(S',a,w)\\); y con ello la elección de \\(A'\\) deja de ser la acción que "
        + "se va a ejecutar.",
        "La del gradiente: \\(\\nabla\\hat q(S,A,w)\\) pasa a \\(\\nabla\\hat q(S',A^*,w)\\), evaluado "
        + "en la acción greedy del estado siguiente.",
        "La de la política: hay que sustituir \\(\\varepsilon\\)-greedy por una política greedy pura, "
        + "porque Q-learning no explora.",
        "La del caso terminal: en Q-learning hay que incluir \\(\\max_a \\hat q(S',a,w)\\) también "
        + "cuando \\(S'\\) es terminal, porque el máximo está siempre definido.",
      ],
      correcta: 0,
      explicacion: "Es exactamente una línea, la del objetivo, y su consecuencia: al usar el máximo, "
        + "la acción \\(A'\\) ya no hace falta para actualizar, y la elección de la acción a ejecutar se "
        + "traslada al comienzo del paso siguiente. El gradiente se sigue evaluando en el par que se ha "
        + "vivido, \\((S,A)\\): eso no cambia. Q-learning explora igual —su política de comportamiento "
        + "sigue siendo \\(\\varepsilon\\)-greedy—; lo que ocurre es que aprende sobre la política "
        + "greedy, y eso es justo lo que lo hace fuera de política. Y el caso terminal sigue sin término "
        + "de continuación en los dos algoritmos, porque \\(\\hat q(\\text{terminal},\\cdot,w)=0\\).",
    },
    {
      enunciado: "Con 8 mosaicados, entrenas un paso en un estado. ¿Qué le pasa al valor estimado de "
        + "un estado vecino?",
      opciones: [
        "Se mueve, en proporción al número de mosaicos que comparte con el estado entrenado, y solo "
        + "para la acción que se entrenó.",
        "No se mueve, porque cada estado activa sus propios ocho mosaicos y los pesos son "
        + "independientes.",
        "Se mueve exactamente lo mismo que el estado entrenado, porque los ocho pesos se actualizan "
        + "por igual.",
        "Se mueve para todas las acciones, porque los mosaicos codifican el estado y la acción entra "
        + "después como un factor multiplicativo.",
      ],
      correcta: 0,
      explicacion: "La generalización de <em>tile coding</em> es exactamente eso: dos estados "
        + "cercanos comparten algunos mosaicos, y el vecino se mueve en proporción a cuántos comparte "
        + "—de ahí el perfil en rampa del módulo 2—. Los pesos no son independientes entre estados "
        + "vecinos: si lo fueran, no habría generalización y esto sería agregación con mosaicos de un "
        + "solo estado. Y no se mueve lo mismo que el estado entrenado, salvo que comparta los ocho. "
        + "Sobre la acción: \\(x(s,a)\\) indexa el par, así que los mosaicos de las tres acciones son "
        + "disjuntos y entrenar una acción no toca el valor de las otras en el mismo estado.",
    },
    {
      enunciado: "Activas las trazas con \\(\\lambda = 0{,}9\\) sobre este Mountain Car, donde hay "
        + "1944 pesos y 8 características activas por paso. ¿Qué dimensión tiene \\(z\\)?",
      opciones: [
        "1944, la misma que \\(w\\): la traza lleva un número por peso, y muchos de ellos son cero "
        + "—guardarla dispersa es una decisión de implementación, no un cambio de dimensión—.",
        "Ocho, una por mosaicado activo, porque solo esas características contribuyen en cada paso.",
        "El número de pares estado-acción, que con dos variables continuas es infinito; por eso hacen "
        + "falta trazas de reemplazo en lugar de acumulativas.",
        "Dieciocho, tres acciones por las seis variables con las que se describe el estado.",
      ],
      correcta: 0,
      explicacion: "La traza vive en el espacio de los pesos: con aproximación hay \\(d\\) pesos y la "
        + "traza lleva un número por cada uno, que dice cuánto ha contribuido ese peso a lo vivido "
        + "recientemente. Aquí \\(d = 1944\\). Las ocho componentes activas son las que se "
        + "<strong>incrementan</strong> en el paso actual, no el tamaño del vector: las demás no son "
        + "inexistentes, están desvaneciéndose. El número de pares estado-acción es justamente lo que la "
        + "aproximación deja de necesitar, y confundirlo con la dimensión de la traza es el error que el "
        + "examen penaliza; el tipo de traza —reemplazo o acumulativa— no tiene nada que ver con eso. Y "
        + "el 18 es la dimensión del ejemplo resuelto del bloque de apuntes, con seis variables y tres "
        + "acciones, no la de este módulo.",
    },
  ], { claves: "t5.m5.quiz" });
}

/* ======================================================================= *
 * MÓDULO 6 — las dos tablas de convergencia, casilla por casilla
 *
 * Los veintiún textos de evidencia van aquí como datos, con la clave que
 * fabrica el motor (`fichaCasilla().clave`): el motor tiene el veredicto y la
 * cita, y la interfaz tiene la prosa. Ninguna casilla se rellena a ojo: o hay
 * cita del libro, o la cita dice que el libro no la cubre.
 * ======================================================================= */

const APROXIMADORES_M6 = ["tabular", "lineal", "noLineal"];

/** Nombre en pantalla de cada identificador del motor. */
const NOMBRES_M6 = {
  mc: () => t("t5.m6.algoMC", "MC"),
  td0: () => t("t5.m6.algoTD", "TD(0)"),
  mcControl: () => t("t5.m6.algoMCcontrol", "MC control"),
  sarsa: () => "SARSA",
  qLearning: () => "Q-learning",
  tabular: () => t("t5.m6.aproxTab", "tabular"),
  lineal: () => t("t5.m6.aproxLin", "lineal"),
  noLineal: () => t("t5.m6.aproxNoLin", "no lineal"),
  dentro: () => t("t5.m6.politicaOn", "dentro de política"),
  fuera: () => t("t5.m6.politicaOff", "fuera de política"),
};

/** Los veintiún textos, en español, indexados por la clave del motor. */
const TEXTOS_M6 = {
  "t5.m6.celda.mc.tabular.dentro":
    "Sin ningún inductor. Promediar retornos observados converge al valor verdadero, y es todo el "
    + "capítulo 5 del libro. Con un peso por estado, además, el mínimo del objetivo es "
    + "<strong>cero</strong>: no hay error de aproximación que repartir.",
  "t5.m6.celda.mc.lineal.dentro":
    "Un inductor: la aproximación. El retorno es un estimador <strong>no sesgado</strong> del valor, "
    + "así que la regla es descenso del gradiente de verdad; y en el caso lineal hay <strong>un solo "
    + "óptimo</strong>, luego converger a un óptimo local es converger al <strong>global</strong> de "
    + "\\(\\overline{VE}\\). <strong>Ojo: al óptimo global del objetivo, no al valor verdadero</strong>: "
    + "el error mínimo suele ser positivo.",
  "t5.m6.celda.mc.noLineal.dentro":
    "Un inductor. Con un objetivo no sesgado hay convergencia a un <strong>óptimo local</strong>, con "
    + "las condiciones habituales de \\(\\alpha\\). Este «SÍ» es <strong>más débil</strong> que el de la "
    + "columna lineal, y el libro lo califica.",
  "t5.m6.celda.td0.tabular.dentro":
    "Un inductor: el <em>bootstrapping</em>. Es la convergencia de TD(0) tabular del tema 4.",
  "t5.m6.celda.td0.lineal.dentro":
    "Dos inductores, y aun así estable: TD(0) lineal converge al <strong>punto fijo TD</strong>, "
    + "\\(w_{TD}=A^{-1}b\\), porque \\(A\\) es definida positiva con la distribución <strong>dentro de "
    + "política</strong>. <strong>No converge al óptimo global</strong>: su error puede ser hasta "
    + "\\(1/(1-\\gamma)\\) veces el mínimo. Es lo que enseña el módulo 3.",
  "t5.m6.celda.td0.noLineal.dentro":
    "<strong>Aquí «NO» significa «sin garantía», no «diverge».</strong> Con dos inductores, la regla de "
    + "la tríada no predice inestabilidad, y <strong>el libro no da ningún contraejemplo de divergencia "
    + "para este caso</strong>: todos sus contraejemplos son <strong>fuera de política</strong>. Lo que "
    + "sí dice es que la teoría disponible no llega hasta aquí.",
  "t5.m6.celda.mc.tabular.fuera":
    "Un inductor: fuera de política. Con muestreo de importancia se corrige la distribución y se "
    + "converge; el precio es <strong>varianza</strong>, no divergencia.",
  "t5.m6.celda.mc.lineal.fuera":
    "Dos inductores, y estable: <strong>MC no hace <em>bootstrapping</em></strong>, así que falta el "
    + "segundo de los tres, y la regla del libro dice que con dos se puede evitar la inestabilidad. El "
    + "precio, otra vez, es la varianza.",
  "t5.m6.celda.mc.noLineal.fuera":
    "<strong>Casilla discutible, y el libro no la cubre.</strong> Solo hay dos inductores —MC no arranca "
    + "por <em>bootstrapping</em>—, así que la regla de la tríada <strong>no</strong> predice "
    + "divergencia; y la propia tabla marca «MC · no lineal · dentro de política» con SÍ, siendo la única "
    + "diferencia el entrenamiento fuera de política. Lecturas defendibles: en toda la columna no lineal "
    + "se pierde la garantía de óptimo <strong>global</strong>, y el muestreo de importancia ordinario "
    + "puede dar <strong>varianza infinita</strong>. Lo que no es defendible es leerlo como «los pesos "
    + "divergen».",
  "t5.m6.celda.td0.tabular.fuera":
    "Dos inductores: <em>bootstrapping</em> y fuera de política. Falta la aproximación, y en tabular los "
    + "valores están desacoplados: es el Q-learning tabular del tema 4, con las mejores garantías de todo "
    + "el curso.",
  "t5.m6.celda.td0.lineal.fuera":
    "<strong>Los tres inductores.</strong> Y aquí «NO» sí es «diverge»: es el <strong>contraejemplo de "
    + "Baird</strong>, donde los pesos se van a infinito aunque el valor verdadero sea cero y se pueda "
    + "representar exactamente. Diverge <strong>para cualquier \\(\\alpha>0\\)</strong> y también con "
    + "actualizaciones de DP, sin nada de azar. Es el módulo 4.",
  "t5.m6.celda.td0.noLineal.fuera":
    "Los tres inductores, y además sin teoría. Si el caso lineal ya diverge, el no lineal no puede tener "
    + "mejor garantía.",
  "t5.m6.celda.mcControl.tabular.dentro":
    "Sin inductores. Es el control de Monte Carlo del tema 4, con arranques exploratorios o políticas "
    + "\\(\\varepsilon\\)-suaves.",
  "t5.m6.celda.mcControl.lineal.dentro":
    "Un inductor. El «(SÍ)» del recuadro —«cerca, pero no quieto»— no es por la aproximación en sí, es "
    + "porque <strong>la política cambia</strong>: la garantía de convergencia de la predicción está "
    + "enunciada <strong>para política constante</strong>.",
  "t5.m6.celda.mcControl.noLineal.dentro":
    "Un inductor, y aun así «NO»: el mismo caso de la columna no lineal. Significa «sin garantía de "
    + "óptimo global», no «diverge».",
  "t5.m6.celda.sarsa.tabular.dentro":
    "Un inductor: el <em>bootstrapping</em>. Es el SARSA tabular del tema 4.",
  "t5.m6.celda.sarsa.lineal.dentro":
    "Dos inductores, y el paréntesis tiene una cita exacta: <strong>SARSA semi-gradiente lineal con "
    + "selección \\(\\varepsilon\\)-greedy no converge en el sentido habitual, pero entra en una región "
    + "acotada cerca de la mejor solución.</strong> Con política <strong>constante</strong> sí converge, "
    + "igual que TD(0) y con el mismo tipo de cota.",
  "t5.m6.celda.sarsa.noLineal.dentro":
    "Dos inductores. Otra vez la columna no lineal: sin garantía, no divergencia demostrada.",
  "t5.m6.celda.qLearning.tabular.fuera":
    "Dos inductores: <em>bootstrapping</em> y fuera de política. Falta la aproximación, y en tabular "
    + "Q-learning tiene las mejores garantías de convergencia de todos los métodos de control.",
  "t5.m6.celda.qLearning.lineal.fuera":
    "<strong>Los tres inductores.</strong> Hay contraejemplos análogos al de Baird que muestran la "
    + "divergencia de Q-learning, y el libro dice que es motivo de preocupación <strong>precisamente "
    + "porque, sin eso, Q-learning tendría las mejores garantías de todos los métodos de "
    + "control</strong>. Matiz honesto del libro: puede que la convergencia se pueda garantizar si la "
    + "política de comportamiento está suficientemente cerca de la objetivo —por ejemplo, "
    + "\\(\\varepsilon\\)-greedy—; <strong>no se ha encontrado nunca que Q-learning diverja en ese caso, "
    + "pero no hay análisis teórico</strong>. Y hay un contraejemplo de Bradtke (1993) en el que "
    + "Q-learning lineal converge a una política <strong>desestabilizadora</strong>.",
  "t5.m6.celda.qLearning.noLineal.fuera":
    "Los tres inductores y sin teoría. Es la casilla de DQN, y explica por qué DQN necesita <strong>dos "
    + "piezas de ingeniería</strong> —repetición de experiencia y red objetivo— para funcionar en la "
    + "práctica.",
};

function modulo6() {
  const zonaControles = $("#m6-controles");
  const zonaTablas = $("#m6-tablas");
  const zonaMarcador = $("#m6-marcador");
  const zonaVeredicto = $("#m6-veredicto");

  /* --- estado del módulo --- */
  let politica = "dentro";
  let aproximador = "lineal";
  let algoritmo = "td0";

  /** Q-learning es fuera de política por construcción: la fila es la suya. */
  const politicaDeTabla = (algo, pol) => {
    if (algo === "qLearning") return "fuera";
    if (algo === "mcControl" || algo === "sarsa") return "dentro";
    return pol;
  };
  const esControl = (algo) => ["mcControl", "sarsa"].includes(algo) || algo === "qLearning";

  /* --- textos de encuadre --- */

  aviso(zonaControles, t("t5.m6.avisoFuente",
    "<strong>Estas dos tablas no están en Sutton &amp; Barto.</strong> En el libro no hay ninguna tabla "
    + "que cruce tabular / lineal / no lineal con dentro y fuera de política. Vienen de las "
    + "<strong>diapositivas de David Silver (UCL)</strong>, que la propia baraja declara como segunda "
    + "fuente en <code>#slide-2</code>. Lo que sí hay en el libro es la evidencia de cada casilla, "
    + "repartida por cuatro capítulos, y es lo que este módulo recompone: <strong>cada casilla trae la "
    + "cita exacta que la sostiene, o la advertencia de que el libro no la cubre</strong>."));

  parrafo(zonaControles, "explicacion", t("t5.m6.explicacion",
    "La regla del libro es una sola frase: <strong>si están presentes dos cualesquiera de los tres "
    + "inductores, pero no los tres, la inestabilidad se puede evitar</strong>. Así que en principio la "
    + "tabla debería salir de contar. Cuenta tú: mueve los tres interruptores, mira cuántos inductores se "
    + "encienden y compara con el veredicto de la casilla. Cuadra en <strong>diez</strong> de las doce "
    + "casillas de predicción. Las dos que no cuadran están las dos en la <strong>misma columna</strong>, "
    + "y ahí está el detalle que la tabla esconde."));

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  const mandoPolitica = grupoRadio(panel, t("t5.m6.politicaLabel", "Política"), [
    { valor: "dentro", texto: t("t5.m6.politicaOn", "dentro de política") },
    { valor: "fuera", texto: t("t5.m6.politicaOff", "fuera de política") },
  ], politica, (v) => { politica = v; dibujar(); });
  const mandoAprox = grupoRadio(panel, t("t5.m6.aproxLabel", "Aproximador"),
    APROXIMADORES_M6.map((a) => ({ valor: a, texto: NOMBRES_M6[a]() })),
    aproximador, (v) => { aproximador = v; dibujar(); });
  const mandoAlgo = grupoRadio(panel, t("t5.m6.algoLabel", "Algoritmo"),
    ["mc", "td0", "mcControl", "sarsa", "qLearning"].map((a) => ({ valor: a, texto: NOMBRES_M6[a]() })),
    algoritmo, (v) => {
      algoritmo = v;
      /* Q-learning fuerza «fuera de política» y lo dice: la combinación
         «Q-learning dentro de política» no existe y no se inventa. */
      if (v === "qLearning") { politica = "fuera"; mandoPolitica.marcar(politica); }
      sincronizarPolitica();
      dibujar();
    });
  botonControl(panel, t("t5.m6.reiniciar", "Valores por omisión"), () => {
    politica = "dentro"; aproximador = "lineal"; algoritmo = "td0";
    mandoPolitica.marcar(politica); mandoAprox.marcar(aproximador); mandoAlgo.marcar(algoritmo);
    sincronizarPolitica();
    dibujar();
  });

  /* «Q-learning dentro de politica» no existe, y hasta ahora el boton se
     dejaba pulsar: quedaba resaltado mientras el marcador decia «fuera de
     politica: presente» y «3 de 3». Se deshabilita, que es lo honesto. */
  function sincronizarPolitica() {
    mandoPolitica.habilitar("dentro", algoritmo !== "qLearning");
  }
  sincronizarPolitica();


  /* --- las dos tablas, clicables --- */

  const [colPred, colCtrl] = dosColumnas(zonaTablas);
  const cajaPred = caja(colPred, t("t5.m6.tablaPred", "Predicción"));
  const cajaCtrl = caja(colCtrl, t("t5.m6.tablaCtrl", "Control"));

  const VEREDICTOS = {
    si: () => t("t5.m6.si", "SÍ"),
    casi: () => t("t5.m6.casi", "(SÍ)"),
    no: () => t("t5.m6.no", "NO"),
  };

  /**
   * Pinta una de las dos tablas con sus casillas como botones.
   *
   * Los «NO» en rojo y negrita y los «SÍ» en gris, como en la diapositiva.
   */
  function pintarTabla(destino, filas, cabecera) {
    const envoltorio = document.createElement("div");
    envoltorio.className = "tabla-scroll";
    const tabla = document.createElement("table");
    tabla.className = "datos";
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    for (const celda of cabecera) {
      const th = document.createElement("th");
      th.innerHTML = celda;
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    const tbody = document.createElement("tbody");
    for (const fila of filas) {
      const f = document.createElement("tr");
      for (const primera of fila.encabezados) {
        const td = document.createElement("td");
        td.innerHTML = primera;
        f.appendChild(td);
      }
      for (const casilla of fila.casillas) {
        const td = document.createElement("td");
        const boton = document.createElement("span");
        boton.setAttribute("role", "button");
        boton.setAttribute("tabindex", "0");
        boton.style.cursor = "pointer";
        boton.style.fontWeight = casilla.veredicto === "si" ? "500" : "700";
        boton.style.color = casilla.veredicto === "si"
          ? tono("--texto-suave") : tono("--peligro");
        boton.textContent = VEREDICTOS[casilla.veredicto]();
        const activa = casilla.algoritmo === algoritmo
          && casilla.aproximador === aproximador
          && casilla.politica === politicaDeTabla(algoritmo, politica);
        if (activa) {
          td.style.background = tono("--acento-tenue");
          td.style.outline = `2px solid ${tono("--acento")}`;
        }
        const elegir = () => {
          algoritmo = casilla.algoritmo;
          aproximador = casilla.aproximador;
          politica = casilla.politica;
          mandoAlgo.marcar(algoritmo);
          mandoAprox.marcar(aproximador);
          mandoPolitica.marcar(politica);
          dibujar();
        };
        boton.addEventListener("click", elegir);
        boton.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); elegir(); }
        });
        td.appendChild(boton);
        f.appendChild(td);
      }
      tbody.appendChild(f);
    }
    tabla.append(thead, tbody);
    envoltorio.appendChild(tabla);
    pintar(destino, envoltorio);
    renderizarMatematicas(envoltorio);
  }

  /** Marcador de inductores y predicción de la regla. */
  const marcador = metricas(zonaMarcador, [
    { id: "ind1", etiqueta: t("t5.m6.ind1", "Aproximación de la función de valor") },
    { id: "ind2", etiqueta: t("t5.m6.ind2", "<em>Bootstrapping</em>") },
    { id: "ind3", etiqueta: t("t5.m6.ind3", "Entrenamiento fuera de política") },
    { id: "cuenta", etiqueta: t("t5.m6.cuentaEtiq", "Inductores presentes") },
  ]);
  const regla = parrafo(zonaMarcador, "explicacion siempre", "");

  /* --- panel de veredicto --- */

  const veredictoTitulo = parrafo(zonaVeredicto, "viz-titulo", "");
  const veredictoGrande = parrafo(zonaVeredicto, "explicacion siempre", "");
  const veredictoTexto = parrafo(zonaVeredicto, "explicacion siempre", "");
  const veredictoCita = parrafo(zonaVeredicto, "cita suave", "");

  const notaCasilla = aviso(zonaVeredicto, t("t5.m6.notaCasilla",
    "Ésta es una de las dos casillas que <strong>no</strong> se deducen de contar inductores, y las dos "
    + "están en la columna «no lineal». La explicación es que en esa columna <strong>«NO» no significa lo "
    + "mismo que en la columna lineal</strong>: en la lineal, «NO» quiere decir «hay un contraejemplo de "
    + "divergencia» —el de Baird—; en la no lineal quiere decir «<strong>no hay garantía</strong>», que es "
    + "mucho más débil. Y en esa misma columna la tabla es, además, <strong>internamente "
    + "inconsistente en la fila de MC</strong>: marca "
    + "«MC · dentro de política · no lineal» con SÍ y «MC · fuera de política · no lineal» con NO, y la "
    + "única diferencia entre las dos es el entrenamiento fuera de política, que sin <em>bootstrapping</em> "
    + "no dispara la inestabilidad. <strong>El libro no cubre esa casilla</strong>; lo más fuerte que dice "
    + "es que la teoría del RL «está en su mayor parte limitada a métodos tabulares o con aproximación "
    + "lineal». La lectura defendible es doble: por un lado, en toda la columna no lineal lo único que se "
    + "pierde es la garantía de <strong>óptimo global</strong> (queda el local); por otro, MC fuera de "
    + "política con muestreo de importancia ordinario puede tener <strong>varianza infinita</strong>, que "
    + "es un modo de fallar muy real aunque no sea divergencia de los pesos. Lo que <strong>no</strong> es "
    + "defendible es leer ese «NO» como «los pesos divergen»."));
  const notaLocal = aviso(zonaVeredicto, t("t5.m6.notaLocal",
    "Cuidado con este «SÍ»: es <strong>óptimo local</strong>, no global. El libro lo dice con todas las "
    + "letras y encima lo califica: «aunque esta garantía solo tranquiliza un poco, es normalmente lo mejor "
    + "que se puede decir de los aproximadores no lineales, y a menudo es suficiente». En la columna "
    + "lineal, en cambio, el «SÍ» de MC <strong>sí</strong> es el óptimo global, porque en el caso lineal "
    + "hay un solo óptimo."));
  const notaControl = aviso(zonaVeredicto, t("t5.m6.notaControl",
    "Y un contrapunto del libro para toda esta tabla: <strong>el peligro no viene del control ni de la "
    + "iteración generalizada de la política</strong>. La inestabilidad ya está en el caso de predicción "
    + "siempre que se junten los tres inductores; el control es más difícil de analizar, pero no añade el "
    + "problema. <strong>Tampoco viene de aprender ni de no conocer el entorno</strong>: aparece igual de "
    + "fuerte en métodos de planificación como la programación dinámica, donde el entorno se conoce por "
    + "completo."));
  const notaQoff = aviso(zonaVeredicto, t("t5.m6.notaQoff",
    "Q-learning es <strong>fuera de política por construcción</strong>: su objetivo es el máximo, no la "
    + "acción que la política de comportamiento tomó. El interruptor de política queda fijo, y por eso su "
    + "fila de la tabla de control no tiene versión «dentro de política». Es también la razón por la que el "
    + "libro, al preguntarse qué inductor soltar, responde: <strong>usa SARSA en lugar de Q-learning</strong>."));
  const notaCtrlPolitica = aviso(zonaVeredicto, t("t5.m6.notaCtrlPolitica",
    "La tabla de control de la diapositiva no separa dentro y fuera de política: MC control y SARSA son "
    + "dentro de política por construcción, y Q-learning es fuera de política. El interruptor de política "
    + "sigue contando inductores, pero la fila de la tabla es la misma."));

  parrafo(zonaVeredicto, "explicacion siempre", t("t5.m6.enlaces",
    "Tres de estas casillas se pueden ver funcionando: TD(0) lineal dentro de política en el "
    + "<a href=\"#m3\">módulo 3</a>, TD(0) lineal fuera de política en el <a href=\"#m4\">módulo 4</a> y "
    + "SARSA lineal en el <a href=\"#m5\">módulo 5</a>."));
  parrafo(zonaVeredicto, "suave", t("t5.m6.rotuloExacto", "Tabla de consulta · sin simulación"));

  /* --- dibujo --- */

  function dibujar() {
    /* Tabla de predicción: cuatro filas (MC/TD dentro, MC/TD fuera). */
    const filasPred = [
      { pol: "dentro", algo: "mc" }, { pol: "dentro", algo: "td0" },
      { pol: "fuera", algo: "mc" }, { pol: "fuera", algo: "td0" },
    ].map((f, i) => ({
      encabezados: [
        i % 2 === 0 ? NOMBRES_M6[f.pol]() : "",
        NOMBRES_M6[f.algo](),
      ],
      casillas: APROXIMADORES_M6.map((ap) => TABLA_PREDICCION.find(
        (c) => c.algoritmo === f.algo && c.aproximador === ap && c.politica === f.pol,
      )),
    }));
    pintarTabla(cajaPred.cuerpo, filasPred,
      t("t5.m6.predCab", "Búsqueda · Algoritmo · Tabular · Lineal · No lineal").split(" · "));

    const filasCtrl = ["mcControl", "sarsa", "qLearning"].map((algo) => ({
      encabezados: [NOMBRES_M6[algo]()],
      casillas: APROXIMADORES_M6.map((ap) => TABLA_CONTROL.find(
        (c) => c.algoritmo === algo && c.aproximador === ap,
      )),
    }));
    pintarTabla(cajaCtrl.cuerpo, filasCtrl,
      t("t5.m6.ctrlCab", "Algoritmo · Tabular · Lineal · No lineal").split(" · "));
    if (!cajaCtrl.caja.querySelector(".recuadro-si")) {
      const p = parrafo(cajaCtrl.caja, "explicacion siempre recuadro-si",
        t("t5.m6.recuadroSi", "<strong>(SÍ) ➜ cerca, pero no quieto</strong>"));
      p.style.marginTop = ".5rem";
    }

    /* Marcador: los inductores se cuentan con el interruptor, no con la fila. */
    const inductores = contarInductores({ algoritmo, aproximador, politica });
    const presente = t("t5.m6.presente", "presente");
    const ausente = t("t5.m6.ausente", "ausente");
    const pinta = (nodo, activo) => {
      nodo.innerHTML = `<span style="font-size:1rem">${activo ? presente : ausente}</span>`;
      nodo.className = `cifra ${activo ? "mala" : "buena"}`;
    };
    pinta(marcador.ind1, inductores.aproximacion);
    pinta(marcador.ind2, inductores.bootstrapping);
    pinta(marcador.ind3, inductores.fueraDePolitica);
    fijarCifra(marcador.cuenta, t("t5.m6.cuenta", "{n} de 3", { n: inductores.total }));
    regla.innerHTML = inductores.total === 3
      ? t("t5.m6.reglaInestable", "Con los tres, <strong>los pesos pueden divergir</strong>")
      : t("t5.m6.reglaEstable", "Con dos o menos, <strong>la inestabilidad se puede evitar</strong>");

    /* Ficha de la casilla. */
    const polTabla = politicaDeTabla(algoritmo, politica);
    const ficha = fichaCasilla({ algoritmo, aproximador, politica: polTabla });
    veredictoTitulo.innerHTML = t("t5.m6.veredictoTitulo", "{algo} · {aprox} · {pol}", {
      algo: NOMBRES_M6[algoritmo](), aprox: NOMBRES_M6[aproximador](), pol: NOMBRES_M6[polTabla](),
    });
    veredictoGrande.innerHTML = `<strong style="font-size:1.4rem">${VEREDICTOS[ficha.veredicto]()}</strong>`;
    veredictoTexto.innerHTML = t(ficha.clave, TEXTOS_M6[ficha.clave] || "");
    renderizarMatematicas(veredictoTexto);
    veredictoCita.innerHTML = ficha.cita;

    const noLinealDiscutible = !ficha.cuadraConLaRegla;
    ver(notaCasilla, noLinealDiscutible);
    ver(notaLocal, algoritmo === "mc" && aproximador === "noLineal" && polTabla === "dentro");
    ver(notaControl, ficha.tabla === "control");
    ver(notaQoff, algoritmo === "qLearning");
    ver(notaCtrlPolitica, esControl(algoritmo) && algoritmo !== "qLearning");
  }

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m6-quiz"), [
    {
      enunciado: "En la tabla de predicción, la casilla de MC fuera de política con aproximación "
        + "lineal es «SÍ», y la de TD(0) fuera de política con aproximación lineal es «NO». ¿Qué explica "
        + "la diferencia?",
      opciones: [
        "Que MC no arranca por <em>bootstrapping</em>: le falta uno de los tres inductores, y con dos "
        + "la inestabilidad se puede evitar. TD(0) fuera de política y lineal tiene los tres.",
        "Que MC usa muestreo de importancia y TD(0) no, y el muestreo de importancia corrige la "
        + "distribución de estados por completo.",
        "Que MC es de varianza menor y por tanto más estable numéricamente que TD(0) en el caso "
        + "lineal.",
        "Que MC no usa \\(\\gamma\\) y la divergencia de TD(0) requiere \\(\\gamma>0{,}5\\).",
      ],
      correcta: 0,
      explicacion: "La regla del libro es la de contar: con dos de los tres inductores, la "
        + "inestabilidad se puede evitar; con los tres, no hay garantía y hay contraejemplos. MC fuera de "
        + "política y lineal tiene aproximación y fuera de política, pero <strong>no</strong> "
        + "<em>bootstrapping</em>, así que se queda en dos. El muestreo de importancia existe en las dos "
        + "familias fuera de política y no es lo que decide. La varianza está al revés: MC tiene "
        + "<strong>más</strong> varianza que TD, y aun así es más estable en este sentido. Y MC sí usa "
        + "\\(\\gamma\\) —en el retorno descontado—: el umbral \\(\\gamma>0{,}5\\) es del ejemplo concreto "
        + "del módulo 4, no una condición general.",
    },
    {
      enunciado: "La casilla de TD(0) dentro de política con aproximación no lineal es «NO». ¿Qué "
        + "significa exactamente ese «NO»?",
      opciones: [
        "Que no hay garantía de convergencia, no que los pesos diverjan: el libro no da ningún "
        + "contraejemplo de divergencia dentro de política, y todos los que da son fuera de política.",
        "Que los pesos divergen, igual que en el contraejemplo de Baird, solo que sin figura porque la "
        + "red neuronal no se puede dibujar.",
        "Que converge, pero a un óptimo local en lugar de al global, que es lo mismo que le pasa a MC "
        + "en esa columna.",
        "Que converge solo si la red es suficientemente pequeña, con la cota "
        + "\\(d \\ll \\lvert\\mathcal S\\rvert\\).",
      ],
      correcta: 0,
      explicacion: "El «NO» de la columna no lineal es más débil que el de la lineal: ahí quiere decir "
        + "que la teoría no llega, y el libro es explícito en que la teoría del RL está limitada en su "
        + "mayor parte a métodos tabulares o lineales. <strong>Todos</strong> los contraejemplos de "
        + "divergencia del libro son fuera de política —Baird y el de Tsitsiklis y Van Roy—, así que "
        + "afirmar divergencia aquí sería ir más lejos que la fuente. Tampoco es «óptimo local»: eso es lo "
        + "que se afirma de MC no lineal, y por eso su casilla dice «SÍ» y ésta «NO»; la diferencia entre "
        + "las dos es el <em>bootstrapping</em>. Y no hay ninguna cota de tamaño de red que garantice "
        + "nada.",
    },
    {
      enunciado: "El libro se pregunta qué inductor se podría soltar. ¿Cuál dice que se puede soltar, "
        + "y con qué receta concreta para el RL sin modelo?",
      opciones: [
        "El entrenamiento fuera de política: “se puede usar simplemente SARSA en lugar de "
        + "Q-learning”. La aproximación no se puede soltar, y el <em>bootstrapping</em> es demasiado "
        + "valioso.",
        "El <em>bootstrapping</em>: se puede usar Monte Carlo en lugar de TD, y el coste en eficiencia "
        + "es despreciable.",
        "La aproximación de la función de valor: basta usar agregación de estados, que es tabular por "
        + "grupos y no dispara la inestabilidad.",
        "Ninguno: los tres son imprescindibles, y por eso hacen falta métodos como Gradient-TD.",
      ],
      correcta: 0,
      explicacion: "El libro recorre los tres. La aproximación es lo que menos se puede soltar, porque "
        + "hace falta escalar —y advierte de que la agregación y los métodos de mínimos cuadrados son "
        + "demasiado débiles o demasiado caros—. El <em>bootstrapping</em> se puede soltar, pero se paga "
        + "en eficiencia de cálculo y de datos, y concluye que es extremadamente valioso. Queda el fuera "
        + "de política, que para el RL sin modelo se suelta con una receta de una línea: usar SARSA en "
        + "lugar de Q-learning. Que existan métodos como Gradient-TD no significa que los tres sean "
        + "imprescindibles: significa que hay quien prefiere no soltar ninguno, y eso queda fuera de este "
        + "curso.",
    },
  ], { claves: "t5.m6.quiz" });
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

