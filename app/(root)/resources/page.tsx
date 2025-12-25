'use client';

import { Search } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ResourceSection } from '@/data/resources';
import { SECTIONS } from '@/data/resources';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  const parts = text.split(regex);
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="rounded-sm bg-yellow-200 px-1 text-inherit dark:bg-yellow-500/60">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function SectionDetails({ section, highlightQuery }: { section: ResourceSection; highlightQuery: string }) {
  return (
    <div>
      <h2 className="text-xl md:text-2xl mb-2">{highlightText(section.title, highlightQuery)}</h2>
      <div className="space-y-4">
        {section.entries.length === 0 ? (
          <p className="text-sm">Coming soon.</p>
        ) : (
          section.entries.map((entry) => (
            <div key={entry.name}>
              <h3 className="text-lg font-semibold">{highlightText(entry.name, highlightQuery)}</h3>
              {entry.lines.map((line, index) => (
                <p key={index} className="text-sm">
                  {highlightText(line, highlightQuery)}
                </p>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ResourcesPage() {
  const [selectedId, setSelectedId] = useState<string>('hotlines');
  const [query, setQuery] = useState('');
  const [accordionValue, setAccordionValue] = useState<string | undefined>('hotlines');

  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const queryActive = normalizedQuery.length > 0;
  const highlightQuery = queryActive ? trimmedQuery : '';

  const filteredSections = useMemo<ResourceSection[]>(() => {
    if (!queryActive) return SECTIONS;
    return SECTIONS.map((section) => {
      const titleMatches = section.title.toLowerCase().includes(normalizedQuery);
      const entries = titleMatches
        ? section.entries // Include all entries if title matches
        : section.entries.filter((entry) =>
          [entry.name, ...entry.lines].some((text) => text.toLowerCase().includes(normalizedQuery))
        );
      return { ...section, entries };
    }).filter((section) => {
      // Keep section if title matches OR if it has matching entries
      const titleMatches = section.title.toLowerCase().includes(normalizedQuery);
      return titleMatches || section.entries.length > 0;
    });
  }, [normalizedQuery, queryActive]);

  const selectedSection = useMemo<ResourceSection | undefined>(() => {
    if (queryActive) return undefined;
    return (
      filteredSections.find((section) => section.id === selectedId) ??
      SECTIONS.find((section) => section.id === selectedId)
    );
  }, [filteredSections, queryActive, selectedId]);

  useEffect(() => {
    if (queryActive) {
      setAccordionValue(filteredSections[0]?.id);
    } else {
      setAccordionValue(selectedId);
    }
  }, [filteredSections, queryActive, selectedId]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
  };

  return (
    <div className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-8xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl md:text-4xl mb-4">Resources</h1>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="search..."
              aria-label="Search resources"
              className="w-32 md:w-64 pl-9 pr-10 text-base h-10"
            />
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex gap-8 h-[calc(100vh-14rem)]">
          <aside className="md:top-24 self-start w-1/4">
            <ul className="space-y-3" role="list">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setSelectedId(s.id)}
                    aria-current={selectedId === s.id && !queryActive ? 'true' : undefined}
                    disabled={queryActive}
                    className={`text-left justify-start px-0 h-auto whitespace-normal hover:underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-70 ${selectedId === s.id && !queryActive ? 'text-primary underline' : ''
                      }`}>
                    {s.title}
                  </Button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="flex-1 space-y-8 pr-2 h-full overflow-y-auto scrollbar-thin">
            {queryActive ? (
              filteredSections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No resources found matching &quot;{trimmedQuery}&quot;.
                </p>
              ) : (
                filteredSections.map((section) => (
                  <SectionDetails key={section.id} section={section} highlightQuery={highlightQuery} />
                ))
              )
            ) : (
              selectedSection && <SectionDetails section={selectedSection} highlightQuery={highlightQuery} />
            )}
          </section>
        </div>

        {/* Mobile Layout - Accordion */}
        <div className="md:hidden">
          {filteredSections.length === 0 && queryActive ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No resources found matching &quot;{trimmedQuery}&quot;</p>
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              className="w-full"
              value={accordionValue}
              onValueChange={(value) => {
                setAccordionValue(value);
                if (value) {
                  setSelectedId(value);
                }
              }}>
              {filteredSections.map((section) => (
                <AccordionItem key={section.id} value={section.id}>
                  <AccordionTrigger className="text-left">
                    <span className="text-lg font-medium">{highlightText(section.title, highlightQuery)}</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {section.entries.length === 0 ? (
                        <p className="text-sm">Coming soon.</p>
                      ) : (
                        section.entries.map((e) => (
                          <div key={e.name} className="space-y-2">
                            <h3 className="text-base font-semibold">{highlightText(e.name, highlightQuery)}</h3>
                            {e.lines.map((line, i) => (
                              <p key={i} className="text-sm leading-relaxed">
                                {highlightText(line, highlightQuery)}
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
