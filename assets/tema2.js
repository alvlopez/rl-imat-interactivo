/* ==========================================================================
   RL · IMAT — Tema 2: Procesos de Decisión de Markov
   Comportamiento de los cinco módulos de tema2.html
   ========================================================================== */

import {
  iniciarPagina, rejilla, arbolBackup, crearQuiz, pintar, num, numMat, tono,
  colorCalor, textoSobre, generador, alCambiarTema, renderizarMatematicas,
} from "./nucleo.js";

import {
  rejilla3x3, rejillaNavegacion, ACCIONES_3X3,
  politicaEquiprobable, politicaDeterminista, normalizar,
  evaluarLineal, evaluarIterativa, iteracionValor, qDeV, politicaGreedy,
  numeroPoliticasOptimas, ramasBackup, probabilidad, cuentaTransiciones,
  simularEpisodio, retornos, estadosSucesores,
} from "./mdp.js";

iniciarPagina();

/** Las cuatro acciones de ambas rejillas están en el orden N, S, O, E. */
const DIRS = ["N", "S", "O", "E"];
const $ = (sel) => document.querySelector(sel);

/** Repintar todos los módulos cuando cambia el tema (los SVG llevan colores fijos). */
const repintadores = [];
alCambiarTema(() => repintadores.forEach((fn) => fn()));

/** Construye una fila de botones que se comportan como un grupo de radio. */
function grupoRadio(contenedor, opciones, valorInicial, alElegir) {
  contenedor.innerHTML = "";
  const botones = opciones.map((op) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = op.texto;
    if (op.titulo) b.title = op.titulo;
    b.addEventListener("click", () => {
      marcar(op.valor);
      alElegir(op.valor);
    });
    contenedor.appendChild(b);
    return { boton: b, valor: op.valor };
  });
  function marcar(valor) {
    botones.forEach((x) => x.boton.setAttribute("aria-pressed", String(x.valor === valor)));
  }
  marcar(valorInicial);
  return marcar;
}

/* ======================================================================= *
 * Estado compartido entre los módulos 2 y 3: la política sobre la rejilla
 * ======================================================================= */

const mdp3 = rejilla3x3();
const compartido = {
  politica: politicaEquiprobable(mdp3),
  oyentes: [],
  cambio() {
    this.oyentes.forEach((fn) => fn());
  },
};

/* ======================================================================= *
 * MÓDULO 1 — la dinámica p(s',r|s,a)
 * ======================================================================= */

