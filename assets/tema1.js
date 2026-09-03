/* ==========================================================================
   RL · IMAT — Tema 1: Introducción y k-armed bandits
   Comportamiento de los cinco módulos de tema1.html
   ========================================================================== */

import {
  iniciarPagina, graficaLineas, graficaViolin, crearQuiz, pintar, leyenda,
  num, numMat, pct, tono, el, generador, alCambiarTema, renderizarMatematicas,
  COLORES_SERIE,
} from "./nucleo.js";

import {
  TIPOS, crearBandit, crearBanditManual, ejecutar, barridoParametros,
} from "./bandits.js";

iniciarPagina();

const $ = (sel) => document.querySelector(sel);
const repintadores = [];
alCambiarTema(() => repintadores.forEach((fn) => fn()));

/* ----------------------------------------------------------------------- *
 * Worker de cálculo, con vuelta atrás al hilo principal si no está disponible
 * ----------------------------------------------------------------------- */

let worker = null;
try {
  worker = new Worker(new URL("./calculo-worker.js", import.meta.url), { type: "module" });
} catch {
  worker = null;
}

let siguienteId = 1;
const enCurso = new Map();

if (worker) {
  worker.onmessage = (evento) => {
    const { tipo, id, fraccion, resultados, curvas, mensaje } = evento.data;
    const tarea = enCurso.get(id);
    if (!tarea) return;
    if (tipo === "progreso") tarea.alProgresar?.(fraccion);
    else if (tipo === "listo") { enCurso.delete(id); tarea.resolver(resultados || curvas); }
    else if (tipo === "error") { enCurso.delete(id); tarea.rechazar(new Error(mensaje)); }
  };
  worker.onerror = () => { worker = null; };
}

/** Lanza un cálculo en el worker; si no hay worker, lo hace aquí mismo. */
function calcular(tarea, config, alProgresar) {
  if (!worker) {
    const fn = tarea === "ejecutar" ? ejecutar : barridoParametros;
    return Promise.resolve(fn({ ...config, alProgresar }));
  }
  const id = siguienteId++;
  return new Promise((resolver, rechazar) => {
    enCurso.set(id, { resolver, rechazar, alProgresar });
    worker.postMessage({ tarea, id, config });
  });
}

/* ======================================================================= *
 * MÓDULO 1 — el problema del bandit (el ejemplo del jamón)
 * ======================================================================= */

