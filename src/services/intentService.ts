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
  /\b(edit|enhance|improve|unblur|sharpen|restore|retouch|upscale|remove background|change background|fix|clean|clear|hd|high quality|quality improve|photo saaf|image saaf|blur hata|blur remove)\b/i,
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

  if (hasImage && editPatterns.some((p) => p.test(text))) {
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
