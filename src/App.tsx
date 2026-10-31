import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ConvertCard } from '@/components/Convert/ConvertCard';
import { TapHint } from '@/components/Convert/TapHint';
import { UnitToggle } from '@/components/Convert/UnitToggle';
import { ItemPicker } from '@/components/Picker/ItemPicker';
import { Results } from '@/components/Results/Results';
import { TopBar } from '@/components/TopBar/TopBar';
import { useElementWidth } from '@/components/ui/useElementWidth';
import { getItem } from '@/lib/assets';
import { useSettings } from '@/state/SettingsContext';

/**
 * Below this width of the content column the narrow form is used (SPEC §13): a 390 px phone
 * (358 px) is narrow; the foldable outer screen (442), inner screen (632) and the two-column
 * desktop are wide. In one column the convert card is as wide as the column.
 */
const COMPACT_BELOW = 400;

/**
 * The one screen (SPEC §13 "Screen"): top bar, convert card, results (or the edit list), the
 * item picker. Holds edit mode, the picker and the wide/narrow decision.
 */
export function App() {
  const { items, base } = useSettings();
  const columnsRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(columnsRef);
  const compact = width !== null && width < COMPACT_BELOW;
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusInputAfterSwitch = useRef(false);
  const hasMetal = items.some((code) => getItem(code).kind === 'metal');

  const toggleEdit = useCallback(() => setEditing((e) => !e), []);
  const openPicker = useCallback(() => setPickerOpen(true), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const doneButton = useCallback(() => editButtonRef.current, []);

  // A result activated from the keyboard unmounts (it became the base): focus the amount.
  useLayoutEffect(() => {
    if (!focusInputAfterSwitch.current) return;
    focusInputAfterSwitch.current = false;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [base]);

  return (
    <div className="app">
      <main className="layout">
        <TopBar
          compact={compact}
          unitToggle={!compact && hasMetal ? <UnitToggle size="md" /> : null}
        />
        <div ref={columnsRef} className="columns">
          <ConvertCard
            compact={compact}
            editing={editing}
            onToggleEdit={toggleEdit}
            editButtonRef={compact ? undefined : editButtonRef}
            onAdd={openPicker}
            inputRef={inputRef}
          />
          {compact ? <TapHint unitToggle={hasMetal ? <UnitToggle size="sm" /> : null} /> : null}
          <Results
            compact={compact}
            editing={editing}
            onToggleEdit={toggleEdit}
            editButtonRef={compact ? editButtonRef : undefined}
            doneButton={doneButton}
            onAdd={openPicker}
            onConverted={(fromKeyboard) => {
              focusInputAfterSwitch.current = fromKeyboard;
            }}
          />
        </div>
        <ItemPicker open={pickerOpen} onClose={closePicker} />
      </main>
    </div>
  );
}