function moduloBandit() {
  const NOMBRES = ["5J", "Joselito", "Covap"];
  // Valores verdaderos de 1_Tema1#page-17 y #page-19. Ojo: las muestras de
  // #page-18 son 9,7 (5J) / 9,8 (Joselito) / 9,1 (Covap) — el 9,8 es una MUESTRA
  // de Joselito, no el q_* de 5J. Confundirlos es el error que este módulo tenía.
  const VERDADEROS = [9.5, 9.2, 8.9];

  const zonaTabla = $("#m1-tabla");
  const zonaHistorial = $("#m1-historial");
  const zonaBrazos = $("#m1-brazos");
  const zonaDiagnostico = $("#m1-diagnostico");

  let bandit;
  let mostrarVerdaderos = false;

  function reiniciar() {
    const semilla = Math.max(1, Number($("#m1-semilla").value) || 1);
    bandit = crearBanditManual({ qEstrella: VERDADEROS, sigmaR: 0.25, semilla });
    dibujar();
  }

  zonaBrazos.innerHTML = "";
  NOMBRES.forEach((nombre, a) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = nombre;
    boton.addEventListener("click", () => { bandit.tirar(a); dibujar(); });
    zonaBrazos.appendChild(boton);
  });

  const botonVerdaderos = document.createElement("button");
  botonVerdaderos.type = "button";
  botonVerdaderos.textContent = "Ver q*(a)";
  botonVerdaderos.title = "Revelar los valores verdaderos, que el agente no conoce";
  botonVerdaderos.addEventListener("click", () => {
    mostrarVerdaderos = !mostrarVerdaderos;
    botonVerdaderos.setAttribute("aria-pressed", String(mostrarVerdaderos));
    dibujar();
  });
  zonaBrazos.appendChild(botonVerdaderos);

  $("#m1-greedy").addEventListener("click", () => {
    for (let i = 0; i < 10; i++) bandit.tirar(bandit.accionGreedy());
    dibujar();
  });
  $("#m1-reset").addEventListener("click", reiniciar);
  $("#m1-semilla").addEventListener("change", reiniciar);

  function dibujar() {
    const greedy = bandit.accionGreedy();
    const filas = NOMBRES.map((nombre, a) => `
      <tr${a === greedy && bandit.tiradas > 0 ? ' class="destacada"' : ""}>
        <td>${nombre}</td>
        <td class="mono">${bandit.N[a]}</td>
        <td class="mono">${bandit.N[a] ? num(bandit.Q[a], 3) : "—"}</td>
        <td class="mono suave">${mostrarVerdaderos ? num(VERDADEROS[a], 1) : "?"}</td>
      </tr>`).join("");
    zonaTabla.innerHTML = `
      <thead><tr><th>Acción</th><th>N(a)</th><th>Q<sub>t</sub>(a)</th><th>q<sub>*</sub>(a)</th></tr></thead>
      <tbody>${filas}</tbody>`;

    $("#m1-tiradas").textContent = String(bandit.tiradas);
    $("#m1-media").textContent = bandit.tiradas ? num(bandit.recompensaMedia, 3) : "—";
    const regret = $("#m1-regret");
    regret.textContent = num(bandit.regret, 2);
    regret.className = `cifra ${bandit.regret < 0.5 ? "buena" : "mala"}`;

    const ultimas = bandit.historial.slice(-14).reverse();
    zonaHistorial.innerHTML = ultimas.length
      ? `<thead><tr><th>t</th><th>A<sub>t</sub></th><th>R<sub>t</sub></th><th>Q tras</th></tr></thead>
         <tbody>${ultimas.map((p) => `
           <tr><td class="mono">${p.t}</td><td>${NOMBRES[p.a]}</td>
           <td class="mono">${num(p.r, 2)}</td><td class="mono">${num(p.Q, 3)}</td></tr>`).join("")}</tbody>`
      : `<tbody><tr><td class="suave">Todavía no has tirado de ninguna palanca.</td></tr></tbody>`;

    if (bandit.tiradas === 0) {
      zonaDiagnostico.innerHTML = `Con \\(Q_0(a) = 0\\) para todos, la política greedy no
        tiene con qué decidir: cualquier acción es «la mejor». Prueba uno.`;
    } else {
      const sinProbar = NOMBRES.filter((_, a) => bandit.N[a] === 0);
      const acierta = greedy === bandit.accionOptima;
      zonaDiagnostico.innerHTML = `
        La política <em>greedy</em> elegiría ahora <strong>${NOMBRES[greedy]}</strong>
        (\\(Q_t = ${numMat(bandit.Q[greedy], 3)}\\)).
        ${acierta
          ? "Acierta — pero fíjate en si lo ha hecho por conocimiento o por suerte."
          : `<strong>Y se equivoca:</strong> el mejor es ${NOMBRES[bandit.accionOptima]}.`}
        ${sinProbar.length
          ? ` Todavía no has probado ${sinProbar.join(" ni ")}: greedy nunca lo hará por su cuenta,
             porque explotar es siempre preferir lo que ya conoce.`
          : ""}`;
    }
    renderizarMatematicas(zonaDiagnostico);
  }

  reiniciar();

  crearQuiz($("#m1-quiz"), [
    {
      enunciado: "En la diapositiva, la única muestra de <em>5J</em> vale 9,7 y la de <em>Joselito</em> 9,8. ¿Qué hace la política greedy?",
      opciones: [
        "Elegir Joselito para siempre, aunque una sola muestra no distingue de forma fiable entre 9,7 y 9,8.",
        "Elegir 5J, que es el que tiene mayor \\(q_*(a)\\).",
        "Alternar entre los dos hasta desempatar.",
        "Elegir Covap, por ser el menos explorado.",
      ],
      correcta: 0,
      explicacion: "Greedy maximiza \\(Q_t\\), no \\(q_*\\): actúa sobre lo que <em>cree</em>. Con una muestra por brazo y ruido, esa creencia es muy poco fiable — y como no explora, no llega a corregirla. Ese es exactamente el argumento de la diapositiva.",
    },
    {
      enunciado: "¿Qué mide el <em>regret</em>?",
      opciones: [
        "Lo que se deja de ganar frente a haber tirado siempre del brazo óptimo.",
        "El error de estimación \\(|Q_t(a) - q_*(a)|\\).",
        "El número de veces que se ha explorado.",
        "La varianza de las recompensas recibidas.",
      ],
      correcta: 0,
      explicacion: "«La máxima recompensa que puedo obtener frente a lo que obtengo». Ojo: el regret se define con los \\(q_*\\), no con las recompensas realizadas — es una medida de la calidad de las <em>decisiones</em>, no de la suerte.",
    },
    {
      enunciado: "La regla \\(Q_{n+1} = Q_n + \\frac{1}{n}[R_n - Q_n]\\) es un caso particular de…",
      opciones: [
        "NuevaEstimación ← Estimación anterior + StepSize · [Objetivo − Estimación anterior], la estructura que reaparece en todo el curso.",
        "el descenso de gradiente sobre el error cuadrático de la política.",
        "la ecuación de Bellman para \\(q_*\\).",
        "el muestreo de importancia.",
      ],
      correcta: 0,
      explicacion: "Es la plantilla que volverás a ver en Monte Carlo, en TD, en SARSA y en aproximación de funciones. Lo único que cambia entre métodos es qué se pone como <em>objetivo</em> y qué se usa como <em>StepSize</em>.",
    },
  ]);
}

/* ======================================================================= *
 * MÓDULO 2 — el banco de pruebas de 10 brazos
 * ======================================================================= */