function moduloDinamica() {
  const zonaRejilla = $("#m1-rejilla");
  const zonaTabla = $("#m1-tabla");
  const zonaAcciones = $("#m1-acciones");
  const salidaEstado = $("#m1-estado");
  const zonaRespuesta = $("#m1-respuesta");

  let s = 0;   // estado "1"
  let a = 1;   // "abajo"

  const marcarAccion = grupoRadio(
    zonaAcciones,
    ACCIONES_3X3.map((nombre, i) => ({ texto: nombre, valor: i })),
    a,
    (valor) => { a = valor; dibujar(); },
  );

  function dibujar() {
    const terminal = mdp3.geometria.terminal;
    const transiciones = mdp3.esTerminal(s) ? [] : mdp3.P[s][a];
    const destinos = new Map(transiciones.map((t) => [t.s2, t]));

    const celdas = [];
    for (let e = 0; e < mdp3.nEstados; e++) {
      const pos = mdp3.geometria.posicion(e);
      const destino = destinos.get(e);
      let color = tono("--superficie");
      let textoColor = tono("--texto");
      if (destino) {
        color = tono("--acento");
        textoColor = textoSobre(color.startsWith("#") ? "rgb(200,120,20)" : color);
      } else if (e === terminal) {
        color = tono("--superficie-3");
      }
      celdas.push({
        ...pos,
        etiqueta: mdp3.etiquetas[e],
        subetiqueta: destino ? `p = ${num(destino.p, 2)}` : null,
        color,
        textoColor: destino ? "#ffffff" : textoColor,
        titulo: e === terminal ? "Estado terminal" : `Estado ${mdp3.etiquetas[e]}`,
        flechas: e === s && !mdp3.esTerminal(e) ? [DIRS[a]] : null,
        colorFlecha: tono("--azul"),
      });
    }

    pintar(zonaRejilla, rejilla({
      celdas, lado: 82, seleccion: s,
      alSeleccionar: (indice) => { s = indice; dibujar(); },
    }));

    salidaEstado.textContent = mdp3.etiquetas[s];

    if (mdp3.esTerminal(s)) {
      zonaTabla.innerHTML = `<tbody><tr><td colspan="3" class="suave">
        T es terminal: no hay transiciones y \\(v(\\mathrm{T}) = 0\\).</td></tr></tbody>`;
      renderizarMatematicas(zonaTabla);
      return;
    }

    const filas = transiciones.map((t) => `
      <tr>
        <td class="mono">${mdp3.etiquetas[t.s2]}</td>
        <td class="mono">${t.r}</td>
        <td class="mono">${num(t.p, 2)}</td>
      </tr>`).join("");
    const nulas = `
      <tr class="suave">
        <td colspan="3" style="text-align:left">
          Cualquier otra combinación \\((s', r)\\) tiene probabilidad 0.
        </td>
      </tr>`;
    zonaTabla.innerHTML = `
      <thead><tr><th>s′</th><th>r</th><th>p(s′,r | s,a)</th></tr></thead>
      <tbody>${filas}${nulas}</tbody>`;
    renderizarMatematicas(zonaTabla);
  }

  /* --- las cuatro preguntas literales de la diapositiva --- */
  const preguntas = [
    { texto: "p(5,−1 | 2, abajo)", s2: "5", r: -1, s: "2", a: "abajo" },
    { texto: "p(5,−1 | 2, izq)", s2: "5", r: -1, s: "2", a: "izq" },
    { texto: "p(5, 0 | 2, abajo)", s2: "5", r: 0, s: "2", a: "abajo" },
    { texto: "p(3,−1 | 3, dch)", s2: "3", r: -1, s: "3", a: "dch" },
  ];
  const razones = {
    "p(5,−1 | 2, abajo)": "Bajar desde 2 lleva siempre a 5, y toda transición da −1. Es determinista.",
    "p(5,−1 | 2, izq)": "Desde 2 hacia la izquierda se llega a 1, no a 5. Esa transición no existe.",
    "p(5, 0 | 2, abajo)": "El estado sí es el correcto, pero la recompensa no: aquí <em>toda</em> transición vale −1, nunca 0. La dinámica es conjunta sobre (s′, r).",
    "p(3,−1 | 3, dch)": "Desde 3 hacia la derecha se sale del tablero, así que el agente se queda en 3 — y cobra igualmente su −1.",
  };

  const zonaPreguntas = $("#m1-preguntas");
  preguntas.forEach((p) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.innerHTML = p.texto;
    boton.addEventListener("click", () => {
      const iS = mdp3.etiquetas.indexOf(p.s);
      const iA = ACCIONES_3X3.indexOf(p.a);
      const iS2 = mdp3.etiquetas.indexOf(p.s2);
      const valor = probabilidad(mdp3, iS2, p.r, iS, iA);
      s = iS; a = iA;
      marcarAccion(a);
      dibujar();
      zonaRespuesta.hidden = false;
      zonaRespuesta.dataset.estado = valor > 0 ? "ok" : "mal";
      zonaRespuesta.innerHTML =
        `<strong>${p.texto} = ${num(valor, 2)}</strong><br>${razones[p.texto]}`;
    });
    zonaPreguntas.appendChild(boton);
  });

  const { pares, ramas } = cuentaTransiciones(mdp3);
  $("#m1-recuento").innerHTML =
    `8 estados no terminales × 4 acciones = <strong>${pares} pares (s, a)</strong>
     — el «cubo de profundidad 4» de la diapositiva. Como aquí la dinámica es
     determinista, cada par tiene una sola rama: ${ramas} transiciones con
     probabilidad no nula.`;

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m1-quiz"), [
    {
      enunciado: "¿Por qué \\(p(5,0 \\mid 2,\\text{abajo}) = 0\\) si bajar desde 2 lleva efectivamente a 5?",
      opciones: [
        "Porque la dinámica es conjunta sobre \\((s', r)\\): el estado es correcto, pero la recompensa 0 no ocurre nunca en esta rejilla.",
        "Porque desde el estado 2 no se puede bajar.",
        "Porque la probabilidad se reparte entre las cuatro acciones.",
        "Porque el estado 5 no es alcanzable desde el 2.",
      ],
      correcta: 0,
      explicacion: "\\(p(s',r\\mid s,a)\\) es una distribución sobre <em>pares</em> estado-recompensa. Aquí toda transición da \\(r=-1\\), así que cualquier consulta con \\(r=0\\) vale 0 aunque el estado destino sea el correcto.",
    },
    {
      enunciado: "En esta rejilla, \\(\\sum_{s'}\\sum_r p(s',r\\mid s,a)\\) vale…",
      opciones: [
        "1 para cada par \\((s,a)\\), porque es una distribución de probabilidad.",
        "1 sumando también sobre las acciones.",
        "4, una unidad por acción disponible.",
        "Depende de si el estado está en el borde.",
      ],
      correcta: 0,
      explicacion: "Es la condición de normalización de la dinámica: fijados \\(s\\) y \\(a\\), las probabilidades de todos los pares \\((s',r)\\) suman 1. En los bordes cambia a dónde se va, no cuánto suma.",
    },
    {
      enunciado: "El rebote contra el borde («si salgo fuera me quedo donde estaba») implica que…",
      opciones: [
        "hay transiciones en las que \\(s' = s\\), y que también cuestan \\(-1\\).",
        "esas acciones no están disponibles en los estados del borde.",
        "la recompensa en el borde es 0, porque el agente no se mueve.",
        "el episodio termina al chocar con el borde.",
      ],
      correcta: 0,
      explicacion: "La acción existe y se ejecuta; simplemente el estado siguiente coincide con el actual. Y como <em>toda</em> transición da \\(-1\\), chocar contra la pared cuesta lo mismo que avanzar: por eso la política óptima nunca lo hace.",
    },
  ]);
}

/* ======================================================================= *
 * MÓDULO 2 — política y retorno
 * ======================================================================= */

