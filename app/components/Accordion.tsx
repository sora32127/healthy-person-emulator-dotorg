import { useState } from "react";

export function Accordion({ children }: { children: React.ReactNode }) {
  return <div className="join join-vertical w-full">{children}</div>;
}

export function AccordionItem({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`collapse collapse-arrow join-item border border-base-300 ${isOpen ? "collapse-open" : "collapse-close"}`}>
      <input 
        type="checkbox" 
        checked={isOpen} 
        onChange={() => setIsOpen(!isOpen)}
        className="peer"
      /> 
    　<div className="collapse-title text-lg font-medium">
        {title}
      </div>
      <div className="collapse-content"> 
        {children}
      </div>
    </div>
  );
}