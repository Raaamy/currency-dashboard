import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { useT } from '@/i18n';
import { METAL_UNITS, type MetalUnit } from '@/lib/assets';
import { useSettings } from '@/state/SettingsContext';

export interface UnitToggleProps {
  size: 'md' | 'sm';
}

/** `g | oz | kg` for the metals (SPEC §13), bound to `settings.metalUnit`. */
export function UnitToggle({ size }: UnitToggleProps) {
  const t = useT();
  const { metalUnit, setMetalUnit } = useSettings();
  const options: SegmentedOption<MetalUnit>[] = METAL_UNITS.map((unit) => ({
    value: unit,
    label: t(`unit.${unit}`),
  }));
  return (
    <Segmented
      options={options}
      value={metalUnit}
      onChange={setMetalUnit}
      label={t('metalsIn')}
      size={size}
    />
  );
}