function moduloPolitica() {
  const zonaRejilla = $("#m2-rejilla");
  const zonaEditor = $("#m2-editor");
  const zonaEpisodio = $("#m2-episodio");
  const entradaGamma = $("#m2-gamma");
  const salidaGamma = $("#m2-gamma-v");

  let seleccion = 0;
  let gamma = 1;

  /* Política determinista razonable: primero a la derecha, si no, hacia abajo. */
  const haciaTerminal = () => politicaDeterminista(mdp3, (s) => {
    if (mdp3.esTerminal(s)) return null;
    const { fila, col } = mdp3.geometria.posicion(s);
    if (col < 2) return ACCIONES_3X3.indexOf("dch");
    if (fila < 2) return ACCIONES_3X3.indexOf("abajo");
    return ACCIONES_3X3.indexOf("dch");
  });

  grupoRadio($("#m2-presets"), [
    { texto: "Equiprobable", valor: "equi", titulo: "π(a|s) = 0.25 para las cuatro acciones" },
    { texto: "Determinista hacia T", valor: "det", titulo: "Una sola acción con probabilidad 1 en cada estado" },
  ], "equi", (valor) => {
    compartido.politica = valor === "equi" ? politicaEquiprobable(mdp3) : haciaTerminal();
    compartido.cambio();
    dibujar();
  });

  function dibujar() {
    const celdas = [];
    for (let e = 0; e < mdp3.nEstados; e++) {
      const pos = mdp3.geometria.posicion(e);
      const esTerminal = mdp3.esTerminal(e);
      const flechas = esTerminal
        ? null
        : DIRS.filter((_, a) => compartido.politica[e][a] > 0.001);
      celdas.push({
        ...pos,
        etiqueta: mdp3.etiquetas[e],
        color: esTerminal ? tono("--superficie-3") : tono("--superficie"),
        flechas,
        titulo: esTerminal ? "Terminal" : DIRS
          .map((d, a) => `${d}: ${num(compartido.politica[e][a], 2)}`).join("  "),
      });
    }
    pintar(zonaRejilla, rejilla({
      celdas, lado: 82, seleccion,
      alSeleccionar: (indice) => { seleccion = indice; dibujar(); },
    }));
    dibujarEditor();
  }

  function dibujarEditor() {
    if (mdp3.esTerminal(seleccion)) {
      zonaEditor.innerHTML = `<p class="explicacion nota">
        El estado terminal no tiene política: el episodio acaba ahí.</p>`;
      return;
    }
    const fila = compartido.politica[seleccion];
    zonaEditor.innerHTML = `
      <p class="viz-titulo">π(a | ${mdp3.etiquetas[seleccion]})</p>
      <div class="controles" style="margin-bottom:0">
        ${ACCIONES_3X3.map((nombre, a) => `
          <div class="control">
            <label class="literal">${nombre} <span class="valor" data-v="${a}">${num(fila[a], 2)}</span></label>
            <input type="range" data-a="${a}" min="0" max="1" step="0.05" value="${fila[a]}">
          </div>`).join("")}
      </div>
      <p class="explicacion nota">Las probabilidades se renormalizan solas para que sumen 1.</p>`;

    zonaEditor.querySelectorAll("input[data-a]").forEach((input) => {
      input.addEventListener("input", () => {
        const a = Number(input.dataset.a);
        const copia = [...compartido.politica[seleccion]];
        copia[a] = Number(input.value);
        if (copia.every((x) => x === 0)) copia[a] = 1;
        compartido.politica[seleccion] = normalizar(copia);
        compartido.politica[seleccion].forEach((p, k) => {
          const etiqueta = zonaEditor.querySelector(`[data-v="${k}"]`);
          if (etiqueta) etiqueta.textContent = num(p, 2);
          const control = zonaEditor.querySelector(`input[data-a="${k}"]`);
          if (control && k !== a) control.value = p;
        });
        compartido.cambio();
        dibujar();
      });
    });
  }

  entradaGamma.addEventListener("input", () => {
    gamma = Number(entradaGamma.value);
    salidaGamma.textContent = num(gamma, 2);
  });

  $("#m2-lanzar").addEventListener("click", () => {
    const semilla = Math.max(1, Number($("#m2-semilla").value) || 1);
    const rng = generador(semilla);
    const inicio = 0; // siempre desde el estado 1, para poder comparar
    const { pasos, terminado } = simularEpisodio(mdp3, compartido.politica, inicio, rng, { maxPasos: 300 });
    const recompensas = pasos.map((p) => p.r);
    const g = retornos(recompensas, gamma);

    const maxFilas = 18;
    const visibles = pasos.slice(0, maxFilas);
    const filas = visibles.map((p, t) => `
      <tr>
        <td class="mono">${t}</td>
        <td class="mono">${mdp3.etiquetas[p.s]}</td>
        <td>${ACCIONES_3X3[p.a]}</td>
        <td class="mono">${p.r}</td>
        <td class="mono">${num(g[t], 3)}</td>
      </tr>`).join("");

    const terminos = recompensas.slice(0, 5)
      .map((r, k) => (k === 0 ? `${r}` : `${numMat(gamma ** k, 3)}\\cdot(${r})`))
      .join(" + ");

    zonaEpisodio.innerHTML = `
      <div class="metricas">
        <div class="metrica">
          <div class="etiq">Pasos hasta T</div>
          <div class="cifra">${terminado ? pasos.length : "> 300"}</div>
        </div>
        <div class="metrica">
          <div class="etiq">Retorno G<sub>0</sub></div>
          <div class="cifra ${g[0] > -6 ? "buena" : "mala"}">${num(g[0], 2)}</div>
        </div>
      </div>
      <p class="explicacion nota">
        \\(G_0 = ${terminos}${recompensas.length > 5 ? " + \\cdots" : ""} = ${numMat(g[0], 3)}\\)
      </p>
      <div class="tabla-scroll">
        <table class="datos">
          <thead><tr><th>t</th><th>S<sub>t</sub></th><th>A<sub>t</sub></th><th>R<sub>t+1</sub></th><th>G<sub>t</sub></th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      ${pasos.length > maxFilas
        ? `<p class="explicacion nota">… y ${pasos.length - maxFilas} pasos más.</p>` : ""}`;
    renderizarMatematicas(zonaEpisodio);
  });

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m2-quiz"), [
    {
      enunciado: "Con \\(\\gamma = 0\\), ¿qué está maximizando el agente?",
      opciones: [
        "Solo la recompensa inmediata \\(R_{t+1}\\): se vuelve completamente miope.",
        "La suma de todas las recompensas futuras sin descontar.",
        "Nada: el retorno queda indefinido.",
        "El número de pasos hasta el terminal.",
      ],
      correcta: 0,
      explicacion: "\\(G_t = R_{t+1} + \\gamma G_{t+1}\\); con \\(\\gamma=0\\) el segundo término desaparece. En esta rejilla todas las recompensas inmediatas valen \\(-1\\), así que un agente con \\(\\gamma=0\\) no distingue entre acciones: es justo el caso en el que el descuento destruye la información del problema.",
    },
    {
      enunciado: "¿Por qué en esta rejilla se puede usar \\(\\gamma = 1\\) sin que el retorno diverja?",
      opciones: [
        "Porque la tarea es episódica y termina en T, así que la suma tiene un número finito de términos.",
        "Porque las recompensas son negativas y se compensan entre sí.",
        "Porque \\(\\gamma = 1\\) siempre es válido en cualquier MDP.",
        "Porque la política equiprobable garantiza la convergencia.",
      ],
      correcta: 0,
      explicacion: "El descuento se introduce para que \\(G_t\\) no diverja en tareas <em>continuas</em>. Si la tarea es episódica y el terminal se alcanza con probabilidad 1, la suma es finita y \\(\\gamma=1\\) es legítimo.",
    },
    {
      enunciado: "Cambias la política a determinista hacia T y el retorno mejora. ¿Qué significa?",
      opciones: [
        "Que esa política es mejor <em>al menos</em> desde ese estado; para afirmar que es mejor en general hace falta que \\(v_{\\pi'}(s) \\ge v_\\pi(s)\\) en todos los estados.",
        "Que ya es la política óptima del MDP.",
        "Que la política equiprobable no es válida.",
        "Nada: el retorno de un episodio suelto es aleatorio y no dice nada.",
      ],
      correcta: 0,
      explicacion: "El orden entre políticas se define estado a estado: \\(\\pi \\ge \\pi' \\iff v_\\pi(s)\\ge v_{\\pi'}(s)\\) para todo \\(s\\). Además un episodio suelto es una muestra: hay que mirar el valor esperado, que es justo lo que calcula el módulo 3.",
    },
  ]);
}

