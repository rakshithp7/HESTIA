export type FAQItemId = 'how' | 'who' | 'why';

export type FAQItem = {
  id: FAQItemId;
  question: string;
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'how',
    question: 'How does Hestia Work?',
    heading: 'How Does Hestia Work?',
    bullets: ['Age Matching', 'Conversation Topic Matching', 'Anonymity', 'Text-based versus Voice-based Chat'],
  },
  {
    id: 'who',
    question: 'Who is Hestia for?',
    heading: 'Who is Hestia for?',
    paragraphs: [
      'Hestia is for anyone seeking a safe, anonymous space to connect with others by age group and shared interests. Whether you want to talk, listen, or simply feel less alone, you are welcome here.',
    ],
  },
  {
    id: 'why',
    question: 'Why Hestia?',
    heading: 'Why Hestia?',
    paragraphs: [
      'Because compassionate, judgment-free conversations matter. Hestia prioritizes privacy, simplicity, and meaningful human connection without pressure, costs, or complexities.',
    ],
  },
];
