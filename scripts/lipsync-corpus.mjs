/**
 * Lip-sync evaluation corpus (Phase 17, plan 17-01).
 *
 * Single source of truth for:
 *  - scripts/build-dict-en.mjs   -> measures the hit-rate of the pruned EN lexicon,
 *  - tests/g2p-en.test.ts        -> corpus hit-rate gate,
 *  - tests/lipsync-corpus.test.ts (17-03) -> golden-span fixtures.
 *
 * IMPORTANT (honesty rule): the corpus is NEVER fed into the lexicon selection. The pruning
 * script ranks words by an independent frequency list, so the hit-rate reported here is a
 * real measurement and not a tautology. Numbers are written out as words because ElevenLabs
 * normalizes digits before it sends the character alignment ("3D" arrives as "three D").
 */

/** (a) The 7 control sentences from docs/en-visemes.md section 6, verbatim. */
export const CONTROL_SENTENCES = [
  'Map, mop, pop — fine, five, very — wine, white',
  'see, she — sip, ship — so, show',
  'bed, bad, bayed, bid, bead',
  'caught, coat, coot, could, cow',
  'her, red, are, ear',
  'think, this, three, they',
  'my, boy, how, go, day',
];

/** (b) Conversational agent paragraphs: small talk, help, explanations, apologies, questions. */
export const CONVERSATIONAL_PARAGRAPHS = [
  "Hello there, it's really nice to meet you. I'm your virtual assistant, and I'm here to help with whatever you need today. You can ask me a question, tell me about your day, or just talk for a while.",
  "I'm sorry about that, I didn't quite catch what you said. Could you please repeat it a little slower? The room sounds a bit noisy, so it might help if you moved closer to the microphone.",
  "Let me explain how this works. First you choose a voice, then you start the conversation, and I answer in real time. If you interrupt me, I stop talking right away and listen to you instead.",
  "That sounds like a wonderful weekend. Did you manage to visit your family, or did the weather ruin your plans? Honestly, I think a long walk by the river is the best way to relax after a busy week.",
  "Before we begin, I would like to ask you a few questions about your project. What are you trying to build, who is going to use it, and when do you need it to be finished?",
  "Of course, I can help you with that. The easiest solution is to restart the program, wait for a minute, and then try again. If the problem comes back, send me the error message and we will look at it together.",
  "Yesterday I read an interesting story about a small village in the mountains. The people there grow their own food, build their own houses, and share everything they have with their neighbors. It made me think about how simple life can be.",
  "Thank you very much for your patience. I know that waiting is never pleasant, especially when you are in a hurry. Your request has been received, and someone from the team will contact you before the end of the day.",
  "If you are looking for something to cook tonight, I would suggest a simple pasta with tomatoes, garlic, and fresh basil. It takes about twenty minutes, and almost everybody likes it. Do you want me to read the recipe step by step?",
  "Good morning! I hope you slept well. The forecast says it will be cloudy until noon, with a chance of rain in the afternoon, so you might want to take an umbrella with you when you leave the house.",
  "Learning a new language takes time, but it gets easier every week. Try to listen to music, watch films, and talk to native speakers as often as possible. Mistakes are completely normal, and they are the fastest way to improve.",
  "I understand that this is frustrating. Let's take a deep breath and go through it one thing at a time. First, tell me what you expected to happen, and then tell me what actually happened instead.",
  "The meeting is scheduled for tomorrow at ten, and the whole team will be there. Please bring your notes, your questions, and any ideas you have for the next quarter. We will also talk about the budget and the new office.",
  "My favorite kind of music is jazz, although I enjoy almost anything with a good melody. There is something special about a quiet piano in the evening, when the city is calm and the lights are low.",
  "Unfortunately, I cannot browse the internet right now, so I might not know the latest news. However, I am happy to share what I know, and you can always check the details yourself on a reliable website.",
  "Your appointment is confirmed. The doctor will see you on Thursday afternoon, and you should arrive about fifteen minutes early to fill out some forms. Remember to bring your insurance card and a list of your medicines.",
  "That is a great question. Honestly, there is no single right answer, because it depends on what matters most to you. Some people prefer speed, others prefer comfort, and a few just want the cheapest option.",
  "When I was asked to describe the perfect holiday, I imagined a quiet beach, a good book, and absolutely nothing to do. After a few days of that, though, I would probably want to explore the town and try the local food.",
  "Please turn left at the next corner, walk past the bakery, and you will see the station on your right. The trains run every ten minutes, but they get crowded around five, so try to leave a little earlier if you can.",
  "I really appreciate your feedback. It helps me understand what works well and what needs to be better. If you have any suggestions about my voice, my answers, or the way I look, please do not hesitate to say so.",
  "Sometimes the best thing you can do is to stop for a moment and think. Write down your goals, choose the most important one, and take the first small step today. Big changes rarely happen overnight, but they always start somewhere.",
  "The match last night was incredible. Our team was losing until the final minutes, and then they scored twice and won the game. People in the stadium were shouting, laughing, and hugging complete strangers.",
  "Would you like to hear a joke? A man walks into a library and asks for a book about the history of time. The librarian looks at him and says, sorry, that one is always out of date.",
  "I can see that you are tired, so let's keep this short. Tonight, drink some water, turn off your phone, and get a full night of sleep. Tomorrow everything will look much clearer, and we can continue from where we stopped.",
  "To recap, we talked about your schedule, your goals for the summer, and the books you want to read. I will remind you about each of them next week, and meanwhile you can message me whenever you have a new idea.",
];

/** (c) Out-of-vocabulary territory: technical loanwords and rare words (for the rules, not the gate). */
export const OOV_SENTENCES = [
  'The metadata describes each grapheme and every viseme on the timeline.',
  'Quantization of the latent embeddings keeps the shader pipeline stable.',
  'A bespoke blendshape rig drives the jaw, the lips, and the tongue.',
  'The automation of the iteration loop reduces the frustration of the team.',
  'My dear friend Wednesday is a lovely island with an old castle and a quiet harbour.',
  'Listen carefully, the receipt says the subtle whistle came from the hour hand.',
];

const ALL_SENTENCES = [...CONTROL_SENTENCES, ...CONVERSATIONAL_PARAGRAPHS, ...OOV_SENTENCES];

/** Lowercased word tokens of a text (letters, inner apostrophes and hyphens kept). */
export function tokenize(text) {
  return (text.toLowerCase().match(/[a-z]+(?:['’-][a-z]+)*/g) ?? []);
}

/** Every sentence of the corpus (control + conversational + OOV-territory). */
export const CORPUS_SENTENCES = ALL_SENTENCES;

/** All lowercased word tokens (with repetitions). */
export const CORPUS_TOKENS = ALL_SENTENCES.flatMap(tokenize);

/**
 * Tokens that count toward the lexicon hit-rate gate: control + conversational text.
 * The OOV-territory sentences are excluded on purpose: they exist to exercise the
 * letter-to-sound rules, so counting them would punish the lexicon for misses we want.
 */
export const GATE_TOKENS = [...CONTROL_SENTENCES, ...CONVERSATIONAL_PARAGRAPHS].flatMap(tokenize);