/* ======================================================================= *
 * MÓDULO 3 — funciones de valor
 * ======================================================================= */

function moduloValores() {
  const zonaRejilla = $("#m3-rejilla");
  const zonaTabla = $("#m3-tabla");
  const zonaNota = $("#m3-nota");
  const titulo = $("#m3-titulo");

  let gamma = 1;
  let vista = "v";
  let v = new Array(mdp3.nEstados).fill(0);
  let barridos = 0;
  let ultimoDelta = null;
  let exacto = false;

  grupoRadio($("#m3-vista"), [
    { texto: "v(s)", valor: "v" },
    { texto: "q(s,a)", valor: "q", titulo: "Los cuatro valores de acción, en cuñas" },
  ], "v", (valor) => { vista = valor; dibujar(); });

  $("#m3-gamma").addEventListener("input", (ev) => {
    gamma = Number(ev.target.value);
    $("#m3-gamma-v").textContent = num(gamma, 2);
    reiniciar();
  });

  function reiniciar() {
    v = new Array(mdp3.nEstados).fill(0);
    barridos = 0;
    ultimoDelta = null;
    exacto = false;
    dibujar();
  }

  $("#m3-reiniciar").addEventListener("click", reiniciar);

  $("#m3-resolver").addEventListener("click", () => {
    const solucion = evaluarLineal(mdp3, compartido.politica, gamma);
    if (!solucion) {
      zonaNota.innerHTML = `<strong>El sistema es singular.</strong> Con esta política y
        \\(\\gamma = 1\\) hay estados desde los que nunca se alcanza T, así que el valor
        no está definido: el retorno diverge. Baja \\(\\gamma\\) o cambia la política.`;
      renderizarMatematicas(zonaNota);
      return;
    }
    v = solucion;
    exacto = true;
    ultimoDelta = 0;
    dibujar();
  });

  $("#m3-barrido").addEventListener("click", () => {
    const paso = unBarrido(v);
    v = paso.v;
    ultimoDelta = paso.delta;
    barridos++;
    exacto = false;
    dibujar();
  });

  $("#m3-auto").addEventListener("click", () => {
    const resultado = evaluarIterativa(mdp3, compartido.politica, gamma, { tolerancia: 1e-10 });
    v = resultado.v;
    barridos = resultado.barridos;
    ultimoDelta = 0;
    exacto = false;
    dibujar();
  });

  function unBarrido(actual) {
    const nuevo = new Array(mdp3.nEstados).fill(0);
    let delta = 0;
    for (let s = 0; s < mdp3.nEstados; s++) {
      if (mdp3.esTerminal(s)) continue;
      let suma = 0;
      for (let a = 0; a < mdp3.nAcciones; a++) {
        const prob = compartido.politica[s][a];
        if (prob <= 0) continue;
        for (const t of mdp3.P[s][a]) suma += prob * t.p * (t.r + gamma * actual[t.s2]);
      }
      nuevo[s] = suma;
      delta = Math.max(delta, Math.abs(nuevo[s] - actual[s]));
    }
    return { v: nuevo, delta };
  }

  function dibujar() {
    const q = qDeV(mdp3, v, gamma);
    const noTerminales = [];
    for (let s = 0; s < mdp3.nEstados; s++) if (!mdp3.esTerminal(s)) noTerminales.push(v[s]);
    const minimo = Math.min(...noTerminales, 0);
    const maximo = Math.max(...noTerminales, 0);
    const escala = (x) => (maximo - minimo < 1e-9 ? 0.5 : (x - minimo) / (maximo - minimo));

    const celdas = [];
    for (let s = 0; s < mdp3.nEstados; s++) {
      const pos = mdp3.geometria.posicion(s);
      const esTerminal = mdp3.esTerminal(s);
      const color = esTerminal ? tono("--superficie-3") : colorCalor(escala(v[s]));

      if (vista === "q" && !esTerminal) {
        const valores = q[s];
        const mejor = Math.max(...valores);
        const minQ = Math.min(...valores);
        const maxQ = Math.max(...valores);
        celdas.push({
          ...pos,
          etiqueta: mdp3.etiquetas[s],
          tamano: 11,
          textoColor: tono("--texto"),
          color: tono("--superficie"),
          cunas: valores.map((valor) => {
            const fondo = colorCalor(maxQ - minQ < 1e-9 ? 0.5 : (valor - minQ) / (maxQ - minQ));
            return {
              texto: num(valor, 1),
              color: fondo,
              textoColor: textoSobre(fondo),
              mejor: Math.abs(valor - mejor) < 1e-9,
            };
          }),
          titulo: mdp3.acciones.map((n, a) => `q(${mdp3.etiquetas[s]}, ${n}) = ${num(valores[a], 3)}`).join("\n"),
        });
      } else {
        celdas.push({
          ...pos,
          etiqueta: mdp3.etiquetas[s],
          subetiqueta: esTerminal ? "0" : num(v[s], 2),
          tamano: 13,
          color,
          textoColor: esTerminal ? tono("--texto-suave") : textoSobre(color),
        });
      }
    }

    pintar(zonaRejilla, rejilla({ celdas, lado: 88 }));
    titulo.innerHTML = vista === "v" ? "v<sub>π</sub>(s)" : "q<sub>π</sub>(s,a) — la cuña resaltada es la mejor acción";

    $("#m3-ecuaciones").textContent = String(mdp3.nEstados);
    $("#m3-barridos").textContent = exacto ? "exacto" : String(barridos);
    $("#m3-delta").textContent = ultimoDelta === null ? "—" : num(ultimoDelta, 4);

    zonaNota.innerHTML = exacto
      ? `Resuelto como sistema lineal: <strong>${mdp3.nEstados} ecuaciones con ${mdp3.nEstados}
         incógnitas</strong> (8 estados más el terminal, cuyo valor es 0 por definición).
         Es la respuesta a la pregunta de la diapositiva.`
      : `Cada barrido aplica la ecuación de Bellman a todos los estados a la vez. Fíjate en
         que la información va «goteando» desde T hacia atrás: en el primer barrido solo
         cambian los estados que tocan el terminal. Eso es exactamente lo que hará la
         programación dinámica del Tema 3.`;

    const filas = [];
    for (let s = 0; s < mdp3.nEstados; s++) {
      if (mdp3.esTerminal(s)) continue;
      filas.push(`<tr>
        <td class="mono">${mdp3.etiquetas[s]}</td>
        <td class="mono">${num(v[s], 3)}</td>
        ${mdp3.acciones.map((_, a) => `<td class="mono">${num(q[s][a], 2)}</td>`).join("")}
      </tr>`);
    }
    zonaTabla.innerHTML = `
      <thead><tr><th>s</th><th>v<sub>π</sub></th>
        ${mdp3.acciones.map((n) => `<th>q(·,${n})</th>`).join("")}</tr></thead>
      <tbody>${filas.join("")}</tbody>`;
    renderizarMatematicas(zonaNota);
  }

  compartido.oyentes.push(() => { reiniciar(); });
  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m3-quiz"), [
    {
      enunciado: "Tras el primer barrido partiendo de \\(v = 0\\), ¿qué estados han cambiado de valor?",
      opciones: [
        "Todos: cada estado recibe su recompensa inmediata esperada, que es \\(-1\\).",
        "Solo los que tocan el terminal, porque son los únicos con información.",
        "Ninguno, porque \\(v\\) empieza en 0.",
        "Solo el terminal.",
      ],
      correcta: 0,
      explicacion: "En el primer barrido \\(v_1(s)=\\sum_a\\pi(a|s)\\sum p\\,[r+\\gamma\\cdot 0] = -1\\) para todos. Lo que se propaga poco a poco no es la recompensa sino la <em>diferencia</em> entre estados: la estructura del problema tarda varios barridos en llegar a los estados lejanos.",
    },
    {
      enunciado: "¿Qué relación hay entre \\(v_\\pi\\) y \\(q_\\pi\\)?",
      opciones: [
        "\\(v_\\pi(s) = \\sum_a \\pi(a\\mid s)\\, q_\\pi(s,a)\\): el valor del estado es la media de los valores de acción bajo la política.",
        "\\(v_\\pi(s) = \\max_a q_\\pi(s,a)\\) para cualquier política.",
        "Son iguales cuando la política es equiprobable.",
        "\\(q_\\pi(s,a) = v_\\pi(s) + r\\).",
      ],
      correcta: 0,
      explicacion: "El máximo solo aparece con la política óptima (\\(v_*(s)=\\max_a q_*(s,a)\\)). Para una política cualquiera se promedia con los pesos \\(\\pi(a\\mid s)\\). Puedes comprobarlo en la tabla: la media de las cuatro columnas \\(q\\) con la política equiprobable da la columna \\(v_\\pi\\).",
    },
    {
      enunciado: "Si eliges la política determinista hacia T y pones \\(\\gamma = 1\\), el sistema lineal…",
      opciones: [
        "sigue teniendo solución, porque esa política alcanza el terminal desde todos los estados.",
        "se vuelve singular siempre que \\(\\gamma = 1\\).",
        "da valores positivos.",
        "no se puede plantear con políticas deterministas.",
      ],
      correcta: 0,
      explicacion: "La matriz \\(\\mathbf{I}-\\gamma \\mathbf{P}_\\pi\\) es invertible con \\(\\gamma=1\\) siempre que el terminal se alcance con probabilidad 1 desde todo estado. Una política que se quedase dando vueltas sin llegar a T sí haría divergir el retorno, y ahí el sistema se vuelve singular.",
    },
  ]);
}

