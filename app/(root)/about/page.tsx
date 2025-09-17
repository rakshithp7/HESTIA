'use client';
import React, { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type FAQItem = {
  id: 'how' | 'who' | 'why';
  question: string;
  content: React.ReactNode;
};

const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'how',
    question: 'How does Hestia Work?',
    content: (
      <div>
        <h4 className="text-2xl md:text-3xl mb-2">How Does Hestia Work?</h4>
        <ul className="list-disc pl-6 space-y-2 text-lg">
          <li>Age Matching</li>
          <li>Conversation Topic Matching</li>
          <li>Anonymity</li>
          <li>Text-based versus Voice-based Chat</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'who',
    question: 'Who is Hestia for?',
    content: (
      <div>
        <h4 className="text-2xl md:text-3xl mb-2">Who is Hestia for?</h4>
        <p className="text-lg leading-relaxed">
          Hestia is for anyone seeking a safe, anonymous space to connect with others by age group and shared interests.
          Whether you want to talk, listen, or simply feel less alone, you are welcome here.
        </p>
      </div>
    ),
  },
  {
    id: 'why',
    question: 'Why Hestia?',
    content: (
      <div>
        <h4 className="text-2xl md:text-3xl mb-2">Why Hestia?</h4>
        <p className="text-lg leading-relaxed">
          Because compassionate, judgment-free conversations matter. Hestia prioritizes privacy, simplicity, and
          meaningful human connection without pressure, costs, or complexities.
        </p>
      </div>
    ),
  },
];

export default function AboutPage() {
  const [selectedFaq, setSelectedFaq] = useState<'how' | 'who' | 'why'>('how');
  return (
    <div>
      {/* Hero section */}
      <section className="bg-primary/70 text-primary-foreground px-6 py-10 md:px-12">
        <div className="max-w-7xl mx-auto">
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
        <div className="max-w-7xl mx-auto">
          <h3 className="text-3xl mb-4">Frequently Asked Questions (FAQs)</h3>

          {/* Desktop Layout */}
          <div className="hidden md:grid md:grid-cols-3 gap-8">
            <div>
              <ul className="space-y-3 text-lg">
                {FAQ_ITEMS.map((faq) => (
                  <li key={faq.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedFaq(faq.id)}
                      className={`text-left underline-offset-4 hover:underline outline-none ${
                        selectedFaq === faq.id ? 'text-primary underline' : ''
                      }`}>
                      {faq.question}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-2">
              <div className="space-y-6">{FAQ_ITEMS.find((faq) => faq.id === selectedFaq)?.content}</div>
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
                    <div className="pt-2">{faq.content}</div>
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
