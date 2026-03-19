import { useFormContext } from 'react-hook-form';

export default function ErrorSummary() {
  const {
    formState: { errors },
  } = useFormContext();

  let errorCount = 0;

  if (errors.situations) {
    const situations = errors.situations as Record<string, { message?: string }>;
    for (const field of Object.values(situations)) {
      if (field?.message) errorCount++;
    }
  }
  if ((errors.reflection as { root?: { message?: string } })?.root?.message) errorCount++;
  if ((errors.counterReflection as { root?: { message?: string } })?.root?.message) errorCount++;
  if ((errors.note as { root?: { message?: string } })?.root?.message) errorCount++;
  if ((errors.title as { root?: { message?: string } })?.root?.message) errorCount++;

  if (errorCount === 0) return null;

  const handleScrollToFirstError = () => {
    const firstErrorElement = document.querySelector('.text-error');
    if (firstErrorElement) {
      firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="alert alert-error mb-6 cursor-pointer" onClick={handleScrollToFirstError}>
      <p className="font-bold">{errorCount}個のエラーがあります</p>
    </div>
  );
}