/* ======================================================================= *
 * MÓDULO 4 — diagramas de backup
 * ======================================================================= */

function celdasNavegacion(mdpNav, { valores = null, politica = null, seleccion = null, mostrarViento = true } = {}) {
  const g = mdpNav.geometria;
  const celdas = [];
  let minimo = 0;
  let maximo = 0;
  if (valores) {
    const noT = valores.filter((_, s) => !mdpNav.esTerminal(s));
    minimo = Math.min(...noT);
    maximo = Math.max(...noT);
  }
  const escala = (x) => (maximo - minimo < 1e-9 ? 0.5 : (x - minimo) / (maximo - minimo));

  for (let s = 0; s < mdpNav.nEstados; s++) {
    const pos = g.posicion(s);
    const esTerminal = mdpNav.esTerminal(s);
    const esRemolino = s === g.remolino;
    const conViento = g.soplaHacia(s);

    let color;
    let textoColor = tono("--texto");
    if (esTerminal) {
      color = tono("--superficie-3");
      textoColor = tono("--texto-suave");
    } else if (valores) {
      color = colorCalor(escala(valores[s]));
      textoColor = textoSobre(color);
    } else if (esRemolino) {
      color = tono("--mal-bg");
    } else if (mostrarViento && g.vientoEste.includes(s)) {
      color = tono("--azul-tenue");
    } else if (mostrarViento && g.vientoSur.includes(s)) {
      color = tono("--ok-bg");
    } else {
      color = tono("--superficie");
    }

    const flechas = politica && !esTerminal ? politica[s].map((a) => DIRS[a]) : null;

    celdas.push({
      ...pos,
      etiqueta: mdpNav.etiquetas[s],
      subetiqueta: valores && !esTerminal ? num(valores[s], 1) : (esRemolino && !valores ? "−5" : null),
      tamano: valores ? 13 : 17,
      color,
      textoColor,
      borde: esRemolino ? tono("--mal") : null,
      flechas,
      titulo: [
        `Estado ${mdpNav.etiquetas[s]}`,
        esRemolino ? "Remolino: entrar aquí cuesta −5" : null,
        conViento ? `Viento: sopla hacia el ${conViento}` : null,
        valores ? `v = ${num(valores[s], 3)}` : null,
      ].filter(Boolean).join("\n"),
    });
  }
  return { celdas, seleccion };
}

