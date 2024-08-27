interface AccordionProps {
  children: React.ReactNode;
}

export function Accordion({ children }: AccordionProps) {
  return <div className="join join-vertical w-full">{children}</div>;
}

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function AccordionItem({ title, children, isOpen, setIsOpen }: AccordionItemProps) {
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