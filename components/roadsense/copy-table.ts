// Every string the /roadsense page shows. Each leaf has all four languages; the
// Spanish is the reference. French uses «vous», Arabic is Modern Standard Arabic
// with Western digits, and both keep key Spanish exam terms in brackets.
// app/roadsense/copy.ts picks one language with DriveIQ's l10n; the components
// only use the RoadsenseCopy type, so they stay free of DriveIQ imports.

export type Variants = { es: string; en: string; fr: string; ar: string };
export const COPY = {
  meta: {
    title: {
      es: "RoadSense: quién tiene preferencia en una foto | DriveIQ",
      en: "RoadSense: who has right of way in a photo | DriveIQ",
      fr: "RoadSense : qui a la priorité sur une photo | DriveIQ",
      ar: "RoadSense: من له الأولوية في الصورة | DriveIQ",
    },
    description: {
      es: "Elige una escena o sube la foto de un cruce: RoadSense te dice quién pasa primero, cita el artículo del BOE y solo marca como comprobado lo que el motor de reglas y la IA confirman.",
      en: "Pick a scene or upload a photo of a junction: RoadSense tells you who goes first, cites the BOE article, and only marks as checked what its rule engine and the AI agree on.",
      fr: "Choisissez une scène ou envoyez la photo d'une intersection : RoadSense vous dit qui passe en premier, cite l'article du BOE et ne marque comme contrôlé que ce que le moteur de règles et l'IA confirment.",
      ar: "اختر مشهدًا أو ارفع صورة تقاطع: يخبرك RoadSense بمن يمرّ أولًا، ويستشهد بالمادة من الجريدة الرسمية (BOE)، ولا يعلّم كمُدقَّق إلا ما يتفق عليه محرّك القواعد والذكاء الاصطناعي.",
    },
  },
  page: {
    // The product name, the same in every language.
    name: { es: "RoadSense", en: "RoadSense", fr: "RoadSense", ar: "RoadSense" },
    title: {
      es: "¿Quién pasa primero?",
      en: "Who goes first?",
      fr: "Qui passe en premier ?",
      ar: "من يمرّ أولًا؟",
    },
    lead: {
      es: "Elige una escena o sube una foto de un cruce. RoadSense te dice qué debes hacer, con el artículo exacto del Reglamento General de Circulación, y solo marca la respuesta como comprobada cuando el motor de reglas y la IA coinciden.",
      en: "Pick a scene or upload a photo of a junction. RoadSense tells you what to do, with the exact article of Spain's traffic rules (Reglamento General de Circulación), and only marks the answer as checked when its rule engine and the AI agree.",
      fr: "Choisissez une scène ou envoyez la photo d'une intersection. RoadSense vous dit quoi faire, avec l'article exact du code de la route espagnol (Reglamento General de Circulación), et ne marque la réponse comme contrôlée que si le moteur de règles et l'IA sont d'accord.",
      ar: "اختر مشهدًا أو ارفع صورة تقاطع. يخبرك RoadSense بما يجب عليك فعله، مع المادة الدقيقة من لائحة المرور الإسبانية (Reglamento General de Circulación)، ولا يعلّم الإجابة كمُدقَّقة إلا عندما يتفق محرّك القواعد والذكاء الاصطناعي.",
    },
    poweredBy: {
      es: "Con Muse Spark, SAM 3.1 y Muse Image de Meta",
      en: "With Meta's Muse Spark, SAM 3.1 and Muse Image",
      fr: "Avec Muse Spark, SAM 3.1 et Muse Image de Meta",
      ar: "باستخدام Muse Spark وSAM 3.1 وMuse Image من Meta",
    },
  },
  scenes: {
    heading: { es: "Escenas de ejemplo", en: "Example scenes", fr: "Scènes d'exemple", ar: "مشاهد نموذجية" },
    aiGenerated: {
      es: "Imagen generada por IA",
      en: "AI-generated image",
      fr: "Image générée par IA",
      ar: "صورة مُولَّدة بالذكاء الاصطناعي",
    },
    precomputed: {
      es: "Respuesta calculada de antemano con el mismo sistema.",
      en: "Answer worked out in advance by the same system.",
      fr: "Réponse calculée à l'avance par le même système.",
      ar: "إجابة حُسبت مسبقًا بالنظام نفسه.",
    },
  },
  upload: {
    heading: { es: "Tu foto", en: "Your photo", fr: "Votre photo", ar: "صورتك" },
    choose: { es: "Elegir una foto", en: "Choose a photo", fr: "Choisir une photo", ar: "اختر صورة" },
    change: { es: "Cambiar la foto", en: "Change photo", fr: "Changer de photo", ar: "غيّر الصورة" },
    analyse: { es: "Analizar", en: "Analyse", fr: "Analyser", ar: "حلّل" },
    tip: {
      es: "Funciona mejor con una foto desde el asiento del conductor, mirando al cruce.",
      en: "Works best with a photo from the driver's seat, looking at the junction.",
      fr: "Fonctionne mieux avec une photo prise depuis le siège du conducteur, face à l'intersection.",
      ar: "يعمل بشكل أفضل مع صورة مأخوذة من مقعد السائق باتجاه التقاطع.",
    },
    notice: {
      es: "Tu foto se envía a Meta para analizarla en modo estándar: no se usa para entrenar sus modelos y DriveIQ no la guarda. Antes de enviarla quitamos la ubicación y los datos de la cámara.",
      en: "Your photo is sent to Meta for analysis in Standard mode: it isn't used to train their models and DriveIQ doesn't keep it. We remove the location and camera data before sending it.",
      fr: "Votre photo est envoyée à Meta pour analyse en mode standard : elle ne sert pas à entraîner ses modèles et DriveIQ ne la conserve pas. Nous retirons la localisation et les données de l'appareil avant l'envoi.",
      ar: "تُرسل صورتك إلى Meta لتحليلها في الوضع القياسي: لا تُستخدم لتدريب نماذجها ولا تحتفظ بها DriveIQ. نزيل الموقع وبيانات الكاميرا قبل الإرسال.",
    },
    privacy: {
      es: "Política de privacidad",
      en: "Privacy policy",
      fr: "Politique de confidentialité",
      ar: "سياسة الخصوصية",
    },
  },
  stages: {
    perceive: { es: "Leyendo la foto…", en: "Reading the photo…", fr: "Lecture de la photo…", ar: "جارٍ قراءة الصورة…" },
    check: { es: "Aplicando el reglamento…", en: "Applying the rules…", fr: "Application des règles…", ar: "جارٍ تطبيق القواعد…" },
    confirm: {
      es: "Comprobando la foto con SAM 3.1…",
      en: "Checking the photo with SAM 3.1…",
      fr: "Contrôle de la photo avec SAM 3.1…",
      ar: "جارٍ تدقيق الصورة باستخدام SAM 3.1…",
    },
    retrieve: {
      es: "Buscando el artículo del BOE…",
      en: "Finding the BOE article…",
      fr: "Recherche de l'article du BOE…",
      ar: "جارٍ البحث عن المادة في الجريدة الرسمية (BOE)…",
    },
    decide: { es: "Redactando la explicación…", en: "Writing the explanation…", fr: "Rédaction de l'explication…", ar: "جارٍ كتابة الشرح…" },
    edit: { es: "Cambiando la escena…", en: "Changing the scene…", fr: "Modification de la scène…", ar: "جارٍ تعديل المشهد…" },
  },
  certainty: {
    checked: {
      label: { es: "Comprobada", en: "Checked", fr: "Contrôlée", ar: "مُدقَّقة" },
      explain: {
        es: "El motor de reglas y la IA llegan a la misma respuesta, SAM 3.1 encuentra en la foto cada señal o vehículo del que depende, y la respuesta cita el texto oficial del BOE. No es una garantía: mira siempre la situación real.",
        en: "The rule engine and the AI reach the same answer, SAM 3.1 finds every sign or vehicle it depends on in the photo, and the answer cites the official BOE text. It isn't a guarantee: always look at the real situation.",
        fr: "Le moteur de règles et l'IA arrivent à la même réponse, SAM 3.1 retrouve dans la photo chaque panneau ou véhicule dont elle dépend, et la réponse cite le texte officiel du BOE. Ce n'est pas une garantie : regardez toujours la situation réelle.",
        ar: "يصل محرّك القواعد والذكاء الاصطناعي إلى الإجابة نفسها، ويعثر SAM 3.1 في الصورة على كل إشارة أو مركبة تعتمد عليها، وتستشهد الإجابة بنص الجريدة الرسمية (BOE). ليست ضمانًا: انظر دائمًا إلى الوضع الحقيقي.",
      },
    },
    disagree: {
      label: { es: "Respuestas distintas", en: "Answers differ", fr: "Réponses différentes", ar: "إجابتان مختلفتان" },
      explain: {
        es: "El motor de reglas y la IA no coinciden, así que te mostramos las dos respuestas y ninguna lleva la marca de comprobada.",
        en: "The rule engine and the AI disagree, so you see both answers and neither is marked as checked.",
        fr: "Le moteur de règles et l'IA ne sont pas d'accord : vous voyez les deux réponses et aucune n'est marquée comme contrôlée.",
        ar: "لا يتفق محرّك القواعد والذكاء الاصطناعي، لذلك نعرض لك الإجابتين ولا تحمل أيّ منهما علامة التدقيق.",
      },
    },
    not_sure: {
      label: { es: "No estamos seguros", en: "Not sure", fr: "Pas sûr", ar: "غير متأكدين" },
      explain: {
        es: "Falta algo para responder con seguridad: abajo te decimos qué. Prueba con otra foto.",
        en: "Something needed for a safe answer is missing; we say what below. Try another photo.",
        fr: "Il manque un élément pour répondre avec certitude ; nous indiquons lequel ci-dessous. Essayez une autre photo.",
        ar: "ينقصنا ما يلزم لإجابة مؤكدة؛ نوضّح أدناه ما هو. جرّب صورة أخرى.",
      },
    },
    outside_scope: {
      label: { es: "Fuera de alcance", en: "Out of scope", fr: "Hors champ", ar: "خارج النطاق" },
      explain: {
        es: "RoadSense solo analiza cruces y pasos de peatones en España.",
        en: "RoadSense only analyses junctions and pedestrian crossings in Spain.",
        fr: "RoadSense n'analyse que les intersections et les passages piétons en Espagne.",
        ar: "يحلّل RoadSense التقاطعات وممرات المشاة في إسبانيا فقط.",
      },
    },
  },
  obligations: {
    proceed: { es: "Puedes pasar", en: "You can go", fr: "Vous pouvez passer", ar: "يمكنك المرور" },
    yield: { es: "Cede el paso", en: "Give way", fr: "Cédez le passage (ceda el paso)", ar: "أفسح الطريق (ceda el paso)" },
    stop_and_yield: {
      es: "Detente por completo y cede el paso",
      en: "Stop completely, then give way",
      fr: "Arrêtez-vous complètement, puis cédez le passage (STOP)",
      ar: "توقّف تمامًا ثم أفسح الطريق (STOP)",
    },
    stop_at_light: { es: "Detente ante el semáforo", en: "Stop at the light", fr: "Arrêtez-vous au feu", ar: "توقّف عند الإشارة الضوئية" },
    yield_to_pedestrians: {
      es: "Deja pasar a los peatones",
      en: "Let the pedestrians cross",
      fr: "Laissez passer les piétons",
      ar: "اسمح للمشاة بالعبور",
    },
    yield_to_emergency_vehicle: {
      es: "Deja paso al vehículo de emergencia",
      en: "Let the emergency vehicle through",
      fr: "Laissez passer le véhicule d'urgence",
      ar: "أفسح الطريق لمركبة الطوارئ",
    },
  },
  unknowns: {
    ego_signage_hidden: {
      es: "Algo tapa o impide leer la señal que podría regular tu paso.",
      en: "Something hides the sign that could govern your approach, or makes it unreadable.",
      fr: "Quelque chose cache ou rend illisible le panneau qui pourrait régler votre passage.",
      ar: "شيء ما يحجب الإشارة التي قد تنظّم مرورك أو يجعل قراءتها متعذّرة.",
    },
    light_state_unclear: {
      es: "No se ve qué luz del semáforo está encendida.",
      en: "You can't tell which lamp of the light is lit.",
      fr: "On ne distingue pas quel feu est allumé.",
      ar: "لا يمكن معرفة أيّ مصباح في الإشارة الضوئية مضاء.",
    },
    junction_unclear: {
      es: "No se distingue bien la forma del cruce.",
      en: "The layout of the junction can't be made out.",
      fr: "On ne distingue pas bien la forme de l'intersection.",
      ar: "لا يمكن تمييز شكل التقاطع بوضوح.",
    },
    right_approach_hidden: {
      es: "No se ve si viene alguien por tu derecha.",
      en: "You can't see whether anyone is coming from your right.",
      fr: "On ne voit pas si quelqu'un arrive par votre droite.",
      ar: "لا يمكن رؤية ما إذا كان أحد قادمًا من يمينك.",
    },
    surface_unclear: {
      es: "No se ve si las vías están pavimentadas.",
      en: "You can't tell whether the roads are paved.",
      fr: "On ne voit pas si les routes sont goudronnées.",
      ar: "لا يمكن معرفة ما إذا كانت الطرق معبّدة.",
    },
  },
  outOfScope: {
    not_spain: {
      es: "La foto no parece de España: RoadSense solo conoce las normas españolas.",
      en: "The photo doesn't look like Spain: RoadSense only knows the Spanish rules.",
      fr: "La photo ne semble pas prise en Espagne : RoadSense ne connaît que les règles espagnoles.",
      ar: "لا تبدو الصورة من إسبانيا: لا يعرف RoadSense سوى القواعد الإسبانية.",
    },
    no_junction: {
      es: "No hay ningún cruce ni paso de peatones que decidir.",
      en: "There's no junction or pedestrian crossing to decide on.",
      fr: "Il n'y a ni intersection ni passage piéton à trancher.",
      ar: "لا يوجد تقاطع أو ممر مشاة لاتخاذ قرار بشأنه.",
    },
    traffic_officer: {
      es: "Un agente dirige el tráfico: sus indicaciones prevalecen sobre todo lo demás.",
      en: "An officer is directing traffic: their signals come before everything else.",
      fr: "Un agent règle la circulation : ses indications priment sur tout le reste.",
      ar: "يوجد شرطي ينظّم المرور: إشاراته تتقدّم على كل ما عداها.",
    },
    other: {
      es: "No podemos analizar esta foto.",
      en: "We can't analyse this photo.",
      fr: "Nous ne pouvons pas analyser cette photo.",
      ar: "لا يمكننا تحليل هذه الصورة.",
    },
  },
  result: {
    answer: { es: "Qué debes hacer", en: "What to do", fr: "Ce que vous devez faire", ar: "ما يجب عليك فعله" },
    why: { es: "Por qué", en: "Why", fr: "Pourquoi", ar: "لماذا" },
    tempting: {
      es: "La respuesta trampa",
      en: "The tempting wrong answer",
      fr: "La fausse bonne réponse",
      ar: "الإجابة الخاطئة المغرية",
    },
    rules: { es: "Lo que dice la ley", en: "What the law says", fr: "Ce que dit la loi", ar: "ما ينص عليه القانون" },
    plainWords: { es: "En pocas palabras", en: "In plain words", fr: "En quelques mots", ar: "باختصار" },
    source: {
      es: "BOE, texto consolidado del Reglamento General de Circulación",
      en: "BOE consolidated text of the Reglamento General de Circulación",
      fr: "BOE, texte consolidé du Reglamento General de Circulación",
      ar: "الجريدة الرسمية (BOE)، النص الموحّد لـ Reglamento General de Circulación",
    },
    versionSince: {
      es: "Versión vigente desde",
      en: "Version in force since",
      fr: "Version en vigueur depuis le",
      ar: "النسخة السارية منذ",
    },
    engine: { es: "Motor de reglas", en: "Rule engine", fr: "Moteur de règles", ar: "محرّك القواعد" },
    model: { es: "IA (Muse Spark)", en: "AI (Muse Spark)", fr: "IA (Muse Spark)", ar: "الذكاء الاصطناعي (Muse Spark)" },
    missing: { es: "Qué falta", en: "What's missing", fr: "Ce qui manque", ar: "ما الذي ينقص" },
    unsettled: {
      es: "Las reglas que citamos no bastan para decidir este caso con seguridad.",
      en: "The rules we cite aren't enough to settle this case safely.",
      fr: "Les règles que nous citons ne suffisent pas à trancher ce cas avec certitude.",
      ar: "القواعد التي نستشهد بها لا تكفي لحسم هذه الحالة بشكل مؤكد.",
    },
    amberException: {
      es: "Con el ámbar fijo debes detenerte, salvo que estés tan cerca que no puedas hacerlo con seguridad.",
      en: "On a steady amber you must stop, unless you're so close that you can't stop safely.",
      fr: "Au feu orange fixe, vous devez vous arrêter, sauf si vous êtes trop près pour le faire en sécurité.",
      ar: "عند الضوء البرتقالي الثابت يجب أن تتوقف، إلا إذا كنت قريبًا جدًا بحيث لا يمكنك التوقف بأمان.",
    },
    evidence: {
      es: "Contorno continuo: confirmado por SAM 3.1. Discontinuo: sin confirmar.",
      en: "Solid outline: confirmed by SAM 3.1. Dashed: not confirmed.",
      fr: "Contour plein : confirmé par SAM 3.1. Pointillés : non confirmé.",
      ar: "الإطار المتصل: أكّده SAM 3.1. الإطار المتقطع: لم يُؤكَّد.",
    },
    models: { es: "Modelos", en: "Models", fr: "Modèles", ar: "النماذج" },
    badgeHelp: {
      es: "¿Qué significa?",
      en: "What does this mean?",
      fr: "Qu'est-ce que cela signifie ?",
      ar: "ماذا يعني هذا؟",
    },
    loading: { es: "Cargando…", en: "Loading…", fr: "Chargement…", ar: "جارٍ التحميل…" },
    // {scenes}, {right}, {answerable} and {wrong} come from docs/roadsense/eval-results.json.
    evaluation: {
      es: "En nuestra evaluación con {scenes} escenas generadas por IA: respuestas comprobadas y acertadas, {right} de {answerable}; respuestas comprobadas pero erróneas, {wrong}. Ajustamos el sistema con esas mismas escenas, así que con fotos reales puede acertar menos.",
      en: "In our evaluation on {scenes} AI-generated scenes: answers checked and right, {right} of {answerable}; answers checked but wrong, {wrong}. We tuned the system on these same scenes, so real photos may fare worse.",
      fr: "Dans notre évaluation sur {scenes} scènes générées par IA : réponses contrôlées et justes, {right} sur {answerable} ; réponses contrôlées mais fausses, {wrong}. Nous avons réglé le système sur ces mêmes scènes : avec de vraies photos, il peut se tromper davantage.",
      ar: "في تقييمنا على {scenes} مشهدًا مُولَّدًا بالذكاء الاصطناعي: إجابات مُدقَّقة وصحيحة: {right} من {answerable}؛ إجابات مُدقَّقة لكنها خاطئة: {wrong}. ضبطنا النظام على المشاهد نفسها، لذا قد تكون نتائجه مع الصور الحقيقية أقل دقة.",
    },
    nothingToConfirm: {
      es: "La respuesta depende de lo que no se ve (por ejemplo, que no venga nadie) o del tipo de cruce, y eso no se puede comprobar en la foto.",
      en: "The answer depends on what isn't there (for example, nobody coming) or on the type of junction, which can't be checked in the photo.",
      fr: "La réponse dépend de ce qui n'est pas visible (par exemple, que personne n'arrive) ou du type d'intersection, ce qui ne peut pas être contrôlé sur la photo.",
      ar: "تعتمد الإجابة على ما لا يظهر (مثلًا ألا يكون أحد قادمًا) أو على نوع التقاطع، ولا يمكن التحقق من ذلك في الصورة.",
    },
    unconfirmed: {
      es: "SAM 3.1 no ha encontrado en la foto todo aquello de lo que depende la respuesta (contornos discontinuos).",
      en: "SAM 3.1 couldn't find everything the answer depends on in the photo (dashed outlines).",
      fr: "SAM 3.1 n'a pas retrouvé dans la photo tout ce dont dépend la réponse (contours en pointillés).",
      ar: "لم يعثر SAM 3.1 في الصورة على كل ما تعتمد عليه الإجابة (الأطر المتقطعة).",
    },
    lowConfidence: {
      es: "La IA no está lo bastante segura de algo de lo que depende la respuesta.",
      en: "The AI isn't sure enough about something the answer depends on.",
      fr: "L'IA n'est pas assez sûre d'un élément dont dépend la réponse.",
      ar: "الذكاء الاصطناعي غير متأكد بما يكفي من أمر تعتمد عليه الإجابة.",
    },
    noExplanation: {
      es: "La explicación de la IA no ha pasado nuestras comprobaciones.",
      en: "The AI's explanation didn't pass our checks.",
      fr: "L'explication de l'IA n'a pas passé nos contrôles.",
      ar: "لم يجتز شرح الذكاء الاصطناعي عمليات التدقيق لدينا.",
    },
    citationMismatch: {
      es: "La IA llega a la misma respuesta, pero sin citar el artículo que aplica el motor de reglas.",
      en: "The AI reaches the same answer, but without citing the article the rule engine applies.",
      fr: "L'IA arrive à la même réponse, mais sans citer l'article qu'applique le moteur de règles.",
      ar: "يصل الذكاء الاصطناعي إلى الإجابة نفسها، لكن دون الاستشهاد بالمادة التي يطبّقها محرّك القواعد.",
    },
    officialText: {
      es: "Texto oficial",
      en: "Official text (in Spanish)",
      fr: "Texte officiel (en espagnol)",
      ar: "النص الرسمي (بالإسبانية)",
    },
  },
  whatIf: {
    heading: { es: "¿Y si…?", en: "What if…?", fr: "Et si… ?", ar: "ماذا لو…؟" },
    swap_to_stop: {
      es: "…la señal fuera un STOP",
      en: "…the sign were a STOP",
      fr: "…le panneau était un STOP",
      ar: "…كانت الإشارة STOP",
    },
    swap_to_yield: {
      es: "…la señal fuera un ceda el paso",
      en: "…the sign were a yield sign",
      fr: "…le panneau était un cédez-le-passage (ceda el paso)",
      ar: "…كانت الإشارة إفساح الطريق (ceda el paso)",
    },
    remove_sign: { es: "…no hubiera señal", en: "…there were no sign", fr: "…il n'y avait pas de panneau", ar: "…لم تكن هناك إشارة" },
    light_red: {
      es: "…el semáforo estuviera en rojo",
      en: "…the light were red",
      fr: "…le feu était rouge",
      ar: "…كانت الإشارة الضوئية حمراء",
    },
    light_green: {
      es: "…el semáforo estuviera en verde",
      en: "…the light were green",
      fr: "…le feu était vert",
      ar: "…كانت الإشارة الضوئية خضراء",
    },
    add_emergency_vehicle: {
      es: "…llegara una ambulancia con las luces encendidas",
      en: "…an ambulance came with its lights on",
      fr: "…une ambulance arrivait gyrophares allumés",
      ar: "…جاءت سيارة إسعاف بأضوائها المضاءة",
    },
    add_pedestrian_on_crossing: {
      es: "…hubiera un peatón cruzando",
      en: "…a pedestrian were crossing",
      fr: "…un piéton traversait",
      ar: "…كان أحد المشاة يعبر",
    },
    original: { es: "Escena original", en: "Original scene", fr: "Scène d'origine", ar: "المشهد الأصلي" },
    notApplied: {
      es: "No hemos podido hacer ese cambio con fiabilidad en esta foto.",
      en: "We couldn't make that change reliably on this photo.",
      fr: "Nous n'avons pas pu faire ce changement de façon fiable sur cette photo.",
      ar: "لم نتمكن من إجراء هذا التغيير بشكل موثوق على هذه الصورة.",
    },
    edited: { es: "Imagen editada por IA", en: "AI-edited image", fr: "Image modifiée par IA", ar: "صورة عُدّلت بالذكاء الاصطناعي" },
    liveNote: {
      es: "Cada cambio en tu foto cuenta como un análisis.",
      en: "Each change to your photo counts as one analysis.",
      fr: "Chaque modification de votre photo compte comme une analyse.",
      ar: "كل تعديل على صورتك يُحتسب تحليلًا واحدًا.",
    },
  },
  errors: {
    timeout: {
      es: "El análisis ha tardado demasiado. Vuelve a intentarlo.",
      en: "The analysis took too long. Please try again.",
      fr: "L'analyse a pris trop de temps. Réessayez.",
      ar: "استغرق التحليل وقتًا طويلًا. حاول مرة أخرى.",
    },
    model: {
      es: "El servicio de IA no ha respondido bien. Vuelve a intentarlo.",
      en: "The AI service didn't respond properly. Please try again.",
      fr: "Le service d'IA n'a pas répondu correctement. Réessayez.",
      ar: "لم تستجب خدمة الذكاء الاصطناعي كما يجب. حاول مرة أخرى.",
    },
    internal: {
      es: "Algo ha fallado. Vuelve a intentarlo.",
      en: "Something went wrong. Please try again.",
      fr: "Une erreur s'est produite. Réessayez.",
      ar: "حدث خطأ ما. حاول مرة أخرى.",
    },
    // After a failed live analysis, the server says whether it was given back (once a day if it was billed).
    refunded: {
      es: "No se ha descontado de tu límite diario.",
      en: "It didn't count against your daily limit.",
      fr: "Elle n'a pas été décomptée de votre limite quotidienne.",
      ar: "لم يُحتسب من حدّك اليومي.",
    },
    counted: {
      es: "Ha contado como uno de tus análisis de hoy.",
      en: "It counted as one of today's analyses.",
      fr: "Elle a compté comme l'une de vos analyses du jour.",
      ar: "احتُسب ضمن تحليلاتك لهذا اليوم.",
    },
    network: {
      es: "No hemos podido conectar. Revisa tu conexión y vuelve a intentarlo.",
      en: "We couldn't connect. Check your connection and try again.",
      fr: "Connexion impossible. Vérifiez votre connexion et réessayez.",
      ar: "تعذّر الاتصال. تحقّق من اتصالك وحاول مرة أخرى.",
    },
    unreadable: {
      es: "No hemos podido leer esa imagen. Prueba con otra foto en JPEG, PNG o WebP.",
      en: "We couldn't read that image. Try another JPEG, PNG or WebP photo.",
      fr: "Impossible de lire cette image. Essayez une autre photo JPEG, PNG ou WebP.",
      ar: "تعذّرت قراءة هذه الصورة. جرّب صورة أخرى بصيغة JPEG أو PNG أو WebP.",
    },
  },
  cta: {
    lead: {
      es: "¿Tienes el examen pronto? Practica con preguntas como las del examen hasta el día de la prueba.",
      en: "Exam coming up? Practise with exam-style questions until the day of the test.",
      fr: "Votre examen approche ? Entraînez-vous avec des questions comme celles de l'examen jusqu'au jour de l'épreuve.",
      ar: "هل اقترب موعد امتحانك؟ تدرّب على أسئلة مماثلة لأسئلة الامتحان حتى يوم الاختبار.",
    },
    button: { es: "Ver el pase de examen", en: "See the exam pass", fr: "Voir le pass examen", ar: "اطّلع على باقة الامتحان" },
    practice: {
      es: "Practicar preguntas de prioridad",
      en: "Practise right-of-way questions",
      fr: "S'entraîner aux questions de priorité",
      ar: "تدرّب على أسئلة الأولوية",
    },
  },
} as const;

/** The copy for one locale: the same shape as COPY with every four-language leaf resolved. */
type Resolved<T> = T extends Variants ? string : { [K in keyof T]: Resolved<T[K]> };
export type RoadsenseCopy = Resolved<typeof COPY>;