const BANDAS_VIENTO = [
  { fila: 0, col: 2, ancho: 2, alto: 1, color: "none", texto: "Viento Este", textoArriba: true },
  { fila: 3, col: 1, ancho: 1, alto: 1, color: "none", texto: "Viento Sur" },
];

function moduloBackup() {
  const zonaRejilla = $("#m4-rejilla");
  const zonaArbol = $("#m4-arbol");
  const zonaTabla = $("#m4-tabla");
  const titulo = $("#m4-titulo");

  let invertido = false;
  let mdpNav = rejillaNavegacion({ vientoProcedente: !invertido });
  let seleccion = 0; // estado "1", el del ejemplo de la diapositiva

  grupoRadio($("#m4-atajos"), [
    { texto: "Estado 1", valor: 1, titulo: "El ejemplo resuelto en la diapositiva 18" },
    { texto: "Estado 3", valor: 3, titulo: "Ejercicio abierto de la diapositiva 18" },
    { texto: "Estado 4", valor: 4, titulo: "Ejercicio abierto de la diapositiva 18" },
    { texto: "Estado 11", valor: 11, titulo: "El que pide el problema 3 de Problemas.pdf" },
  ], 1, (etiqueta) => {
    seleccion = mdpNav.etiquetas.indexOf(String(etiqueta));
    dibujar();
  });

  $("#m4-viento-inv").addEventListener("change", (ev) => {
    invertido = ev.target.checked;
    mdpNav = rejillaNavegacion({ vientoProcedente: !invertido });
    dibujar();
  });

  function dibujar() {
    const { celdas } = celdasNavegacion(mdpNav, { seleccion });
    pintar(zonaRejilla, rejilla({
      celdas, lado: 72, margen: 34, seleccion,
      etiquetasBanda: BANDAS_VIENTO,
      alSeleccionar: (indice) => { seleccion = indice; dibujar(); },
    }));

    const etiqueta = mdpNav.etiquetas[seleccion];
    titulo.textContent = `Diagrama de backup del estado ${etiqueta}`;

    if (mdpNav.esTerminal(seleccion)) {
      zonaArbol.innerHTML = `<p class="suave">T es terminal: no tiene diagrama de backup.</p>`;
      zonaTabla.innerHTML = "";
      return;
    }

    const ramas = ramasBackup(mdpNav, seleccion);
    pintar(zonaArbol, arbolBackup(etiqueta, ramas, { ancho: 560 }));

    const filas = ramas.flatMap((rama) => rama.nodos.map((n, k) => `
      <tr>
        <td>${k === 0 ? rama.accion : ""}</td>
        <td class="mono">${n.estado}</td>
        <td class="mono">${n.recompensa}</td>
        <td class="mono">${num(n.probabilidad, 2)}</td>
      </tr>`)).join("");
    zonaTabla.innerHTML = `
      <thead><tr><th>a</th><th>s′</th><th>r</th><th>p</th></tr></thead>
      <tbody>${filas}</tbody>`;

    const sucesores = estadosSucesores(mdpNav, seleccion).map((s) => mdpNav.etiquetas[s]);
    $("#m4-leyenda").innerHTML = `
      Azul: viento (celdas 3 y 4). Verde: viento (celdas 10 y 14). Rojo: el remolino
      (estado 8), donde <em>entrar</em> cuesta −5. T solo se alcanza desde el 16 yendo al este.
      <br><strong>Para actualizar v(${etiqueta}) hacen falta los valores de:</strong>
      <span class="mono">${sucesores.join(", ")}</span>.`;
  }

  $("#m4-aviso").innerHTML = `
    <strong>Sobre el sentido del viento.</strong> El enunciado dice «Viento Este» y «Viento
    Sur» sin aclarar si el viento va hacia ese punto cardinal o viene de él. Lo fija la
    trayectoria T1 del problema 3 de <span class="mono">Problemas.pdf</span>:
    <span class="mono">… (2,right), (3,right), (3,down) …</span> — desde el estado 3 el
    agente va al este y <em>no se mueve</em>. Como la celda 4 existe, no puede ser un rebote:
    solo cabe la regla «en dirección opuesta al viento → 0.25 de no moverse». Por tanto el
    viento Este <em>procede</em> del este y sopla hacia el oeste, y el viento Sur sopla hacia
    el norte. El interruptor de arriba permite ver el criterio contrario.`;

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m4-quiz"), [
    {
      enunciado: "En el diagrama del estado 3, la rama de la acción E tiene dos hojas: 4 con probabilidad 0.75 y 3 con probabilidad 0.25. ¿Por qué aparece el propio 3 como sucesor?",
      opciones: [
        "Porque ir al este es ir contra el viento, y hay 0.25 de probabilidad de no moverse.",
        "Porque el estado 3 está en el borde y rebota.",
        "Porque el viento puede empujarlo dos celdas y sale del tablero.",
        "Porque la política asigna probabilidad 0.25 a quedarse quieto.",
      ],
      correcta: 0,
      explicacion: "El rebote no puede ser: la celda 4 existe. Y la política no interviene en la dinámica: \\(p(s',r\\mid s,a)\\) es del <em>entorno</em>. Queda la regla del viento en contra.",
    },
    {
      enunciado: "El diagrama de backup del estado 4 hacia el este tiene una sola hoja con probabilidad 1. ¿Qué ha pasado con el 0.25 del viento?",
      opciones: [
        "Las dos ramas llevan al mismo sitio (rebota contra el borde en ambos casos), así que sus probabilidades se suman.",
        "El viento no afecta a la celda 4.",
        "Se ha perdido: la distribución ya no suma 1.",
        "El 0.25 se reparte entre las otras tres acciones.",
      ],
      correcta: 0,
      explicacion: "\\(p(s',r\\mid s,a)\\) es una distribución sobre pares \\((s',r)\\), no sobre «lo que intentó hacer el agente». Si dos sucesos distintos acaban en el mismo par, sus probabilidades se agregan: \\(0.75+0.25=1\\). Es un detalle que se cuela en muchos exámenes.",
    },
    {
      enunciado: "¿Qué representan los puntos negros del diagrama de backup?",
      opciones: [
        "Los pares \\((s,a)\\): de ahí sale la incertidumbre del entorno.",
        "Los estados terminales.",
        "Las recompensas.",
        "Los estados sucesores.",
      ],
      correcta: 0,
      explicacion: "El primer nivel de ramificación lo elige el <em>agente</em> con \\(\\pi(a\\mid s)\\); el segundo lo elige el <em>entorno</em> con \\(p(s',r\\mid s,a)\\). Los puntos negros son la frontera entre ambos.",
    },
  ]);
}

