import { useEffect, useId, useRef, useState } from 'react';
import { AsYouType } from 'libphonenumber-js/core';
import { formatPhone, normalizePhone, phoneMetadata } from './domain';

function validate(input) {
  const value = input.value.trim();
  let message = '';
  if (!value && input.required) {
    message = 'Введите номер телефона.';
  } else if (value && !normalizePhone(value)) {
    message = 'Проверьте российский номер. Можно ввести 10 цифр без кода или начать с +7 или 8.';
  }
  input.setCustomValidity(message);
  return message;
}

function formatEdit(input, event) {
  const { value, selectionStart } = input;
  // Leave selections and middle edits to the native editor so the caret stays at the edited digit.
  if (event.isComposing || selectionStart !== value.length) return;
  if (event.inputType === 'deleteContentBackward') {
    const trimmed = value.replace(/[()\s-]+$/, '');
    if (trimmed !== value) input.value = trimmed;
    return;
  }
  if (!event.inputType?.startsWith('insert') || !/^(?:\+7)?[\d()\s-]+$/.test(value)) return;

  const digits = value.replace(/\D/g, '');
  if (digits.length > 11) return;
  // A national ten-digit number can itself start with 8. Keep the original digits while typing.
  if (event.inputType !== 'insertText' || event.data?.length > 1) {
    if (normalizePhone(value)) input.value = formatPhone(value);
    return;
  }
  if (!/^\d$/.test(event.data ?? '')) return;
  const formatted = new AsYouType('RU', phoneMetadata).input(value).replace(/[^\d]+$/, '');
  if (formatted !== value && formatted.replace(/\D/g, '') === digits && formatted.startsWith('+') === value.startsWith('+')) {
    input.value = formatted;
  }
}

export default function RussianPhoneInput({ defaultValue = '', name = 'phone', required = true }) {
  const inputRef = useRef(null);
  const errorId = useId();
  const [error, setError] = useState('');
  const reported = useRef(false);

  useEffect(() => { validate(inputRef.current); }, [required]);

  const report = event => {
    reported.current = true;
    setError(validate(event.currentTarget));
  };

  return <>
    <input ref={inputRef} name={name} type="tel" inputMode="tel" autoComplete="tel"
      required={required} placeholder="+7 (999) 123-45-67" defaultValue={formatPhone(defaultValue)}
      aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
      onChange={event => {
        const input = event.currentTarget;
        formatEdit(input, event.nativeEvent);
        const message = validate(input);
        if (reported.current) setError(message);
      }}
      onBlur={event => {
        const input = event.currentTarget;
        const formatted = formatPhone(input.value);
        if (formatted !== input.value) input.value = formatted;
        report(event);
      }}
      onInvalid={report}
    />
    {error && <span id={errorId} className="form-error" role="status">{error}</span>}
  </>;
}
