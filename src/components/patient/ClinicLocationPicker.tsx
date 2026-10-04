import { Checkbox } from "@/components/ui/checkbox";
import { CLINIC_LOCATIONS, parseClinicLocations, serializeClinicLocations } from "@/lib/clinicLocations";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const ClinicLocationPicker = ({ value, onChange }: Props) => {
  const selected = parseClinicLocations(value);

  const toggle = (location: string, checked: boolean) => {
    const next = checked ? [...selected, location] : selected.filter((v) => v !== location);
    onChange(serializeClinicLocations(next));
  };

  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {CLINIC_LOCATIONS.map((l) => {
        const isChecked = selected.includes(l.value);
        return (
          <label
            key={l.value}
            className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors ${
              isChecked ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted/40"
            }`}
          >
            <Checkbox checked={isChecked} onCheckedChange={(c) => toggle(l.value, c === true)} />
            {l.label}
          </label>
        );
      })}
    </div>
  );
};

export default ClinicLocationPicker;