/* ======================================================================= *
 * MÓDULO 5 — optimalidad
 * ======================================================================= */

function moduloOptimalidad() {
  const mdpNav = rejillaNavegacion();
  const zonaRejilla = $("#m5-rejilla");
  const zonaTabla = $("#m5-tabla");
  const titulo = $("#m5-titulo");

  let gamma = 1;
  let modo = "optimo";
  let verFlechas = true;

  grupoRadio($("#m5-modo"), [
    { texto: "Política óptima", valor: "optimo", titulo: "Ecuación de optimalidad de Bellman" },
    { texto: "Política equiprobable", valor: "equi", titulo: "Evaluación de una política que se mueve al azar" },
  ], "optimo", (valor) => { modo = valor; dibujar(); });

  $("#m5-gamma").addEventListener("input", (ev) => {
    gamma = Number(ev.target.value);
    $("#m5-gamma-v").textContent = num(gamma, 2);
    dibujar();
  });

  $("#m5-flechas").addEventListener("change", (ev) => {
    verFlechas = ev.target.checked;
    dibujar();
  });

  function dibujar() {
    let v;
    let esOptimo = modo === "optimo";
    if (esOptimo) {
      v = iteracionValor(mdpNav, gamma).v;
    } else {
      v = evaluarLineal(mdpNav, politicaEquiprobable(mdpNav), gamma)
        || new Array(mdpNav.nEstados).fill(NaN);
    }

    const q = qDeV(mdpNav, v, gamma);
    const greedy = politicaGreedy(mdpNav, q);
    const cuantas = numeroPoliticasOptimas(greedy);
    const conEmpate = greedy.filter((acciones) => acciones.length > 1).length;

    const { celdas } = celdasNavegacion(mdpNav, {
      valores: v,
      politica: verFlechas ? greedy : null,
    });
    pintar(zonaRejilla, rejilla({ celdas, lado: 72, margen: 34, etiquetasBanda: BANDAS_VIENTO }));

    titulo.innerHTML = esOptimo ? "v<sub>*</sub>(s) y π<sub>*</sub>" : "v<sub>π</sub>(s) con π equiprobable";
    $("#m5-cuantas").textContent = esOptimo ? String(cuantas) : "—";
    $("#m5-v1").textContent = num(v[0], 2);

    $("#m5-nota").innerHTML = esOptimo
      ? `Hay <strong>${conEmpate} estados con empate</strong> en el argmax, y por tanto
         <strong>${cuantas} políticas deterministas óptimas distintas</strong>: esa es la
         respuesta a la pregunta de la diapositiva. Todas comparten la misma \\(v_*\\) —
         la función de valor óptima es única, la política óptima no.
         ${gamma < 1 ? `Con \\(\\gamma = ${numMat(gamma, 2)}\\) los empates cambian: el descuento
         altera qué caminos son indistinguibles.` : ""}`
      : `Moverse al azar es carísimo: compara este \\(v_\\pi\\) con el \\(v_*\\) de la otra
         vista. La diferencia en cada celda es lo que se gana por actuar bien, y es máxima
         cerca del remolino, donde una acción equivocada cuesta −5.`;

    const filas = [];
    for (let s = 0; s < mdpNav.nEstados; s++) {
      if (mdpNav.esTerminal(s)) continue;
      const acciones = greedy[s].map((a) => mdpNav.acciones[a]).join(" / ");
      filas.push(`<tr${greedy[s].length > 1 ? ' class="destacada"' : ""}>
        <td class="mono">${mdpNav.etiquetas[s]}</td>
        <td class="mono">${num(v[s], 2)}</td>
        <td>${acciones}</td>
      </tr>`);
    }
    zonaTabla.innerHTML = `
      <thead><tr><th>s</th><th>v(s)</th><th>acción(es) greedy</th></tr></thead>
      <tbody>${filas.join("")}</tbody>`;
    renderizarMatematicas($("#m5-nota"));
  }

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m5-quiz"), [
    {
      enunciado: "Las celdas con dos flechas indican que…",
      opciones: [
        "hay un empate en \\(\\arg\\max_a q_*(s,a)\\): ambas acciones son igual de buenas, y por eso existe más de una política óptima.",
        "la política todavía no ha convergido.",
        "el agente debe alternar entre las dos acciones.",
        "hay un error numérico en la iteración de valor.",
      ],
      correcta: 0,
      explicacion: "\\(v_*\\) es única, pero cualquier política que en cada estado ponga toda la probabilidad sobre acciones que alcanzan el máximo es óptima. Si hay empates, hay varias.",
    },
    {
      enunciado: "¿Qué diferencia hay entre la ecuación de Bellman para \\(v_\\pi\\) y la ecuación de <em>optimalidad</em> para \\(v_*\\)?",
      opciones: [
        "La de \\(v_\\pi\\) promedia sobre las acciones con \\(\\pi(a\\mid s)\\); la de \\(v_*\\) toma el máximo sobre las acciones.",
        "La de \\(v_*\\) no incluye el factor de descuento.",
        "La de \\(v_\\pi\\) es lineal y la de \\(v_*\\) también.",
        "No hay diferencia: son la misma ecuación con distinto nombre.",
      ],
      correcta: 0,
      explicacion: "Sustituir la media por el máximo es lo que rompe la linealidad: por eso \\(v_\\pi\\) se puede obtener resolviendo un sistema y \\(v_*\\) no, y hay que recurrir a métodos iterativos como la iteración de valor.",
    },
    {
      enunciado: "El estado 8 (el remolino) tiene un valor peor que sus vecinos. ¿Por qué exactamente?",
      opciones: [
        "Porque la recompensa −5 se cobra al <em>entrar</em> en él, así que todo camino que pase por ahí paga ese coste.",
        "Porque estar en el estado 8 impide moverse.",
        "Porque el remolino es un estado terminal de fracaso.",
        "Porque el descuento se aplica dos veces en esa celda.",
      ],
      correcta: 0,
      explicacion: "El remolino no atrapa ni termina el episodio: solo encarece las transiciones que acaban en él. Por eso la política óptima lo rodea, y por eso los estados desde los que es difícil evitarlo también pierden valor.",
    },
  ]);
}

/* ======================================================================= *
 * Arranque
 * ======================================================================= */

moduloDinamica();
moduloPolitica();
moduloValores();
moduloBackup();
moduloOptimalidad();
renderizarMatematicas();
