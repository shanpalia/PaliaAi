export type PaliaIntent =
  | 'chat'
  | 'image_edit'
  | 'image_generate'
  | 'web_search';

const searchPatterns = [
  /\b(latest|today|current|now|news|weather|price|stock|score|schedule|update|recent|live)\b/i,
  /\b(आज|अभी|ताज़ा|ताजा|लेटेस्ट|न्यूज़|समाचार|मौसम|कीमत|भाव|स्कोर|शेड्यूल|अपडेट)\b/i,
  /\b(search|google|web search|internet|online)\b/i,
];

const editPatterns = [
  /\b(edit|enhance|improve|unblur|sharpen|restore|retouch|upscale|remove background|change background|background change|background white|white background|white kar|kar de|badal do|badalna|fix|clean|clear|hd|high quality|quality improve|photo saaf|image saaf|blur hata|blur remove)\b/i,
  /(धुंधला|साफ|क्वालिटी|एडिट|एन्हांस|एचडी|बैकग्राउंड|रिस्टोर|शार्प|उपस्केल)/i,
];

const generatePatterns = [
  /\b(generate|create|make|draw|design|render|image banao|photo banao|tasveer banao|picture banao|image bana|photo bana)\b/i,
  /(तस्वीर बनाओ|फोटो बनाओ|इमेज बनाओ|पोस्टर बनाओ|लोगो बनाओ|चित्र बनाओ)/i,
];

export function detectPaliaIntent(
  message: string,
  hasImage: boolean,
  explicitSearch = false,
): PaliaIntent {
  const text = (message || '').trim();

  // When a photo is attached, treat edit instructions as image edits instead of
  // sending them to chat/document handling. Keep genuine questions conversational.
  const asksAboutImage = /\\b(what is this|who is this|describe|explain this image|what can you see|identify|is this|ye kya hai|ye kaun|kya dikh raha|tasveer mein kya|image mein kya|photo mein kya)\\b/i.test(text);
  if (hasImage && !asksAboutImage && editPatterns.some((p) => p.test(text))) {
    return 'image_edit';
  }

  if (!hasImage && generatePatterns.some((p) => p.test(text))) {
    return 'image_generate';
  }

  if (explicitSearch || searchPatterns.some((p) => p.test(text))) {
    return 'web_search';
  }

  return 'chat';
}

export function shouldAutoSearch(message: string): boolean {
  const text = (message || '').trim();
  return searchPatterns.some((p) => p.test(text));
}
