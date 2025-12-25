'use client';
import React, { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import type { FAQItem, FAQItemId } from '@/data/faq';
import { FAQ_ITEMS } from '@/data/faq';

function FaqContent({ faq }: { faq: FAQItem }) {
  return (
    <div className="space-y-8">
      <h4 className="text-2xl md:text-3xl mb-2">{faq.heading}</h4>
      {faq.paragraphs?.map((text, index) => (
        <p key={index} className="text-lg leading-relaxed">
          {text}
        </p>
      ))}
      {faq.subSections?.map((section, index) => (
        <div key={index} className="space-y-1">
          <h5 className="text-xl font-semibold">{section.title}</h5>
          <p className="text-lg leading-relaxed">{section.content}</p>
        </div>
      ))}
      {faq.bullets && (
        <ul className="list-disc pl-6 space-y-2 text-lg">
          {faq.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AboutPage() {
  const [selectedFaq, setSelectedFaq] = useState<FAQItemId>('how');
  const activeFaq = FAQ_ITEMS.find((faq) => faq.id === selectedFaq);
  return (
    <div>
      {/* Hero section */}
      <section className="bg-primary/70 text-primary-foreground px-6 py-10 md:px-12">
        <div className="max-w-8xl mx-auto">
          <h2 className="text-4xl md:text-5xl mb-4">What is Hestia?</h2>
          <p className="text-lg md:text-xl leading-relaxed">
            Hestia is a completely free and anonymous chat service that allows you to talk to another community member
            in your age group based on your choice of topic. Our aim is to provide a judgement-free space founded on
            human connection, understanding, and unity.
          </p>
        </div>
      </section>

      {/* FAQ section */}
      <section className="px-6 py-8 md:px-12">
        <div className="max-w-8xl mx-auto">
          <h3 className="text-3xl mb-4">Frequently Asked Questions (FAQs)</h3>

          {/* Desktop Layout */}
          <div className="hidden md:grid md:grid-cols-3 gap-8">
            <div>
              <ul className="space-y-3 text-lg">
                {FAQ_ITEMS.map((faq) => (
                  <li key={faq.id}>
                    <Button
                      variant="link"
                      type="button"
                      onClick={() => setSelectedFaq(faq.id)}
                      className={`text-left justify-start px-0 h-auto underline-offset-4 hover:underline outline-none ${selectedFaq === faq.id ? 'text-primary underline' : ''
                        }`}>
                      {faq.question}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-2">
              <div className="space-y-6">{activeFaq && <FaqContent faq={activeFaq} />}</div>
            </div>
          </div>

          {/* Mobile Layout - Accordion */}
          <div className="md:hidden">
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left">
                    <span className="text-lg font-medium">{faq.question}</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2">
                      <FaqContent faq={faq} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
    </div>
  );
}
