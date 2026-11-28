// apps/scan/src/language-notes.ts: the short note that opens when someone picks a language, written
// in that language by hand (not by the browser's translator). It says what Leave a Map is, that the
// email file stays on the device, and what is happening to the page right now. It shows even where
// the page itself can't be translated (Safari, phones), so the person still knows what's going on.
// The note sits inside .lang-pick, which translate.ts skips, so this text is never translated again.

/** What is happening to the page. */
export type NoteState = 'working' | 'done' | 'unsupported' | 'unavailable' | 'failed';

export type NoteWords = {
  /** What Leave a Map does. */
  about: string;
  /** The email file stays on this device. */
  privacy: string;
  /** Close button. */
  ok: string;
} & Record<NoteState, string>;

export const NOTES: Record<string, NoteWords> = {
  en: {
    about: 'Leave a Map reads a copy of a mailbox on this device and lists the accounts tied to it, most urgent first.',
    privacy: 'The email file is never uploaded. Everything happens on this device.',
    working: 'Your browser is translating this page on this device. The first time can take a few minutes.',
    done: 'This page was translated by your browser’s built-in AI. Some words may be off; English is the original.',
    unsupported: 'This browser can’t translate the page, so it stays in English. Chrome on a computer can translate it.',
    unavailable: 'This language isn’t ready on this device yet, so the page stays in English.',
    failed: 'The translation stopped, so the page is back in English.',
    ok: 'OK',
  },
  hi: {
    about: 'Leave a Map इसी डिवाइस पर मेलबॉक्स की एक कॉपी पढ़ता है और उससे जुड़े खातों की सूची बनाता है, सबसे ज़रूरी पहले।',
    privacy: 'ईमेल फ़ाइल कहीं अपलोड नहीं होती। सब कुछ इसी डिवाइस पर होता है।',
    working: 'आपका ब्राउज़र इस पेज का अनुवाद इसी डिवाइस पर कर रहा है। पहली बार में कुछ मिनट लग सकते हैं।',
    done: 'इस पेज का अनुवाद आपके ब्राउज़र में बने AI ने किया है। कुछ शब्द गलत हो सकते हैं; असली पेज अंग्रेज़ी में है।',
    unsupported: 'यह ब्राउज़र पेज का अनुवाद नहीं कर सकता, इसलिए पेज अंग्रेज़ी में ही रहेगा। कंप्यूटर पर Chrome में इसका अनुवाद हो सकता है।',
    unavailable: 'यह भाषा अभी इस डिवाइस पर तैयार नहीं है, इसलिए पेज अंग्रेज़ी में ही रहेगा।',
    failed: 'अनुवाद रुक गया, इसलिए पेज फिर से अंग्रेज़ी में है।',
    ok: 'ठीक है',
  },
  bn: {
    about: 'Leave a Map এই ডিভাইসেই একটি মেলবক্সের কপি পড়ে এবং তার সঙ্গে যুক্ত অ্যাকাউন্টগুলির তালিকা তৈরি করে, সবচেয়ে জরুরিগুলো আগে।',
    privacy: 'ইমেল ফাইলটি কোথাও আপলোড হয় না। সবকিছু এই ডিভাইসেই হয়।',
    working: 'আপনার ব্রাউজার এই ডিভাইসেই পাতাটি অনুবাদ করছে। প্রথমবার কয়েক মিনিট লাগতে পারে।',
    done: 'আপনার ব্রাউজারের নিজস্ব AI এই পাতাটি অনুবাদ করেছে। কিছু শব্দ ভুল হতে পারে; মূল পাতা ইংরেজিতে।',
    unsupported: 'এই ব্রাউজার পাতাটি অনুবাদ করতে পারে না, তাই এটি ইংরেজিতেই থাকবে। কম্পিউটারে Chrome এটি অনুবাদ করতে পারে।',
    unavailable: 'এই ভাষাটি এখনও এই ডিভাইসে প্রস্তুত নয়, তাই পাতাটি ইংরেজিতেই থাকবে।',
    failed: 'অনুবাদ থেমে গেছে, তাই পাতাটি আবার ইংরেজিতে।',
    ok: 'ঠিক আছে',
  },
  mr: {
    about: 'Leave a Map याच डिव्हाइसवर मेलबॉक्सची एक प्रत वाचते आणि त्याच्याशी जोडलेल्या खात्यांची यादी करते, सर्वात तातडीची आधी.',
    privacy: 'ईमेल फाइल कुठेही अपलोड होत नाही. सर्व काही याच डिव्हाइसवर होते.',
    working: 'तुमचा ब्राउझर याच डिव्हाइसवर या पानाचे भाषांतर करत आहे. पहिल्यांदा काही मिनिटे लागू शकतात.',
    done: 'या पानाचे भाषांतर तुमच्या ब्राउझरमधील AI ने केले आहे. काही शब्द चुकीचे असू शकतात; मूळ पान इंग्रजीत आहे.',
    unsupported: 'हा ब्राउझर पानाचे भाषांतर करू शकत नाही, म्हणून ते इंग्रजीतच राहील. संगणकावरील Chrome मध्ये भाषांतर होऊ शकते.',
    unavailable: 'ही भाषा अजून या डिव्हाइसवर तयार नाही, म्हणून पान इंग्रजीतच राहील.',
    failed: 'भाषांतर थांबले, म्हणून पान पुन्हा इंग्रजीत आहे.',
    ok: 'ठीक आहे',
  },
  ta: {
    about: 'Leave a Map இந்தச் சாதனத்திலேயே ஒரு மின்னஞ்சல் பெட்டியின் நகலைப் படித்து, அதனுடன் இணைந்த கணக்குகளை, மிக அவசரமானவை முதலில், பட்டியலிடுகிறது.',
    privacy: 'மின்னஞ்சல் கோப்பு எங்கும் பதிவேற்றப்படுவதில்லை. எல்லாமே இந்தச் சாதனத்திலேயே நடக்கிறது.',
    working: 'உங்கள் உலாவி இந்தப் பக்கத்தை இந்தச் சாதனத்திலேயே மொழிபெயர்க்கிறது. முதல் முறை சில நிமிடங்கள் ஆகலாம்.',
    done: 'இந்தப் பக்கத்தை உங்கள் உலாவியில் உள்ள AI மொழிபெயர்த்தது. சில சொற்கள் தவறாக இருக்கலாம்; மூலப் பக்கம் ஆங்கிலத்தில் உள்ளது.',
    unsupported: 'இந்த உலாவியால் பக்கத்தை மொழிபெயர்க்க முடியாது, அதனால் அது ஆங்கிலத்திலேயே இருக்கும். கணினியில் Chrome இதை மொழிபெயர்க்கும்.',
    unavailable: 'இந்த மொழி இன்னும் இந்தச் சாதனத்தில் தயாராக இல்லை, அதனால் பக்கம் ஆங்கிலத்திலேயே இருக்கும்.',
    failed: 'மொழிபெயர்ப்பு நின்றுவிட்டது, அதனால் பக்கம் மீண்டும் ஆங்கிலத்தில் உள்ளது.',
    ok: 'சரி',
  },
  te: {
    about: 'Leave a Map ఈ పరికరంలోనే ఒక మెయిల్‌బాక్స్ కాపీని చదివి, దానికి అనుసంధానమైన ఖాతాల జాబితాను, అత్యవసరమైనవి ముందుగా, తయారు చేస్తుంది.',
    privacy: 'ఈమెయిల్ ఫైల్ ఎక్కడికీ అప్‌లోడ్ కాదు. అంతా ఈ పరికరంలోనే జరుగుతుంది.',
    working: 'మీ బ్రౌజర్ ఈ పేజీని ఈ పరికరంలోనే అనువదిస్తోంది. మొదటిసారి కొన్ని నిమిషాలు పట్టవచ్చు.',
    done: 'ఈ పేజీని మీ బ్రౌజర్‌లోని AI అనువదించింది. కొన్ని పదాలు తప్పుగా ఉండవచ్చు; అసలు పేజీ ఇంగ్లీషులో ఉంది.',
    unsupported: 'ఈ బ్రౌజర్ పేజీని అనువదించలేదు, కాబట్టి అది ఇంగ్లీషులోనే ఉంటుంది. కంప్యూటర్‌లో Chrome దీన్ని అనువదించగలదు.',
    unavailable: 'ఈ భాష ఇంకా ఈ పరికరంలో సిద్ధంగా లేదు, కాబట్టి పేజీ ఇంగ్లీషులోనే ఉంటుంది.',
    failed: 'అనువాదం ఆగిపోయింది, కాబట్టి పేజీ మళ్లీ ఇంగ్లీషులో ఉంది.',
    ok: 'సరే',
  },
  kn: {
    about: 'Leave a Map ಈ ಸಾಧನದಲ್ಲೇ ಮೇಲ್‌ಬಾಕ್ಸ್‌ನ ಪ್ರತಿಯನ್ನು ಓದಿ, ಅದಕ್ಕೆ ಸಂಬಂಧಿಸಿದ ಖಾತೆಗಳ ಪಟ್ಟಿಯನ್ನು, ಅತ್ಯಂತ ತುರ್ತಾದವು ಮೊದಲು, ಮಾಡುತ್ತದೆ.',
    privacy: 'ಇಮೇಲ್ ಫೈಲ್ ಎಲ್ಲಿಗೂ ಅಪ್‌ಲೋಡ್ ಆಗುವುದಿಲ್ಲ. ಎಲ್ಲವೂ ಈ ಸಾಧನದಲ್ಲೇ ನಡೆಯುತ್ತದೆ.',
    working: 'ನಿಮ್ಮ ಬ್ರೌಸರ್ ಈ ಪುಟವನ್ನು ಈ ಸಾಧನದಲ್ಲೇ ಅನುವಾದಿಸುತ್ತಿದೆ. ಮೊದಲ ಬಾರಿ ಕೆಲವು ನಿಮಿಷಗಳು ಬೇಕಾಗಬಹುದು.',
    done: 'ಈ ಪುಟವನ್ನು ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನಲ್ಲಿರುವ AI ಅನುವಾದಿಸಿದೆ. ಕೆಲವು ಪದಗಳು ತಪ್ಪಾಗಿರಬಹುದು; ಮೂಲ ಪುಟ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿದೆ.',
    unsupported: 'ಈ ಬ್ರೌಸರ್ ಪುಟವನ್ನು ಅನುವಾದಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ, ಆದ್ದರಿಂದ ಅದು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ. ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ Chrome ಇದನ್ನು ಅನುವಾದಿಸಬಲ್ಲದು.',
    unavailable: 'ಈ ಭಾಷೆ ಇನ್ನೂ ಈ ಸಾಧನದಲ್ಲಿ ಸಿದ್ಧವಾಗಿಲ್ಲ, ಆದ್ದರಿಂದ ಪುಟ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ.',
    failed: 'ಅನುವಾದ ನಿಂತುಹೋಯಿತು, ಆದ್ದರಿಂದ ಪುಟ ಮತ್ತೆ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿದೆ.',
    ok: 'ಸರಿ',
  },
  es: {
    about: 'Leave a Map lee en este dispositivo una copia de un buzón de correo y hace una lista de las cuentas vinculadas, empezando por las más urgentes.',
    privacy: 'El archivo de correo nunca se sube a ningún sitio. Todo ocurre en este dispositivo.',
    working: 'Tu navegador está traduciendo esta página en este dispositivo. La primera vez puede tardar unos minutos.',
    done: 'La IA integrada de tu navegador ha traducido esta página. Algunas palabras pueden no ser exactas; el original está en inglés.',
    unsupported: 'Este navegador no puede traducir la página, así que se queda en inglés. Chrome en un ordenador sí puede traducirla.',
    unavailable: 'Este idioma todavía no está listo en este dispositivo, así que la página se queda en inglés.',
    failed: 'La traducción se detuvo, así que la página vuelve a estar en inglés.',
    ok: 'Entendido',
  },
  fr: {
    about: 'Leave a Map lit sur cet appareil une copie d’une boîte mail et dresse la liste des comptes qui y sont liés, les plus urgents d’abord.',
    privacy: 'Le fichier des e-mails n’est jamais envoyé en ligne. Tout se passe sur cet appareil.',
    working: 'Votre navigateur traduit cette page sur cet appareil. La première fois, cela peut prendre quelques minutes.',
    done: 'Cette page a été traduite par l’IA intégrée à votre navigateur. Certains mots peuvent être inexacts ; l’original est en anglais.',
    unsupported: 'Ce navigateur ne peut pas traduire la page, elle reste donc en anglais. Chrome sur un ordinateur peut la traduire.',
    unavailable: 'Cette langue n’est pas encore prête sur cet appareil, la page reste donc en anglais.',
    failed: 'La traduction s’est arrêtée, la page est de nouveau en anglais.',
    ok: 'OK',
  },
  de: {
    about: 'Leave a Map liest auf diesem Gerät eine Kopie eines Postfachs und listet die damit verbundenen Konten auf, die dringendsten zuerst.',
    privacy: 'Die E-Mail-Datei wird nie hochgeladen. Alles passiert auf diesem Gerät.',
    working: 'Ihr Browser übersetzt diese Seite auf diesem Gerät. Beim ersten Mal kann das einige Minuten dauern.',
    done: 'Diese Seite wurde von der eingebauten KI Ihres Browsers übersetzt. Manche Wörter können ungenau sein; das Original ist auf Englisch.',
    unsupported: 'Dieser Browser kann die Seite nicht übersetzen, deshalb bleibt sie auf Englisch. Chrome auf einem Computer kann sie übersetzen.',
    unavailable: 'Diese Sprache ist auf diesem Gerät noch nicht bereit, deshalb bleibt die Seite auf Englisch.',
    failed: 'Die Übersetzung wurde abgebrochen, die Seite ist wieder auf Englisch.',
    ok: 'OK',
  },
  pt: {
    about: 'O Leave a Map lê neste dispositivo uma cópia de uma caixa de e-mail e lista as contas ligadas a ela, das mais urgentes para as menos.',
    privacy: 'O arquivo de e-mails nunca é enviado para a internet. Tudo acontece neste dispositivo.',
    working: 'Seu navegador está traduzindo esta página neste dispositivo. Na primeira vez, pode levar alguns minutos.',
    done: 'Esta página foi traduzida pela IA integrada do seu navegador. Algumas palavras podem estar imprecisas; o original está em inglês.',
    unsupported: 'Este navegador não consegue traduzir a página, então ela fica em inglês. O Chrome num computador consegue traduzi-la.',
    unavailable: 'Este idioma ainda não está pronto neste dispositivo, então a página fica em inglês.',
    failed: 'A tradução parou, então a página voltou ao inglês.',
    ok: 'Entendi',
  },
  zh: {
    about: 'Leave a Map 在这台设备上读取邮箱的副本，列出与它关联的账户，最紧急的排在最前面。',
    privacy: '邮件文件不会上传到任何地方，一切都在这台设备上完成。',
    working: '你的浏览器正在这台设备上翻译此页面。第一次可能需要几分钟。',
    done: '此页面由你浏览器内置的 AI 翻译。部分措辞可能不准确，原文为英文。',
    unsupported: '此浏览器无法翻译页面，因此页面保持英文。电脑上的 Chrome 可以翻译。',
    unavailable: '这台设备上还没有准备好这种语言，因此页面保持英文。',
    failed: '翻译已停止，页面已恢复为英文。',
    ok: '知道了',
  },
  ja: {
    about: 'Leave a Map は、このデバイス上でメールボックスのコピーを読み込み、関連するアカウントを緊急度の高い順に一覧にします。',
    privacy: 'メールのファイルがアップロードされることはありません。すべてこのデバイス上で行われます。',
    working: 'ブラウザがこのデバイス上でページを翻訳しています。初回は数分かかることがあります。',
    done: 'このページはブラウザに内蔵された AI が翻訳しました。不正確な表現があるかもしれません。原文は英語です。',
    unsupported: 'このブラウザはページを翻訳できないため、英語のまま表示します。パソコンの Chrome なら翻訳できます。',
    unavailable: 'この言語はまだこのデバイスで準備ができていないため、ページは英語のままです。',
    failed: '翻訳が中断されたため、ページは英語に戻りました。',
    ok: 'OK',
  },
};

/** The note for a language, falling back to English. */
export const noteWords = (code: string): NoteWords => NOTES[code] ?? NOTES.en;
