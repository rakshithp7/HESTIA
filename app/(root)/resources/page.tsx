'use client';

import { Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type ResourceEntry = { name: string; lines: string[] };
type ResourceSection = { id: string; title: string; entries: ResourceEntry[] };

const SECTIONS: ResourceSection[] = [
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

export default function ResourcesPage() {
  const [selectedId, setSelectedId] = useState<string>('hotlines');
  const [query, setQuery] = useState('');

  const filteredSections = useMemo<ResourceSection[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((section) => {
      const titleMatches = section.title.toLowerCase().includes(q);
      const entries = titleMatches
        ? section.entries // Include all entries if title matches
        : section.entries.filter((e) => [e.name, ...e.lines].some((t) => t.toLowerCase().includes(q)));
      return { ...section, entries };
    }).filter((section) => {
      // Keep section if title matches OR if it has matching entries
      const titleMatches = section.title.toLowerCase().includes(q);
      return titleMatches || section.entries.length > 0;
    });
  }, [query]);

  const selectedSection = useMemo<ResourceSection | undefined>(() => {
    return filteredSections.find((s) => s.id === selectedId) ?? SECTIONS.find((s) => s.id === selectedId);
  }, [filteredSections, selectedId]);

  return (
    <div className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl md:text-4xl mb-4">Resources</h1>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search..."
              aria-label="Search resources"
              className="w-32 md:w-64 rounded-xl border border-border bg-input pl-9 pr-3 py-1 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:grid md:grid-cols-3 gap-8">
          <aside className="md:top-24 self-start">
            <ul className="space-y-3" role="list">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    aria-current={selectedId === s.id ? 'true' : undefined}
                    className={`text-left inline-block hover:underline underline-offset-4 ${
                      selectedId === s.id ? 'text-primary underline' : ''
                    }`}>
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="md:col-span-2 space-y-8 pr-2">
            {selectedSection && (
              <div>
                <h2 className="text-xl md:text-2xl mb-2">{selectedSection.title}</h2>
                <div className="space-y-4">
                  {selectedSection.entries.length === 0 ? (
                    <p className="text-sm">Coming soon.</p>
                  ) : (
                    selectedSection.entries.map((e) => (
                      <div key={e.name}>
                        <h3 className="text-lg font-semibold">{e.name}</h3>
                        {e.lines.map((line, i) => (
                          <p key={i} className="text-sm">
                            {line}
                          </p>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Mobile Layout - Accordion */}
        <div className="md:hidden">
          {filteredSections.length === 0 && query.trim() ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No resources found matching &quot;{query}&quot;</p>
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              className="w-full"
              defaultValue={query.trim() && filteredSections.length > 0 ? filteredSections[0].id : undefined}>
              {filteredSections.map((section) => (
                <AccordionItem key={section.id} value={section.id}>
                  <AccordionTrigger className="text-left">
                    <span className="text-lg font-medium">{section.title}</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {section.entries.length === 0 ? (
                        <p className="text-sm">Coming soon.</p>
                      ) : (
                        section.entries.map((e) => (
                          <div key={e.name} className="space-y-2">
                            <h3 className="text-base font-semibold">{e.name}</h3>
                            {e.lines.map((line, i) => (
                              <p key={i} className="text-sm leading-relaxed">
                                {line}
                              </p>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </div>
    </div>
  );
}