function moduloTestbed() {
  const zona = $("#m2-violin");
  let k = 10;

  function dibujar() {
    const semilla = Math.max(1, Number($("#m2-semilla").value) || 1);
    const bandit = crearBandit({
      k, rngProblema: generador(semilla), rngRuido: generador(semilla + 1),
    });
    const q = Array.from(bandit.qEstrella);
    pintar(zona, graficaViolin(q, { ancho: 720, alto: 340 }));

    const ordenados = [...q].sort((a, b) => b - a);
    const brecha = ordenados[0] - ordenados[1];
    $("#m2-nota").innerHTML = `
      En esta instancia el mejor brazo es el <strong>${q.indexOf(ordenados[0]) + 1}</strong>
      con \\(q_* = ${numMat(ordenados[0], 2)}\\), y le saca
      <strong>${num(brecha, 2)}</strong> al segundo.
      ${brecha < 0.25
        ? "Es una brecha <em>muy pequeña</em>: hará falta muchísima exploración para distinguirlos, y la curva de «% de acción óptima» subirá despacio aunque el agente esté haciéndolo bien en recompensa."
        : brecha > 0.8
          ? "Es una brecha <em>grande</em>: casi cualquier estrategia lo encontrará pronto."
          : "Es una brecha intermedia, la situación típica."}
      Prueba varias semillas: las curvas del módulo 3 promedian cientos de instancias como
      esta, y por eso salen suaves.`;
    renderizarMatematicas($("#m2-nota"));
  }

  $("#m2-semilla").addEventListener("input", dibujar);
  $("#m2-nuevo").addEventListener("click", () => {
    $("#m2-semilla").value = String(Math.floor(Math.random() * 99999) + 1);
    dibujar();
  });
  $("#m2-k").addEventListener("input", (ev) => {
    k = Number(ev.target.value);
    $("#m2-k-v").textContent = String(k);
    dibujar();
  });

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m2-quiz"), [
    {
      enunciado: "Las recompensas se muestrean de \\(\\mathcal{N}(q_*(a), 1)\\). Si dos brazos difieren en 0,2, ¿cuántas tiradas hacen falta para distinguirlos con fiabilidad?",
      opciones: [
        "Muchas: el error típico de la media cae como \\(1/\\sqrt{n}\\), así que para resolver una diferencia de 0,2 hacen falta del orden de 100 tiradas por brazo.",
        "Dos o tres: la media converge muy rápido.",
        "Ninguna: basta comparar la primera muestra de cada uno.",
        "Es imposible distinguirlos por muestreo.",
      ],
      correcta: 0,
      explicacion: "Con \\(\\sigma = 1\\), el error típico tras \\(n\\) tiradas es \\(1/\\sqrt{n}\\). Para bajar de 0,2 hacen falta \\(n \\gtrsim 25\\) por brazo solo para igualar la diferencia, y bastante más para separarla del ruido. Por eso el «% de acción óptima» sube tan despacio.",
    },
    {
      enunciado: "¿Por qué las figuras del libro promedian 2000 ejecuciones?",
      opciones: [
        "Porque cada instancia del problema es distinta y una sola ejecución sería puro ruido: se está estimando el rendimiento <em>esperado</em> de la estrategia.",
        "Porque el algoritmo necesita 2000 pasos para converger.",
        "Para que el agente vea 2000 brazos distintos.",
        "Porque es el número mínimo para que \\(Q_t\\) converja a \\(q_*\\).",
      ],
      correcta: 0,
      explicacion: "Lo que se compara no es el resultado en <em>un</em> bandit sino el comportamiento medio sobre la distribución de problemas. Genera varias semillas aquí y verás lo distintas que pueden ser dos instancias.",
    },
  ]);
}

/* ======================================================================= *
 * MÓDULO 3 — comparador de estrategias
 * ======================================================================= */

const ESTRATEGIAS = [
  {
    id: "eps01", nombre: "ε-greedy, ε = 0.1", parametro: "ε", valor: 0.1, activa: true,
    config: (v) => ({ tipo: TIPOS.EPSILON, epsilon: v, alpha: null, q0: 0 }),
  },
  {
    id: "eps001", nombre: "ε-greedy, ε = 0.01", parametro: "ε", valor: 0.01, activa: true,
    config: (v) => ({ tipo: TIPOS.EPSILON, epsilon: v, alpha: null, q0: 0 }),
  },
  {
    id: "greedy", nombre: "greedy (ε = 0)", parametro: "—", valor: 0, activa: true,
    config: () => ({ tipo: TIPOS.EPSILON, epsilon: 0, alpha: null, q0: 0 }),
  },
  {
    id: "alfa", nombre: "ε-greedy 0.1 con paso constante α", parametro: "α", valor: 0.1, activa: false,
    config: (v) => ({ tipo: TIPOS.EPSILON, epsilon: 0.1, alpha: v, q0: 0 }),
  },
  {
    id: "optimista", nombre: "greedy optimista (α = 0.1)", parametro: "Q₀", valor: 5, activa: false,
    config: (v) => ({ tipo: TIPOS.OPTIMISTA, epsilon: 0, alpha: 0.1, q0: v }),
  },
  {
    id: "ucb", nombre: "UCB", parametro: "c", valor: 2, activa: false,
    config: (v) => ({ tipo: TIPOS.UCB, c: v, alpha: null, q0: 0 }),
  },
  {
    id: "gradiente", nombre: "gradient bandit", parametro: "α", valor: 0.1, activa: false,
    config: (v) => ({ tipo: TIPOS.GRADIENTE, alpha: v, conBaseline: true }),
  },
];

