import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function isoToDisplay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function parseMeetingDate(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const display = [day, month, year].filter(Boolean).join("/");

  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return { display, iso: "" };
  }

  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  const parsed = new Date(yearNumber, monthNumber - 1, dayNumber);
  const valid =
    parsed.getFullYear() === yearNumber &&
    parsed.getMonth() === monthNumber - 1 &&
    parsed.getDate() === dayNumber;

  return { display, iso: valid ? `${year}-${month}-${day}` : "" };
}

type MeetingDateInputProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

export function MeetingDateInput({
  id = "data",
  label = "Data",
  value,
  onChange,
  required,
}: MeetingDateInputProps) {
  const [display, setDisplay] = useState(isoToDisplay(value));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ day: "", month: "", year: "" });
  const dayOptions = useMemo(() => Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0")), []);
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")), []);
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear() + 1;
    return Array.from({ length: currentYear - 2000 + 1 }, (_, index) => String(currentYear - index));
  }, []);

  useEffect(() => {
    setDisplay(isoToDisplay(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const digits = display.replace(/\D/g, "");
    setDraft({
      day: digits.slice(0, 2),
      month: digits.slice(2, 4),
      year: digits.slice(4, 8) || String(new Date().getFullYear()),
    });
  }, [display, open]);

  const updateDisplay = (raw: string) => {
    const parsed = parseMeetingDate(raw);
    setDisplay(parsed.display);
    onChange(parsed.iso);
  };

  const applyDraft = () => {
    updateDisplay(`${draft.day}${draft.month}${draft.year}`);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          inputMode="numeric"
          required={required}
          value={display}
          onChange={(event) => updateDisplay(event.target.value)}
          placeholder="DD/MM/AAAA"
          className="h-12 rounded-2xl border-border/60 bg-background/70 text-base"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0 rounded-2xl"
          onClick={() => setOpen(true)}
          aria-label="Abrir seletor de data"
        >
          <CalendarDays className="h-5 w-5" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-border/60 bg-background/98 p-4 shadow-[var(--shadow-card)]">
          <DialogHeader>
            <DialogTitle>Selecionar data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Dia</Label>
                <Select value={draft.day} onValueChange={(day) => setDraft((prev) => ({ ...prev, day }))}>
                  <SelectTrigger className="h-12 rounded-2xl">
                    <SelectValue placeholder="Dia" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {dayOptions.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mês</Label>
                <Select value={draft.month} onValueChange={(month) => setDraft((prev) => ({ ...prev, month }))}>
                  <SelectTrigger className="h-12 rounded-2xl">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {monthOptions.map((month) => (
                      <SelectItem key={month} value={month}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ano</Label>
                <Select value={draft.year} onValueChange={(year) => setDraft((prev) => ({ ...prev, year }))}>
                  <SelectTrigger className="h-12 rounded-2xl">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border border-border/55 bg-card/70 p-3 text-xs text-muted-foreground">
              Use dia, mês e ano para registrar a data da reunião.
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => updateDisplay("")}>
                Limpar
              </Button>
              <Button
                type="button"
                className="rounded-2xl"
                disabled={!draft.day || !draft.month || !draft.year}
                onClick={applyDraft}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
