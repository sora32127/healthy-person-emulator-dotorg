import { useEffect, useState } from 'react';

const sections = [
  { id: 'section-post-type', label: '投稿タイプ' },
  { id: 'section-situation', label: '状況説明' },
  { id: 'section-reality-check', label: '現実直視' },
  { id: 'section-counterfactual', label: '反実仮想' },
  { id: 'section-tags', label: 'タグ選択' },
  { id: 'section-title', label: 'タイトル' },
];

export default function FormProgressBar() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = sections.findIndex((s) => s.id === entry.target.id);
            if (index !== -1) {
              setActiveIndex(index);
            }
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );

    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="hidden lg:block fixed right-8 top-1/3 z-10">
      <ul className="steps steps-vertical text-sm">
        {sections.map((section, index) => (
          <li key={section.id} className={`step ${index <= activeIndex ? 'step-primary' : ''}`}>
            <button
              type="button"
              onClick={() => {
                document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:underline text-left"
            >
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