function moduloComparador() {
  const zonaEstrategias = $("#m3-estrategias");
  const botonEjecutar = $("#m3-ejecutar");
  let ultimo = null;

  zonaEstrategias.innerHTML = ESTRATEGIAS.map((e) => `
    <div class="control">
      <label class="interruptor">
        <input type="checkbox" data-est="${e.id}" ${e.activa ? "checked" : ""}>
        ${e.nombre}
      </label>
      ${e.parametro === "—" ? "" : `
        <div class="fila">
          <span class="suave mono">${e.parametro}</span>
          <input type="number" data-par="${e.id}" value="${e.valor}" step="0.01" min="0" style="width:5.5rem">
        </div>`}
    </div>`).join("");

  zonaEstrategias.querySelectorAll("[data-est]").forEach((entrada) => {
    entrada.addEventListener("change", () => {
      const e = ESTRATEGIAS.find((x) => x.id === entrada.dataset.est);
      e.activa = entrada.checked;
    });
  });
  zonaEstrategias.querySelectorAll("[data-par]").forEach((entrada) => {
    entrada.addEventListener("change", () => {
      const e = ESTRATEGIAS.find((x) => x.id === entrada.dataset.par);
      e.valor = Number(entrada.value);
    });
  });

  const enlazar = (idRango, idSalida, formato = String) => {
    const rango = $(idRango);
    const salida = $(idSalida);
    rango.addEventListener("input", () => { salida.textContent = formato(Number(rango.value)); });
  };
  enlazar("#m3-pasos", "#m3-pasos-v");
  enlazar("#m3-runs", "#m3-runs-v");

  $("#m3-deriva").addEventListener("change", (ev) => {
    if (!ev.target.checked) return;
    // el par que responde a la pregunta: promedio muestral frente a α constante
    const alfa = zonaEstrategias.querySelector('[data-est="alfa"]');
    if (alfa && !alfa.checked) { alfa.checked = true; alfa.dispatchEvent(new Event("change")); }
  });

  const progreso = $("#m3-progreso");

  /** Cajas de gráfica con su mensaje, para que nunca se vean vacías. */
  function dibujarVacio(mensaje) {
    for (const id of ["#m3-gr-recompensa", "#m3-gr-optimo"]) {
      pintar($(id), graficaLineas([], { ancho: 900, alto: 300, mensaje }));
    }
  }

  botonEjecutar.addEventListener("click", async () => {
    const activas = ESTRATEGIAS.filter((e) => e.activa);
    if (!activas.length) {
      dibujarVacio("Selecciona al menos una estrategia.");
      return;
    }

    botonEjecutar.disabled = true;
    botonEjecutar.textContent = "Calculando…";
    progreso.hidden = false;
    progreso.firstElementChild.style.width = "0%";
    dibujarVacio("Calculando…");

    const config = {
      configuraciones: activas.map((e) => ({ id: e.id, ...e.config(e.valor) })),
      pasos: Number($("#m3-pasos").value),
      ejecuciones: Number($("#m3-runs").value),
      semilla: Math.max(1, Number($("#m3-semilla").value) || 1),
      deriva: $("#m3-deriva").checked ? 0.01 : 0,
    };

    try {
      const resultados = await calcular("ejecutar", config, (fraccion) => {
        progreso.firstElementChild.style.width = `${Math.round(fraccion * 100)}%`;
      });
      ultimo = { resultados, activas, config };
      dibujar();
    } catch (error) {
      dibujarVacio("No se pudo completar el cálculo.");
      $("#m3-lectura").textContent = `No se pudo completar el cálculo: ${error.message}`;
    } finally {
      botonEjecutar.disabled = false;
      botonEjecutar.textContent = "Ejecutar";
      progreso.hidden = true;
    }
  });

  function dibujar() {
    if (!ultimo) return;
    const { resultados, activas, config } = ultimo;
    const series = resultados.map((r, i) => {
      const e = activas[i];
      return {
        nombre: e.parametro === "—" ? e.nombre : `${e.nombre.replace(/[,·].*$/, "")} (${e.parametro} = ${e.valor})`,
        color: tono(COLORES_SERIE[i % COLORES_SERIE.length]),
        y: Array.from(r.recompensa),
      };
    });
    const seriesOptimo = resultados.map((r, i) => ({
      nombre: series[i].nombre,
      color: series[i].color,
      y: Array.from(r.optimo),
    }));

    pintar($("#m3-gr-recompensa"), graficaLineas(series, {
      ancho: 900, alto: 300, ejeX: "Pasos", ejeY: "Recompensa media", yMin: 0,
    }));
    pintar($("#m3-gr-optimo"), graficaLineas(seriesOptimo, {
      ancho: 900, alto: 300, ejeX: "Pasos", ejeY: "% acción óptima",
      yMin: 0, yMax: 1, formatoY: (v) => `${Math.round(v * 100)} %`,
    }));
    $("#m3-leyenda").replaceChildren(leyenda(series));

    /* --- lectura automática de lo que ha pasado --- */
    const nivel = (serie) => {
      const desde = Math.floor(serie.length * 0.9);
      let suma = 0;
      for (let i = desde; i < serie.length; i++) suma += serie[i];
      return suma / (serie.length - desde);
    };
    const mejor = resultados
      .map((r, i) => ({ nombre: series[i].nombre, valor: nivel(r.optimo) }))
      .sort((a, b) => b.valor - a.valor)[0];

    const partes = [
      `Al final del horizonte (${config.pasos} pasos, promediando ${config.ejecuciones}
       problemas) la estrategia que más veces acierta la acción óptima es
       <strong>${mejor.nombre}</strong>, con ${pct(mejor.valor, 1)}.`,
    ];

    const e01 = resultados.find((r) => r.id === "eps01");
    const e001 = resultados.find((r) => r.id === "eps001");
    if (e01 && e001) {
      const cruce = buscarCruce(e001.optimo, e01.optimo);
      partes.push(cruce
        ? `<strong>El cruce ocurre hacia el paso ${cruce}:</strong> a partir de ahí
           ε = 0.01 supera a ε = 0.1. Explora diez veces menos, así que tarda mucho más
           en encontrar el mejor brazo, pero una vez lo encuentra lo explota el 99 % del
           tiempo en lugar del 90 %. Esa es la respuesta a la pregunta de la diapositiva.`
        : `Con este horizonte todavía no se ve el cruce entre ε = 0.1 y ε = 0.01:
           sube los pasos por encima de 5000 y vuelve a ejecutar.`);
    }

    if (config.deriva > 0) {
      partes.push(`Con el entorno en movimiento, el <strong>promedio muestral 1/n deja de
        funcionar</strong>: reparte el mismo peso entre lo que vio al principio y lo que
        acaba de ver, así que arrastra información caducada. El paso constante α mantiene
        un promedio ponderado por recencia y sigue al óptimo. Es también la respuesta a
        «¿se cumple \\(\\sum \\alpha_n^2 &lt; \\infty\\) para α constante?»: no se cumple,
        y precisamente por eso el agente nunca deja de aprender.`);
    }

    $("#m3-lectura").innerHTML = partes.join(" ");
    renderizarMatematicas($("#m3-lectura"));
  }

  /** Primer paso a partir del cual una serie supera a la otra de forma sostenida. */
  function buscarCruce(a, b) {
    const ventana = Math.max(50, Math.floor(a.length / 40));
    const media = (serie, desde) => {
      let suma = 0;
      for (let i = desde; i < desde + ventana; i++) suma += serie[i];
      return suma / ventana;
    };
    for (let i = ventana; i + ventana < a.length; i += ventana) {
      if (media(a, i) > media(b, i)) {
        // comprobamos que se mantiene hasta el final
        const resto = Math.floor((a.length - ventana) / ventana) * ventana;
        if (media(a, resto) > media(b, resto)) return i;
      }
    }
    return null;
  }

  dibujarVacio("Pulsa «Ejecutar» para lanzar la simulación.");
  repintadores.push(dibujar);

  crearQuiz($("#m3-quiz"), [
    {
      enunciado: "Con el entorno no estacionario, el promedio muestral \\(1/n\\) empeora con el tiempo. ¿Por qué?",
      opciones: [
        "Porque \\(1/n \\to 0\\): cada nueva recompensa pesa cada vez menos, así que la estimación se congela y deja de seguir a un \\(q_*\\) que sigue moviéndose.",
        "Porque acumula error numérico al dividir por \\(n\\).",
        "Porque explora demasiado poco.",
        "Porque \\(Q_t\\) se vuelve negativo.",
      ],
      correcta: 0,
      explicacion: "El promedio muestral cumple \\(\\sum\\alpha_n=\\infty\\) y \\(\\sum\\alpha_n^2&lt;\\infty\\): las condiciones que garantizan convergencia. Pero <em>converger</em> es justo lo que no interesa si el objetivo se mueve. Con α constante la segunda condición falla, el agente nunca deja de aprender, y eso pasa de defecto a virtud.",
    },
    {
      enunciado: "ε = 0.1 sube más rápido pero se estanca en torno al 80 % de acción óptima. ¿Por qué no llega al 100 %?",
      opciones: [
        "Porque el 10 % de los pasos elige al azar entre los 10 brazos, así que como mucho puede acertar el 91 % de las veces.",
        "Porque \\(Q_t\\) nunca converge a \\(q_*\\).",
        "Porque el promedio muestral tiene sesgo.",
        "Porque hay brazos que nunca llega a probar.",
      ],
      correcta: 0,
      explicacion: "Techo \\(= (1-\\varepsilon) + \\varepsilon/k = 0.9 + 0.01 = 0.91\\). Es el precio fijo de explorar con ε constante: para acercarse al 100 % habría que reducir ε con el tiempo.",
    },
    {
      enunciado: "La inicialización optimista empieza <em>peor</em> que ε-greedy y luego la adelanta. ¿Qué está pasando al principio?",
      opciones: [
        "Que \\(Q_0 = 5\\) está muy por encima de cualquier recompensa real, así que el agente se «decepciona» con cada brazo y va probándolos todos: explora de forma sistemática aunque sea greedy.",
        "Que la inicialización introduce un sesgo que hay que corregir con muestreo de importancia.",
        "Que el paso constante α = 0.1 es demasiado grande al principio.",
        "Que UCB le está robando exploración.",
      ],
      correcta: 0,
      explicacion: "Es exploración <em>por decepción</em>, y solo funciona al principio: cuando las estimaciones bajan al nivel real, el impulso se agota. Por eso es un truco de arranque y no una solución para entornos que cambian — pruébalo con la deriva activada y compáralo.",
    },
  ]);
}

