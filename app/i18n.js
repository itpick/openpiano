/* OpenPiano — i18n (light layer, EN source + RU + ES overlays).
 * Structure follows foxzi's I18N design: missing keys fall back to the source
 * dictionary so an incomplete translation never breaks the UI. Extend by
 * adding keys to DICTS; use t("key") everywhere in views.
 * Exposed as window.I18N: { t, setLocale, locale }.
 */
(() => {
  "use strict";
  const DICTS = {
    en: {
      "app.name":"OpenPiano",
      "home.welcome":"Hi",
      "home.continue":"Continue",
      "home.workout":"⏱ Daily Workout",
      "home.songs":"🎵 Song library",
      "home.free":"🎹 Free Play",
      "course.title":"Course",
      "songs.title":"Songs",
      "trainer.title":"📖 Read Notes",
      "sheet.title":"🎼 Sheet Music",
      "free.title":"Free Play",
      "lesson.start":"▶ Start",
      "lesson.restart":"↻ Restart",
      "lesson.listen":"🔊 Listen",
      "lesson.mic":"🎤 Mic",
      "lesson.midi":"🎚 MIDI",
      "lesson.hands":"🖐 Hands",
      "lesson.stepHint":"step — waits for you",
      "lesson.movingHint":"moving — play in time",
      "finish.passed":"✓ Unit passed — next unlocked",
      "note.C":"C","note.D":"D","note.E":"E","note.F":"F","note.G":"G","note.A":"A","note.B":"B",
    },
    ru: {
      "home.continue":"Продолжить",
      "course.title":"Курс",
      "songs.title":"Мелодии",
      "trainer.title":"📖 Чтение нот",
      "sheet.title":"🎼 Ноты",
      "free.title":"Свободная игра",
      "lesson.start":"▶ Начать",
      "lesson.restart":"↻ Ещё раз",
      "lesson.listen":"🔊 Послушать",
      "lesson.mic":"🎤 Микрофон",
      "lesson.midi":"🎚 MIDI",
      "lesson.hands":"🖐 Руки",
      "lesson.stepHint":"пошагово — ждёт тебя",
      "lesson.movingHint":"в ритме — играй в такт",
      "finish.passed":"✓ Урок пройден — следующий открыт",
      "note.C":"До","note.D":"Ре","note.E":"Ми","note.F":"Фа","note.G":"Соль","note.A":"Ля","note.B":"Си",
    },
    es: {
      "home.continue":"Continuar",
      "course.title":"Curso",
      "songs.title":"Canciones",
      "trainer.title":"📖 Leer notas",
      "sheet.title":"🎼 Partituras",
      "free.title":"Toca libre",
      "lesson.start":"▶ Empezar",
      "lesson.restart":"↻ Repetir",
      "lesson.listen":"🔊 Escuchar",
      "lesson.mic":"🎤 Micro",
      "lesson.midi":"🎚 MIDI",
      "lesson.hands":"🖐 Manos",
      "lesson.stepHint":"paso a paso — te espera",
      "lesson.movingHint":"al ritmo — toca a tiempo",
      "finish.passed":"✓ Lección superada — siguiente abierta",
      "note.C":"Do","note.D":"Re","note.E":"Mi","note.F":"Fa","note.G":"Sol","note.A":"La","note.B":"Si",
    }
  };
  let locale = localStorage.getItem("openpiano.locale") || "en";
  function t(key){
    return (DICTS[locale] && DICTS[locale][key]) || DICTS.en[key] || key;
  }
  function setLocale(l){ locale=DICTS[l]?l:"en";
    localStorage.setItem("openpiano.locale", locale); }
  window.I18N={ t, setLocale, get locale(){ return locale; }, DICTS };
})();
