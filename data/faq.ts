export type FAQItemId = 'how' | 'who' | 'why';

export type FAQItem = {
  id: FAQItemId;
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  subSections?: { title: string; content: string }[];
};

export const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'how',
    heading: 'How Does Hestia Work?',
    subSections: [
      {
        title: 'Age Matching',
        content:
          'To create meaningful connections, Hestia verifies each user’s age through ID confirmation. This allows us to match you with community members in a similar age group, helping conversations feel more relatable and comfortable. ID verification is used only to confirm age and is not stored or shared.',
      },
      {
        title: 'Conversation Topic Matching',
        content:
          'Hestia pairs you with someone who selected a conversation topic similar to yours. By matching users based on shared topics, we help ensure you’re talking with someone who understands what you’re going through and wants to discuss the same things.',
      },
      {
        title: 'Anonymity',
        content:
          'All conversations on Hestia are completely anonymous. This allows members to speak openly and connect without fear of judgment, bias, or discrimination.',
      },
      {
        title: 'Text-Based vs. Voice-Based Chat',
        content:
          'Hestia gives you the choice between text-based chat or voice chat. This flexibility lets you communicate in the way that feels most comfortable and accessible for you.',
      },
    ],
  },
  {
    id: 'who',
    heading: 'Who is Hestia for?',
    paragraphs: [
      'Hestia is for anyone seeking a safe, anonymous space to connect with others through shared age groups and topics of interest. Whether you want to talk, listen, or simply feel less alone, you’re welcome here.',
      '*Important Note: Hestia is not a crisis or emergency service. If you are in immediate danger or distress, please seek professional or emergency support. You can visit our Resources page for some helpful links.',
    ],
  },
  {
    id: 'why',
    heading: 'Why Hestia?',
    paragraphs: [
      'Because compassionate, judgment-free conversations matter. Hestia prioritizes privacy, simplicity, and meaningful human connection without pressure, costs, or complexity.',
    ],
  },
];