/* ======================================================================= *
 * MÓDULO 4 — estudio de parámetros
 * ======================================================================= */

function moduloBarrido() {
  const boton = $("#m4-ejecutar");
  const progreso = $("#m4-progreso");
  let ultimo = null;
  let pasosDeUltimo = 0;   // el horizonte con el que se calculó `ultimo`

  $("#m4-runs").addEventListener("input", (ev) => {
    $("#m4-runs-v").textContent = ev.target.value;
  });
  $("#m4-pasos").addEventListener("input", (ev) => {
    $("#m4-pasos-v").textContent = ev.target.value;
  });

  boton.addEventListener("click", async () => {
    boton.disabled = true;
    boton.textContent = "Calculando…";
    progreso.hidden = false;
    progreso.firstElementChild.style.width = "0%";
    dibujarVacio("Calculando…");

    try {
      const pasos = Number($("#m4-pasos").value);
      const curvas = await calcular("barrido", {
        pasos,
        ejecuciones: Number($("#m4-runs").value),
        semilla: 1,
        deriva: $("#m4-deriva").checked ? 0.01 : 0,
      }, (fraccion) => {
        progreso.firstElementChild.style.width = `${Math.round(fraccion * 100)}%`;
      });
      ultimo = curvas;
      pasosDeUltimo = pasos;
      dibujar();
    } catch (error) {
      dibujarVacio("No se pudo completar el cálculo.");
      $("#m4-lectura").textContent = `No se pudo completar el cálculo: ${error.message}`;
    } finally {
      boton.disabled = false;
      boton.textContent = "Calcular";
      progreso.hidden = true;
    }
  });

  function dibujarVacio(mensaje) {
    pintar($("#m4-grafica"), graficaLineas([], { ancho: 900, alto: 340, mensaje }));
  }

  function dibujar() {
    if (!ultimo) return;
    const series = ultimo.map((curva, i) => ({
      nombre: `${curva.nombre}  (${curva.parametro})`,
      color: tono(COLORES_SERIE[i % COLORES_SERIE.length]),
      x: curva.valores,
      y: curva.medias,
      puntos: true,
    }));

    const todos = ultimo.flatMap((c) => c.valores);
    const marcas = [...new Set(todos)].sort((a, b) => a - b).map((v) => ({
      valor: v, etiqueta: v < 1 ? `1/${Math.round(1 / v)}` : String(v),
    }));

    pintar($("#m4-grafica"), graficaLineas(series, {
      ancho: 900, alto: 340, escalaX: "log2", ticksX: marcas,
      ejeX: "ε   ·   α   ·   c   ·   Q₀",
      ejeY: `Recompensa media (${pasosDeUltimo} pasos)`,
    }));
    $("#m4-leyenda").replaceChildren(leyenda(series));

    const resumen = ultimo.map((curva) => {
      const mejor = curva.medias.indexOf(Math.max(...curva.medias));
      const v = curva.valores[mejor];
      return `<strong>${curva.nombre}</strong>: mejor con ${curva.parametro} =
        ${v < 1 ? `1/${Math.round(1 / v)}` : v} (${num(curva.medias[mejor], 3)})`;
    }).join(" · ");

    $("#m4-lectura").innerHTML = `${resumen}.
      Fíjate en que <em>todas</em> las curvas tienen forma de campana: pasarse de
      exploración cuesta tanto como quedarse corto. Y en que el eje horizontal mezcla
      parámetros que significan cosas distintas — la comparación válida es la altura del
      máximo de cada curva, no su posición.`;
  }

  dibujarVacio("Pulsa «Calcular»: son unos segundos de simulación.");
  repintadores.push(dibujar);

  crearQuiz($("#m4-quiz"), [
    {
      enunciado: "¿Qué significa que la curva de UCB esté por encima de la de ε-greedy en su punto óptimo?",
      opciones: [
        "Que en este problema y con este horizonte UCB rinde mejor <em>si se afina bien su parámetro</em>; no que sea mejor en general.",
        "Que UCB converge más rápido en cualquier problema de RL.",
        "Que ε-greedy no converge.",
        "Que UCB no necesita ajustar parámetros.",
      ],
      correcta: 0,
      explicacion: "La figura compara los <em>máximos alcanzables</em> en un banco de pruebas concreto, estacionario y con un horizonte fijo. La propia diapositiva avisa de que UCB es «difícil de extender a problemas de RL generales con espacios más complejos y aproximaciones».",
    },
    {
      enunciado: "El eje horizontal vale a la vez para ε, α, c y \\(Q_0\\). ¿Qué hay que tener en cuenta al leerlo?",
      opciones: [
        "Que la posición horizontal de cada curva no es comparable entre estrategias: solo tiene sentido comparar la altura de los máximos.",
        "Que todos los parámetros se pueden intercambiar entre estrategias.",
        "Que un ε de 1/4 equivale a un c de 1/4.",
        "Que la escala es lineal.",
        ],
      correcta: 0,
      explicacion: "Es un gráfico de barrido, no un espacio de parámetros común: cada curva recorre su propio parámetro en escala logarítmica. Compartir el eje es una comodidad visual del libro, y una fuente clásica de malinterpretación.",
    },
  ]);
}

