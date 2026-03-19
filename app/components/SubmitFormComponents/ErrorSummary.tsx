import { useFormContext } from 'react-hook-form';

export default function ErrorSummary() {
  const {
    formState: { errors },
  } = useFormContext();

  const errorMessages: string[] = [];

  // situations errors
  if (errors.situations) {
    const situations = errors.situations as Record<string, { message?: string }>;
    for (const field of Object.values(situations)) {
      if (field?.message) {
        errorMessages.push(field.message);
      }
    }
  }

  // reflection errors
  if (errors.reflection) {
    const reflection = errors.reflection as { root?: { message?: string } };
    if (reflection.root?.message) {
      errorMessages.push(reflection.root.message);
    }
  }

  // counterReflection errors
  if (errors.counterReflection) {
    const counterReflection = errors.counterReflection as { root?: { message?: string } };
    if (counterReflection.root?.message) {
      errorMessages.push(counterReflection.root.message);
    }
  }

  // note errors
  if (errors.note) {
    const note = errors.note as { root?: { message?: string } };
    if (note.root?.message) {
      errorMessages.push(note.root.message);
    }
  }

  // title errors
  if (errors.title) {
    const title = errors.title as { root?: { message?: string } };
    if (title.root?.message) {
      errorMessages.push(title.root.message);
    }
  }

  if (errorMessages.length === 0) return null;

  return (
    <div className="alert alert-error mb-6">
      <div>
        <p className="font-bold">入力内容にエラーがあります</p>
        <ul className="list-disc list-inside mt-2">
          {errorMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
