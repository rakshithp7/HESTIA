export type ResourceEntry = {
  name: string;
  lines: string[];
};

export type ResourceSection = {
  id: string;
  title: string;
  entries: ResourceEntry[];
};

export const SECTIONS: ResourceSection[] = [
  {
    id: 'hotlines',
    title: 'Crisis and Emergency Support Hotlines',
    entries: [
      {
        name: '988 Suicide and Crisis Lifeline',
        lines: [
          '24/7 service to call, text, or chat with a counselor for immediate support',
          'https://988lifeline.org/',
          'call or text: 988',
        ],
      },
      {
        name: 'Crisis Text Line',
        lines: [
          '24/7 service to text with a trained volunteer crisis counselor',
          'https://www.crisistextline.org/',
          'text “HOME” or “HOLA” to: 741-741',
        ],
      },
      {
        name: 'The Trevor Project',
        lines: [
          '24/7 service offering emergency support services for LGBTQIA+ youth',
          'https://www.thetrevorproject.org/',
          'call: 1-866-488-7386',
          'text “START” to: 678-678',
        ],
      },
    ],
  },
  {
    id: 'cbt',
    title: 'Guided Cognitive Behavioral Therapy (CBT)',
    entries: [
      {
        name: 'TherapistAid',
        lines: [
          'Research-informed catalog of CBT worksheets, interactive tools, and educational resources created by mental health professionals and organized by topic',
          'https://www.therapistaid.com/',
        ],
      },
      {
        name: 'Moodgym',
        lines: [
          'Interactive and accredited self-help program to prevent and manage symptoms of anxiety and depression using CBT methods, developed by researchers at the Australian National University',
          'https://www.moodgym.com.au/',
        ],
      },
    ],
  },
  { id: 'mood', title: 'Mood Trackers and Mindfulness Tools', entries: [] },
  { id: 'groups', title: 'Support Groups', entries: [] },
];
