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
        name: '988 Suicide & Crisis Lifeline',
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
          'text “HOME” to: 741-741',
        ],
      },
      {
        name: 'The Trevor Project',
        lines: [
          '24/7 crisis intervention and suicide prevention specifically for LGBTQ+ youth',
          'https://www.thetrevorproject.org/',
          'call: 1-866-488-7386',
          'text “START” to: 678-678',
        ],
      },
      {
        name: 'Trans Lifeline',
        lines: [
          'Peer support for trans people, run by trans people (guaranteed no active rescue)',
          'https://translifeline.org/',
          'call: 1-877-565-8860',
        ],
      },
      {
        name: 'BlackLine',
        lines: [
          'Peer support and reporting for Black, Black LGBTQ+, and Brown folks',
          'https://www.callblackline.com/',
          'call: 1-800-604-5841',
        ],
      },
      {
        name: 'Veterans Crisis Line',
        lines: [
          'Confidential crisis support for veterans, service members, and their families',
          'https://www.veteranscrisisline.net/',
          'call: 988 (Press 1)',
          'text: 838255',
        ],
      },
      {
        name: 'National Domestic Violence Hotline',
        lines: [
          '24/7 confidential support for anyone experiencing domestic violence',
          'https://www.thehotline.org/',
          'call: 1-800-799-7233',
          'text “START” to: 88788',
        ],
      },
      {
        name: 'RAINN (National Sexual Assault Hotline)',
        lines: [
          'Confidential support connecting survivors with local service providers',
          'https://www.rainn.org/',
          'call: 1-800-656-4673',
        ],
      },
      {
        name: 'NEDA Helpline',
        lines: [
          'Support, resources, and treatment options for eating disorders',
          'https://www.nationaleatingdisorders.org/',
          'call or text: 1-800-931-2237',
        ],
      },
      {
        name: 'SAMHSA National Helpline',
        lines: [
          'Treatment referral and information service for substance use and mental health',
          'https://www.samhsa.gov/find-help/national-helpline',
          'call: 1-800-662-4357',
        ],
      },
      {
        name: 'Love is Respect',
        lines: [
          'Prevention and support for abusive dating relationships (teens/young adults)',
          'https://www.loveisrespect.org/',
          'call: 1-866-331-9474',
          'text “LOVEIS” to: 22522',
        ],
      },
      {
        name: 'Postpartum Support International',
        lines: [
          'Support for parents experiencing postpartum depression or anxiety',
          'https://www.postpartum.net/',
          'call or text: 1-800-944-4773',
        ],
      },
      {
        name: 'Childhelp National Child Abuse Hotline',
        lines: [
          'Crisis intervention for child abuse victims and reporters',
          'https://childhelphotline.org/',
          'call or text: 1-800-422-4453',
        ],
      },
      {
        name: 'StrongHearts Native Helpline',
        lines: [
          'Domestic and dating violence helpline specifically for Native Americans',
          'https://strongheartshelpline.org/',
          'call: 1-844-762-8483',
        ],
      },
      {
        name: 'Teen Line',
        lines: [
          'Teen-to-teen support monitored by professionals',
          'https://www.teenline.org/',
          'call: 1-800-852-8336',
          'text “TEEN” to: 839863',
        ],
      },
      {
        name: 'National Runaway Safeline',
        lines: [
          'Support for youth who have run away or are considering it',
          'https://www.1800runaway.org/',
          'call: 1-800-786-2929',
        ],
      },
      {
        name: 'National Human Trafficking Hotline',
        lines: [
          'Report trafficking or get help for victims',
          'https://humantraffickinghotline.org/',
          'call: 1-888-373-7888',
          'text: 233733',
        ],
      },
      {
        name: 'Poison Help Hotline',
        lines: [
          'Immediate medical advice for poisoning or overdose risks',
          'https://www.poison-help.com/',
          'call: 1-800-222-1222',
        ],
      },
      {
        name: 'Disaster Distress Helpline',
        lines: [
          'Counseling for distress related to natural or human-caused disasters',
          'https://www.samhsa.gov/find-help/disaster-distress-helpline',
          'call or text: 1-800-985-5990',
        ],
      },
      {
        name: 'DeafLEAD Crisis Support',
        lines: [
          'Crisis support specifically for the Deaf and Hard of Hearing community',
          'https://www.deaflead.com/',
          'video phone: 321-800-3323',
        ],
      },
    ],
  },
  {
    id: 'cbt',
    title: 'Guided Cognitive Behavioral Therapy (CBT)',
    entries: [
      {
        name: 'Therapist Aid',
        lines: [
          'Professional-grade CBT worksheets, videos, and guides',
          'https://www.therapistaid.com/',
        ],
      },
      {
        name: 'Centre for Clinical Interventions (CCI)',
        lines: [
          'Comprehensive, free workbook modules for anxiety, depression, and body image',
          'https://www.cci.health.wa.gov.au/',
        ],
      },
      {
        name: 'Think CBT',
        lines: [
          'Massive library of direct PDF downloads for CBT exercises',
          'https://thinkcbt.com/',
        ],
      },
      {
        name: 'Woebot',
        lines: [
          'AI chatbot that uses CBT principles to talk you through stress',
          'https://woebothealth.com/',
        ],
      },
      {
        name: 'PTSD Coach (VA App)',
        lines: [
          'Trauma management tools created by the VA (available to civilians)',
          'https://mobile.va.gov/app/ptsd-coach',
        ],
      },
      {
        name: 'DBT Self Help',
        lines: [
          'Dialectical Behavior Therapy skills and resources for emotional regulation',
          'https://dbtselfhelp.com/',
        ],
      },
      {
        name: 'Sidran Institute',
        lines: [
          'Educational resources for Trauma and Dissociative Disorders',
          'https://www.sidran.org/',
        ],
      },
    ],
  },
  {
    id: 'mood',
    title: 'Mood Trackers and Mindfulness Tools',
    entries: [
      {
        name: 'Insight Timer',
        lines: [
          'Largest library of free guided meditations (100k+)',
          'https://insighttimer.com/',
        ],
      },
      {
        name: 'Smiling Mind',
        lines: [
          'Mindfulness programs developed by psychologists (non-profit)',
          'https://www.smilingmind.com.au/',
        ],
      },
      {
        name: 'UCLA Guided Meditations',
        lines: [
          'High-quality audio meditations without needing an app',
          'https://www.uclahealth.org/programs/marc/free-guided-meditations/guided-meditations',
        ],
      },
      {
        name: 'Mindfulness Coach',
        lines: [
          'App for learning mindfulness basics, created by the VA',
          'https://mobile.va.gov/app/mindfulness-coach',
        ],
      },
      {
        name: 'Finch',
        lines: [
          'Gamified self-care where you care for a virtual pet by caring for yourself',
          'https://finchcare.com/',
        ],
      },
      {
        name: 'Wysa',
        lines: [
          'AI chat for anxiety and mood tracking',
          'https://www.wysa.com/',
        ],
      },
      {
        name: 'Bearable',
        lines: [
          'Data-heavy mood and symptom tracking app',
          'https://bearable.app/',
        ],
      },
      {
        name: 'Daylio',
        lines: [
          'Micro-journaling and mood tracking without typing',
          'https://daylio.net/',
        ],
      },
      {
        name: 'How We Feel',
        lines: [
          'High-design emotion tracking created by researchers',
          'https://howwefeel.org/',
        ],
      },
      {
        name: 'Earkick',
        lines: [
          'Anxiety tracker that measures mental health via voice analysis and heart rate',
          'https://earkick.com/',
        ],
      },
      {
        name: 'CBT-i Coach',
        lines: [
          'Cognitive Behavioral Therapy for Insomnia (sleep issues)',
          'https://mobile.va.gov/app/cbt-i-coach',
        ],
      },
    ],
  },
  {
    id: 'groups',
    title: 'Support Groups',
    entries: [
      {
        name: 'NAMI (National Alliance on Mental Illness)',
        lines: [
          'Support for general mental health conditions (NAMI Connection)',
          'https://www.nami.org/',
        ],
      },
      {
        name: 'DBSA (Depression and Bipolar Support Alliance)',
        lines: [
          'Support for mood disorders (Depression/Bipolar)',
          'https://www.dbsalliance.org/',
        ],
      },
      {
        name: 'Hearing Voices Network (USA)',
        lines: [
          'Support and community for those who hear voices or have similar experiences',
          'https://www.hearingvoicesusa.org/',
        ],
      },
      {
        name: '7 Cups',
        lines: [
          'General listening service (chat rooms and 1-on-1)',
          'https://www.7cups.com/',
        ],
      },
      {
        name: 'SMART Recovery',
        lines: [
          'Science-based, non-12-step addiction recovery',
          'https://www.smartrecovery.org/',
        ],
      },
      {
        name: 'Alcoholics Anonymous (AA)',
        lines: ['12-step support for alcohol addiction', 'https://www.aa.org/'],
      },
      {
        name: 'Narcotics Anonymous (NA)',
        lines: ['12-step support for drug addiction', 'https://www.na.org/'],
      },
      {
        name: 'Al-Anon Family Groups',
        lines: [
          'Support for families and friends of alcoholics',
          'https://al-anon.org/',
        ],
      },
      {
        name: 'ADAA',
        lines: [
          'Directories for anxiety and depression support groups',
          'https://adaa.org/',
        ],
      },
      {
        name: 'IOCDF (International OCD Foundation)',
        lines: [
          'Support and resources for Obsessive-Compulsive Disorder',
          'https://iocdf.org/',
        ],
      },
      {
        name: 'GriefShare',
        lines: [
          'Grief and bereavement support (often religiously affiliated)',
          'https://www.griefshare.org/',
        ],
      },
      {
        name: 'The Dinner Party',
        lines: [
          'Peer-led grief support for 20- and 30-somethings',
          'https://www.thedinnerparty.org/',
        ],
      },
      {
        name: 'PFLAG',
        lines: [
          'Support for LGBTQ+ people, parents, families, and allies',
          'https://pflag.org/',
        ],
      },
      {
        name: 'MaleSurvivor',
        lines: [
          'Men seeking healing from sexual violence',
          'https://malesurvivor.org/',
        ],
      },
      {
        name: 'CODA (Co-Dependents Anonymous)',
        lines: [
          'Support for developing healthy relationships',
          'https://coda.org/',
        ],
      },
      {
        name: 'Gamblers Anonymous',
        lines: [
          'Support for gambling addiction',
          'https://www.gamblersanonymous.org/',
        ],
      },
      {
        name: 'Eating Disorders Anonymous (EDA)',
        lines: [
          'Eating disorder recovery focused on balance',
          'https://eatingdisordersanonymous.org/',
        ],
      },
      {
        name: 'Adult Children of Alcoholics (ACA)',
        lines: [
          'Support for adults who grew up in dysfunction or addiction',
          'https://adultchildren.org/',
        ],
      },
      {
        name: 'Emotions Anonymous',
        lines: [
          'Emotional well-being support (12-step based)',
          'https://emotionsanonymous.org/',
        ],
      },
      {
        name: 'BEAM',
        lines: [
          'Black Emotional & Mental Health Collective community resources',
          'https://www.beam.community/',
        ],
      },
      {
        name: 'ULifeline',
        lines: [
          'Mental health resources specifically for college students',
          'https://www.ulifeline.org/',
        ],
      },
    ],
  },
];
