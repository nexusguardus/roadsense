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
    eyebrow: { es: "RoadSense · nuevo", en: "RoadSense · new", fr: "RoadSense · nouveau", ar: "RoadSense · جديد" },
    title: {
      es: "Haz una foto de un cruce. Descubre quién pasa primero.",
      en: "Photograph a junction. Find out who goes first.",
      fr: "Photographiez une intersection. Découvrez qui passe en premier.",
      ar: "صوِّر تقاطعًا واعرف من يمرّ أولًا.",
    },
    lead: {
      es: "Haz la foto desde el asiento del conductor. RoadSense te dice qué debes hacer según las normas de tráfico, marca la señal o el vehículo que lo decide y cita la ley.",
      en: "Take a photo from the driver's seat. RoadSense tells you what you must do under Spain's traffic rules, outlines the sign or vehicle that decides it, and quotes the law.",
      fr: "Prenez la photo depuis le siège du conducteur. RoadSense vous dit ce que vous devez faire selon le code de la route espagnol, entoure le panneau ou le véhicule qui en décide et cite la loi.",
      ar: "التقط الصورة من مقعد السائق. يخبرك RoadSense بما يجب عليك فعله وفق قواعد المرور الإسبانية، ويحدّد الإشارة أو المركبة التي تحسم الأمر، ويستشهد بنص القانون.",
    },
  },
  hero: {
    upload: { es: "Subir una foto", en: "Upload a photo", fr: "Envoyer une photo", ar: "ارفع صورة" },
    tryExample: { es: "Probar un ejemplo", en: "Try an example", fr: "Essayer un exemple", ar: "جرّب مثالًا" },
    trust: {
      es: "Gratis para probar · No guardamos tu foto · Cruces y pasos de peatones en España",
      en: "Free to try · We don't keep your photo · Junctions and pedestrian crossings in Spain",
      fr: "Gratuit pour essayer · Nous ne gardons pas votre photo · Intersections et passages piétons en Espagne",
      ar: "مجاني للتجربة · لا نحتفظ بصورتك · التقاطعات وممرات المشاة في إسبانيا",
    },
    exampleTag: { es: "Ejemplo", en: "Example", fr: "Exemple", ar: "مثال" },
    // The rule as the BOE names it, in Spanish in every language, e.g. "RGC art. 56.1 · Intersecciones señalizadas".
    citation: { es: "{article} · {title}", en: "{article} · {title}", fr: "{article} · {title}", ar: "{article} · {title}" },
  },
  steps: {
    snap: {
      title: { es: "Fotografía el cruce", en: "Snap the junction", fr: "Photographiez l'intersection", ar: "صوِّر التقاطع" },
      body: {
        es: "Desde el asiento del conductor, mirando al frente.",
        en: "From the driver's seat, looking ahead.",
        fr: "Depuis le siège du conducteur, en regardant devant vous.",
        ar: "من مقعد السائق، باتجاه الأمام.",
      },
    },
    answer: {
      title: { es: "Recibe la respuesta", en: "Get the answer", fr: "Obtenez la réponse", ar: "احصل على الإجابة" },
      body: {
        es: "Qué debes hacer, en qué se basa y el artículo exacto.",
        en: "What you must do, what it's based on, and the exact article.",
        fr: "Ce que vous devez faire, sur quoi cela repose et l'article exact.",
        ar: "ما يجب عليك فعله، وعلى ماذا يستند، والمادة القانونية بدقة.",
      },
    },
    ask: {
      title: { es: "Pregunta «¿y si…?»", en: "Ask \"what if…?\"", fr: "Demandez « et si… ? »", ar: "اسأل «ماذا لو…؟»" },
      body: {
        es: "Escribe un cambio, como un peatón que cruza, y mira cómo cambia la respuesta.",
        en: "Type a change, like a person stepping out, and see how the answer changes.",
        fr: "Écrivez un changement, comme un piéton qui traverse, et voyez comment la réponse change.",
        ar: "اكتب تغييرًا، مثل أحد المشاة يعبر، وشاهد كيف تتغيّر الإجابة.",
      },
    },
  },
  examples: {
    heading: { es: "O empieza con un ejemplo", en: "Or start with an example", fr: "Ou commencez par un exemple", ar: "أو ابدأ بمثال" },
    seeAll: { es: "Ver todos", en: "See all", fr: "Tout voir", ar: "عرض الكل" },
    showFewer: { es: "Ver menos", en: "Show fewer", fr: "Voir moins", ar: "عرض أقل" },
  },
  howItChecks: {
    heading: { es: "Cómo se comprueba a sí mismo", en: "How it checks itself", fr: "Comment il se contrôle lui-même", ar: "كيف يدقّق في نفسه" },
    body: {
      es: "Muse Spark lee la foto → un motor de reglas aplica el Reglamento → SAM 3.1 encuentra en la foto la señal o el coche → si no coinciden todos, dice «no estamos seguros» en vez de adivinar. Muse Image dibuja tus «¿y si…?».",
      en: "Muse Spark reads the photo → a rule engine applies the Reglamento → SAM 3.1 finds the sign or car in the photo → if they don't all agree, it says \"not sure\" instead of guessing. Muse Image draws your what-ifs.",
      fr: "Muse Spark lit la photo → un moteur de règles applique le Reglamento → SAM 3.1 retrouve le panneau ou la voiture sur la photo → s'ils ne sont pas tous d'accord, il dit « pas sûr » au lieu de deviner. Muse Image dessine vos « et si… ? ».",
      ar: "يقرأ Muse Spark الصورة ← يطبّق محرّك القواعد اللائحة (Reglamento) ← يعثر SAM 3.1 على الإشارة أو السيارة في الصورة ← إذا لم تتفق كلها، يقول «غير متأكدين» بدلًا من التخمين. ويرسم Muse Image تغييرات «ماذا لو…؟».",
    },
    sourceCode: { es: "Código fuente", en: "Source code", fr: "Code source", ar: "الشيفرة المصدرية" },
  },
  scenes: {
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
    change: { es: "Cambiar la foto", en: "Change photo", fr: "Changer de photo", ar: "غيّر الصورة" },
    analyse: { es: "Analizar esta foto", en: "Analyse this photo", fr: "Analyser cette photo", ar: "حلّل هذه الصورة" },
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
    understand: { es: "Entendiendo tu pregunta…", en: "Understanding your question…", fr: "Compréhension de votre question…", ar: "جارٍ فهم سؤالك…" },
  },
  certainty: {
    checked: {
      label: { es: "Doble comprobación", en: "Double-checked", fr: "Double contrôle", ar: "تدقيق مزدوج" },
      explain: {
        es: "El motor de reglas y la IA llegan a la misma respuesta, SAM 3.1 encuentra en la foto cada señal o vehículo del que depende, y la respuesta cita el texto oficial del BOE. No es una garantía: mira siempre la situación real.",
        en: "The rule engine and the AI reach the same answer, SAM 3.1 finds every sign or vehicle it depends on in the photo, and the answer cites the official BOE text. It isn't a guarantee: always look at the real situation.",
        fr: "Le moteur de règles et l'IA arrivent à la même réponse, SAM 3.1 retrouve dans la photo chaque panneau ou véhicule dont elle dépend, et la réponse cite le texte officiel du BOE. Ce n'est pas une garantie : regardez toujours la situation réelle.",
        ar: "يصل محرّك القواعد والذكاء الاصطناعي إلى الإجابة نفسها، ويعثر SAM 3.1 في الصورة على كل إشارة أو مركبة تعتمد عليها، وتستشهد الإجابة بنص الجريدة الرسمية (BOE). ليست ضمانًا: انظر دائمًا إلى الوضع الحقيقي.",
      },
    },
    disagree: {
      label: {
        es: "Nuestras dos comprobaciones no coinciden",
        en: "Our two checks disagree",
        fr: "Nos deux contrôles ne concordent pas",
        ar: "فحصانا لا يتفقان",
      },
      explain: {
        es: "El motor de reglas y la IA no coinciden, así que te mostramos las dos respuestas y ninguna lleva la marca de comprobada.",
        en: "The rule engine and the AI disagree, so you see both answers and neither is marked as checked.",
        fr: "Le moteur de règles et l'IA ne sont pas d'accord : vous voyez les deux réponses et aucune n'est marquée comme contrôlée.",
        ar: "لا يتفق محرّك القواعد والذكاء الاصطناعي، لذلك نعرض لك الإجابتين ولا تحمل أيّ منهما علامة التدقيق.",
      },
    },
    not_sure: {
      label: { es: "No estamos seguros", en: "Not sure", fr: "Pas sûr", ar: "غير متأكدين" },
      note: { es: "RoadSense no adivina", en: "RoadSense won't guess", fr: "RoadSense ne devine pas", ar: "لا يخمّن RoadSense" },
      explain: {
        es: "Falta algo para responder con seguridad: abajo te decimos qué. Prueba con otra foto.",
        en: "Something needed for a safe answer is missing; we say what below. Try another photo.",
        fr: "Il manque un élément pour répondre avec certitude ; nous indiquons lequel ci-dessous. Essayez une autre photo.",
        ar: "ينقصنا ما يلزم لإجابة مؤكدة؛ نوضّح أدناه ما هو. جرّب صورة أخرى.",
      },
    },
    outside_scope: {
      label: {
        es: "No podemos responder con esta foto",
        en: "Can't answer this photo",
        fr: "Impossible de répondre avec cette photo",
        ar: "لا يمكننا الإجابة عن هذه الصورة",
      },
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
    slow_down_for_pedestrian: {
      es: "Reduce la velocidad y detente si hace falta",
      en: "Slow down, and stop if needed",
      fr: "Ralentissez et arrêtez-vous si nécessaire",
      ar: "خفّف السرعة وتوقّف إذا لزم الأمر",
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
      es: "Las normas que comprueba RoadSense no resuelven este caso, así que no adivina.",
      en: "The rules RoadSense checks don't settle this case, so it won't guess.",
      fr: "Les règles que RoadSense contrôle ne tranchent pas ce cas, donc il ne devine pas.",
      ar: "القواعد التي يدقّق فيها RoadSense لا تحسم هذه الحالة، لذلك لا يخمّن.",
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
      es: "¿Qué significa «Doble comprobación»?",
      en: "What does Double-checked mean?",
      fr: "Que signifie « Double contrôle » ?",
      ar: "ماذا يعني «تدقيق مزدوج»؟",
    },
    whyWrongFold: { es: "Por qué la gente se equivoca", en: "Why people get this wrong", fr: "Pourquoi on se trompe souvent", ar: "لماذا يخطئ كثيرون" },
    lawFold: { es: "Leer la ley", en: "Read the law", fr: "Lire la loi", ar: "اقرأ نص القانون" },
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
  // What an explanation calls a fact Muse Spark wrote only as its id ("donc u1 passe" → "donc la
  // voiture passe"), with the article it takes mid-sentence. See withoutFactIds in view.ts.
  factNames: {
    car: { es: "el coche", en: "the car", fr: "la voiture", ar: "السيارة" },
    motorcycle: { es: "la moto", en: "the motorcycle", fr: "la moto", ar: "الدراجة النارية" },
    bicycle: { es: "el ciclista", en: "the cyclist", fr: "le cycliste", ar: "راكب الدراجة" },
    pedestrian: { es: "el peatón", en: "the pedestrian", fr: "le piéton", ar: "أحد المشاة" },
    tram: { es: "el tranvía", en: "the tram", fr: "le tram", ar: "الترام" },
    emergency_vehicle: { es: "el vehículo de emergencia", en: "the emergency vehicle", fr: "le véhicule d'urgence", ar: "مركبة الطوارئ" },
    sign: { es: "la señal", en: "the sign", fr: "le panneau", ar: "الإشارة" },
    light: { es: "el semáforo", en: "the traffic light", fr: "le feu", ar: "الإشارة الضوئية" },
    marking: { es: "la marca vial", en: "the road marking", fr: "le marquage au sol", ar: "العلامة الأرضية" },
  },
  whatIf: {
    heading: { es: "¿Y si…?", en: "What if…?", fr: "Et si… ?", ar: "ماذا لو…؟" },
    // Suggestion chips, in the learner's words.
    swap_to_stop: { es: "es un STOP", en: "it's a STOP sign", fr: "c'est un panneau STOP", ar: "الإشارة STOP" },
    swap_to_yield: {
      es: "es un ceda el paso",
      en: "it's a yield sign",
      fr: "c'est un cédez-le-passage (ceda el paso)",
      ar: "الإشارة أفسح الطريق (ceda el paso)",
    },
    remove_sign: { es: "desaparece la señal", en: "the sign disappears", fr: "le panneau disparaît", ar: "تختفي الإشارة" },
    light_red: { es: "el semáforo se pone en rojo", en: "the light turns red", fr: "le feu passe au rouge", ar: "تصبح الإشارة الضوئية حمراء" },
    light_green: { es: "el semáforo se pone en verde", en: "the light turns green", fr: "le feu passe au vert", ar: "تصبح الإشارة الضوئية خضراء" },
    add_emergency_vehicle: { es: "llega una ambulancia", en: "an ambulance comes", fr: "une ambulance arrive", ar: "تصل سيارة إسعاف" },
    add_pedestrian_on_crossing: { es: "cruza un peatón delante", en: "a person crosses in front", fr: "un piéton traverse devant", ar: "يعبر أحد المشاة أمامك" },
    add_pedestrian_ahead: { es: "sale un peatón delante", en: "a person steps out in front", fr: "un piéton surgit devant", ar: "يخرج أحد المشاة أمامك" },
    original: { es: "Ejemplo original", en: "Original example", fr: "Exemple d'origine", ar: "المثال الأصلي" },
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
    // Typed what-ifs.
    placeholder: { es: "p. ej. cruza un peatón delante", en: "e.g. a person crosses in front", fr: "p. ex. un piéton traverse devant", ar: "مثلًا: يعبر أحد المشاة أمامك" },
    ask: { es: "Preguntar", en: "Ask", fr: "Demander", ar: "اسأل" },
    hint: {
      es: "Lo que escribes se envía a Meta para entenderlo. No lo guardamos.",
      en: "What you type is sent to Meta to understand it. We don't keep it.",
      fr: "Ce que vous écrivez est envoyé à Meta pour le comprendre. Nous ne le conservons pas.",
      ar: "يُرسَل ما تكتبه إلى Meta لفهمه. لا نحتفظ به.",
    },
    yourPhoto: { es: "Tu foto", en: "Your photo", fr: "Votre photo", ar: "صورتك" },
    readAs: { es: "Entendido como:", en: "Read as:", fr: "Compris comme :", ar: "فهمناه هكذا:" },
    readAsLabels: {
      swap_to_stop: { es: "tu señal pasa a ser un STOP", en: "your sign becomes a STOP", fr: "votre panneau devient un STOP", ar: "تصبح إشارتك STOP" },
      swap_to_yield: {
        es: "tu señal pasa a ser un ceda el paso",
        en: "your sign becomes a yield sign",
        fr: "votre panneau devient un cédez-le-passage (ceda el paso)",
        ar: "تصبح إشارتك أفسح الطريق (ceda el paso)",
      },
      remove_sign: { es: "tu señal desaparece", en: "your sign is gone", fr: "votre panneau disparaît", ar: "تختفي إشارتك" },
      light_red: { es: "tu semáforo se pone en rojo", en: "your traffic light turns red", fr: "votre feu passe au rouge", ar: "تصبح إشارتك الضوئية حمراء" },
      light_green: { es: "tu semáforo se pone en verde", en: "your traffic light turns green", fr: "votre feu passe au vert", ar: "تصبح إشارتك الضوئية خضراء" },
      add_pedestrian_on_crossing: {
        es: "un peatón en el paso de cebra delante de ti",
        en: "a person on the zebra crossing in front of you",
        fr: "un piéton sur le passage piéton devant vous",
        ar: "أحد المشاة على ممر المشاة أمامك",
      },
      add_pedestrian_ahead: {
        es: "un peatón que se mete en la calzada delante de ti",
        en: "a person stepping into the road in front of you",
        fr: "un piéton qui s'engage sur la chaussée devant vous",
        ar: "أحد المشاة يدخل الطريق أمامك",
      },
      add_emergency_vehicle: {
        es: "llega una ambulancia con las luces encendidas",
        en: "an ambulance arrives with its lights on",
        fr: "une ambulance arrive gyrophares allumés",
        ar: "تصل سيارة إسعاف بأضوائها المضاءة",
      },
    },
    confirm: {
      es: "¿Lo pruebo? Cuenta como un análisis.",
      en: "Run it? It counts as one analysis.",
      fr: "Le lancer ? Cela compte comme une analyse.",
      ar: "هل نجرّبه؟ يُحتسب تحليلًا واحدًا.",
    },
    run: { es: "Probarlo", en: "Run it", fr: "Lancer", ar: "جرّبه" },
    notPossible: {
      no_light: {
        es: "En esta foto no hay un semáforo para ti.",
        en: "There's no traffic light for you in this photo.",
        fr: "Il n'y a pas de feu pour vous sur cette photo.",
        ar: "لا توجد في هذه الصورة إشارة ضوئية خاصة بك.",
      },
      no_sign: {
        es: "En esta foto no hay un STOP ni un ceda el paso para ti.",
        en: "There's no STOP or yield sign of yours in this photo.",
        fr: "Il n'y a pas de STOP ni de cédez-le-passage (ceda el paso) pour vous sur cette photo.",
        ar: "لا توجد في هذه الصورة إشارة STOP أو أفسح الطريق (ceda el paso) خاصة بك.",
      },
      light_already_red: { es: "Tu semáforo ya está en rojo.", en: "Your light is already red.", fr: "Votre feu est déjà rouge.", ar: "إشارتك الضوئية حمراء بالفعل." },
      light_already_green: { es: "Tu semáforo ya está en verde.", en: "Your light is already green.", fr: "Votre feu est déjà vert.", ar: "إشارتك الضوئية خضراء بالفعل." },
      sign_already_stop: { es: "Tu señal ya es un STOP.", en: "Your sign is already a STOP.", fr: "Votre panneau est déjà un STOP.", ar: "إشارتك STOP بالفعل." },
      sign_already_yield: {
        es: "Tu señal ya es un ceda el paso.",
        en: "Your sign is already a yield sign.",
        fr: "Votre panneau est déjà un cédez-le-passage (ceda el paso).",
        ar: "إشارتك أفسح الطريق (ceda el paso) بالفعل.",
      },
      pedestrian_already: {
        es: "Ya hay un peatón delante.",
        en: "There's already a person in front of you.",
        fr: "Il y a déjà un piéton devant vous.",
        ar: "يوجد بالفعل أحد المشاة أمامك.",
      },
      emergency_already: {
        es: "Ya hay un vehículo de emergencia en esta foto.",
        en: "There's already an emergency vehicle in this photo.",
        fr: "Il y a déjà un véhicule d'urgence sur cette photo.",
        ar: "توجد بالفعل مركبة طوارئ في هذه الصورة.",
      },
      cant_change: {
        es: "Solo puedo cambiar un semáforo entre rojo y verde, o una señal entre STOP y ceda el paso.",
        en: "I can only switch a light between red and green, or a sign between STOP and yield.",
        fr: "Je peux seulement faire passer un feu du rouge au vert ou l'inverse, ou un panneau entre STOP et cédez-le-passage (ceda el paso).",
        ar: "لا يمكنني إلا تبديل الإشارة الضوئية بين الأحمر والأخضر، أو الإشارة بين STOP وأفسح الطريق (ceda el paso).",
      },
    },
    notOnExample: {
      es: "Este ejemplo no tiene ese cambio preparado. Pruébalo con tu propia foto.",
      en: "This example doesn't have that change ready. Try it on your own photo.",
      fr: "Cet exemple n'a pas ce changement prêt. Essayez-le sur votre propre photo.",
      ar: "هذا المثال لا يتضمّن هذا التغيير جاهزًا. جرّبه على صورتك.",
    },
    none: {
      es: "Eso todavía no lo puedo probar. Puedo cambiar el semáforo o la señal, poner un peatón delante o traer un vehículo de emergencia.",
      en: "I can't test that one yet. I can change the traffic light or the sign, put a person in front of you, or bring in an emergency vehicle.",
      fr: "Je ne peux pas encore tester cela. Je peux changer le feu ou le panneau, placer un piéton devant vous ou faire venir un véhicule d'urgence.",
      ar: "لا يمكنني اختبار ذلك بعد. يمكنني تغيير الإشارة الضوئية أو الإشارة، أو وضع أحد المشاة أمامك، أو إحضار مركبة طوارئ.",
    },
    notCounted: {
      es: "No ha contado en tus análisis del día.",
      en: "This didn't count towards your daily analyses.",
      fr: "Cela n'a pas compté dans vos analyses du jour.",
      ar: "لم يُحتسب ذلك ضمن تحليلاتك اليومية.",
    },
    tryInstead: {
      es: "Prueba con una de estas:",
      en: "Try one of these instead:",
      fr: "Essayez plutôt l'une de celles-ci :",
      ar: "جرّب أحد هذه الاقتراحات بدلًا من ذلك:",
    },
    paused: {
      es: "Las preguntas escritas están en pausa ahora mismo. Las sugerencias de abajo siguen funcionando.",
      en: "Typed questions are paused right now. The suggestions below still work.",
      fr: "Les questions écrites sont en pause pour le moment. Les suggestions ci-dessous fonctionnent toujours.",
      ar: "الأسئلة المكتوبة متوقفة مؤقتًا الآن. ما زالت الاقتراحات أدناه تعمل.",
    },
    error: {
      es: "No he podido leer tu pregunta ahora mismo. Inténtalo de nuevo o elige una sugerencia.",
      en: "I couldn't read your question just now. Try again, or pick a suggestion.",
      fr: "Je n'ai pas pu lire votre question pour le moment. Réessayez ou choisissez une suggestion.",
      ar: "تعذّرت عليّ قراءة سؤالك الآن. حاول مرة أخرى أو اختر أحد الاقتراحات.",
    },
    before: {
      es: "Antes: {before} → ahora: {after}",
      en: "Before: {before} → now: {after}",
      fr: "Avant : {before} → maintenant : {after}",
      ar: "قبل: {before} ← الآن: {after}",
    },
    same: { es: "La misma respuesta que antes", en: "Same answer as before", fr: "La même réponse qu'avant", ar: "الإجابة نفسها كما كانت" },
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
