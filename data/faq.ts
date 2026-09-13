export type FAQItemId = 'how' | 'who' | 'why' | 'origin';

export type FAQItem = {
  id: FAQItemId;
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  subSections?: {
    title: string;
    content: string;
    /** Optional trailing link, rendered after the content. */
    link?: { label: string; href: string };
  }[];
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
  {
    id: 'origin',
    heading: 'Where Hestia came from',
    paragraphs: [
      'Mental health is talked about far more openly than it used to be, but the tools meant to help can still feel hard to approach. Crisis lines do essential work, though reaching one can feel clinical, distant, or higher-stakes than what someone is going through. Wellness apps often feel impersonal. Both tend to treat every person the same way, and in a hard moment people are willing to ask for help — they just don’t want it to feel scripted.',
      'That gap is where Hestia started. Early research into existing chat apps, alongside conversations with people who had used hotlines and support platforms, turned up something uncomfortable: the tools were convenient and available, yet often left people feeling more isolated rather than less. A one-size-fits-all structure made it difficult to feel genuinely heard.',
      'The name comes from Hestia, the Greek goddess of the hearth and the home — the idea of a safe place to sit for a while. The format takes its cue from the open-ended, talk-to-a-stranger quality of early internet chat, but rebuilt around verified age groups and shared topics, so the person on the other side is closer to where you actually are.',
    ],
    subSections: [
      {
        title: 'What we set out to do',
        content:
          'Offer support that bends to the person rather than the other way round; make room for empathy and relatability by putting people with peers rather than scripts; and strip out enough anxiety and friction that reaching out feels like a small step instead of a big one.',
      },
      {
        title: 'Credit',
        content:
          'Hestia began as a three-week independent product design project by Diya Sharma, covering the concept, user research, interaction design, visual system, and accessibility decisions, built out in collaboration with a developer.',
        link: {
          label: 'Read the full case study',
          href: 'https://disharma.com/case-studies',
        },
      },
    ],
  },
];