/* ======================================================================= *
 * MÓDULO 5 — de bandits a MDP
 * ======================================================================= */

function moduloPuente() {
  const zona = $("#m5-diagrama");
  const entradaEstados = $("#m5-estados");
  const entradaTransicion = $("#m5-transicion");

  const REGIMENES = {
    bandit: {
      nombre: "k-armed bandit",
      descripcion: `El entorno no tiene estados: cada decisión es independiente de las
        anteriores, siempre estás en la misma situación. El agente solo tiene que estimar
        \\(q_*(a)\\), un número por acción. Es «RL sin estados», y es todo el Tema 1.`,
    },
    contextual: {
      nombre: "Bandit contextual (asociativo)",
      descripcion: `Ahora el entorno presenta situaciones distintas y el agente debe
        aprender \\(q_*(s,a)\\): qué acción es buena <em>en cada contexto</em>. Pero sus
        acciones <strong>no cambian</strong> qué contexto vendrá después, así que sigue sin
        haber consecuencias a largo plazo: basta con ser codicioso en cada situación.`,
    },
    mdp: {
      nombre: "Entorno general de RL — un MDP",
      descripcion: `Las acciones influyen en los estados futuros, así que una recompensa
        alta ahora puede costar recompensas mayores después (<em>delayed reward</em>). Ya no
        basta con maximizar \\(R_{t+1}\\): hay que maximizar el <strong>retorno</strong>
        \\(G_t\\). Aquí empieza el Tema 2.`,
    },
  };

  function regimenActual() {
    if (!entradaEstados.checked) return "bandit";
    return entradaTransicion.checked ? "mdp" : "contextual";
  }

  function dibujar() {
    const regimen = regimenActual();
    const hayEstados = regimen !== "bandit";
    const hayTransicion = regimen === "mdp";

    const svg = el("svg", {
      viewBox: "0 0 520 300", width: 520, height: 300, role: "img",
      style: "max-width:100%;height:auto",
    });
    const linea = tono("--borde-fuerte");
    const texto = tono("--texto");
    const suave = tono("--texto-suave");

    const caja = (x, y, w, h, etiqueta, opciones = {}) => {
      svg.appendChild(el("rect", {
        x, y, width: w, height: h, rx: 5,
        fill: opciones.fondo || tono("--superficie"),
        stroke: opciones.borde || linea,
        "stroke-width": opciones.grosor || 1.6,
        "stroke-dasharray": opciones.discontinua ? "6 4" : null,
        opacity: opciones.atenuada ? 0.35 : 1,
      }));
      svg.appendChild(el("text", {
        x: x + w / 2, y: y + h / 2 + 4, "text-anchor": "middle",
        "font-size": opciones.tamano || 11.5, "font-weight": 650,
        fill: opciones.atenuada ? suave : (opciones.color || texto),
        opacity: opciones.atenuada ? 0.6 : 1,
      }, etiqueta));
    };

    const flecha = (x1, y1, x2, y2, etiqueta, opciones = {}) => {
      svg.appendChild(el("path", {
        d: opciones.d || `M${x1} ${y1} L${x2} ${y2}`,
        fill: "none", stroke: opciones.color || linea, "stroke-width": 1.6,
        "marker-end": "url(#flecha1)",
        "stroke-dasharray": opciones.discontinua ? "5 4" : null,
        opacity: opciones.atenuada ? 0.3 : 1,
      }));
      if (etiqueta) {
        svg.appendChild(el("text", {
          x: opciones.ex ?? (x1 + x2) / 2, y: opciones.ey ?? (y1 + y2) / 2 - 6,
          "text-anchor": "middle", "font-size": 11, "font-family": "monospace",
          fill: opciones.atenuada ? suave : (opciones.color || texto),
          opacity: opciones.atenuada ? 0.4 : 1,
        }, etiqueta));
      }
    };

    svg.appendChild(el("defs", {}, el("marker", {
      id: "flecha1", viewBox: "0 0 10 10", refX: 9, refY: 5,
      markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse",
    }, el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: linea }))));

    /* entorno */
    caja(250, 55, 230, 150, "", { fondo: tono("--superficie-2") });
    svg.appendChild(el("text", {
      x: 365, y: 196, "text-anchor": "middle", "font-size": 11,
      "font-weight": 700, fill: suave, "letter-spacing": "1",
    }, "ENTORNO"));

    caja(275, 72, 180, 46, "PROCESO DE TRANSICIÓN", {
      atenuada: !hayTransicion,
      discontinua: !hayTransicion,
      borde: hayTransicion ? tono("--acento") : linea,
      grosor: hayTransicion ? 2 : 1.4,
    });
    caja(275, 130, 180, 46, "PROCESO DE RECOMPENSA", { borde: tono("--azul") });

    /* agente */
    caja(40, 105, 130, 60, "AGENTE", { tamano: 13, borde: tono("--acento"), grosor: 2 });

    /* acción */
    flecha(170, 135, 273, 135, "a_t", { ey: 128, color: tono("--acento") });

    /* recompensa: entorno → agente, por abajo */
    flecha(0, 0, 0, 0, "r_{t+1}", {
      d: "M275 165 L275 262 L105 262 L105 167",
      ex: 190, ey: 276, color: tono("--azul"),
    });

    /* estado: entorno → agente, por arriba */
    flecha(0, 0, 0, 0, "s_{t+1}", {
      d: "M455 95 L455 25 L70 25 L70 103",
      ex: 262, ey: 18,
      atenuada: !hayEstados,
      discontinua: !hayEstados,
      color: hayEstados ? tono("--ok") : linea,
    });

    if (!hayTransicion && hayEstados) {
      svg.appendChild(el("text", {
        x: 365, y: 62, "text-anchor": "middle", "font-size": 10,
        fill: suave, "font-style": "italic",
      }, "el contexto llega, pero no depende de a_t"));
    }

    pintar(zona, svg);

    const info = REGIMENES[regimen];
    $("#m5-nombre").textContent = info.nombre;
    $("#m5-descripcion").innerHTML = info.descripcion;

    const filas = [
      ["¿Hay estados?", "no", "sí", "sí"],
      ["¿La acción afecta al futuro?", "no", "no", "sí"],
      ["Qué se estima", "q<sub>*</sub>(a)", "q<sub>*</sub>(s,a)", "v<sub>π</sub>(s) o q<sub>π</sub>(s,a)"],
      ["Qué se maximiza", "R<sub>t+1</sub>", "R<sub>t+1</sub> en cada contexto", "el retorno G<sub>t</sub>"],
      ["Dónde se ve", "Tema 1", "Tema 1, final", "Tema 2 en adelante"],
    ];
    const columna = { bandit: 1, contextual: 2, mdp: 3 };
    $("#m5-tabla").innerHTML = `
      <thead><tr><th></th><th>bandit</th><th>contextual</th><th>MDP</th></tr></thead>
      <tbody>${filas.map(([cabecera, ...celdas]) => `
        <tr>
          <td>${cabecera}</td>
          ${celdas.map((c, i) => `<td${i + 1 === columna[regimen] ? ' class="mono"' : ' class="mono suave"'}
            ${i + 1 === columna[regimen] ? 'style="font-weight:700;color:var(--acento)"' : ""}>${c}</td>`).join("")}
        </tr>`).join("")}</tbody>`;

    renderizarMatematicas($("#m5-descripcion"));
  }

  entradaEstados.addEventListener("change", () => {
    if (!entradaEstados.checked) entradaTransicion.checked = false;
    dibujar();
  });
  entradaTransicion.addEventListener("change", () => {
    if (entradaTransicion.checked) entradaEstados.checked = true;
    dibujar();
  });

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m5-quiz"), [
    {
      enunciado: "¿Qué distingue a un bandit contextual de un MDP?",
      opciones: [
        "En el bandit contextual las acciones no influyen en qué estado vendrá después, así que no hay recompensa retardada y basta con actuar de forma codiciosa en cada contexto.",
        "El bandit contextual no tiene recompensas.",
        "El MDP no tiene estados.",
        "En el bandit contextual no se puede explorar.",
      ],
      correcta: 0,
      explicacion: "Los dos tienen estados. Lo que aparece en el MDP es el <em>proceso de transición</em>: como la acción cambia el futuro, hay que razonar sobre el retorno y no solo sobre la recompensa inmediata. Eso es lo que obliga a introducir \\(v_\\pi\\), \\(\\gamma\\) y las ecuaciones de Bellman.",
    },
    {
      enunciado: "En un bandit, ¿por qué no hace falta un factor de descuento \\(\\gamma\\)?",
      opciones: [
        "Porque no hay futuro que descontar: la acción de ahora no condiciona las situaciones siguientes, así que el problema se reduce a maximizar la recompensa de cada paso por separado.",
        "Porque las recompensas son siempre positivas.",
        "Porque \\(\\gamma\\) solo se usa en tareas episódicas.",
        "Porque los bandits siempre tienen horizonte infinito.",
      ],
      correcta: 0,
      explicacion: "\\(\\gamma\\) pondera consecuencias futuras. Si mis acciones no tienen consecuencias sobre el estado, no hay nada que ponderar: el problema secuencial se descompone en decisiones independientes.",
    },
  ]);
}

/* ======================================================================= *
 * Arranque
 * ======================================================================= */

moduloBandit();
moduloTestbed();
moduloComparador();
moduloBarrido();
moduloPuente();
renderizarMatematicas();

/* Ejecuta el comparador con los valores por defecto para que la página no se
   vea vacía al llegar al módulo 3. */
$("#m3-ejecutar").click();
