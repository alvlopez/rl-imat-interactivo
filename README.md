# Recursos interactivos — Aprendizaje por Refuerzo (RL · IMAT)

Sitio estático con los recursos interactivos de la asignatura **Aprendizaje por Refuerzo**
(DEAC-IMAT-411), Grado en Ingeniería Matemática e Inteligencia Artificial, ICAI ·
Universidad Pontificia Comillas.

- `index.html` — portada
- `tema1.html` — Introducción y *k*-armed bandits (Sutton, cap. 1-2)
- `tema2.html` — Procesos de Decisión de Markov (Sutton, cap. 3)

---

## Principio de diseño

Cada módulo nace de una **pregunta que las diapositivas plantean y no pueden responder**
porque una imagen fija no llega: el cruce entre ε = 0.1 y ε = 0.01 ocurre más allá de los
1000 pasos que muestra la figura, el diagrama de backup de los estados 3 y 4 queda como
ejercicio, la política óptima puede no ser única… Si un módulo no responde a nada que la
diapositiva deje abierto, sobra.

| Diapositiva | Pregunta | Dónde se responde |
|---|---|---|
| `Tema1#slide-21` | ¿Se cumple \(\sum \alpha_n^2 < \infty\) para α constante? | T1 · módulo 3 |
| `Tema1#slide-24` | ¿Quién gana a la larga, ε = 0.1 o ε = 0.01? | T1 · módulo 3 |
| `Tema1#slide-25`, `#slide-26` | ¿Sensibilidad a cambios en el entorno? | T1 · módulo 3 |
| `Tema2#slide-8` | Las cuatro probabilidades \(p(s',r\mid s,a)\) | T2 · módulo 1 |
| `Tema2#slide-15` | ¿Cuántas ecuaciones salen de la cuadrícula? | T2 · módulo 3 |
| `Tema2#slide-18` | Diagrama de backup de los estados 3 y 4 | T2 · módulo 4 |
| `Tema2#slide-19` | ¿Puede haber varias políticas óptimas? | T2 · módulo 5 |
| `3_Tema3#slide-9`, `#slide-10` | «Algunas consideraciones» que no contienen ninguna | T3 · módulo 1 |
| `Tema3_DP#slide-6` | ¿Qué podemos afirmar sobre las políticas negra, roja, verde y azul? *(Wooclap sin responder)* | T3 · módulo 2 |
| `3_Tema3#slide-8`, `Tema3_DP#slide-11` | ¿Puede el `else go to 2` no terminar nunca? | T3 · módulo 3 |
| `3_Tema3#slide-10`, `Tema3_DP#slide-12` | La figura dibuja que en \(k=3\) la política ya es óptima, y nadie lo dice | T3 · módulo 4 |
| `3_Tema3#slide-11`, `Tema3_DP#slide-13` | ¿Hace falta esperar a que converja la evaluación? | T3 · módulo 5 |
| `Tema3_DP#slide-16` | La glosa que falta sobre la recta \(v=v_\pi\) | T3 · módulo 6 |
| `4_Tema4#slide-4` | «Con \(q_*\) sacas la política; con \(v_*\) solo si tienes el modelo», enunciado y nunca demostrado | T4 · módulo 1 |
| `4_Tema4#slide-21` | La comparación MC/TD, punto por punto y **sin ninguna evidencia** | T4 · módulo 2 |
| `4_Tema4#slide-36` | La figura del acantilado, proyectada **sin un solo hiperparámetro** | T4 · módulo 3 |
| `Tema4_2_ModelFree#slide-18` | «Si ε se redujera, ambos convergen a \(\pi_*\)», sin comprobar | T4 · módulo 3 |
| `Tema4_2_ModelFree#slide-23` | «Expected SARSA mejora consistentemente a SARSA», sin evidencia | T4 · módulo 3 |
| `4_Tema4#slide-37`, `#slide-38` | «¡El aprendizaje doble funciona!», sin el porqué | T4 · módulo 4 |
| `4_Tema4_2#slide-5` | «¿Hay un valor óptimo de \(n\)?» — **el título no se responde** | T4 (cont.) · módulo 1 |
| `4_Tema4_2#slide-4` | «Supón \(n=10\): ¿qué pasa al principio de un episodio?» | T4 (cont.) · módulo 1 |
| `4_Tema4_2#slide-17` | «Con λ podemos acelerar el aprendizaje» — sin ninguna curva que lo respalde | T4 (cont.) · módulo 1 |
| `4_Tema4_2#slide-14` | ¿La culpa se la lleva el timbre o la luz? **La diapositiva lo deja ahí** | T4 (cont.) · módulo 2 |
| `5_Tema_5_1#slide-8` | \(J(w) = \mathbb E_\pi[\cdot]\) **sin decir bajo qué distribución**, que es lo que decide qué estados se sacrifican | T5 · módulo 1 |
| `5_Tema_5_1#slide-9`, `#slide-11` | «¿Qué alternativas tenemos para construir esa señal?» y «¿hay algún tipo de aproximación?» — las dos **sin responder en pantalla** | T5 · módulo 2 |
| `5_Tema_5_1#slide-23`, `#slide-24` | Las dos figuras de *tile coding*, con **cero caracteres de explicación** | T5 · módulo 2 |
| `5_Tema_5_1#slide-13`, `#slide-14` | «Converge al óptimo global» y «a un punto cercano» — sin demostración y sin cuantificar «cercano» | T5 · módulo 3 |
| `5_Tema_5_1#slide-15` | La figura de Baird divergiendo, con **67 caracteres de texto**: ni qué MDP es, ni que es fuera de política, ni por qué | T5 · módulo 4 |
| `5_Tema_5_1#slide-19`, `#slide-20` | La caja del libro **sin un hiperparámetro y sin entorno**, y la diapositiva-ejercicio en blanco | T5 · módulo 5 |
| `5_Tema_5_1#slide-16`, `#slide-21` | Veintiuna casillas de convergencia **como hechos**, con los tres inductores al lado y sin conectarlos | T5 · módulo 6 |
| `5_Tema_5_2#slide-6` | «Masas de probabilidad arbitrarias ➜ política estocástica sin estructuras impuestas» — cuatro ventajas de corrido **y ni un caso** | T5 (cont.) · módulo 1 |
| `5_Tema_5_2#slide-8`, `#slide-9` | Dos **recuadros de color** que nunca se explican, un \(\mu(s)\) que no se define, y un \(\propto\) que pasa a \(=\) sin comentario | T5 (cont.) · módulo 2 |
| `5_Tema_5_2#slide-11` | La Figura 13.1 proyectada con **cero caracteres de texto**: ni de qué entorno es, ni qué es \(v_*(s_0)\) | T5 (cont.) · módulo 3 |
| `5_Tema_5_2#slide-12` | «¿Bajo qué condiciones? ¿Por qué?» y «¿cuál es el papel de la línea base?» — respondidas **solo en las notas del ponente** | T5 (cont.) · módulo 4 |
| `5_Tema_5_2#slide-14`, `#slide-17` | «Varianza reducida, **rendimiento claramente mejor**» — y no hay ni una curva de actor-crítico en las barajas ni en el libro | T5 (cont.) · módulo 5 |
| `5_Tema_5_2#slide-18`, `#slide-19` | «Un mal movimiento **destroza** la aproximación» y «la KL lo frena»: lo más examinado del tema, sin un dato detrás | T5 (cont.) · módulo 6 |
| `Tema6_PolicyGradient#slide-6` | **«¿dónde hemos visto esto antes?»** — preguntado al aula y nunca respondido. Es el bandido de gradiente del T1, que el sitio ya ejecutaba **sin nombrarlo** | T5 (cont.) · bloque B3 ↔ T1 · módulo 3 |

---

## Estructura

```
web/
├── index.html · tema1.html · tema2.html
├── assets/
│   ├── estilo.css          tokens de color, tema claro/oscuro, modo clase
│   ├── nucleo.js           RNG con semilla, gráficas SVG, quiz, chrome de página
│   ├── mdp.js              motor de MDP finitos (Tema 2)
│   ├── bandits.js          motor de k-armed bandits (Tema 1)
│   ├── calculo-worker.js   Web Worker para las simulaciones largas
│   ├── i18n.js             capa de idioma: t(), botón EN/ES, ?idioma=
│   ├── en.js               diccionario inglés (el español NO está aquí)
│   ├── tema1.js            los cinco módulos del Tema 1
│   └── tema2.js            los cinco módulos del Tema 2
├── tests/                  node --test, sin dependencias
├── package.json            solo para los tests (GitHub Pages lo ignora)
└── .nojekyll               que Pages sirva los ficheros tal cual
```

**Sin framework y sin paso de compilación.** Es HTML, CSS y JavaScript con módulos ES:
se puede abrir un `.html`, entenderlo y editarlo. La única dependencia externa es
**KaTeX desde CDN**, y solo para tipografiar las fórmulas; si algún día hace falta una
versión sin red (para Moodle, por ejemplo), basta con copiar KaTeX al repositorio.

---

## Trabajar en local

```bash
npm test              # node --test "tests/*.test.js"  — 43 tests, sin dependencias
npm run servir        # sirve en http://localhost:8080
```

`npm run servir` usa `python -m http.server`. Cualquier servidor estático vale; **hace
falta uno**, porque los módulos ES no se cargan desde `file://`.

### Los tests

No comprueban «que el código no falle», sino **que el código reproduce el material de
clase**. Los importantes son los de contraste:

- El diagrama de backup del estado 1 de la rejilla 4×4 sale `N→1, S→5, O→1, E→2` con
  `r = −1`: exactamente el de `2_Tema2_wclp#slide-16`.
- Las cuatro probabilidades de `Tema2_MDP#slide-8` (material de Lucía) dan 1, 0, 0 y 1.
- `v_*` de la rejilla 3×3 coincide con la distancia Manhattan al terminal.
- ε = 0.1 alcanza ≈ 1.4 de recompensa media a los 1000 pasos, como la figura del libro.
- El estudio de parámetros sitúa los óptimos donde los sitúa la figura 2.6.
- **La opción correcta de un cuestionario sigue siendo la correcta después de barajar**
  (`tests/quiz.test.js`). Es el test que impide que el barajado convierta un acierto en
  un fallo.

### Material de referencia

La colección de referencia es **`Teoria/Diapos/MaterialAlvaro/`**, que es la que se usa
en clase: el T1 se cita como `1_Tema1#page-N` (solo hay PDF) y el T2 como
`2_Tema2_wclp#slide-N`. Cuando un contenido solo existe en el material de Lucía, la cita
lo dice explícitamente. La correspondencia entre las dos colecciones está en
`Teoria/referencia/mapa-diapositivas.md`.

Tres cosas están **solo** en el material de Lucía y se citan como tales: el estudio de
parámetros del módulo T1-M4 (figura 2.6, `Tema1_Intro#slide-29`), las cuatro
probabilidades literales de `Tema2_MDP#slide-8`, y la extensión del ejercicio de backup
al estado 4 (`Tema2_MDP#slide-18`; Álvaro pide solo el 3).

### Idioma: español por defecto, inglés como capa

El sitio está en **español**, y el inglés es una **capa de traducción encima**. El botón
`EN` / `ES` de la cabecera cambia de idioma; se recuerda en el navegador y se puede
compartir un enlace directo con `?idioma=en`.

**El español no vive en ningún diccionario**: vive donde siempre, en el HTML y en las
cadenas del JS. `assets/en.js` solo contiene el inglés. Esto tiene dos consecuencias que
son la razón del diseño:

- no hay dos copias del español que puedan desincronizarse;
- **si falta una clave inglesa, sale el español**, no un hueco ni un error.

Cómo se marca el texto traducible:

| Dónde | Cómo |
|---|---|
| HTML | `data-t="clave"` en el elemento; el valor del diccionario es HTML |
| Atributos | `data-t-title` y `data-t-etiqueta` (para `title` y `aria-label`) |
| JS | `t("clave", "texto en español")`, con `{parametros}` opcionales |
| Cuestionarios | `crearQuiz(zona, preguntas, { claves: "t1.m3.quiz" })` — busca `<prefijo>.<i>.enunciado`, `.opciones` y `.explicacion`. **El banco en español no se toca** |

Tres cuidados que no son evidentes y que ya han costado un fallo:

1. **Nunca marques un `<input>`**: es un elemento vacío y `innerHTML` no hace nada. Ni un
   contenedor que envuelva un `id` que el JS necesite, porque lo destruirías. En esos
   casos se envuelve solo el texto en un `<span data-t>`.
2. **Los identificadores del motor no se traducen.** `ACCIONES_3X3` y `ACCIONES_NAV` son
   índices y claves, y los tests dependen de ellos: se traduce cómo se *muestran*, con
   `nombreAccion()` y `nombreDir()`. En inglés la brújula es **N/S/W/E**, no N/S/O/E.
3. **El formato numérico también es idioma**: `1,50` frente a `1.50`, `79 %` frente a
   `79%`. Lo resuelven `num()` y `pct()` en `nucleo.js`; no lo repitas a mano.

**Las citas cambian de sistema.** En español se cita la diapositiva
(`1_Tema1#page-24`); en inglés, la **sección y la figura de Sutton & Barto**, porque quien
lee esa versión no tiene el material de clase y porque secciones y figuras son estables
entre ediciones, y los números de página no.

Cambiar de idioma **recarga la página**. Es deliberado: la mitad del texto lo generan los
módulos al vuelo, y repintarlos de forma reactiva sería una fuente permanente de bloques
a medio traducir. El precio es perder el estado de las simulaciones.

`tests/i18n.test.js` cubre lo que de verdad puede fallar aquí: que **toda** clave usada
en HTML, en JS y en los cuestionarios tenga inglés; que no sobren claves; que las listas
de opciones conserven su longitud (si no, `correcta` apuntaría a otra opción); y que
ninguna traducción se haya quedado en español. Para añadir un idioma basta otro fichero
como `en.js` y una entrada en `IDIOMAS`.

### Subíndices fuera de LaTeX

Dentro de `\(...\)` los subíndices los pone KaTeX. Fuera —rótulos de gráfica, botones,
cabeceras de tabla, lecturas generadas por JS— **hay que escribirlos con `<sub>`**:
`v<sub>π</sub>`, `v<sub>k</sub>`, `v<sub>π′</sub>`, `v<sub>*</sub>`. Un `v_π` escrito en
crudo se lee en pantalla con el guion bajo y rompe la coincidencia carácter a carácter
con la diapositiva, que es la regla del curso.

En los SVG no existe `<sub>`, así que `textoSvg()` (en `nucleo.js`) acepta esa **misma
marca** y la compone con `<tspan>` desplazado. Ventaja: un rótulo se escribe igual y se
traduce con una sola clave, vaya al DOM o al lienzo. La prima va **dentro** del
subíndice —`v<sub>π′</sub>`, no `v<sub>π</sub>′`— porque la prosa del sitio escribe
`v_{\pi'}`.

Dos tests de `tests/i18n.test.js` vigilan que no se cuele ningún subíndice en crudo, en
español y en inglés. La excepción son las **cajas de pseudocódigo** (`<pre class="codigo">`,
claves `t3.b6.caja`, `t3.m3.caja`, `t3.m5.caja`): son transcripción literal en
monoespaciado, donde `Σ_{s',r}`, `argmax_a` y `π_*` comparten una convención de texto
plano y marcar solo una parte la rompería.

### Lienzos que crecen en modo clase

Un SVG dibujado a 600×300 no crece con `?modo=clase`: el resto de la página sube a
`--base: 20px` y los rótulos del lienzo se quedan en 13 px dentro de una caja de 1500 px,
con medio diagrama de aire a la derecha. `lienzo()` acepta por eso `{ escalable: true }`
—`diagramaDosRectas` lo expone como opción `escalable`, y hoy solo lo usa el módulo 6 del
T3, que es el que se proyecta—: el SVG pasa a `width:100%` con
`max-width: var(--lienzo-max, <ancho natural>px)`, así que **mientras nadie defina esa
variable se ve exactamente igual que antes** (modo normal y móvil, intactos). En modo
clase `estilo.css` la sube a `min(100%, 1200px)`.

Lo bueno de escalar por `viewBox` es que crece **todo** el contenido del lienzo sin tocar
un solo `font-size`: rótulos, glosas y también el `dy` y el `font-size` de los subíndices
de `textoSvg()`, que son proporcionales al cuerpo de letra. La leyenda, en cambio, es HTML
y queda fuera del `viewBox`: la sube aparte la regla `.lienzo-escalable + .leyenda`. El
tope de 1200 px existe porque el lienzo conserva la proporción —todo el ancho que gana lo
gana también en alto— y a pantalla completa se comería la mitad del proyector.

### El orden de las opciones de los cuestionarios

Las 27 preguntas se redactan con la correcta en primera posición, y `crearQuiz` las
baraja **en cada carga de página** (`barajarOpciones`, en `nucleo.js`). Es una excepción
deliberada a la reproducibilidad por semilla del resto del sitio: si el orden fuera
estable, «elige siempre la a)» sería una estrategia ganadora. Corolario: **ninguna
explicación puede referirse a una opción por letra ni por posición**, y hay un test que
lo vigila.

Si se toca un motor y uno de estos falla, lo que está mal es el código, no el test.

---

## Decisiones que conviene conocer

**El sentido del viento en la rejilla de navegación.** El enunciado dice «Viento Este» y
«Viento Sur» sin aclarar si el viento va hacia ese punto cardinal o viene de él, y eso
cambia todos los números. Lo resuelve la trayectoria T1 del problema 3 de
`Teoria/Problemas/Problemas.pdf`:

```
T1: (5,up), (1,right), (2,right), (3,right), (3,down), ...
                                   └── desde 3 va al este y NO se mueve
```

La celda 4 existe, así que no puede ser un rebote: la única regla que lo explica es «en
dirección opuesta al viento → 0.25 de probabilidad de no movernos». Por tanto el viento
Este **procede** del este y sopla hacia el oeste (convención meteorológica), y el viento
Sur sopla hacia el norte. Está implementado así, dicho en la propia página, y hay un
interruptor para ver el criterio contrario.

**El remolino.** «R = −5 si entramos en el remolino (S = 8)». Se ha implementado como
`r = −5` siempre que el estado siguiente sea el 8, incluido el caso de rebotar dentro de
él. Es una decisión discutible que conviene precisar en el enunciado.

**Número de ejecuciones.** Las figuras del libro promedian 2000 problemas; aquí el valor
por defecto es 200 para que la respuesta sea inmediata en clase. Es ajustable, y con 2000
las curvas quedan igual de suaves que en el libro.

---

## Publicación

Publicado en **GitHub Pages** desde la rama `main`, raíz del repositorio:

- Sitio: <https://alvlopez.github.io/rl-imat-interactivo/>
- Repositorio: <https://github.com/alvlopez/rl-imat-interactivo>

El fichero `.nojekyll` evita que Pages ignore nada. No hay nada que compilar: lo que hay
en el repositorio es lo que se sirve, así que basta con `git push` para actualizar.

Los parámetros de URL `?modo=clase` y `?tema=oscuro` (o `claro`) sirven para dejar un
enlace ya preparado para el proyector.

> **Aviso: este repositorio vive dentro de OneDrive.** Es cómodo, porque el código queda
> junto al resto del material de la asignatura, pero OneDrive sincroniza también el
> directorio `.git`. Con un solo equipo el riesgo es bajo; si algún día trabajas desde
> dos máquinas a la vez, conviene moverlo fuera de OneDrive para que la sincronización no
> corrompa el historial.

---

## Créditos

Basado en R. S. Sutton y A. G. Barto, *Reinforcement Learning: An Introduction*, 2.ª ed.,
MIT Press, 2018, y en el material de teoría de la asignatura.
